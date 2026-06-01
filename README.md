<div align="center">

# 🎓 UniFlow

### AI-Powered University Life Hub

**One message to manage your entire university life.**

Schedule · Budget · Assignments · Scholarships · Internships · Resources · Group Projects

[![Live Demo](https://img.shields.io/badge/Live-Demo-8B5CF6?style=for-the-badge&logo=vercel&logoColor=white)](https://frontend-six-swart-83.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![AI](https://img.shields.io/badge/AI-Groq_LLaMA_3.3-6366F1?style=flat-square)](https://groq.com/)
[![Cloud](https://img.shields.io/badge/Cloud-Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Web Data](https://img.shields.io/badge/Web_Data-Bright_Data-FF6B35?style=flat-square)](https://brightdata.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

<!-- ![UniFlow Screenshot](docs/screenshot.png) -->
*<sub>↑ Screenshot placeholder — drop your screenshot into <code>docs/screenshot.png</code></sub>*

</div>

---

## 🧠 What is UniFlow?

UniFlow is an AI-powered university companion built for **1.4 million Malaysian university students**. Instead of juggling five different apps for schedules, budgets, assignments, and scholarships, students just **type naturally** — like texting a friend:

> *"calc quiz thursday 2pm, spent RM15 on lunch, find me CS scholarships"*

UniFlow's AI parses that single message into structured calendar events, expense logs, and scholarship searches — all in one shot. No forms. No menus. Just type.

Built on the **Midnight Amethyst** design system (dark theme, lavender accents, glassmorphism), UniFlow feels like a premium consumer app — not a university tool. It ships with a **Chrome extension** that imports courses, assignments, and study materials directly from **UM Spectrum (Moodle)**, so students never manually enter anything their LMS already knows.

---

## ✨ Key Features

- 🤖 **AI Command Hub** — Natural language → structured events, expenses, reminders via Groq LLM (function calling)
- 📅 **Smart Schedule** — Week/month views, countdown timers, all-day events, Spectrum sync, UM academic calendar
- 📝 **Assignment Tracking** — Auto-detect overdue/this-week/no-date, Spectrum import, completion tracking
- 📚 **Study Resources** — Spectrum-imported materials, auto-classified by file type (PDF, slides, docs, links, quizzes)
- 💰 **Budget Tracking** — Category bars, weekly trend chart, budget limits, color-coded progress
- 🎓 **Scholarship Finder** — 4 parallel Bright Data SERP queries, match scoring, save & compare
- 💼 **Internship Finder** — 8 parallel SERP queries with tier-1 company boost, Groq LLM extraction, diversity capping
- 👥 **Group Projects** — Create groups, assign members, task boards with progress tracking
- 🧩 **Chrome Extension** — Reads UM Spectrum (Moodle/Moove) DOM, imports courses + assignments + resources with preview-before-commit UX
- 🔐 **Firebase Auth + Firestore** — Cloud sync across devices, offline-first with localStorage

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User                                         │
│                   (Browser / Chrome)                                │
└──────────┬────────────────────────────────────┬─────────────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────┐           ┌──────────────────────────┐
│   Chrome Extension   │           │     Frontend (Vercel)    │
│   Manifest V3        │──bridge──▶│   HTML + Tailwind + JS   │
│   Spectrum DOM Scraper│           │   Firebase Auth + Store  │
└──────────────────────┘           └──────────┬───────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │   Backend (FastAPI)   │
                                   │   Python 3.10+        │
                                   └──┬───────┬───────────┘
                                      │       │
                          ┌───────────┘       └────────────┐
                          ▼                                 ▼
               ┌──────────────────┐              ┌──────────────────┐
               │  Groq LLM API    │              │  Bright Data     │
               │  llama-3.3-70b   │              │  SERP API        │
               │  (NLP parsing)   │              │  (Web search)    │
               └──────────────────┘              └──────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for Vercel CLI, optional)
- **Firebase project** — [Create one free](https://console.firebase.google.com)
- **Groq API key** — [Get one free](https://console.groq.com)
- **Bright Data account** — [Sign up](https://brightdata.com) (for Scholarships/Internships)
- **Chrome** (for extension)

### 1. Clone the Repo

```bash
git clone https://github.com/Srinivaas-only/UniFlow.git
cd UniFlow
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys (see Environment Variables below)

# Start the server
python -m uvicorn app.main:app --reload --port 8000
```

Server runs at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/health
```

### 3. Frontend Setup

```bash
cd frontend

# Serve locally (no build step — it's static HTML)
python -m http.server 3000
```

Visit [http://localhost:3000](http://localhost:3000). The frontend auto-detects the backend at `localhost:8000`.

### 4. Chrome Extension

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `/extension` folder
5. Navigate to [spectrum.um.edu.my](https://spectrum.um.edu.my) and click the UniFlow extension icon

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Required — AI parsing, internship extraction
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Bright Data — scholarship & internship search
BRIGHTDATA_API_KEY=Bearer_xxxxxxxxxxxxxxxxxxxx
BRIGHTDATA_ZONE=serp_api1

# Groq config (defaults shown)
DEEPSEEK_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx       # same as GROQ_API_KEY
DEEPSEEK_BASE_URL=https://api.groq.com/openai/v1
DEEPSEEK_MODEL=llama-3.3-70b-versatile
```

> **Note:** Firebase config lives in `frontend/js/firebase.js` — these keys are public-safe. Security is enforced via Firestore rules.

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/parse` | Natural language → structured events & expenses |
| `POST` | `/api/scholarships` | Bright Data scholarship search (4 parallel queries) |
| `POST` | `/api/internships` | Bright Data internship search (8 parallel queries + LLM extraction) |
| `POST` | `/api/uni-scrape` | UM academic calendar scraping |
| `POST` | `/api/spectrum-import` | Chrome extension Moodle data import |
| `POST` | `/api/resources` | Study resource search (deprecated — Spectrum import preferred) |
| `GET` | `/health` | Health check & config status |

### Parse Example

```json
// POST /api/parse
{ "message": "calc quiz thursday 2pm, spent RM15 on lunch" }

// Response
{
  "events": [
    { "title": "Calculus Quiz", "date": "2026-06-04", "time": "14:00", "type": "exam" },
    { "title": "Lunch", "date": "2026-06-01", "amount": "RM 15", "type": "expense", "category": "food" }
  ]
}
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Vanilla HTML, Tailwind CSS, Firebase SDK | Zero-build static SPA |
| **Backend** | FastAPI, Python 3.10+ | REST API server |
| **AI / LLM** | Groq `llama-3.3-70b-versatile` (function calling) | NLP parsing, data extraction |
| **Web Data** | Bright Data SERP API | Real-time scholarship & internship search |
| **Auth & DB** | Firebase Auth + Firestore | Cloud sync, offline-first |
| **Extension** | Chrome Manifest V3 | Spectrum (Moodle) DOM scraping |
| **Hosting** | Vercel (frontend) + local (backend) | Production deployment |

---

## 📁 Project Structure

```
UniFlow/
├── backend/                    # FastAPI + Groq + Bright Data
│   ├── app/
│   │   ├── main.py             # API endpoints, rate limiting
│   │   ├── parser.py           # LLM-powered NLP parser
│   │   ├── brightdata.py       # Bright Data SERP + Web Unlocker
│   │   ├── spectrum_processor.py # Chrome extension data pipeline
│   │   ├── models.py           # Pydantic request/response schemas
│   │   └── config.py           # Settings & env vars
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # Static HTML + Tailwind CSS + Firebase
│   ├── index.html              # Landing page
│   ├── favicon.svg             # UniFlow icon
│   ├── theme.css               # Midnight Amethyst design tokens
│   ├── vercel.json             # Vercel deployment config
│   ├── js/
│   │   ├── firebase.js         # Firebase config (public-safe)
│   │   ├── store.js            # Data layer (localStorage + Firestore sync + API client)
│   │   └── components/         # Shared UI modules
│   │       ├── sidebar.js      # Navigation sidebar
│   │       ├── header.js       # Page header
│   │       ├── bottomNav.js    # Mobile bottom navigation
│   │       ├── modal.js        # Modal dialogs
│   │       ├── toast.js        # Toast notifications
│   │       ├── notifications.js # Notification center
│   │       ├── authGuard.js    # Firebase auth gate
│   │       ├── loading.js      # Loading spinners
│   │       ├── validation.js   # Input validation
│   │       └── tailwind.js     # Tailwind config (dark theme)
│   └── screen/
│       ├── login.html          # Sign in
│       ├── signup.html         # Sign up
│       ├── 01.html             # Hub Dashboard
│       ├── 02.html             # Schedule Calendar
│       ├── 03.html             # Study Resources
│       ├── 04.html             # Data Structures Vault
│       ├── 05.html             # Assignments
│       ├── 06.html             # Group Projects
│       ├── 07.html             # Budget Tracker
│       ├── 08.html             # Scholarship Finder
│       ├── 09.html             # AI Command Hub
│       ├── internships.html    # Internship Finder
│       ├── profile.html        # User Profile
│       ├── settings.html       # App Settings
│       └── help.html           # Help & FAQ
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Extension config
│   ├── popup.js                # Extension popup UI
│   ├── popup.html              # Extension popup HTML
│   ├── content.js              # Content script (Spectrum DOM)
│   ├── web_bridge.js           # Bridge between extension & web app
│   ├── background.js           # Service worker
│   └── lib/
│       └── extractors.js       # 5 page-type extractors
└── firestore.rules             # Firestore security rules
```

---

## 🧩 Chrome Extension — Spectrum Import

The UniFlow Chrome Extension reads the **UM Spectrum (Moodle, Moove theme)** DOM when a student visits their LMS. It handles **5 page types**:

| Page Type | URL Pattern | What It Extracts |
|-----------|-------------|-----------------|
| **Dashboard** | `/my/` | All enrolled courses with codes |
| **Course Page** | `/course/view.php?id=` | Assignments, quizzes, resources, URLs, folders |
| **Calendar** | `/calendar/view.php` | Events with dates, course codes, descriptions |
| **My Courses** | `/my/courses.php` | Course list with codes and semesters |
| **Single Assignment** | `/mod/assign/view.php` | Title, due date, submission status, description |

**Flow:** Extension scrapes DOM → sends to backend `/api/spectrum-import` → deterministic processing + optional LLM enrichment → returns structured events + resources → frontend shows preview → user confirms merge into their data.

---

## 🏆 Built For

**[Bright Data "Web Data UNLOCKED" Hackathon 2026](https://brightdata.com/hackathon)**

- **Track 1 — GTM Intelligence:** Scholarship Finder uses 4 parallel Bright Data SERP queries to surface real Malaysian scholarships with match scoring.
- **Track 2 — Finance & Market Intelligence:** Internship Finder uses 8 parallel SERP queries with Groq LLM extraction and tier-1 company boosting to find the best opportunities.

---

## 👥 Team

| Member | Role |
|--------|------|
| **Srinivaas (Vaas)** | Full-stack development, AI integration, Chrome extension |
| **Isaac** | Design, product strategy, user research |

Both Year 1 Computer Science @ **Universiti Malaya** 🇲🇾

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [**Bright Data**](https://brightdata.com) — SERP API powering scholarship & internship search
- [**Groq**](https://groq.com) — Lightning-fast LLM inference for natural language parsing
- [**Firebase**](https://firebase.google.com) — Auth, Firestore, cloud infrastructure
- [**Anthropic Claude**](https://claude.ai) — AI-assisted development
- [**FastAPI**](https://fastapi.tiangolo.com) — Modern Python web framework
- [**Tailwind CSS**](https://tailwindcss.com) — Utility-first CSS framework

---

<div align="center">

**[⬆ Back to Top](#-uniflow)**

</div>
