/**
 * UniFlow — Deterministic Date Parser for Moodle/Spectrum
 *
 * Priority chain:
 * 1. Unix timestamp from DOM (data-* attrs, URL params) → direct conversion
 * 2. Explicit date patterns in text → regex extraction
 * 3. Relative dates (today, tomorrow) → offset from Date.now()
 * 4. Mark as needs_llm: true for LLM fallback
 *
 * Timezone: Asia/Kuala_Lumpur (UTC+8). Moodle timestamps are server time.
 * Year inference: academic year Sep–Aug cycle.
 */
(function (root) {
  'use strict';

  const MONTHS = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  };

  const MONTH_NAMES = Object.keys(MONTHS);

  /**
   * Extract a unix timestamp from a URL's query params.
   * Looks for `time=XXX` or `t=XXX` params.
   * @param {string} url
   * @returns {number|null}
   */
  function extractTimestampFromUrl(url) {
    if (!url) return null;
    try {
      const params = new URL(url, 'https://spectrum.um.edu.my').searchParams;
      const time = params.get('time') || params.get('t');
      if (time) {
        const ts = parseInt(time, 10);
        return isNaN(ts) ? null : ts;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Extract a course ID from a URL's query params.
   * Looks for `id=XXX` or `course=XXX`.
   * @param {string} url
   * @returns {string|null}
   */
  function extractCourseIdFromUrl(url) {
    if (!url) return null;
    try {
      const params = new URL(url, 'https://spectrum.um.edu.my').searchParams;
      return params.get('course') || params.get('id') || null;
    } catch (e) { return null; }
  }

  /**
   * Parse a 12h or 24h time string from text.
   * @param {string} rawText
   * @returns {string|null} HH:MM format or null
   */
  function extractTimeFromText(rawText) {
    if (!rawText) return null;

    // "5:00 PM", "5:00PM", "5 PM"
    const match12h = rawText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12h) {
      let h = parseInt(match12h[1], 10);
      const m = match12h[2];
      if (/PM/i.test(match12h[3]) && h < 12) h += 12;
      if (/AM/i.test(match12h[3]) && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    // "17:00" (24h, not followed by AM/PM)
    const match24h = rawText.match(/(\d{2}):(\d{2})(?!\s*(?:AM|PM))/i);
    if (match24h) {
      return `${match24h[1]}:${match24h[2]}`;
    }

    return null;
  }

  /**
   * Infer year for dates without an explicit year.
   * Academic year: Sep–Aug. If month is Sep–Dec and we're in Jan–Aug → previous year.
   * If month is Jan–Aug and we're in Sep–Dec → next year. Otherwise current year.
   */
  function inferYear(month) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const parsedMonth = parseInt(month, 10);

    if (parsedMonth >= 9 && currentMonth < 9) return currentYear - 1;
    if (parsedMonth < 9 && currentMonth >= 9) return currentYear + 1;
    return currentYear;
  }

  /**
   * Build an ISO date from regex match groups.
   * Handles multiple pattern formats.
   */
  function buildDateFromMatch(match, rawText) {
    // Pattern: "5th April 2026" → groups: [day, monthName, year?]
    if (match.length >= 3 && MONTHS[match[2].toLowerCase()]) {
      const day = match[1].padStart(2, '0');
      const month = MONTHS[match[2].toLowerCase()];
      const year = match[3] || String(inferYear(month));
      return {
        iso_date: `${year}-${month}-${day}`,
        time: extractTimeFromText(rawText),
        confidence: match[3] ? 'high' : 'medium',
        needs_llm: false,
        raw: rawText
      };
    }
    // Pattern: "April 5, 2026" → groups: [monthName, day, year]
    if (match.length >= 4 && MONTHS[match[1].toLowerCase()]) {
      const day = match[2].padStart(2, '0');
      const month = MONTHS[match[1].toLowerCase()];
      const year = match[3];
      return {
        iso_date: `${year}-${month}-${day}`,
        time: extractTimeFromText(rawText),
        confidence: 'high',
        needs_llm: false,
        raw: rawText
      };
    }
    return { iso_date: null, time: null, confidence: 'low', needs_llm: true, raw: rawText };
  }

  /**
   * Compute a relative date (today, tomorrow, yesterday).
   */
  function relativeDate(offset, rawText) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      iso_date: d.toISOString().split('T')[0],
      time: extractTimeFromText(rawText),
      confidence: 'high',
      needs_llm: false,
      raw: rawText
    };
  }

  /**
   * Parse a date from a unix timestamp.
   * @param {number} timestamp — unix seconds
   * @param {string} [rawText] — optional raw text for time extraction
   * @returns {object}
   */
  function parseFromTimestamp(timestamp, rawText) {
    if (!timestamp || isNaN(timestamp)) {
      return { iso_date: null, time: null, confidence: 'low', needs_llm: true, raw: rawText || '' };
    }
    const d = new Date(timestamp * 1000);
    return {
      iso_date: d.toISOString().split('T')[0],
      time: extractTimeFromText(rawText) || `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      confidence: 'high',
      needs_llm: false,
      raw: rawText || ''
    };
  }

  // Date regex patterns, ordered by specificity
  const DATE_PATTERNS = [
    // "5th April 2026", "5 April 2026", "5 April"
    /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?/i,
    // "April 5, 2026"
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
    // "Monday, 1 June" (no year)
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
    // "5/4/2026", "5-4-2026" (ambiguous — assume DD/MM/YYYY for Malaysian context)
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  ];

  // Embedded date patterns for activity names
  const EMBEDDED_DATE_PATTERNS = [
    /(?:Due\s*(?:Date)?[:\s]*)(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})?/i,
    /(?:Deadline[:\s]*)(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})?/i,
    /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})/i,
    /(?:by|before|until)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
  ];

  /**
   * Main date parser — deterministic chain with fallback.
   * @param {string} rawText — the raw date text to parse
   * @param {number|null} contextTimestamp — unix timestamp from DOM if available
   * @returns {object} { iso_date, time, confidence, needs_llm, raw }
   */
  function parseMoodleDate(rawText, contextTimestamp) {
    if (!rawText || !rawText.trim()) {
      return { iso_date: null, time: null, confidence: 'none', needs_llm: !!contextTimestamp === false, raw: rawText || '' };
    }

    // Priority 1: Direct timestamp
    if (contextTimestamp) {
      return parseFromTimestamp(contextTimestamp, rawText);
    }

    // Priority 2: Regex patterns
    for (const pattern of DATE_PATTERNS) {
      const match = rawText.match(pattern);
      if (match) return buildDateFromMatch(match, rawText);
    }

    // Priority 3: Relative dates
    if (/\btomorrow\b/i.test(rawText)) return relativeDate(1, rawText);
    if (/\btoday\b/i.test(rawText)) return relativeDate(0, rawText);
    if (/\byesterday\b/i.test(rawText)) return relativeDate(-1, rawText);

    // Priority 4: Fallback to LLM
    return { iso_date: null, time: null, confidence: 'low', needs_llm: true, raw: rawText };
  }

  /**
   * Detect embedded dates in activity names like
   * "Individual Assignment Due Date 5th April 2026"
   * @param {string} name
   * @returns {object|null} { iso_date, confidence, raw } or null
   */
  function detectEmbeddedDate(name) {
    if (!name) return null;
    for (const pattern of EMBEDDED_DATE_PATTERNS) {
      const match = name.match(pattern);
      if (match) {
        const day = (match[1] || match[2]).padStart(2, '0');
        // Find the month name in the match
        let monthStr = null;
        let year = null;
        for (const m of match) {
          if (m && MONTHS[m.toLowerCase()]) monthStr = MONTHS[m.toLowerCase()];
          if (m && /^\d{4}$/.test(m)) year = m;
        }
        if (!monthStr) continue;
        if (!year) year = String(inferYear(monthStr));
        return {
          iso_date: `${year}-${monthStr}-${day}`,
          confidence: 'medium',
          needs_llm: false,
          raw: match[0]
        };
      }
    }
    return null;
  }

  // Export
  root.UniFlowDateParser = {
    parseMoodleDate,
    detectEmbeddedDate,
    extractTimestampFromUrl,
    extractCourseIdFromUrl,
    extractTimeFromText,
    inferYear,
    parseFromTimestamp
  };
})(typeof self !== 'undefined' ? self : this);
