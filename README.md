# 🎓 UniFlow — AI-Powered University Life Hub

> **One message to manage your entire university life** — schedules, budgets, assignments, scholarships, and study resources. Built for Malaysian university students.

[![Tech Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![Tech Stack](https://img.shields.io/badge/Frontend-Tailwind_CSS-38B2AC?style=flat-square)](https://tailwindcss.com/)
[![Tech Stack](https://img.shields.io/badge/AI-DeepSeek_%7C_Groq-6366F1?style=flat-square)](https://deepseek.com/)
[![Tech Stack](https://img.shields.io/badge/Cloud-Firebase-FFCA28?style=flat-square)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 🎯 The Problem

University students juggle **classes, assignments, expenses, scholarships, and group projects** — all scattered across different apps, calendars, and sticky notes. There's no single tool that understands natural language and manages everything in one place.

## 💡 The Solution

**UniFlow** is an AI-powered hub where you type naturally:

> *"calc quiz thursday 2pm, OS assignment due friday, spent RM15 on lunch"*

The AI parses your message into structured events, expenses, and reminders — all saved and synced to the cloud. No forms, no tapping through menus. Just type.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Command Hub** | Type naturally — LLM parses events, expenses, reminders simultaneously |
| 📅 **Smart Schedule** | Weekly calendar with color-coded events, countdown timers, month view |
| 📊 **Hub Dashboard** | Dynamic greeting, stats, upcoming events, weekly activity, quick actions |
| 💰 **Budget Tracker** | Auto-categorized expenses, budget limits, spending insights |
| 📝 **Assignments** | Priority-sorted with overdue badges, completion tracking |
| 🎓 **Scholarship Finder** | Real Malaysian scholarships via Bright Data web search |
| 📚 **Study Resources** | Past papers, notes, textbooks found via Bright Data |
| 👥 **Group Projects** | Create groups, assign tasks, track progress |
| 🔐 **Auth & Cloud Sync** | Firebase Auth + Firestore — data follows you across devices |

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  LLM (AI)    │
│  HTML/JS/    │     │   FastAPI    │     │ DeepSeek /   │
│  Tailwind    │     │              │     │ Groq         │
│              │     │              │────▶│ Bright Data  │
│              │────▶│  Firebase    │     │ (Web Search) │
│              │     │  Auth +      │     └──────────────┘
│              │     │  Firestore   │
└──────────────┘     └──────────────┘
```

```
UniFlow/
├── backend/               # FastAPI + LLM + Bright Data
│   ├── app/
│   │   ├── main.py        # API endpoints
│   │   ├── parser.py      # LLM-powered NLP parser
│   │   ├── brightdata.py  # Bright Data web scraper
│   │   ├── models.py      # Pydantic schemas
│   │   └── config.py      # Settings
│   ├── requirements.txt
│   └── .env.example
├── frontend/              # Static HTML + Tailwind CSS + Firebase SDK
│   ├── index.html         # Landing page
│   ├── js/
│   │   ├── firebase.js    # Firebase config
│   │   ├── store.js       # localStorage + Firestore sync + API client
│   │   └── components/    # Shared UI (header, sidebar, bottomNav, toast)
│   └── screen/
│       ├── login.html     # Authentication
│       ├── signup.html    # Registration
│       ├── 01.html        # Hub Dashboard
│       ├── 02.html        # Schedule Calendar
│       ├── 03.html        # Study Resources
│       ├── 04.html        # Data Structures Vault
│       ├── 05.html        # Assignments
│       ├── 06.html        # Group Projects
│       ├── 07.html        # Budget Tracker
│       ├── 08.html        # Scholarship Finder
│       ├── 09.html        # AI Command Hub
│       ├── profile.html   # User Profile
│       ├── settings.html  # App Settings
│       └── help.html      # Help & FAQ
└── firestore.rules        # Firestore security rules
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- A Firebase project (free)
- API key for DeepSeek or Groq (free tier available)

### 1. Firebase Setup (one-time)

```bash
# 1. Create a Firebase project at https://console.firebase.google.com
# 2. Enable Authentication → Email/Password
# 3. Create Firestore Database (start in test mode)
# 4. Copy your Firebase config to frontend/js/firebase.js
# 5. Apply security rules from firestore.rules
```

> Firebase API keys are **public-safe** — security comes from Firestore rules.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Set up API keys
cp .env.example .env
# Edit .env — add your DeepSeek or Groq API key

# Start the server
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
python -m http.server 3000
# Visit http://localhost:3000
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/parse` | POST | Parse natural language → structured events |
| `POST /api/scholarships` | POST | Search scholarships via Bright Data |
| `POST /api/resources` | POST | Search study resources via Bright Data |
| `GET /health` | GET | Health check |

### Parse Example

```json
// POST /api/parse
{ "message": "calc quiz thursday 2pm, spent RM15 on lunch" }

// Response
{
  "events": [
    { "title": "Calculus Quiz", "date": "2026-05-28", "time": "14:00", "type": "exam" },
    { "title": "Lunch", "date": "2026-05-28", "amount": "RM 15", "type": "expense" }
  ]
}
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Tailwind CSS, Material Symbols, Vanilla JS | Responsive dark-themed UI |
| **Backend** | FastAPI (Python) | REST API server |
| **AI** | DeepSeek / Groq (OpenAI-compatible) | Natural language processing |
| **Web Data** | Bright Data | Real-time scholarship & resource search |
| **Auth** | Firebase Authentication | Email/password login |
| **Database** | Firestore + localStorage | Cloud sync with offline support |

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | API key (works with Groq, DeepSeek, or any OpenAI-compatible provider) |
| `DEEPSEEK_BASE_URL` | No | Default: `https://api.deepseek.com` (use `https://api.groq.com/openai/v1` for Groq) |
| `DEEPSEEK_MODEL` | No | Default: `deepseek-chat` (use `llama-3.3-70b-versatile` for Groq) |
| `BRIGHTDATA_API_KEY` | No | Required for scholarship/resource search |

---

## 🎥 Demo Flow

1. **Landing page** → Click "Get Started"
2. **Sign up** → Create account with email/password
3. **Dashboard** → See greeting, stats, upcoming events
4. **AI Command Hub** → Type *"OS quiz friday 3pm, spent RM8 on coffee"*
5. **Schedule** → See AI-parsed events in calendar
6. **Budget** → Track auto-categorized expenses
7. **Scholarship Finder** → Search real Malaysian scholarships
8. **Profile** → View stats, edit info

---

## 📄 License

MIT