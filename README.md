# 📚 SchedWise: AI-Assisted Academic Task Schedule Management Application for CRMC Students

## 🎓 Project Overview

**SchedWise** is an AI-powered academic task scheduling and management application designed to help students of Cebu Roosevelt Memorial Colleges (CRMC) effectively organize their academic responsibilities, manage deadlines, prioritize tasks, and improve productivity.

The application leverages Artificial Intelligence (AI), calendar synchronization, smart notifications, conflict detection, and conversational assistance to provide students with an intelligent and user-friendly scheduling experience.

This project is developed as a **Capstone Project** for the Bachelor of Science in Information Technology program at Cebu Roosevelt Memorial Colleges.

---

## 🎯 Problem Statement

Many students struggle with:

* Overlapping schedules
* Missed deadlines
* Poor task prioritization
* Inefficient time management
* Lack of effective scheduling tools

SchedWise addresses these challenges by providing an intelligent scheduling platform that helps students manage academic activities more efficiently and effectively.

---

## ✨ Key Features

### 👤 User Registration & Profile Management

* Secure account registration and login
* User authentication and authorization
* Profile management
* Password recovery through email verification

### 📅 Schedule Management & Calendar Integration

* Create and manage academic schedules
* Add assignments, activities, and deadlines
* Calendar visualization
* Upload schedule-related files
* Google Calendar synchronization
* Offline access to previously saved schedules

### 🤖 AI-Based Task Prioritization

* Intelligent task ranking based on:

  * Urgency
  * Deadline proximity
  * Importance
  * Academic standing
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

* Large Language Model (LLM)-powered chatbot
* Conversational schedule management
* Task creation and editing
* Deadline tracking assistance
* Conflict detection support

### 🎙️ Multilingual Speech-to-Text

* Voice command support
* Multilingual speech recognition
* Hands-free schedule management

### 📸 Proof-Based Progress Validation

* Upload image evidence for completed tasks
* Progress monitoring system
* Improved accountability and task tracking

### 🧠 AI Flashcard Generator

* Upload study materials:

  * Notes
  * Documents
  * PowerPoint presentations
* Automatically generate study flashcards
* Assist students in quiz and exam preparation

---

## 🏗️ System Objectives

The system aims to:

* Improve student time management
* Reduce scheduling conflicts
* Increase academic productivity
* Enhance deadline awareness
* Support academic monitoring
* Provide intelligent scheduling assistance

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

* Large Language Model (LLM) API
* AI Task Prioritization Engine
* AI Flashcard Generation

### Notifications

* Firebase Cloud Messaging (FCM)

### Calendar Integration

* Google Calendar API

### Speech Processing

* Speech-to-Text API

### Storage & Synchronization

* Offline Local Storage
* Cloud Synchronization

---

## 📱 Core Modules

| Module              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| User Management     | Registration, login, authentication, profile management |
| Schedule Management | Academic schedules, deadlines, calendar view            |
| AI Prioritization   | Intelligent task ranking and recommendations            |
| Conflict Detection  | Schedule overlap detection and resolution               |
| Smart Notifications | Deadline reminders and alerts                           |
| AI Chatbot          | Conversational schedule assistant                       |
| Speech-to-Text      | Voice-enabled interaction                               |
| Progress Validation | Proof-based task completion                             |
| Flashcard Generator | AI-generated study flashcards                           |

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

## 🔄 Development Methodology

The project follows the **Agile Software Development Methodology** consisting of six development sprints:

### Sprint 1

* Requirement Gathering
* Planning
* UI/UX Design

### Sprint 2

* Authentication
* User Management
* Local Data Storage

### Sprint 3

* Schedule Management
* Calendar Integration
* Offline Functionality

### Sprint 4

* AI Task Prioritization
* Conflict Detection
* Notifications

### Sprint 5

* AI Chatbot Integration
* Speech-to-Text Features

### Sprint 6

* Progress Validation
* Testing
* Debugging
* Final Evaluation

---

## 🎯 Sustainable Development Goal (SDG)

This project supports:

### SDG 4 – Quality Education

SchedWise contributes to quality education by helping students effectively manage academic responsibilities, improve study habits, and enhance overall learning productivity.

---

## 👨‍💻 Development Team

### Proponents

* Yves Thadeus Alimpos
* Nicole Rose Rosales
* John Michael Pelayo
* Jun Melencio Gomez

### Adviser

* Hilarion Jr. Raganas

---

## 📄 License

This project is developed for academic and research purposes as part of the Capstone Project requirements of Cebu Roosevelt Memorial Colleges.

---

## 🌟 SchedWise

**Smart Scheduling. Better Time Management. Improved Academic Success.**
