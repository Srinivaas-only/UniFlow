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

  /**
   * Detect the file type of a course activity from its icon, name, and link URL.
   * Returns: 'pdf' | 'pptx' | 'docx' | 'xlsx' | 'video' | 'audio' |
   *          'link' | 'folder' | 'page' | 'archive' | 'other'
   */
  function detectFileType(activityEl) {
    // 0. Check all image sources in the activity (Moove theme uses multiple icon elements)
    const allImgs = activityEl.querySelectorAll('img');
    const allImgSrcs = [...allImgs].map(img => img.src || img.getAttribute('src') || '').join(' ');

    // 1. Check icon image source (Moodle uses standard icon filenames + Moove monologo variants)
    const iconImg = activityEl.querySelector('.activityiconcontainer img, .activity-icon img, img.icon, img.iconlarge');
    const iconSrc = iconImg?.src || '';
    // Also check SVG use href for inline icons
    const svgUse = activityEl.querySelector('svg use');
    const svgHref = svgUse?.getAttribute('href') || svgUse?.getAttribute('xlink:href') || '';

    const combinedSrc = (iconSrc + ' ' + allImgSrcs + ' ' + svgHref).toLowerCase();

    if (combinedSrc.includes('pdf') || combinedSrc.includes('pdf-monologo')) return 'pdf';
    if (combinedSrc.includes('powerpoint') || combinedSrc.includes('pptx') || combinedSrc.includes('powerpoint-monologo')) return 'pptx';
    if (combinedSrc.includes('document') || combinedSrc.includes('docx') || combinedSrc.includes('word') || combinedSrc.includes('word-monologo')) return 'docx';
    if (combinedSrc.includes('spreadsheet') || combinedSrc.includes('xlsx') || combinedSrc.includes('excel') || combinedSrc.includes('spreadsheet-monologo')) return 'xlsx';
    if (combinedSrc.includes('video') || combinedSrc.includes('mp4') || combinedSrc.includes('movie')) return 'video';
    if (combinedSrc.includes('audio') || combinedSrc.includes('mp3')) return 'audio';
    if (combinedSrc.includes('archive') || combinedSrc.includes('zip')) return 'archive';

    // 2. Check activity name for file extension hints
    const name = activityEl.getAttribute('data-activityname') ||
                 activityEl.querySelector('.instancename')?.textContent || '';
    if (/\.(pdf)\b/i.test(name)) return 'pdf';
    if (/\.(pptx?|ppt)\b/i.test(name)) return 'pptx';
    if (/\.(docx?|doc)\b/i.test(name)) return 'docx';
    if (/\.(xlsx?|xls)\b/i.test(name)) return 'xlsx';
    if (/\.(mp4|mov|avi|webm)\b/i.test(name)) return 'video';
    if (/\.(mp3|wav|m4a)\b/i.test(name)) return 'audio';
    if (/\.(zip|rar|7z|tar)\b/i.test(name)) return 'archive';

    // 3. Check the resource link URL for file extension hints
    // modtype_resource links may redirect to actual files, but the anchor href has clues
    const linkEl = activityEl.querySelector('a.aalink, .activityname a, a[href*="/mod/"]');
    const linkHref = linkEl?.getAttribute('href') || linkEl?.href || '';

    // 4. Check pluginfile.php URLs in any element (actual file download links)
    const pluginfileLinks = activityEl.querySelectorAll('a[href*="pluginfile.php"]');
    if (pluginfileLinks.length > 0) {
      const fileUrl = pluginfileLinks[0].getAttribute('href') || '';
      if (/\.pdf/i.test(fileUrl)) return 'pdf';
      if (/\.pptx?/i.test(fileUrl)) return 'pptx';
      if (/\.docx?/i.test(fileUrl)) return 'docx';
      if (/\.xlsx?/i.test(fileUrl)) return 'xlsx';
      if (/\.mp4|\.mov|\.webm/i.test(fileUrl)) return 'video';
    }

    // 5. Check for content type text in the activity's extra info
    const contentText = (activityEl.textContent || '').toLowerCase();
    if (contentText.includes('pdf document') || contentText.includes('.pdf')) return 'pdf';
    if (contentText.includes('powerpoint') || contentText.includes('presentation') || contentText.includes('.pptx')) return 'pptx';
    if (contentText.includes('word document') || contentText.includes('.docx')) return 'docx';
    if (contentText.includes('excel') || contentText.includes('spreadsheet') || contentText.includes('.xlsx')) return 'xlsx';
    if (contentText.includes('video') || contentText.includes('.mp4')) return 'video';

    // 6. Check modtype for structural classification
    const modtype = [...activityEl.classList].find(c => c.startsWith('modtype_'))?.replace('modtype_', '');
    if (modtype === 'url') return 'link';
    if (modtype === 'folder') return 'folder';
    if (modtype === 'book' || modtype === 'page') return 'page';

    return 'other';
  }

  /**
   * Detect completion status of an assignment from Moodle's completion UI.
   * Returns: 'complete' | 'pending' | 'unknown'
   */
  function detectCompletion(activityEl) {
    const completionEl = activityEl.querySelector(
      '[data-region="completion-info"], .completion-info, .completion-icon, ' +
      '[data-region="activity-completion-info"], .activity-completionstatus'
    );
    if (!completionEl) return 'unknown';

    const text = (completionEl.textContent || '').toLowerCase();
    if (text.includes('done') || text.includes('complet')) return 'complete';
    if (text.includes('not done') || text.includes('to do') || text.includes('pending')) return 'pending';

    // Check for completion checkbox state
    const completionCheckbox = activityEl.querySelector('[data-action="toggle-manual-completion"]');
    const ariaPressed = completionCheckbox?.getAttribute('aria-pressed');
    if (ariaPressed === 'true') return 'complete';
    if (ariaPressed === 'false') return 'pending';

    return 'pending'; // safe default for assignments
  }

  /**
   * Infer file type from the Moodle icon alt text (used for dashboard items
   * where the full activity element isn't available).
   */
  function _fileTypeFromIcon(iconAlt) {
    if (!iconAlt) return 'other';
    const alt = iconAlt.toLowerCase();
    if (alt.includes('pdf')) return 'pdf';
    if (alt.includes('powerpoint') || alt.includes('ppt') || alt.includes('slides')) return 'pptx';
    if (alt.includes('word') || alt.includes('document') || alt.includes('doc')) return 'docx';
    if (alt.includes('excel') || alt.includes('spreadsheet')) return 'xlsx';
    if (alt.includes('video') || alt.includes('mp4')) return 'video';
    if (alt.includes('audio') || alt.includes('mp3')) return 'audio';
    if (alt.includes('archive') || alt.includes('zip')) return 'archive';
    if (alt.includes('url') || alt.includes('link')) return 'link';
    if (alt.includes('folder')) return 'folder';
    return 'other';
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
        // File type hint from icon
        file_type: _fileTypeFromIcon(iconAlt),
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

    // Expand ALL collapsed sections so hidden modules become visible in the DOM
    // Moodle Moove theme uses collapsed sections that hide content
    const collapsedSections = qa('.section.collapsed, .course-section.collapsed, [data-state="collapsed"]');
    collapsedSections.forEach(section => {
      section.classList.remove('collapsed');
      section.setAttribute('data-state', 'expanded');
      // Also click any toggle buttons inside
      const toggleBtn = section.querySelector('.section-toggle, .toggle-section, [data-action="toggle-section"]');
      if (toggleBtn) toggleBtn.click();
    });
    // Also click "Expand all" if it exists
    const expandAllBtn = q('#toggle-all-sections, .btn-expand-all, [data-action="expand-all"]');
    if (expandAllBtn) expandAllBtn.click();

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
        // File type detection (for resources)
        file_type: detectFileType(mod),
        // Completion detection (for assignments)
        completion_status: (modType === 'assign') ? detectCompletion(mod) : undefined,
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

      // Strategy 1: Walk up to parent day cell for timestamp
      let dayCell = link.closest('[data-region="day"]');
      let dayTimestamp = dayCell ? parseInt(dayCell.getAttribute('data-new-event-timestamp'), 10) : null;

      // Strategy 2: Check URL for time parameter (calendar view.php?view=day&time=XXXX)
      if (!dayTimestamp || isNaN(dayTimestamp)) {
        const urlTimestamp = DP.extractTimestampFromUrl(url);
        if (urlTimestamp) dayTimestamp = urlTimestamp;
      }

      // Strategy 3: Check href of the link itself for time param
      if (!dayTimestamp || isNaN(dayTimestamp)) {
        const linkHref = link.getAttribute('href') || '';
        const urlTs = DP.extractTimestampFromUrl(linkHref);
        if (urlTs) dayTimestamp = urlTs;
      }

      // Strategy 4: Look for date text in parent container
      // Moodle shows "Friday, 30 May 2026" in the event's context
      let rawDateText = '';
      if (!dayTimestamp) {
        // Check parent elements for date text
        let parent = link.parentElement;
        for (let p = 0; p < 5 && parent; p++) {
          const dateEl = parent.querySelector('.date, [data-region="event-date"], .event-date');
          if (dateEl) {
            rawDateText = textOf(dateEl);
            break;
          }
          // Also check for hidden timestamp attributes
          const tsAttr = parent.getAttribute('data-day-timestamp') || parent.getAttribute('data-timestamp');
          if (tsAttr) {
            const ts = parseInt(tsAttr, 10);
            if (!isNaN(ts)) { dayTimestamp = ts; break; }
          }
          parent = parent.parentElement;
        }
      }

      const courseId = DP.extractCourseIdFromUrl(url);

      // Event subtype from class
      const subtype = detectEventSubtype(link.className);

      // Parse date — prefer timestamp, then raw text
      let dateParsed;
      if (dayTimestamp && !isNaN(dayTimestamp)) {
        dateParsed = DP.parseMoodleDate(null, dayTimestamp);
      } else if (rawDateText) {
        dateParsed = DP.parseMoodleDate(rawDateText, null);
      } else {
        // Last resort: try to extract date from the link's surrounding text
        const surroundingText = (link.parentElement ? link.parentElement.textContent : '') || '';
        dateParsed = DP.parseMoodleDate(surroundingText.trim(), null);
      }

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
