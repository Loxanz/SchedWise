import { File } from "expo-file-system";
import JSZip from "jszip";
import * as XLSX from "xlsx";

const MAX_EXTRACTED_CHARACTERS = 200000;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "log",
  "rtf",
  "xml",
  "html",
  "htm",
]);

const ZIP_OFFICE_EXTENSIONS = new Set(["docx", "pptx", "xlsx", "odt", "odp", "ods"]);
const LEGACY_OFFICE_EXTENSIONS = new Set(["doc", "ppt", "xls"]);
const SPREADSHEET_EXTENSIONS = new Set(["xls", "xlsx", "csv", "ods"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"]);

const ALL_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
];

export const FLASHCARD_UPLOAD_TYPES = ["*/*", ...ALL_DOCUMENT_MIME_TYPES];

const getFileExtension = (fileName = "") => {
  const parts = String(fileName).toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const normalizeExtractedText = (text) => {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const truncateText = (text) => {
  if (text.length <= MAX_EXTRACTED_CHARACTERS) {
    return text;
  }

  return `${text.slice(0, MAX_EXTRACTED_CHARACTERS)}\n\n[Content truncated for AI processing.]`;
};

const ensureReadableText = (text, fileLabel) => {
  const normalized = normalizeExtractedText(text);

  if (!normalized || normalized.length < 20) {
    throw new Error(
      `Could not extract enough readable text from ${fileLabel}. Try a clearer document or a .txt copy of your notes.`
    );
  }

  return truncateText(normalized);
};

const readFileArrayBuffer = async (uri) => {
  const file = new File(uri);
  const bytes = await file.bytes();

  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
};

const readTextFile = async (uri) => {
  const file = new File(uri);
  const text = await file.text();
  return normalizeExtractedText(text);
};

const stripXmlText = (xml) => {
  return String(xml || "")
    .replace(/<a:t[^>]*>/g, "")
    .replace(/<\/a:t>/g, "")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<text[^>]*>/g, "")
    .replace(/<\/text>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const stripRtfText = (rtf) => {
  return String(rtf || "")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\line/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, "")
    .trim();
};

const loadZipArchive = async (arrayBuffer) => {
  return JSZip.loadAsync(arrayBuffer);
};

const extractDocxText = async (arrayBuffer) => {
  const zip = await loadZipArchive(arrayBuffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    return "";
  }

  const documentXml = await documentFile.async("string");
  return stripXmlText(documentXml);
};

const extractPptxText = async (arrayBuffer) => {
  const zip = await loadZipArchive(arrayBuffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (slidePaths.length === 0) {
    return "";
  }

  const slideTexts = await Promise.all(
    slidePaths.map(async (path) => {
      const slideXml = await zip.file(path).async("string");
      return stripXmlText(slideXml);
    })
  );

  return slideTexts.filter(Boolean).join("\n\n");
};

const extractOdtText = async (arrayBuffer) => {
  const zip = await loadZipArchive(arrayBuffer);
  const contentFile = zip.file("content.xml");

  if (!contentFile) {
    return "";
  }

  const contentXml = await contentFile.async("string");
  return stripXmlText(contentXml);
};

const extractXlsxText = async (arrayBuffer) => {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_txt(sheet);
      return sheetText ? `${sheetName}\n${sheetText}` : "";
    })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "";
  }
};

const extractZipOfficeText = async (arrayBuffer) => {
  const zip = await loadZipArchive(arrayBuffer);
  const paths = Object.keys(zip.files);

  if (paths.some((path) => path.startsWith("word/"))) {
    return extractDocxText(arrayBuffer);
  }

  if (paths.some((path) => path.startsWith("ppt/"))) {
    return extractPptxText(arrayBuffer);
  }

  if (paths.some((path) => path.startsWith("xl/"))) {
    return extractXlsxText(arrayBuffer);
  }

  if (paths.includes("content.xml")) {
    return extractOdtText(arrayBuffer);
  }

  return "";
};

const extractLegacyBinaryText = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const latinChunks = [];
  const utf16Chunks = [];
  let latinChunk = "";
  let utf16Chunk = "";

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    const isPrintableLatin =
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126);

    latinChunk += isPrintableLatin ? String.fromCharCode(byte) : " ";
    if (!isPrintableLatin) {
      if (latinChunk.trim().length >= 4) {
        latinChunks.push(latinChunk.trim());
      }
      latinChunk = "";
    }
  }

  if (latinChunk.trim().length >= 4) {
    latinChunks.push(latinChunk.trim());
  }

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] | (bytes[index + 1] << 8);
    const isPrintableUtf16 =
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255);

    utf16Chunk += isPrintableUtf16 ? String.fromCharCode(code) : " ";
    if (!isPrintableUtf16) {
      if (utf16Chunk.trim().length >= 4) {
        utf16Chunks.push(utf16Chunk.trim());
      }
      utf16Chunk = "";
    }
  }

  if (utf16Chunk.trim().length >= 4) {
    utf16Chunks.push(utf16Chunk.trim());
  }

  const combined = [...latinChunks, ...utf16Chunks]
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length >= 4)
    .join("\n");

  return normalizeExtractedText(combined);
};

const isZipArchive = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
};

const isPdfFile = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
};

const extractByExtension = async (extension, arrayBuffer, mimeType) => {
  if (PDF_EXTENSIONS.has(extension) || mimeType === "application/pdf") {
    return extractLegacyBinaryText(arrayBuffer);
  }

  if (extension === "docx" || ZIP_OFFICE_EXTENSIONS.has(extension)) {
    if (extension === "pptx") {
      return extractPptxText(arrayBuffer);
    }

    if (SPREADSHEET_EXTENSIONS.has(extension)) {
      return extractXlsxText(arrayBuffer);
    }

    if (extension === "odt" || extension === "odp" || extension === "ods") {
      return extractOdtText(arrayBuffer);
    }

    return extractDocxText(arrayBuffer);
  }

  if (LEGACY_OFFICE_EXTENSIONS.has(extension)) {
    return extractLegacyBinaryText(arrayBuffer);
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return extractXlsxText(arrayBuffer);
  }

  if (extension === "rtf" || mimeType === "application/rtf") {
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(arrayBuffer)
    );
    return stripRtfText(rawText);
  }

  return "";
};

export const extractTextFromUploadedFile = async (file) => {
  if (!file?.uri) {
    throw new Error("No file was provided.");
  }

  const fileName = file.name || "uploaded-file";
  const mimeType = String(file.mimeType || "").toLowerCase();
  const extension = getFileExtension(fileName);

  if (IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith("image/")) {
    throw new Error(
      "Image files cannot be converted to text flashcards yet. Upload a PDF, Word, PowerPoint, Excel, or text study file."
    );
  }

  if (
    TEXT_EXTENSIONS.has(extension) ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  ) {
    const text =
      extension === "rtf"
        ? stripRtfText(await readTextFile(file.uri))
        : await readTextFile(file.uri);

    return {
      fileName,
      text: ensureReadableText(text, fileName),
    };
  }

  const arrayBuffer = await readFileArrayBuffer(file.uri);
  let extractedText = await extractByExtension(extension, arrayBuffer, mimeType);

  if (!extractedText && isZipArchive(arrayBuffer)) {
    extractedText = await extractZipOfficeText(arrayBuffer);
  }

  if (!extractedText && isPdfFile(arrayBuffer)) {
    extractedText = extractLegacyBinaryText(arrayBuffer);
  }

  if (!extractedText) {
    extractedText = extractLegacyBinaryText(arrayBuffer);
  }

  return {
    fileName,
    text: ensureReadableText(extractedText, fileName),
  };
};
