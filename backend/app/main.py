import asyncio
import json
import logging
import re
import time
import traceback
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.models import (
    ParseRequest, ParseResponse,
    ScholarshipProfile, ScholarshipResponse, ScholarshipResult,
    ResourceRequest, ResourceResponse, ResourceResult,
    UniCalendarRequest, UniCalendarResponse, CalendarEvent,
    InternshipProfile, InternshipResponse, InternshipResult,
)
from app.parser import parse_events
from app.brightdata import search_serp, web_unlock

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
_executor = ThreadPoolExecutor(max_workers=8)


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
            f"Malaysia scholarship 2026 {profile.course}",
            f"JPA scholarship 2026 undergraduate {profile.course}",
            "MARA scholarship 2026 application",
            f"Yayasan scholarship Malaysia 2026 {profile.course}",
        ]

        # Run 4 SERP queries in parallel via thread pool
        loop = asyncio.get_event_loop()
        search_tasks = [
            loop.run_in_executor(_executor, search_serp, q)
            for q in queries
        ]
        search_results = await asyncio.gather(*search_tasks)

        all_results = []
        for results in search_results:
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

        # Deduplicate by URL, keep highest score
        seen = {}
        for r in all_results:
            key = r.link or r.title.lower().strip()
            if key not in seen or r.match_score > seen[key].match_score:
                seen[key] = r

        ranked = sorted(seen.values(), key=lambda x: x.match_score, reverse=True)[:10]
        logger.info(f"Scholarship search returned {len(ranked)} results for course={profile.course}")
        return ScholarshipResponse(scholarships=ranked)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _match_score(profile: ScholarshipProfile, text: str) -> int:
    """Calculate match score (0-100) per spec:
    course keyword (+30), state (+20), year level (+15),
    CGPA-related keywords (+10), recency (+25)."""
    score = 0
    t = text.lower()
    # Course keyword match (+30)
    course_words = [w for w in profile.course.lower().split() if len(w) > 3]
    if any(w in t for w in course_words):
        score += 30
    # State match (+20)
    if profile.state.lower() in t:
        score += 20
    # Year level match (+15)
    year_labels = {
        1: ["first year", "year 1", "1st year", "freshman"],
        2: ["second year", "year 2", "2nd year", "sophomore"],
        3: ["third year", "year 3", "3rd year", "junior"],
        4: ["fourth year", "year 4", "4th year", "senior", "final year"],
    }
    year_terms = year_labels.get(profile.year, [])
    if str(profile.year) in t or any(y in t for y in year_terms):
        score += 15
    # CGPA-related keywords (+10)
    if str(profile.cgpa) in t or "cgpa" in t or "gpa" in t:
        score += 10
    # Recency — mentions 2025 or 2026 (+25)
    if "2026" in t or "2025" in t:
        score += 25
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
#  POST /api/internships — Bright Data search
# ──────────────────────────────────────────────


