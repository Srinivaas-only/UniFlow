# UniFlow — Spectrum (UM Moodle) Importer V2

Chrome extension that reads data from UM's Moodle (spectrum.um.edu.my) and imports it into UniFlow.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

## Usage

1. Navigate to [spectrum.um.edu.my](https://spectrum.um.edu.my) and log in
2. Go to any supported page:
   - **Dashboard** — imports upcoming deadlines
   - **Course page** — imports assignments, quizzes, resources
   - **Calendar** — imports calendar events
   - **My Courses** — imports course list
   - **Single Assignment** — imports due date + status
3. Click the **UniFlow** extension icon in Chrome toolbar
4. Popup shows detected page type and item count
5. Click **Preview items** to see extracted data with checkboxes
6. Uncheck anything you don't want
7. Click **Import N selected** to send to backend
8. On UniFlow Schedule screen, click **Pull Spectrum** to merge into calendar

## Architecture

```
extension/
├── manifest.json          # Manifest V3 config
├── content.js             # Orchestrator — page detection + message dispatch
├── popup.html / popup.js  # Preview + commit UI (Midnight Amethyst themed)
├── lib/
│   ├── debug.js           # Debug logging + bundle export
│   ├── dateParser.js      # Deterministic Moodle date parsing
│   ├── classifier.js      # Moodle modtype → UniFlow type mapping
│   ├── dedupe.js          # Import history + dedup via chrome.storage
│   └── extractors.js      # 5 DOM extractors (dashboard, course, calendar, etc.)
├── icons/                 # 16/48/128px lavender U icons
└── README.md
```

## Debug Mode

1. Click the 🐛 icon in the popup header to enable debug mode
2. Open Chrome DevTools Console (F12) on any Spectrum page
3. All selector hits/misses logged with `[UniFlow DEBUG]` prefix
4. Full extraction payload dumped to console
5. Download icon appears — click to save a debug bundle JSON file

## Supported Pages

| Page | URL Pattern | Body Class | What's Extracted |
|------|-------------|------------|-----------------|
| Dashboard | `/my/` | `pagelayout-mydashboard` | Upcoming events with timestamps |
| Course | `/course/view.php?id=XXX` | `path-course-view` | Activities (assign, quiz, resource, etc.) |
| Calendar | `/calendar/` | `path-calendar` | Events with day timestamps |
| My Courses | `/my/courses.php` | `pagelayout-mycourses` | Course list (async loaded) |
| Assignment | `/mod/assign/` | `path-mod-assign` | Due date, status, grading |

## Requirements

- Chrome 100+ (Manifest V3)
- UniFlow backend running on `http://localhost:8000`
- Logged into spectrum.um.edu.my
