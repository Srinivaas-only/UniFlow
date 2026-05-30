/**
 * UniFlow — Spectrum (Moodle) DOM Extractors
 *
 * 5 extractors for Dashboard, Course, Calendar, My Courses, Single Assignment.
 * Each returns structured raw data with deterministic timestamps where possible.
 *
 * Depends on: UniFlowDateParser, UniFlowClassifier, UniFlowDebug (loaded before this).
 */
(function (root) {
  'use strict';

  const DP = root.UniFlowDateParser;
  const CL = root.UniFlowClassifier;
  const DBG = root.UniFlowDebug;

  // ── Shared helpers ──

  function q(selector, parent) {
    const el = (parent || document).querySelector(selector);
    DBG.logSelector('shared', selector, el, el ? (el.textContent || '').trim().slice(0, 80) : null);
    return el;
  }

  function qa(selector, parent) {
    const els = (parent || document).querySelectorAll(selector);
    DBG.debug(`qa("${selector}") → ${els.length} results`);
    return els;
  }

  function textOf(el) {
    return el ? el.textContent.trim() : '';
  }

  function hrefOf(el) {
    if (!el) return '';
    const h = el.getAttribute('href') || el.href || '';
    return h.startsWith('http') ? h : (h ? 'https://spectrum.um.edu.my' + h : '');
  }

  function findParentSection(el) {
    let parent = el.parentElement;
    for (let i = 0; i < 15 && parent; i++) {
      if (parent.matches && (parent.matches('li.section') || (parent.id && parent.id.startsWith('section-')))) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function findTableValue(label) {
    const ths = document.querySelectorAll('th, .cell.c0');
    for (const th of ths) {
      if (th.textContent.trim().toLowerCase().includes(label.toLowerCase())) {
        const td = th.nextElementSibling;
        if (td) return td.textContent.trim();
      }
    }
    return null;
  }

  // ══════════════════════════════════════════
  //  EXTRACTOR 1 — DASHBOARD
  // ══════════════════════════════════════════

  function extractDashboard() {
    const items = [];
    const skipped = [];
    const eventItems = qa('[data-region="event-list-content"] [data-region="event-item"]');

    DBG.info(`Dashboard: found ${eventItems.length} event items`);

    eventItems.forEach((el, idx) => {
      const link = q('a[data-action="view-event"]', el);
      if (!link) { DBG.warn(`Dashboard item ${idx}: no event link found`); return; }

      const rawTitle = link.getAttribute('title') || textOf(link);
      const eventId = link.getAttribute('data-event-id') || '';
      const url = hrefOf(link);
      const courseId = DP.extractCourseIdFromUrl(url);

      // Date: try timestamp from .date.small a href first (deterministic)
      const dateLink = q('.date.small a', el);
      const dateTimestamp = dateLink ? DP.extractTimestampFromUrl(dateLink.href) : null;
      const rawDateText = textOf(q('.date.small', el));

      // Parse date deterministically
      const dateParsed = DP.parseMoodleDate(rawDateText, dateTimestamp);

      // Icon hint
      const iconAlt = el.querySelector('.activityiconcontainer img')?.getAttribute('alt') || '';

      // Classify
      const classification = CL.classify({ type: 'event', name: rawTitle, raw_title: rawTitle });

      if (classification.skip) {
        skipped.push({ name: rawTitle, reason: classification.skip_reason });
        return;
      }

      items.push({
        raw_title: rawTitle,
        event_id: eventId,
        url: url,
        course_id: courseId,
        date_timestamp: dateTimestamp,
        raw_date_text: rawDateText,
        icon_alt: iconAlt,
        // Parsed fields
        iso_date: dateParsed.iso_date,
        time: dateParsed.time,
        date_confidence: dateParsed.confidence,
        needs_llm: dateParsed.needs_llm,
        // Classification
        category: classification.category,
        event_type: classification.event_type,
        extractor: 'dashboard'
      });
    });

    // Also check upcoming events sidebar
    const upcomingItems = qa('.block_calendar_upcoming [data-region="event-item"]');
    upcomingItems.forEach((el, idx) => {
      const link = q('a[data-action="view-event"]', el);
      if (!link) return;

      const rawTitle = link.getAttribute('title') || textOf(link);
      const eventId = link.getAttribute('data-event-id') || '';
      const url = hrefOf(link);

      // Avoid duplicates with main list
      if (items.some(i => i.event_id === eventId)) return;

      const rawDateText = textOf(q('.date', el));
      const dateParsed = DP.parseMoodleDate(rawDateText, null);
      const classification = CL.classify({ type: 'event', name: rawTitle, raw_title: rawTitle });

      if (classification.skip) {
        skipped.push({ name: rawTitle, reason: classification.skip_reason });
        return;
      }

      items.push({
        raw_title: rawTitle,
        event_id: eventId,
        url: url,
        course_id: DP.extractCourseIdFromUrl(url),
        date_timestamp: null,
        raw_date_text: rawDateText,
        icon_alt: '',
        iso_date: dateParsed.iso_date,
        time: dateParsed.time,
        date_confidence: dateParsed.confidence,
        needs_llm: dateParsed.needs_llm,
        category: classification.category,
        event_type: classification.event_type,
        extractor: 'dashboard_sidebar'
      });
    });

    DBG.info(`Dashboard: ${items.length} items extracted, ${skipped.length} skipped`);
    return { items, skipped };
  }

  // ══════════════════════════════════════════
  //  EXTRACTOR 2 — COURSE PAGE
  // ══════════════════════════════════════════

  function extractCourse() {
    // Course metadata
    const h1 = q('.page-header-headings h1') || q('#region-main h1');
    const courseFullName = textOf(h1);
    const courseParsed = CL.parseCourseName(courseFullName);
    const courseId = DP.extractCourseIdFromUrl(location.href) ||
      (document.body.className.match(/course-(\d+)/) || [])[1] || '';

    DBG.info(`Course: "${courseFullName}" (id=${courseId})`);

    const items = [];
    const skipped = [];
    const modules = qa('[class*="modtype_"]');

    DBG.info(`Course: found ${modules.length} module elements`);

    modules.forEach((mod, idx) => {
      // Determine type
      const classList = [...mod.classList];
      const modTypeClass = classList.find(c => c.startsWith('modtype_'));
      const modType = modTypeClass ? modTypeClass.replace('modtype_', '') : 'unknown';

      if (CL.shouldSkip(modType)) {
        const name = mod.querySelector('.instancename')?.textContent.trim() || `#${idx}`;
        skipped.push({ name, reason: `${modType}_skipped` });
        return;
      }

      // Module ID
      const moduleEl = mod.closest('[id^="module-"]') || mod;
      const moduleId = (moduleEl.id || mod.id || '').replace('module-', '') ||
        mod.getAttribute('data-id') || '';

      // Name — try multiple strategies
      const inner = mod.querySelector('.activity-item') || mod;
      let name = inner.getAttribute('data-activityname') || '';
      if (!name) {
        const instancename = mod.querySelector('.instancename');
        if (instancename) {
          // Strip sr-only accessibility text
          const clone = instancename.cloneNode(true);
          const srOnly = clone.querySelector('.sr-only');
          if (srOnly) srOnly.remove();
          name = clone.textContent.trim();
        }
      }
      if (!name) {
        const activityLink = mod.querySelector('.activityname a');
        if (activityLink) name = activityLink.textContent.trim();
      }

      if (!name) { DBG.warn(`Course module ${idx}: no name found (type=${modType})`); return; }

      // URL
      const linkEl = mod.querySelector('a.aalink') ||
        mod.querySelector('.activityname a') ||
        mod.querySelector('a[href*="/mod/"]');
      const url = hrefOf(linkEl);

      // Inline date text (Moodle shows "Due: X" on some activities)
      const inlineDate = textOf(mod.querySelector('.activity-dates')) ||
        textOf(mod.querySelector('[data-region="activity-dates"]')) || null;

      // Section/topic name
      const section = findParentSection(mod);
      const sectionName = section ? textOf(section.querySelector('.sectionname')) : null;

      // Detect embedded date in name
      const embeddedDate = DP.detectEmbeddedDate(name);

      // Classification
      const classification = CL.classify({ type: modType, name });

      if (classification.skip) {
        skipped.push({ name, reason: classification.skip_reason });
        return;
      }

      items.push({
        name: name,
        module_id: moduleId,
        type: modType,
        url: url,
        inline_date_text: inlineDate,
        section_name: sectionName,
        name_embedded_date: embeddedDate ? embeddedDate.iso_date : null,
        name_embedded_date_confidence: embeddedDate ? embeddedDate.confidence : null,
        // Course context
        course_id: courseId,
        course_code: courseParsed.code,
        course_name: courseParsed.short_name || courseFullName,
        // Classification
        category: classification.category,
        event_type: classification.event_type,
        extractor: 'course'
      });
    });

    DBG.info(`Course: ${items.length} items, ${skipped.length} skipped`);
    return {
      course: {
        full_name: courseFullName,
        code: courseParsed.code,
        short_name: courseParsed.short_name,
        course_id: courseId
      },
      items,
      skipped
    };
  }

  // ══════════════════════════════════════════
  //  EXTRACTOR 3 — CALENDAR
  // ══════════════════════════════════════════

  function extractCalendar() {
    const items = [];
    const eventLinks = qa('a[data-event-id][title]');

    DBG.info(`Calendar: found ${eventLinks.length} event links`);

    eventLinks.forEach(link => {
      const title = link.getAttribute('title') || '';
      const eventId = link.getAttribute('data-event-id') || '';
      const url = hrefOf(link);

      // Walk up to parent day cell for timestamp
      const dayCell = link.closest('[data-region="day"]');
      const dayTimestamp = dayCell ? parseInt(dayCell.getAttribute('data-new-event-timestamp'), 10) : null;

      const courseId = DP.extractCourseIdFromUrl(url);

      // Event subtype from class
      const subtype = detectEventSubtype(link.className);

      // Parse date
      const dateParsed = DP.parseMoodleDate(null, dayTimestamp);

      // Classify from title
      const classification = CL.classify({ type: 'event', name: title, raw_title: title });

      if (!title) return;

      items.push({
        raw_title: title,
        event_id: eventId,
        url: url,
        course_id: courseId,
        day_timestamp: dayTimestamp,
        event_subtype: subtype,
        // Parsed
        iso_date: dateParsed.iso_date,
        time: dateParsed.time,
        date_confidence: dateParsed.confidence,
        needs_llm: dateParsed.needs_llm,
        // Classification
        category: classification.category,
        event_type: classification.event_type,
        extractor: 'calendar'
      });
    });

    // Also scrape upcoming sidebar if present
    const upcomingItems = qa('.block_calendar_upcoming [data-region="event-item"]');
    upcomingItems.forEach(el => {
      const link = q('a[data-action="view-event"]', el);
      if (!link) return;
      const eventId = link.getAttribute('data-event-id') || '';
      if (items.some(i => i.event_id === eventId)) return;

      const title = link.getAttribute('title') || textOf(link);
      const url = hrefOf(link);
      const rawDateText = textOf(q('.date', el));
      const dateParsed = DP.parseMoodleDate(rawDateText, null);
      const classification = CL.classify({ type: 'event', name: title });

      if (!title) return;

      items.push({
        raw_title: title,
        event_id: eventId,
        url: url,
        course_id: DP.extractCourseIdFromUrl(url),
        day_timestamp: null,
        event_subtype: 'upcoming',
        iso_date: dateParsed.iso_date,
        time: dateParsed.time,
        date_confidence: dateParsed.confidence,
        needs_llm: dateParsed.needs_llm,
        category: classification.category,
        event_type: classification.event_type,
        extractor: 'calendar_sidebar'
      });
    });

    DBG.info(`Calendar: ${items.length} items extracted`);
    return { items, skipped: [] };
  }

  function detectEventSubtype(className) {
    if (!className) return 'unknown';
    if (className.includes('calendar_event_course')) return 'course_event';
    if (className.includes('calendar_event_user')) return 'user_event';
    if (className.includes('calendar_event_site')) return 'site_event';
    if (className.includes('calendar_event_group')) return 'group_event';
    return 'unknown';
  }

  // ══════════════════════════════════════════
  //  EXTRACTOR 4 — MY COURSES (async)
  // ══════════════════════════════════════════

  function waitForCourses(timeout = 15000) {
    return new Promise(resolve => {
      const startTime = Date.now();

      function check() {
        // Look for actual course cards, filter out pulse placeholders
        const cards = document.querySelectorAll('[data-region="course-card"], a[href*="/course/view.php?id="]');
        const realCards = [...cards].filter(c => {
          // Filter out loading placeholders
          return !c.querySelector('.bg-pulse-grey') && c.textContent.trim().length > 0;
        });

        if (realCards.length > 0) {
          DBG.info(`My Courses: ${realCards.length} real cards found after ${Date.now() - startTime}ms`);
          return resolve(realCards);
        }
        if (Date.now() - startTime >= timeout) {
          DBG.warn(`My Courses: timed out after ${timeout}ms, returning ${cards.length} items`);
          return resolve([...cards]);
        }
        setTimeout(check, 300);
      }
      check();
    });
  }

  async function extractMyCourses() {
    const courseCards = await waitForCourses();
    const items = [];

    courseCards.forEach(card => {
      // Handle both <a> elements and containers with <a> inside
      const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/course/view.php?id="]');
      if (!link) return;

      const url = link.getAttribute('href') || link.href || '';
      const courseId = DP.extractCourseIdFromUrl(url);
      const fullName = (link.textContent || link.getAttribute('title') || '').trim();

      if (!fullName || !url) return;

      // Look for progress bar
      const progressBar = card.querySelector('[role="progressbar"]');
      const progress = progressBar ? parseInt(progressBar.getAttribute('aria-valuenow') || '0', 10) : null;

      items.push({
        full_name: fullName,
        url: hrefOf(link),
        course_id: courseId,
        progress: progress,
        extractor: 'my_courses'
      });
    });

    DBG.info(`My Courses: ${items.length} courses extracted`);
    return { items, skipped: [] };
  }

  // ══════════════════════════════════════════
  //  EXTRACTOR 5 — SINGLE ASSIGNMENT
  // ══════════════════════════════════════════

  function extractAssignment() {
    const title = textOf(q('.page-header-headings h1')) || textOf(q('h1'));
    const courseId = DP.extractCourseIdFromUrl(location.href);
    const url = location.href;

    // Submission status table values
    const dueDate = findTableValue('Due date');
    const status = findTableValue('Submission status');
    const gradingStatus = findTableValue('Grading status');
    const timeRemaining = findTableValue('Time remaining');
    const description = textOf(q('#intro'));

    // Parse due date
    const dueDateParsed = DP.parseMoodleDate(dueDate, null);

    return {
      items: [{
        raw_title: title,
        url: url,
        course_id: courseId,
        type: 'assign',
        due_date_text: dueDate,
        submission_status: status,
        grading_status: gradingStatus,
        time_remaining: timeRemaining,
        description: description || null,
        iso_date: dueDateParsed.iso_date,
        time: dueDateParsed.time,
        date_confidence: dueDateParsed.confidence,
        needs_llm: dueDateParsed.needs_llm,
        category: 'event',
        event_type: 'assignment',
        extractor: 'assignment'
      }],
      skipped: []
    };
  }

  // Export all extractors
  root.UniFlowExtractors = {
    extractDashboard,
    extractCourse,
    extractCalendar,
    extractMyCourses,
    extractAssignment,
    // Helpers exposed for testing
    findParentSection,
    findTableValue,
    detectEventSubtype
  };
})(typeof self !== 'undefined' ? self : this);
