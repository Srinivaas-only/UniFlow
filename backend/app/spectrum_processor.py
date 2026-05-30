"""
UniFlow — Spectrum Import Processor
Processes raw scraped data from the Chrome extension.
Deterministic parsing first, LLM enrichment only as fallback.
"""
import json
import logging
import re
import traceback
from datetime import datetime

from app.config import settings

logger = logging.getLogger("uniflow.spectrum")

# ── Moodle modtype → UniFlow type mapping ──

RESOURCE_TYPES = {"resource", "url", "folder", "book", "page"}
SKIP_TYPES = {"attendance", "label"}

EVENT_TYPE_MAP = {
    "assign": "assignment",
    "quiz": "exam",
    "forum": "reminder",
    "workshop": "assignment",
    "choice": "reminder",
    "feedback": "reminder",
    "lesson": "reminder",
    "h5pactivity": "assignment",
    "lti": "assignment",
}

# Title keyword → refined event type
TITLE_TYPE_RULES = [
    (["exam", "quiz", "test", "midterm", "final"], "exam"),
    (["due", "submission", "deadline", "submit"], "deadline"),
    (["assignment", "homework", "project"], "assignment"),
    (["meeting", "consultation"], "meeting"),
    (["announcement", "notice"], "reminder"),
]


def classify_item(item: dict) -> dict:
    """Classify a raw item into event/resource/skip with type."""
    mod_type = (item.get("type") or "").lower()
    title = (item.get("name") or item.get("raw_title") or "").lower()

    if mod_type in SKIP_TYPES:
        return {"category": "skip", "event_type": None, "skip_reason": f"{mod_type}_skipped"}

    if mod_type in RESOURCE_TYPES or item.get("category") == "resource":
        return {"category": "resource", "event_type": "resource", "skip_reason": None}

    # Title-based refinement
    for keywords, event_type in TITLE_TYPE_RULES:
        if any(kw in title for kw in keywords):
            return {"category": "event", "event_type": event_type, "skip_reason": None}

    # Modtype-based default
    default = EVENT_TYPE_MAP.get(mod_type, "other")
    return {"category": "event", "event_type": default, "skip_reason": None}


def parse_course_name(full_name: str) -> dict:
    """Parse 'WIA1002/WIB1002 DATA STRUCTURE' → {code, short_name, full_name}."""
    if not full_name:
        return {"code": "", "short_name": "", "full_name": ""}

    match = re.match(r"^([A-Z]{2,4}\d{4}(?:/[A-Z]{2,4}\d{4})*)\s+(.+)", full_name.strip())
    if match:
        codes = match.group(1).split("/")
        return {"code": codes[0], "short_name": match.group(2).strip(), "full_name": full_name.strip()}

    return {"code": "", "short_name": full_name.strip(), "full_name": full_name.strip()}


