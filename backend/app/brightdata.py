"""
Bright Data integration for UniFlow.
Uses SERP API for searching and Web Unlocker for scraping.
"""
import json
import requests

from app.config import settings

SERP_API_URL = "https://api.brightdata.com/serp/req"
WEB_UNLOCKER_URL = "https://api.brightdata.com/request"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


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


def serp_search(query: str, num_results: int = 10) -> list[dict]:
    """Search using Bright Data SERP API. Returns list of organic results."""
    payload = {
        "query": query,
        "num": num_results,
    }
    try:
        resp = requests.post(
            SERP_API_URL,
            headers=_serp_headers(),
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("organic", [])
    except Exception as e:
        print(f"SERP search error: {e}")
        return []


def web_unlock(url: str) -> str:
    """Fetch a page using Bright Data Web Unlocker. Returns raw HTML."""
    payload = {
        "url": url,
        "method": "GET",
        "headers": {"User-Agent": USER_AGENT},
    }
    try:
        resp = requests.post(
            WEB_UNLOCKER_URL,
            headers=_unlocker_headers(),
            json=payload,
            timeout=45,
        )
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"Web Unlocker error for {url}: {e}")
        return ""