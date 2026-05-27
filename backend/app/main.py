import logging
import re
import time
import traceback

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.models import (
    ParseRequest, ParseResponse,
    ScholarshipProfile, ScholarshipResponse, ScholarshipResult,
    ResourceRequest, ResourceResponse, ResourceResult,
    UniCalendarRequest, UniCalendarResponse, CalendarEvent,
)
from app.parser import parse_events
from app.brightdata import serp_search, web_unlock

app = FastAPI(
    title="UniFlow Parser API",
    version="0.2.0",
    description="UniFlow backend — AI parsing, scholarship finder, resource search, uni calendar scraping.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("uniflow")

# ── Simple in-memory rate limiter ──
_rate_limits: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 20     # requests per window


def _check_rate_limit(ip: str):
    now = time.time()
    hits = _rate_limits.get(ip, [])
    hits = [t for t in hits if now - t < RATE_LIMIT_WINDOW]
    if len(hits) >= RATE_LIMIT_MAX:
        return False
    hits.append(now)
    _rate_limits[ip] = hits
    return True


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    if request.url.path.startswith("/api/") and not _check_rate_limit(ip):
        logger.warning(f"Rate limited: {ip} on {request.url.path}")
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please wait a moment."})
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed:.2f}s)")
    return response


# ──────────────────────────────────────────────
#  GET /health
# ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "deepseek_configured": bool(settings.DEEPSEEK_API_KEY),
        "brightdata_configured": bool(settings.BRIGHTDATA_API_KEY),
    }


