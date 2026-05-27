# UniFlow — AI-Powered University Life Hub

> One message to manage your entire university life — schedules, budgets, assignments, scholarships, and study resources. Built for Malaysian university students.

## Architecture

```
UniFlow/
├── backend/           # FastAPI + Gemini + Bright Data
│   ├── app/
│   │   ├── main.py        # API endpoints (/api/parse, /api/scholarships, /api/resources)
│   │   ├── parser.py      # Gemini-powered NLP parser
│   │   ├── brightdata.py  # Bright Data web scraper
│   │   ├── models.py      # Pydantic schemas
│   │   └── config.py      # Settings
│   ├── requirements.txt
│   └── .env
├── frontend/          # Static HTML + Tailwind CSS
│   ├── index.html          # Landing page + onboarding
│   ├── js/
│   │   ├── store.js        # localStorage + API client
│   │   └── components/     # Shared UI (sidebar, header, bottomNav, tailwind)
│   └── screen/
│       ├── 01.html         # Hub Dashboard
│       ├── 02.html         # Schedule Calendar
│       ├── 03.html         # Study Resources (Bright Data)
│       ├── 05.html         # Assignments
│       ├── 06.html         # Group Projects
│       ├── 07.html         # Budget Tracker
│       ├── 08.html         # Scholarship Finder (Bright Data)
│       └── 09.html         # AI Command Hub (Chat)
```

## Quick Start

### Backend

```bash
cd backend

# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY and BRIGHTDATA_TOKEN

# 4. Run the server
uvicorn app.main:app --reload --port 8080
```

### Frontend

Open `frontend/index.html` in a browser, or serve with any static server:

```bash
cd frontend
python -m http.server 3000
# Visit http://localhost:3000
```

## Features

### 🤖 AI Command Hub (Screen 09)
Type naturally: *"calc quiz thursday 2pm, OS assignment due friday, spent RM15 on lunch"* — Gemini parses events, expenses, and reminders simultaneously.

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
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `BRIGHTDATA_TOKEN` | No | Bright Data SERP API token |
| `BRIGHTDATA_SERP_URL` | No | Bright Data SERP endpoint |

## Tech Stack

- **Backend:** FastAPI, Google Gemini 2.0 Flash, Bright Data
- **Frontend:** Tailwind CSS, Material Symbols, vanilla JS
- **Storage:** localStorage (client), in-memory cache (server)
- **LLM:** Google Gemini for NLP parsing
- **Web Data:** Bright Data for real-time scholarship/resource search

## License

MIT