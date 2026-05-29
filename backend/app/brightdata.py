"""
Bright Data integration for UniFlow.
Uses the SERP API zone (serp_api1) via the unified /request endpoint.
Includes retry logic with exponential backoff (1s, 2s, 4s) and comprehensive logging.
NO caching — we want real data during demo.
"""
import json
import logging
import time
from urllib.parse import quote_plus

import requests

from app.config import settings

logger = logging.getLogger("uniflow.brightdata")

BRIGHTDATA_API_URL = "https://api.brightdata.com/request"
SERP_ZONE = "serp_api1"


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.BRIGHTDATA_API_KEY}",
    }


def _retry_request(url: str, payload: dict, *, timeout: int = 30, max_retries: int = 3) -> requests.Response | None:
    """Execute POST request with exponential backoff retry (1s, 2s, 4s).
    Returns the response on success, or None on total failure — never raises."""
    last_error = None
    for attempt in range(max_retries):
        try:
            resp = requests.post(url, headers=_headers(), json=payload, timeout=timeout)
            resp.raise_for_status()
            return resp
        except requests.exceptions.Timeout as e:
            last_error = e
            wait = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(
                f"[attempt {attempt+1}/{max_retries}] Timeout for query='{payload.get('url','')[:80]}' — retrying in {wait}s"
            )
            time.sleep(wait)
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else 0
            if status == 429:
                wait = 2 ** (attempt + 1)
                logger.warning(
                    f"[attempt {attempt+1}/{max_retries}] Rate limited (429) — retrying in {wait}s"
                )
                time.sleep(wait)
                continue
            if status >= 500:
                wait = 2 ** attempt
                logger.warning(
                    f"[attempt {attempt+1}/{max_retries}] Server error {status} — retrying in {wait}s"
                )
                time.sleep(wait)
                continue
            # 4xx other than 429 — log and don't retry
            logger.error(
                f"Bright Data client error {status} for query='{payload.get('url','')[:80]}'"
            )
            return None
        except requests.exceptions.ConnectionError as e:
            last_error = e
            wait = 2 ** attempt
            logger.warning(
                f"[attempt {attempt+1}/{max_retries}] Connection error — retrying in {wait}s"
            )
            time.sleep(wait)
        except Exception as e:
            last_error = e
            wait = 2 ** attempt
            logger.error(f"[attempt {attempt+1}/{max_retries}] Unexpected error: {e}")
            time.sleep(wait)

    logger.error(f"All {max_retries} retries failed. Last error: {last_error}")
    return None


def search_serp(query: str) -> list[dict]:
    """Run a Bright Data SERP query. Returns parsed organic results.
    Each result: { title, link, snippet, source_domain }
    Returns empty list on total failure — never crashes."""
    encoded_query = quote_plus(query)
    serp_url = f"https://www.google.com/search?q={encoded_query}"

    payload = {
        "zone": SERP_ZONE,
        "url": serp_url,
        "format": "json",
    }

    start = time.time()
    logger.info(f"SERP search: query='{query[:80]}'")

    resp = _retry_request(BRIGHTDATA_API_URL, payload, timeout=30)

    if resp is None:
        elapsed = time.time() - start
        logger.error(f"SERP search FAILED after {elapsed:.2f}s — query='{query[:60]}'")
        return []

    try:
        wrapper = resp.json()
        # Bright Data wraps response: { status_code, headers, body }
        # where body is a JSON string that needs double-parsing
        body_str = wrapper.get("body", "")
        if isinstance(body_str, str) and body_str:
            data = json.loads(body_str)
        elif isinstance(body_str, dict):
            data = body_str
        else:
            data = wrapper  # fallback
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"SERP response JSON parse error after {elapsed:.2f}s: {e}")
        return []

    organic = data.get("organic", [])
    elapsed = time.time() - start

    results = []
    for item in organic:
        link = item.get("link", "")
        source_domain = ""
        if link:
            try:
                from urllib.parse import urlparse
                source_domain = urlparse(link).netloc.replace("www.", "")
            except Exception:
                pass
        results.append({
            "title": item.get("title", ""),
            "link": link,
            "snippet": item.get("description", "") or item.get("snippet", ""),
            "source_domain": source_domain,
        })

    logger.info(f"SERP returned {len(results)} organic results in {elapsed:.2f}s — query='{query[:60]}'")
    return results


def web_unlock(url: str) -> str:
    """Fetch a page using Bright Data Web Unlocker.
    Returns raw HTML string, or empty string on failure."""
    payload = {
        "zone": SERP_ZONE,
        "url": url,
    }

    start = time.time()
    logger.info(f"Web Unlocker: url='{url}'")

    resp = _retry_request(BRIGHTDATA_API_URL, payload, timeout=45)

    if resp is None:
        elapsed = time.time() - start
        logger.error(f"Web Unlocker FAILED after {elapsed:.2f}s — url='{url}'")
        return ""

    elapsed = time.time() - start
    html = resp.text
    logger.info(f"Web Unlocker returned {len(html)} chars in {elapsed:.2f}s — url='{url}'")
    return html
