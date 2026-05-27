"""
Bright Data integration for UniFlow.
Uses SERP API for searching and Web Unlocker for scraping.
Includes retry logic, caching, logging, and timeout handling.
"""
import hashlib
import json
import logging
import time
from functools import lru_cache

import requests

from app.config import settings

logger = logging.getLogger("uniflow.brightdata")

SERP_API_URL = "https://api.brightdata.com/serp/req"
WEB_UNLOCKER_URL = "https://api.brightdata.com/request"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# ── In-memory TTL cache ──
_cache: dict = {}
CACHE_TTL = 600  # 10 minutes


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        logger.info(f"Cache HIT for key={key[:16]}...")
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}
    # Evict old entries if cache grows too large
    if len(_cache) > 100:
        oldest = sorted(_cache.items(), key=lambda x: x[1]["ts"])[:20]
        for k, _ in oldest:
            _cache.pop(k, None)


def _serp_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.BRIGHTDATA_API_KEY}",
        "Content-Type": "application/json",
    }


def _unlocker_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.BRIGHTDATA_API_KEY}",
        "Content-Type": "application/json",
    }


def _retry_request(method, url, *, headers=None, json=None, timeout=30, max_retries=3):
    """Execute HTTP request with exponential backoff retry."""
    last_error = None
    for attempt in range(max_retries):
        try:
            resp = method(url, headers=headers, json=json, timeout=timeout)
            resp.raise_for_status()
            return resp
        except requests.exceptions.Timeout as e:
            last_error = e
            wait = 2 ** attempt
            logger.warning(f"Timeout on attempt {attempt+1}/{max_retries} for {url}, retrying in {wait}s...")
            time.sleep(wait)
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else 0
            if status == 429:
                wait = 2 ** (attempt + 1)
                logger.warning(f"Rate limited (429) on attempt {attempt+1}, retrying in {wait}s...")
                time.sleep(wait)
                continue
            if status >= 500:
                wait = 2 ** attempt
                logger.warning(f"Server error {status} on attempt {attempt+1}, retrying in {wait}s...")
                time.sleep(wait)
                continue
            # 4xx other than 429 — don't retry
            raise
        except requests.exceptions.ConnectionError as e:
            last_error = e
            wait = 2 ** attempt
            logger.warning(f"Connection error on attempt {attempt+1}, retrying in {wait}s...")
            time.sleep(wait)
    raise last_error or Exception(f"All {max_retries} retries failed for {url}")


def serp_search(query: str, num_results: int = 10, use_cache: bool = True) -> list[dict]:
    """Search using Bright Data SERP API with retry + caching."""
    cache_key = hashlib.md5(f"serp:{query}:{num_results}".encode()).hexdigest()

    if use_cache:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    payload = {"query": query, "num": num_results}

    logger.info(f"SERP search: query='{query[:60]}...' num={num_results}")
    start = time.time()

    try:
        resp = _retry_request(
            requests.post, SERP_API_URL,
            headers=_serp_headers(),
            json=payload,
            timeout=30,
        )
        data = resp.json()
        results = data.get("organic", [])
        elapsed = time.time() - start
        logger.info(f"SERP returned {len(results)} results in {elapsed:.2f}s")
        _cache_set(cache_key, results)
        return results
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"SERP search failed after {elapsed:.2f}s: {e}")
        return []


def web_unlock(url: str, use_cache: bool = True) -> str:
    """Fetch a page using Bright Data Web Unlocker with retry + caching."""
    cache_key = hashlib.md5(f"web:{url}".encode()).hexdigest()

    if use_cache:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    payload = {
        "url": url,
        "method": "GET",
        "headers": {"User-Agent": USER_AGENT},
    }

    logger.info(f"Web Unlocker: url='{url}'")
    start = time.time()

    try:
        resp = _retry_request(
            requests.post, WEB_UNLOCKER_URL,
            headers=_unlocker_headers(),
            json=payload,
            timeout=45,
        )
        html = resp.text
        elapsed = time.time() - start
        logger.info(f"Web Unlocker returned {len(html)} chars in {elapsed:.2f}s")
        _cache_set(cache_key, html)
        return html
    except Exception as e:
        elapsed = time.time() - start
        logger.error(f"Web Unlocker failed after {elapsed:.2f}s: {e}")
        return ""