# UniFlow — AI-Powered University Life Hub

> One message to manage your entire university life — schedules, budgets, assignments, scholarships, and study resources. Built for Malaysian university students.

## Architecture

```
UniFlow/
├── backend/           # FastAPI + OpenAI-compatible LLM + Bright Data
│   ├── app/
│   │   ├── main.py        # API endpoints (/api/parse, /api/scholarships, /api/resources)
│   │   ├── parser.py      # LLM-powered NLP parser
│   │   ├── brightdata.py  # Bright Data web scraper
│   │   ├── models.py      # Pydantic schemas
│   │   └── config.py      # Settings
│   ├── requirements.txt
│   └── .env               # API keys (not committed)
├── frontend/          # Static HTML + Tailwind CSS + Firebase SDK
│   ├── index.html          # Landing page + onboarding
│   ├── js/
│   │   ├── firebase.js    # Firebase config (public, shared across team)
│   │   ├── store.js       # localStorage + Firestore sync + API client
│   │   └── components/    # Shared UI (sidebar, header, bottomNav, tailwind)
│   └── screen/
│       ├── login.html      # Login page
│       ├── signup.html     # Signup page
│       ├── 01.html         # Hub Dashboard
│       ├── 02.html         # Schedule Calendar
│       ├── 03.html         # Study Resources (Bright Data)
│       ├── 04.html         # Data Structures Vault
│       ├── 05.html         # Assignments
│       ├── 06.html         # Group Projects
│       ├── 07.html         # Budget Tracker
│       ├── 08.html         # Scholarship Finder (Bright Data)
│       └── 09.html         # AI Command Hub (Chat)
├── firestore.rules        # Firestore security rules (reference copy)
```

## Quick Start

### 1. Firebase Setup (one-time, project owner)

```bash
# 1. Create a Firebase project at https://console.firebase.google.com
# 2. Enable Authentication → Email/Password sign-in method
# 3. Create Firestore Database (start in test mode, then apply rules)
# 4. Copy your Firebase config to frontend/js/firebase.js
# 5. Apply security rules: Firestore → Rules tab → paste contents of firestore.rules
```

> **Note:** This is done once by whoever sets up the project. Teammates just `git pull` and the Firebase config is already there. Firebase API keys are public-safe — security comes from Firestore rules.

### 2. Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env — add your API keys (Groq, DeepSeek, or any OpenAI-compatible provider)

# Run the server
python -m uvicorn app.main:app --reload --port 8080
```

### 3. Frontend

Open `frontend/screen/login.html` in a browser, or serve with any static server:

```bash
cd frontend
python -m http.server 3000
# Visit http://localhost:3000/screen/login.html
```

## Features

### 🔐 Authentication & Cloud Sync
Firebase Auth for login/signup. Firestore cloud sync — data follows the user across devices and sessions. Auth guards protect all dashboard pages. Each user's data is isolated with Firestore security rules.

### 🤖 AI Command Hub (Screen 09)
Type naturally: *"calc quiz thursday 2pm, OS assignment due friday, spent RM15 on lunch"* — LLM parses events, expenses, and reminders simultaneously.

### 📅 Smart Schedule (Screen 02)
Weekly calendar grid with time slots, color-coded events by type, month view toggle, overlap detection, and event modal with edit/delete.

### 📊 Hub Dashboard (Screen 01)
Dynamic greeting, next event countdown, stats (exams/assignments/budget/streak), upcoming events list, weekly activity chart, quick actions.

### 💰 Budget Tracker (Screen 07)
Auto-categorized expenses, budget limit with progress bar, category breakdown, spending insights.

### 📝 Assignments (Screen 05)
Priority-sorted list with overdue/today/this-week badges, completion tracking, progress stats.

### 🎓 Scholarship Finder (Screen 08)
Bright Data searches the web for real Malaysian scholarships. Sort by match/amount/deadline. Save favorites. Auto-add deadline reminders.

### 📚 Study Resources (Screen 03)
Bright Data finds past papers, notes, textbooks, and video tutorials. Filter by type. Save favorites.

### 👥 Group Projects (Screen 06)
Create groups, manage members, assign tasks, track completion progress.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse` | POST | Parse natural language to structured events |
| `/api/scholarships` | POST | Search scholarships via Bright Data |
| `/api/resources` | POST | Search study resources via Bright Data |
| `/api/uni-scrape` | POST | Scrape university calendar |
| `/health` | GET | Health check with cache stats |

### Parse Example

```json
// POST /api/parse
{ "message": "calc quiz thursday 2pm, OS assignment due friday" }

// Response
{
  "events": [
    { "title": "Calculus Quiz", "date": "2026-05-28", "time": "14:00", "type": "exam" },
    { "title": "OS Assignment Due", "date": "2026-05-29", "time": null, "type": "assignment" }
  ]
}
```

### Event Types

| Type | Examples |
|------|----------|
| `exam` | tests, quizzes, midterms, finals |
| `assignment` | homework, labs, reports, projects |
| `meeting` | FYP meetings, consultations |
| `class` | lectures, tutorials, labs |
| `expense` | spending, purchases |
| `deadline` | submission deadlines |
| `reminder` | personal reminders |
| `social` | dinners, hangouts |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | API key (works with Groq, DeepSeek, or any OpenAI-compatible provider) |
| `DEEPSEEK_BASE_URL` | No | API base URL (default: https://api.deepseek.com, use https://api.groq.com/openai/v1 for Groq) |
| `DEEPSEEK_MODEL` | No | Model name (default: deepseek-chat, use llama-3.3-70b-versatile for Groq) |
| `BRIGHTDATA_API_KEY` | No | Bright Data API key for scholarship/resource search |

## Tech Stack

- **Backend:** FastAPI, OpenAI-compatible LLM (Groq / DeepSeek / etc.), Bright Data
- **Frontend:** Tailwind CSS, Material Symbols, vanilla JS
- **Cloud Services:** Firebase Auth (authentication), Firestore (database)
- **Storage:** localStorage (client) + Firestore (cloud sync), in-memory cache (server — planned)
- **LLM:** OpenAI-compatible API for NLP parsing
- **Web Data:** Bright Data for real-time scholarship/resource search

## License

MIT