@app.post("/api/internships", response_model=InternshipResponse)
async def internships(profile: InternshipProfile) -> InternshipResponse:
    """Search for Malaysian internships using Bright Data SERP API + Groq LLM extraction."""
    if not settings.BRIGHTDATA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BRIGHTDATA_API_KEY is not configured.",
        )
    try:
        queries = [
            # Tier 1: Major SEA tech companies
            f"Grab internship {profile.course} Malaysia 2026",
            f"Shopee internship {profile.course} Kuala Lumpur 2026",
            f"TikTok internship Malaysia {profile.course} 2026",
            f"AirAsia internship Malaysia {profile.course} 2026",
            # Tier 2: Malaysian banks + telcos + corporates
            f"Maybank CIMB Petronas Axiata internship {profile.course} Malaysia 2026",
            # Tier 3: General Malaysian internship boards
            f"{profile.course} internship Malaysia 2026 undergraduate",
            f"paid internship {profile.course} {profile.state} Malaysia 2026",
            # Tier 4: Generic catch-all
            f"internship program Malaysia {profile.course} year {profile.year}",
        ]

        # Run all 8 SERP queries in parallel via thread pool
        loop = asyncio.get_event_loop()
        search_tasks = [
            loop.run_in_executor(_executor, search_serp, q)
            for q in queries
        ]
        search_results = await asyncio.gather(*search_tasks)

        # Aggregate and dedupe by URL
        all_raw = {}
        for results in search_results:
            for r in results:
                link = r.get("link", "")
                if not link or link in all_raw:
                    continue
                all_raw[link] = {
                    "title": r.get("title", ""),
                    "link": link,
                    "snippet": r.get("snippet", ""),
                    "source_domain": r.get("source_domain", ""),
                }

        if not all_raw:
            logger.info(f"Internship search returned 0 SERP results for course={profile.course}")
            return InternshipResponse(internships=[])

        # Use Groq LLM to extract structured internship data from title + snippet
        structured = await _llm_extract_internships(list(all_raw.values()), profile)

        # Dedupe by company name + role (merge same company+role, keep higher score)
        company_deduped = {}
        for item in structured:
            key = (item.company or "").strip().lower() + "|" + (item.role or "").strip().lower()
            if not key.strip("|"):
                continue
            if key not in company_deduped or item.match_score > company_deduped[key].match_score:
                company_deduped[key] = item
        structured = list(company_deduped.values()) if company_deduped else structured

        # Enforce diversity: max 2 results per company
        MAX_PER_COMPANY = 2
        company_counts = {}
        diverse = []
        remainder = []
        for item in sorted(structured, key=lambda x: x.match_score, reverse=True):
            company_key = (item.company or "").strip().lower()
            if not company_key:
                remainder.append(item)
                continue
            count = company_counts.get(company_key, 0)
            if count < MAX_PER_COMPANY:
                diverse.append(item)
                company_counts[company_key] = count + 1
            else:
                remainder.append(item)
        # Fill remaining slots with overflow items
        for item in remainder:
            if len(diverse) >= 12:
                break
            diverse.append(item)
        structured = diverse

        # Calculate match scores
        for item in structured:
            text = (item.role + " " + item.company + " " + item.snippet + " " + item.eligibility).lower()
            score = 0
            # Course keyword match (+30)
            course_words = [w for w in profile.course.lower().split() if len(w) > 3]
            if any(w in text for w in course_words):
                score += 30
            # Year/semester appropriate — internships for year 2-3 students (+20)
            if profile.year in (2, 3):
                year_terms = ["undergraduate", "intern", "student", "year 2", "year 3", "penyear"]
                if any(t in text for t in year_terms):
                    score += 20
            elif "freshman" not in text and "entry" in text:
                score += 10
            # State match (+15)
            if profile.state.lower() in text or "kuala lumpur" in text or "selangor" in text:
                score += 15
            # CGPA eligibility mentioned and student qualifies (+15)
            cgpa_match = re.search(r'(?:cgpa|gpa)\s*(?:min\.?|minimum)?\s*([\d.]+)', text)
            if cgpa_match:
                try:
                    min_cgpa = float(cgpa_match.group(1))
                    if profile.cgpa >= min_cgpa:
                        score += 15
                except ValueError:
                    pass
            elif "cgpa" not in text and "gpa" not in text:
                pass
            # Recency — 2026 in title/snippet (+20)
            if "2026" in text:
                score += 20
            # Tier-1 company boost (+15)
            TIER_1_COMPANIES = [
                'grab', 'shopee', 'tiktok', 'bytedance', 'airasia',
                'maybank', 'cimb', 'petronas', 'axiata', 'maxis',
                'celcom', 'digi', 'public bank', 'rhb',
                'ibm', 'microsoft', 'google', 'aws', 'accenture',
                'pwc', 'kpmg', 'ey', 'deloitte', 'sea group', 'lazada',
            ]
            for company in TIER_1_COMPANIES:
                if company in text:
                    score += 15
                    break
            item.match_score = min(score, 100)

        # Sort by match_score descending, take top 12
        ranked = sorted(structured, key=lambda x: x.match_score, reverse=True)[:12]
        logger.info(f"Internship search returned {len(ranked)} results for course={profile.course}")
        return InternshipResponse(internships=ranked)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def _llm_extract_internships(raw_items: list[dict], profile: InternshipProfile) -> list[InternshipResult]:
    """Use Groq LLM to extract structured internship data from SERP results."""
    if not raw_items or not settings.DEEPSEEK_API_KEY:
        return []

    from openai import OpenAI

    client = OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )

    # Build items text for LLM — include up to 40 items for broader coverage
    items_text = json.dumps([
        {"index": i, "title": r["title"], "snippet": r["snippet"][:200], "link": r["link"]}
        for i, r in enumerate(raw_items[:40])
    ], indent=2)

    prompt = (
        f"You are extracting internship listings from Malaysian web search results.\n"
        f"Student profile: {profile.course}, Year {profile.year} Semester {profile.semester}, CGPA {profile.cgpa}, State: {profile.state}\n\n"
        f"For EACH search result below, extract structured internship information. "
        f"If a result is NOT about an internship (e.g., it's a course page, a news article, unrelated), skip it.\n\n"
        f"Return a JSON array of objects with keys:\n"
        f"- company: company or organization name\n"
        f"- role: job title or internship role\n"
        f"- duration: e.g. '3 months', '6 months', '12 weeks' (empty string if unknown)\n"
        f"- location: city/region in Malaysia (empty string if unknown)\n"
        f"- allowance: salary/allowance info e.g. 'RM 1500/month' (empty string if unknown)\n"
        f"- eligibility: brief eligibility summary (empty string if unknown)\n"
        f"- deadline: application deadline as text (empty string if unknown)\n"
        f"- index: the original index number from the input\n\n"
        f"Search results:\n{items_text[:5000]}\n\n"
        f"Return ONLY a valid JSON array. No markdown fences. No explanation."
    )

    try:
        resp = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": "You extract structured internship data from search results. Return ONLY a valid JSON array."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )
        content = resp.choices[0].message.content.strip()
        # Strip markdown fences if present
        if content.startswith("```"):
            content = re.sub(r'^```\w*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        parsed = json.loads(content)
        results = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            idx = item.get("index", 0)
            if idx < 0 or idx >= len(raw_items):
                continue
            raw = raw_items[idx]
            results.append(InternshipResult(
                company=item.get("company", ""),
                role=item.get("role", raw["title"]),
                duration=item.get("duration", ""),
                location=item.get("location", ""),
                allowance=item.get("allowance", ""),
                eligibility=item.get("eligibility", ""),
                deadline=item.get("deadline", ""),
                link=raw["link"],
                snippet=raw["snippet"][:200],
            ))
        return results
    except Exception as e:
        logger.error(f"LLM internship extraction failed: {e}")
        # Fallback: return raw results as-is with basic field mapping
        return [
            InternshipResult(
                company="",
                role=r["title"],
                link=r["link"],
                snippet=r["snippet"][:200],
            )
            for r in raw_items[:10]
        ]


# ──────────────────────────────────────────────
#  POST /api/resources — DEPRECATED (kept for backward compatibility)
# ──────────────────────────────────────────────
@app.post("/api/resources", response_model=ResourceResponse)
async def resources(req: ResourceRequest) -> ResourceResponse:
    """Search for study resources using Bright Data SERP API.
    # DEPRECATED — kept for backward compatibility. Resources screen now uses Spectrum data only."""
    if not settings.BRIGHTDATA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BRIGHTDATA_API_KEY is not configured.",
        )
    try:
        subject = req.subject.strip()
        # 4 category-specific queries as per spec
        category_queries = [
            (f'"{subject}" past year exam paper university Malaysia', "past_paper"),
            (f'"{subject}" lecture notes pdf', "notes"),
            (f'"{subject}" textbook pdf free', "textbook"),
            (f'"{subject}" tutorial site:youtube.com', "video"),
        ]

        # Run all 4 SERP queries in parallel
        loop = asyncio.get_event_loop()
        search_tasks = [
            loop.run_in_executor(_executor, search_serp, q)
            for q, _ in category_queries
        ]
        search_results = await asyncio.gather(*search_tasks)

        all_results = []
        for (query, category), results in zip(category_queries, search_results):
            for r in results[:5]:  # Top 5 from each category
                title = r.get("title", "")
                link = r.get("link", "")
                snippet = r.get("snippet", "")
                source_domain = r.get("source_domain", "")
                if not title:
                    continue
                all_results.append(ResourceResult(
                    title=title,
                    type=category,
                    source=source_domain or _extract_source(link),
                    link=link,
                    description=snippet[:200] if snippet else "",
                ))

        # Deduplicate by link
        seen = {}
        for r in all_results:
            if r.link not in seen:
                seen[r.link] = r

        logger.info(f"Resource search returned {len(seen)} results for subject={subject}")
        return ResourceResponse(resources=list(seen.values()))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
    """Scrape university academic calendar using Bright Data SERP + LLM parsing."""
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
        # Use SERP search to find calendar info (SERP zone can't fetch URLs directly)
        uni_names = {
            "UM": "Universiti Malaya",
            "USM": "Universiti Sains Malaysia",
            "UKM": "Universiti Kebangsaan Malaysia",
            "UTM": "Universiti Teknologi Malaysia",
        }
        uni_name = uni_names.get(uni, uni)
        queries = [
            f"{uni_name} academic calendar 2025 2026 semester dates",
            f"{uni_name} exam schedule 2025 2026",
        ]

        # Run SERP queries in parallel
        loop = asyncio.get_event_loop()
        search_tasks = [
            loop.run_in_executor(_executor, search_serp, q)
            for q in queries
        ]
        search_results = await asyncio.gather(*search_tasks)

        # Collect all text from search results
        all_text = ""
        for results in search_results:
            for r in results[:5]:
                title = r.get("title", "")
                snippet = r.get("snippet", "")
                if title:
                    all_text += f"Title: {title}\n"
                if snippet:
                    all_text += f"Description: {snippet}\n"
                all_text += "\n"

        if not all_text.strip():
            logger.warning(f"No SERP results for {uni} calendar")
            return UniCalendarResponse(university=uni, events=[])

        # Use LLM to extract structured events from SERP snippets, fallback to regex
        events = []
        if settings.DEEPSEEK_API_KEY:
            events = await _llm_parse_calendar_text(all_text, uni_name)
        if not events:
            logger.info(f"LLM parse failed or unavailable for {uni}, using regex fallback on SERP data")
            events = _parse_calendar_from_text(all_text, uni_name)

        logger.info(f"Uni calendar scrape returned {len(events)} events for {uni}")
        return UniCalendarResponse(university=uni, events=events)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def _llm_parse_calendar_text(text: str, uni_name: str) -> list[CalendarEvent]:
    """Use DeepSeek LLM to extract calendar events from SERP snippets."""
    from openai import OpenAI

    client = OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )

    prompt = (
        f"Extract academic calendar events from the following search results about {uni_name}. "
        f"Return a JSON array of objects with keys: title, date (YYYY-MM-DD format, or descriptive like 'October 2025'), "
        f"end_date (YYYY-MM-DD or empty), category (semester, exam, holiday, registration, other), "
        f"description (brief note).\n\n"
        f"Focus on: semester start/end dates, mid-semester breaks, final exam periods, "
        f"public holidays, registration deadlines.\n\n"
        f"Search results:\n{text[:4000]}"
    )

    try:
        resp = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": "You are a calendar data extractor. Return ONLY a valid JSON array. No markdown, no explanation."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )
        content = resp.choices[0].message.content.strip()
        # Strip markdown fences if present
        if content.startswith("```"):
            content = re.sub(r'^```\w*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        raw_events = json.loads(content)
        events = []
        for item in raw_events[:30]:
            if isinstance(item, dict) and item.get("title"):
                events.append(CalendarEvent(
                    title=item["title"],
                    date=item.get("date", ""),
                    end_date=item.get("end_date", ""),
                    category=item.get("category", "other"),
                    description=item.get("description", ""),
                ))
        return events
    except Exception as e:
        logger.error(f"LLM calendar parse failed: {e}")
        return []


def _parse_calendar_from_text(text: str, uni_name: str) -> list[CalendarEvent]:
    """Regex fallback: extract calendar events from SERP snippet text.
    Handles UM format: 'Lectures. 6 weeks*. 13.10.2025. -. 23.11.2025.'"""
    events = []
    seen_titles = set()
    skip_patterns = [
        r'^\d+\s*(weeks?|days?)\*?\s*$', r'^Read more', r'^\d+$',
        r'^\s*$', r'^Description:', r'^Title:',
    ]

    def _find_label(before_text: str) -> str:
        """Walk backwards through period-delimited segments to find the event label."""
        segments = [s.strip() for s in before_text.split('.') if s.strip()]
        for seg in reversed(segments[-6:]):
            if any(re.match(p, seg, re.IGNORECASE) for p in skip_patterns):
                continue
            label = seg.strip(' -')
            if len(label) >= 3:
                return label
        return ""

    # Pattern 1: DD.MM.YYYY -. DD.MM.YYYY (UM format: optional trailing periods)
    for m in re.finditer(
        r'(\d{2}\.\d{2}\.\d{4})\.?\s*-\s*\.?\s*(\d{2}\.\d{2}\.\d{4})',
        text
    ):
        before = text[:m.start()].rstrip('. ')
        label = _find_label(before)
        if not label or label.lower() in seen_titles:
            continue
        seen_titles.add(label.lower())
        events.append(CalendarEvent(
            title=label,
            date=m.group(1).replace('.', '-'),
            end_date=m.group(2).replace('.', '-'),
            category=_classify_event(label), description="",
        ))

    # Pattern 2: DD.MM.YYYY - DD.MM.YYYY (without trailing periods)
    for m in re.finditer(
        r'(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})',
        text
    ):
        key = m.group(1) + m.group(2)
        before = text[:m.start()].rstrip('. ')
        label = _find_label(before)
        if not label or label.lower() in seen_titles:
            continue
        seen_titles.add(label.lower())
        events.append(CalendarEvent(
            title=label,
            date=m.group(1).replace('.', '-'),
            end_date=m.group(2).replace('.', '-'),
            category=_classify_event(label), description="",
        ))

    # Pattern 3: DD Month YYYY - DD Month YYYY
    for m in re.finditer(
        r'(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*[-–]\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})',
        text, re.IGNORECASE
    ):
        before = text[:m.start()].rstrip('. ')
        label = _find_label(before)
        if not label or label.lower() in seen_titles:
            continue
        seen_titles.add(label.lower())
        events.append(CalendarEvent(
            title=label, date=m.group(1).strip(), end_date=m.group(2).strip(),
            category=_classify_event(label), description="",
        ))

    # Pattern 4: standalone labeled events like "Mid Semester I Break"
    # or "Final Examination" followed by date range in different format
    exam_pattern = r'(?:Final\s+Exam(?:ination)?|Mid[- ]Semester\s+Break|Registration|Orientation|Census\s+Date)[^.]*?(\d{1,2}[\s./-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s./-]\d{2,4})'
    for m in re.finditer(exam_pattern, text, re.IGNORECASE):
        desc = re.sub(r'<[^>]+>', '', m.group(0).split(m.group(1))[0]).strip(' .:-')
        if desc and desc.lower() not in seen_titles:
            seen_titles.add(desc.lower())
            events.append(CalendarEvent(
                title=desc, date=m.group(1).strip(), end_date="",
                category=_classify_event(desc), description="",
            ))

    return events[:30]


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


# ──────────────────────────────────────────────
#  POST /api/spectrum-import — Chrome extension V2
# ──────────────────────────────────────────────
from app.spectrum_processor import process_items, llm_enrich

@app.post("/api/spectrum-import")
async def spectrum_import(request: Request):
    """Accept scraped Moodle data from Chrome extension V2.
    Deterministic processing first, LLM enrichment as fallback."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    import_type = data.get("type", "")
    raw_items = data.get("raw_items", data.get("items", []))
    course_context = data.get("course_context")

    if not raw_items:
        return {
            "events": [],
            "resources": [],
            "skipped": [],
            "stats": {"extracted": 0, "events_created": 0, "resources_created": 0, "skipped": 0, "needs_llm_count": 0},
            "source": "spectrum.um.edu.my",
            "message": "No items to import",
        }

    logger.info(f"Spectrum V2 import: type={import_type}, raw_items={len(raw_items)}")

    # Process through deterministic pipeline
    result = process_items(raw_items, course_context)

    # LLM enrichment for items that need it
    needs_llm_items = result.get("needs_llm", [])
    if needs_llm_items and settings.DEEPSEEK_API_KEY:
        logger.info(f"Spectrum: enriching {len(needs_llm_items)} items via LLM")
        enriched = await llm_enrich(needs_llm_items)
        # Merge enriched items into events
        for item in enriched:
            if item not in result["events"]:
                result["events"].append(item)
        result["stats"]["needs_llm_count"] = len(needs_llm_items)

    imported_count = len(result["events"]) + len(result["resources"])
    parts = []
    if result["events"]:
        parts.append(f"{len(result['events'])} events")
    if result["resources"]:
        parts.append(f"{len(result['resources'])} resources")
    message = f"Imported {' and '.join(parts)} from Spectrum" if parts else "No items imported"

    logger.info(f"Spectrum V2 complete: {message}")

    return {
        "events": result["events"],
        "resources": result["resources"],
        "skipped": result["skipped"],
        "stats": result["stats"],
        "source": "spectrum.um.edu.my",
        "message": message,
    }