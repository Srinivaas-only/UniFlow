/**
 * UniFlow — Type Classifier for Moodle items
 *
 * Maps Moodle modtype → UniFlow event type.
 * Two-tier classification: structual (from modtype) + semantic (from title keywords).
 */
(function (root) {
  'use strict';

  // Types to skip entirely
  const SKIP_TYPES = new Set(['attendance', 'label']);

  // Moodle modtype → UniFlow category
  const MODTYPE_MAP = {
    assign:       'event',    // will be refined to 'assignment' or 'deadline'
    quiz:         'event',    // will be refined to 'exam'
    forum:        'event',    // will be refined to 'reminder'
    workshop:     'event',    // → 'assignment'
    choice:       'event',    // → 'reminder'
    feedback:     'event',    // → 'reminder'
    lesson:       'event',    // → 'reminder'
    h5pactivity:  'event',    // → 'assignment'
    lti:          'event',    // → 'assignment'
    resource:     'resource',
    url:          'resource',
    folder:       'resource',
    book:         'resource',
    page:         'resource',
  };

  // Title keyword → refined event type
  const TITLE_TYPE_RULES = [
    { keywords: ['exam', 'quiz', 'test', 'midterm', 'final', 'peperiksaan'], type: 'exam' },
    { keywords: ['due', 'submission', 'deadline', 'submit'], type: 'deadline' },
    { keywords: ['assignment', 'homework', 'project', 'kerja kursus'], type: 'assignment' },
    { keywords: ['attendance', 'kehadiran'], type: 'class' },
    { keywords: ['lecture', 'tutorial', 'lab', 'practical', 'kuliah'], type: 'class' },
    { keywords: ['meeting', 'consultation', 'consultation'], type: 'meeting' },
    { keywords: ['announcement', 'announce', 'notice'], type: 'reminder' },
  ];

  /**
   * Should this modtype be skipped?
   * @param {string} modType
   * @returns {boolean}
   */
  function shouldSkip(modType) {
    return SKIP_TYPES.has(modType);
  }

  /**
   * Classify a Moodle item into UniFlow category (event vs resource vs skip)
   * and refined event type.
   *
   * @param {object} item — { type, name, raw_title, ... }
   * @returns {object} { category, event_type, skip, skip_reason }
   */
  function classify(item) {
    const modType = (item.type || '').toLowerCase();
    const title = (item.name || item.raw_title || '').toLowerCase();

    // Skip noisy types
    if (shouldSkip(modType)) {
      return { category: 'skip', event_type: null, skip: true, skip_reason: `${modType}_skipped` };
    }

    // Known modtype mapping
    const mappedCategory = MODTYPE_MAP[modType];

    if (mappedCategory === 'resource') {
      return { category: 'resource', event_type: 'resource', skip: false, skip_reason: null };
    }

    if (mappedCategory === 'event' || !mappedCategory) {
      // Refined classification from title keywords
      for (const rule of TITLE_TYPE_RULES) {
        if (rule.keywords.some(kw => title.includes(kw))) {
          return { category: 'event', event_type: rule.type, skip: false, skip_reason: null };
        }
      }

      // Fallback: modtype-based defaults
      const defaultTypeMap = {
        assign: 'assignment',
        quiz: 'exam',
        forum: 'reminder',
        workshop: 'assignment',
        choice: 'reminder',
        feedback: 'reminder',
        lesson: 'reminder',
        h5pactivity: 'assignment',
        lti: 'assignment',
      };

      const defaultType = defaultTypeMap[modType] || 'other';
      return { category: 'event', event_type: defaultType, skip: false, skip_reason: null };
    }

    return { category: 'event', event_type: 'other', skip: false, skip_reason: null };
  }

  /**
   * Parse a course title like "WIA1002/WIB1002 DATA STRUCTURE"
   * into structured { code, short_name, full_name }.
   */
  function parseCourseName(fullName) {
    if (!fullName) return { code: '', short_name: '', full_name: '' };

    const trimmed = fullName.trim();

    // Pattern: "CODE1/CODE2 NAME" or "CODE NAME" or just "NAME"
    const codeMatch = trimmed.match(/^([A-Z]{2,4}\d{4}(?:\/[A-Z]{2,4}\d{4})*)\s+(.+)/);

    if (codeMatch) {
      const codes = codeMatch[1].split('/');
      return {
        code: codes[0],
        short_name: codeMatch[2].trim(),
        full_name: trimmed
      };
    }

    return {
      code: '',
      short_name: trimmed,
      full_name: trimmed
    };
  }

  // Export
  root.UniFlowClassifier = {
    classify,
    shouldSkip,
    parseCourseName,
    SKIP_TYPES,
    MODTYPE_MAP
  };
})(typeof self !== 'undefined' ? self : this);
