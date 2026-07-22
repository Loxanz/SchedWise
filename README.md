# 📚 SchedWise: AI-Assisted Academic Task Schedule Management Application for CRMC Students

## 🎓 Project Overview

**SchedWise** is an AI-powered academic task scheduling and management application designed to help students of Cebu Roosevelt Memorial Colleges (CRMC) effectively organize their academic responsibilities, manage deadlines, prioritize tasks, and improve productivity.

The application leverages Artificial Intelligence (AI), calendar synchronization, smart notifications, conflict detection, and conversational assistance to provide students with an intelligent and user-friendly scheduling experience.

This project is developed as a **Capstone Project** for the Bachelor of Science in Information Technology program at Cebu Roosevelt Memorial Colleges.

---

## ✨ Key Features

### 📅 Schedule Management & Calendar Integration

* Create and manage academic schedules
* Add assignments, activities, and deadlines
* Calendar visualization
* Google Calendar synchronization
* Offline access to previously saved schedules

### 🤖 AI-Based Task Prioritization

* Intelligent task ranking based on:

  * Urgency
  * Deadline proximity
  * Importance
* Personalized scheduling recommendations

### ⚠️ Conflict Detection & Smart Notifications

* Detect overlapping schedules
* Identify duplicate tasks
* Generate schedule conflict alerts
* Automatic rescheduling suggestions
* Push notifications for:

  * Upcoming deadlines
  * Pending tasks
  * Schedule conflicts
  * Important academic events

### 💬 AI Chatbot Assistant

* Conversational schedule management
* Task creation and editing
* Deadline tracking assistance

### 🎙️ Multilingual Speech-to-Text

* Voice command support
* Multilingual speech recognition
* Hands-free schedule management

### 📸 Proof-Based Progress Validation

* Upload image evidence for completed tasks
* Progress monitoring system

### 🧠 AI Flashcard Generator

* Upload study materials:

  * Notes
  * Documents
  * PowerPoint presentations
* Automatically generate study flashcards
* Assist students in quiz and exam preparation

---

## 🛠️ Technology Stack

### Frontend

* React Native
* Expo

### Backend

* Supabase

  * Authentication
  * Database
  * Row Level Security (RLS)
  * Storage

### Artificial Intelligence

* Groq AI API
* Llama Model

### Notifications

* Firebase Cloud Messaging (FCM)

### Calendar Integration

* Google API

### Speech Processing

* Speech-to-Text API

### Storage & Synchronization

* Offline Local Storage
* Cloud Synchronization

---

## 🚀 Installation

### Prerequisites

* Node.js
* npm or yarn
* Expo CLI
* Supabase Project
* Google Calendar API Credentials
* Firebase Project (FCM)

### Clone Repository

```bash
git clone https://github.com/your-username/schedwise.git
```

```bash
cd schedwise
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

EXPO_PUBLIC_LLM_API_KEY=your_llm_api_key

EXPO_PUBLIC_FCM_PROJECT_ID=your_firebase_project_id
```

### Run Application

```bash
npx expo start
```

---

## 📖 Usage

1. Register or log in to your account.
2. Create academic schedules and tasks.
3. Synchronize schedules with Google Calendar.
4. Receive AI-generated task priorities.
5. Monitor deadlines through smart notifications.
6. Use the AI chatbot for schedule assistance.
7. Upload proof of completed activities.
8. Generate flashcards from study materials.
9. Track academic progress and productivity.

---

## 👨‍💻 Development Team

### Proponents

* Yves Thadeus Alimpos
* Nicole Rose Rosales
* John Michael Pelayo
* Jun Melencio Gomez