def process_items(raw_items: list, course_context: dict = None) -> dict:
    """
    Main processing pipeline.
    1. Classify each item (event/resource/skip)
    2. Extract dates deterministically from item fields
    3. Separate events from resources
    4. Deduplicate by URL
    5. Collect items needing LLM enrichment
    """
    events = []
    resources = []
    skipped = []
    needs_llm = []

    course_code = ""
    course_name = ""
    if course_context:
        course_code = course_context.get("code", "")
        course_name = course_context.get("short_name", course_context.get("full_name", ""))

    for item in raw_items:
        classification = classify_item(item)

        if classification["category"] == "skip":
            skipped.append({
                "name": item.get("name") or item.get("raw_title") or "",
                "reason": classification["skip_reason"]
            })
            continue

        # Determine the title
        title = item.get("raw_title") or item.get("name") or ""
        # Clean title
        clean_title = re.sub(r"\s+is due$", "", title, flags=re.IGNORECASE)
        clean_title = re.sub(r"^Due Date\s+", "", clean_title, flags=re.IGNORECASE)

        # Date extraction — prefer pre-computed fields from extension
        iso_date = item.get("iso_date") or item.get("name_embedded_date") or ""
        time_str = item.get("time")
        confidence = item.get("date_confidence", "none")
        needs_llm_flag = item.get("needs_llm", False)

        # If no date yet, try inline_date_text
        if not iso_date and item.get("inline_date_text"):
            parsed = _parse_date_text(item["inline_date_text"])
            if parsed:
                iso_date = parsed
                confidence = "medium"
                needs_llm_flag = False

        # Build source URL
        source_url = item.get("url", "")

        if classification["category"] == "resource":
            resources.append({
                "title": clean_title,
                "url": source_url,
                "type": "resource",
                "course_code": course_code,
                "course_name": course_name,
                "section": item.get("section_name", ""),
            })
        else:
            event = {
                "title": clean_title,
                "iso_date": iso_date or None,
                "time": time_str,
                "type": classification["event_type"],
                "source": "spectrum",
                "source_url": source_url,
                "course_code": course_code,
                "course_name": course_name,
                "confidence": confidence or ("high" if iso_date else "none"),
                "event_id": item.get("event_id"),
                "module_id": item.get("module_id"),
            }

            if needs_llm_flag or not iso_date:
                needs_llm.append(event)
            else:
                events.append(event)

    # Deduplicate events by URL
    events = _dedupe(events)
    resources = _dedupe(resources)

    return {
        "events": events,
        "resources": resources,
        "skipped": skipped,
        "needs_llm": needs_llm,
        "stats": {
            "extracted": len(raw_items),
            "events_created": len(events),
            "resources_created": len(resources),
            "skipped": len(skipped),
            "needs_llm_count": len(needs_llm),
        }
    }


def _parse_date_text(text: str) -> str | None:
    """Try to parse a date from inline date text like 'Due: 5 April 2026'."""
    if not text:
        return None

    months = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }

    patterns = [
        r"(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})",
        r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})",
    ]

    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                groups = m.groups()
                if len(groups) == 3 and groups[1].lower() in months:
                    day = groups[0].zfill(2)
                    month = months[groups[1].lower()]
                    year = groups[2]
                    return f"{year}-{month}-{day}"
                elif "/" in groups[1] or "-" in groups[1]:
                    # DD/MM/YYYY
                    return f"{groups[2]}-{groups[1].zfill(2)}-{groups[0].zfill(2)}"
            except Exception:
                continue

    return None


def _dedupe(items: list) -> list:
    """Deduplicate by source_url (or title as fallback)."""
    seen = {}
    for item in items:
        key = item.get("source_url") or item.get("url") or item.get("title", "")
        if key not in seen:
            seen[key] = item
        else:
            # Keep more complete version
            existing = seen[key]
            if len(str(item)) > len(str(existing)):
                seen[key] = item
    return list(seen.values())


async def llm_enrich(items: list) -> list:
    """Use Groq LLM to extract dates/titles for items that need it."""
    if not items or not settings.DEEPSEEK_API_KEY:
        return items

    from openai import OpenAI

    client = OpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
    )

    items_text = json.dumps([
        {"title": i.get("title"), "source_url": i.get("source_url"),
         "raw_date": i.get("iso_date"), "type": i.get("type")}
        for i in items
    ], indent=2)

    today = datetime.now().strftime("%Y-%m-%d")
    prompt = (
        f"Clean up these Moodle event items. Today: {today}\n\n"
        f"Items:\n{items_text[:3000]}\n\n"
        f"For each item, extract a clean title and ISO date (YYYY-MM-DD) if possible. "
        f"Return a JSON array: [{{\"title\": \"...\", \"iso_date\": \"YYYY-MM-DD\" or null}}]\n"
        f"No markdown fences."
    )

    try:
        resp = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": "You clean Moodle import data. Return ONLY a valid JSON array."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"):
            content = re.sub(r'^```\w*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        parsed = json.loads(content)

        # Merge LLM results back
        for i, llm_item in enumerate(parsed):
            if i < len(items) and isinstance(llm_item, dict):
                if llm_item.get("title"):
                    items[i]["title"] = llm_item["title"]
                if llm_item.get("iso_date"):
                    items[i]["iso_date"] = llm_item["iso_date"]
                    items[i]["confidence"] = "medium"

        return items

    except Exception as e:
        logger.error(f"LLM enrichment failed: {e}")
        return items