# ──────────────────────────────────────────────
#  POST /api/parse — AI event/expense parser
# ──────────────────────────────────────────────
@app.post("/api/parse", response_model=ParseResponse)
async def parse(request: ParseRequest) -> ParseResponse:
    """Parse a natural language message and return structured event data."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY is not configured.",
        )
    try:
        events = await parse_events(request.message)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    return ParseResponse(events=events)


# ──────────────────────────────────────────────
#  POST /api/scholarships — Bright Data search
# ──────────────────────────────────────────────
@app.post("/api/scholarships", response_model=ScholarshipResponse)
async def scholarships(profile: ScholarshipProfile) -> ScholarshipResponse:
    """Search for Malaysian scholarships using Bright Data SERP API."""
    if not settings.BRIGHTDATA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BRIGHTDATA_API_KEY is not configured.",
        )
    try:
        queries = [
            f"Malaysia student scholarships 2026 CGPA {profile.cgpa} {profile.course} site:gov.my OR site:edu.my",
            f"JPA scholarship 2026 {profile.state} CGPA {profile.cgpa}",
            f"MARA scholarship 2026 bumiputera {profile.course}",
            f"Yayasan scholarship 2026 Malaysia {profile.course} year {profile.year}",
        ]
        all_results = []
        for q in queries:
            results = serp_search(q, num_results=5)
            for r in results:
                title = r.get("title", "")
                link = r.get("link", "")
                snippet = r.get("snippet", "")
                if not title:
                    continue
                score = _match_score(profile, title + " " + snippet)
                all_results.append(ScholarshipResult(
                    title=title,
                    provider=_extract_provider(title),
                    amount=_extract_amount(title + " " + snippet),
                    deadline=_extract_deadline(snippet),
                    eligibility=f"CGPA {profile.cgpa}, {profile.course}, Year {profile.year}",
                    link=link,
                    match_score=score,
                ))

        # Deduplicate by title, keep highest score
        seen = {}
        for r in all_results:
            key = r.title.lower().strip()
            if key not in seen or r.match_score > seen[key].match_score:
                seen[key] = r

        ranked = sorted(seen.values(), key=lambda x: x.match_score, reverse=True)[:10]
        return ScholarshipResponse(scholarships=ranked)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _match_score(profile: ScholarshipProfile, text: str) -> int:
    score = 50
    t = text.lower()
    if str(profile.cgpa) in t:
        score += 20
    if profile.course.lower() in t:
        score += 15
    if str(profile.year) in t:
        score += 5
    if profile.state.lower() in t:
        score += 5
    if "scholarship" in t or "biasiswa" in t:
        score += 5
    return min(score, 100)


def _extract_provider(title: str) -> str:
    keywords = ["JPA", "MARA", "Yayasan", "Petronas", "Khazanah", "Bank Negara", "Telekom", "TNB"]
    for kw in keywords:
        if kw.lower() in title.lower():
            return kw
    return ""


def _extract_amount(text: str) -> str:
    patterns = [r"RM[\d,]+", r"\$[\d,]+", r"up to RM[\d,]+", r"full tuition"]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(0)
    return ""


def _extract_deadline(text: str) -> str:
    patterns = [r"\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}"]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(0)
    return ""


# ──────────────────────────────────────────────
#  POST /api/resources — Bright Data search
# ──────────────────────────────────────────────
@app.post("/api/resources", response_model=ResourceResponse)
async def resources(req: ResourceRequest) -> ResourceResponse:
    """Search for study resources using Bright Data SERP API."""
    if not settings.BRIGHTDATA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BRIGHTDATA_API_KEY is not configured.",
        )
    try:
        subject = req.subject.strip()
        queries = [
            f'"{subject}" past year exam paper site:edu.my',
            f'"{subject}" lecture notes textbook PDF Malaysia university',
            f'"{subject}" tutorial playlist YouTube',
            f'"{subject}" study guide notes free',
        ]
        all_results = []
        for q in queries:
            results = serp_search(q, num_results=5)
            for r in results:
                title = r.get("title", "")
                link = r.get("link", "")
                snippet = r.get("snippet", "")
                if not title:
                    continue
                all_results.append(ResourceResult(
                    title=title,
                    type=_classify_resource(title + " " + snippet + " " + link),
                    source=_extract_source(link),
                    link=link,
                    description=snippet[:200] if snippet else "",
                ))

        # Deduplicate by link
        seen = {}
        for r in all_results:
            if r.link not in seen:
                seen[r.link] = r

        return ResourceResponse(resources=list(seen.values())[:15])
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _classify_resource(text: str) -> str:
    t = text.lower()
    if "past year" in t or "exam paper" in t or "past paper" in t or "soalan" in t:
        return "past_paper"
    if "youtube" in t or "playlist" in t or "video" in t or "tutorial" in t:
        return "video"
    if "textbook" in t or "pdf" in t or "ebook" in t:
        return "textbook"
    if "notes" in t or "lecture" in t or "slide" in t:
        return "notes"
    return "other"


def _extract_source(link: str) -> str:
    if "youtube" in link:
        return "YouTube"
    if "edu.my" in link:
        return "University (MY)"
    if "slideshare" in link:
        return "SlideShare"
    if "scribd" in link:
        return "Scribd"
    try:
        from urllib.parse import urlparse
        domain = urlparse(link).netloc.replace("www.", "")
        return domain.split(".")[0].title()
    except Exception:
        return "Web"


# ──────────────────────────────────────────────
#  POST /api/uni-scrape — University calendar
# ──────────────────────────────────────────────
UNI_CALENDAR_URLS = {
    "UM": "https://aasc.um.edu.my/academic-calendar",
    "USM": "https://academic.usm.my/index.php/academic-calendar",
    "UKM": "https://www.ukm.my/ppp/academic-calendar",
    "UTM": "https://academic.utm.my/academic-calendar",
}


@app.post("/api/uni-scrape", response_model=UniCalendarResponse)
async def uni_scrape(req: UniCalendarRequest) -> UniCalendarResponse:
    """Scrape university academic calendar using Bright Data Web Unlocker."""
    if not settings.BRIGHTDATA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BRIGHTDATA_API_KEY is not configured.",
        )
    uni = req.university.upper()
    if uni not in UNI_CALENDAR_URLS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown university: {uni}. Supported: UM, USM, UKM, UTM",
        )
    try:
        url = UNI_CALENDAR_URLS[uni]
        html = web_unlock(url)
        events = _parse_calendar_html(html, uni)
        return UniCalendarResponse(university=uni, events=events)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _parse_calendar_html(html: str, uni: str) -> list[CalendarEvent]:
    """Extract calendar events from raw HTML using regex patterns."""
    events = []
    if not html:
        return events

    # Pattern: Date range or single date followed by event description
    date_patterns = [
        r'(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*[-–]\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[:\s]*([^.<!\n]{5,120})',
        r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})\s*[-–]\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})[:\s]*([^.<!\n]{5,120})',
        r'(\d{1,2}/\d{1,2}/\d{4})\s*[-–]\s*(\d{1,2}/\d{1,2}/\d{4})[:\s]*([^.<!\n]{5,120})',
        r'(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})[:\s]*([^.<!\n]{5,120})',
    ]

    seen_titles = set()
    for pattern in date_patterns:
        matches = re.findall(pattern, html, re.IGNORECASE)
        for m in matches:
            if len(m) == 3:
                start_date, end_date, desc = m
            else:
                start_date, desc = m
                end_date = start_date

            desc = re.sub(r'<[^>]+>', '', desc).strip()
            if not desc or len(desc) < 5:
                continue

            key = desc.lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)

            events.append(CalendarEvent(
                title=desc,
                date=start_date.strip(),
                end_date=end_date.strip(),
                category=_classify_event(desc),
                description="",
            ))

    return events[:30]


def _classify_event(text: str) -> str:
    t = text.lower()
    if "exam" in t or "final" in t or "midterm" in t or "peperiksaan" in t:
        return "exam"
    if "holiday" in t or "break" in t or "cuti" in t or "recess" in t:
        return "holiday"
    if "registration" in t or "register" in t or "daftar" in t or "enrol" in t:
        return "registration"
    if "semester" in t or "semester" in t or "session" in t:
        return "semester"
    return "other"