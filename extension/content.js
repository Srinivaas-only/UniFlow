/**
 * UniFlow — Spectrum (Moodle) Content Script
 * Runs on spectrum.um.edu.my, scrapes DOM data when invoked by popup.
 */
(() => {
  'use strict';

  const BACKEND_URL = 'http://localhost:8000';

  // ── Page Detection ──
  function detectPageType() {
    const body = document.body ? document.body.className : '';
    const path = location.pathname;

    if (body.includes('pagelayout-mydashboard')) return 'dashboard';
    if (body.includes('path-course-view') || body.includes('pagelayout-course')) return 'course';
    if (body.includes('path-calendar')) return 'calendar';
    if (path.includes('/my/courses') || body.includes('pagelayout-mycourses')) return 'my_courses';
    return 'unknown';
  }

  // ── Dashboard Scraper ──
  function scrapeDashboard() {
    const items = [];
    const eventItems = document.querySelectorAll('[data-region="event-item"]');

    eventItems.forEach(el => {
      const link = el.querySelector('a[data-action="view-event"]');
      if (!link) return;

      const title = link.getAttribute('title') || link.textContent.trim();
      const eventId = link.getAttribute('data-event-id') || '';
      const url = link.getAttribute('href') || '';
      const dateEl = el.querySelector('.date.small');
      const dateText = dateEl ? dateEl.textContent.trim() : '';

      if (!title) return;

      items.push({
        title: title,
        event_id: eventId,
        url: url.startsWith('http') ? url : 'https://spectrum.um.edu.my' + url,
        date_text: dateText,
        raw_type: 'event'
      });
    });

    return {
      type: 'dashboard_import',
      source_url: location.href,
      items: items
    };
  }

  // ── Course Scraper ──
  function scrapeCourse() {
    // Course name
    let courseName = '';
    const h1 = document.querySelector('.page-header-headings h1') || document.querySelector('#region-main h1');
    if (h1) courseName = h1.textContent.trim();

    // Course ID from URL
    const idMatch = location.search.match(/[?&]id=(\d+)/);
    const courseId = idMatch ? idMatch[1] : '';

    // Also try body class
    if (!courseId) {
      const bodyClasses = document.body.className;
      const bodyMatch = bodyClasses.match(/course-(\d+)/);
      if (bodyMatch) courseId = bodyMatch[1];
    }

    const SKIP_TYPES = ['attendance', 'label'];
    const items = [];

    // Find all activity modules
    const modules = document.querySelectorAll('[class*="modtype_"]');
    modules.forEach(mod => {
      // Determine type
      let modType = '';
      const classList = mod.className;
      const typeMatch = classList.match(/modtype_(\w+)/);
      if (typeMatch) modType = typeMatch[1].toLowerCase();

      if (SKIP_TYPES.includes(modType)) return;

      // Name
      let name = '';
      const instancename = mod.querySelector('.instancename');
      if (instancename) {
        // Strip accessibility suffix like "Assignment" that Moodle adds
        const srOnly = instancename.querySelector('.sr-only');
        if (srOnly) srOnly.remove();
        name = instancename.textContent.trim();
      }
      // Fallback to data-activityname
      if (!name) {
        const activityItem = mod.querySelector('[data-activityname]');
        if (activityItem) name = activityItem.getAttribute('data-activityname') || '';
      }
      if (!name) return;

      // Link
      const linkEl = mod.querySelector('.activityname a') || mod.querySelector('a[href*="mod/"]');
      const url = linkEl ? linkEl.getAttribute('href') || '' : '';

      // Module ID
      let moduleId = '';
      const parent = mod.closest('[id^="module-"]') || mod;
      const idAttr = parent.id || mod.id || '';
      const modIdMatch = idAttr.match(/module-(\d+)/);
      if (modIdMatch) moduleId = modIdMatch[1];

      items.push({
        name: name,
        type: modType || 'unknown',
        url: url.startsWith('http') ? url : (url ? 'https://spectrum.um.edu.my' + url : ''),
        module_id: moduleId
      });
    });

    return {
      type: 'course_import',
      source_url: location.href,
      course_name: courseName,
      course_id: courseId,
      items: items
    };
  }

  // ── Calendar Scraper ──
  function scrapeCalendar() {
    const items = [];
    const eventLinks = document.querySelectorAll('a[data-event-id][title]');

    eventLinks.forEach(link => {
      const title = link.getAttribute('title') || '';
      const eventId = link.getAttribute('data-event-id') || '';
      const url = link.getAttribute('href') || '';

      // Walk up to find the day container with timestamp
      let timestamp = null;
      let parent = link.parentElement;
      for (let i = 0; i < 10 && parent; i++) {
        if (parent.hasAttribute && parent.hasAttribute('data-new-event-timestamp')) {
          timestamp = parseInt(parent.getAttribute('data-new-event-timestamp'), 10);
          break;
        }
        parent = parent.parentElement;
      }

      if (!title) return;

      items.push({
        title: title,
        event_id: eventId,
        url: url.startsWith('http') ? url : (url ? 'https://spectrum.um.edu.my' + url : ''),
        timestamp: timestamp
      });
    });

    return {
      type: 'calendar_import',
      source_url: location.href,
      items: items
    };
  }

  // ── My Courses Scraper (async load) ──
  function waitForCourses(maxWaitMs = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = 500;

      function check() {
        const courseLinks = document.querySelectorAll('a[href*="/course/view.php?id="]');
        if (courseLinks.length > 0) {
          resolve(courseLinks);
          return;
        }
        if (Date.now() - startTime >= maxWaitMs) {
          resolve(courseLinks); // return whatever we have
          return;
        }
        setTimeout(check, interval);
      }
      check();
    });
  }

  async function scrapeMyCourses() {
    const courseLinks = await waitForCourses();
    const items = [];

    courseLinks.forEach(link => {
      const name = link.textContent.trim();
      const url = link.getAttribute('href') || '';
      const idMatch = url.match(/[?&]id=(\d+)/);
      const courseId = idMatch ? idMatch[1] : '';

      if (!name) return;

      items.push({
        name: name,
        url: url.startsWith('http') ? url : 'https://spectrum.um.edu.my' + url,
        course_id: courseId
      });
    });

    return {
      type: 'courses_import',
      source_url: location.href,
      items: items
    };
  }

  // ── Send to Backend ──
  async function sendToBackend(data) {
    try {
      const response = await fetch(BACKEND_URL + '/api/spectrum-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      // If backend unreachable, store locally for later
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.warn('[UniFlow] Backend unreachable, storing data locally');
        // Store in chrome.storage for later retrieval
        const storageKey = 'uniflow_pending_' + data.type;
        await chrome.storage.local.set({ [storageKey]: data });
        throw new Error('Backend not running. Data saved locally. Start the backend and try again.');
      }
      throw err;
    }
  }

  // ── Message Handler ──
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DETECT_PAGE') {
      const pageType = detectPageType();
      let previewCount = 0;
      let previewName = '';

      switch (pageType) {
        case 'dashboard':
          previewCount = document.querySelectorAll('[data-region="event-item"]').length;
          break;
        case 'course': {
          const h1 = document.querySelector('.page-header-headings h1') || document.querySelector('#region-main h1');
          previewName = h1 ? h1.textContent.trim() : '';
          previewCount = document.querySelectorAll('[class*="modtype_"]').length;
          break;
        }
        case 'calendar':
          previewCount = document.querySelectorAll('a[data-event-id][title]').length;
          break;
        case 'my_courses':
          previewCount = document.querySelectorAll('a[href*="/course/view.php?id="]').length;
          break;
      }

      sendResponse({ pageType, previewCount, previewName });
      return false;
    }

    if (request.action === 'START_IMPORT') {
      (async () => {
        try {
          const pageType = detectPageType();
          let scrapedData;

          switch (pageType) {
            case 'dashboard':
              scrapedData = scrapeDashboard();
              break;
            case 'course':
              scrapedData = scrapeCourse();
              break;
            case 'calendar':
              scrapedData = scrapeCalendar();
              break;
            case 'my_courses':
              scrapedData = await scrapeMyCourses();
              break;
            default:
              chrome.runtime.sendMessage({ status: 'error', message: 'Unknown page type' });
              return;
          }

          console.log('[UniFlow] Scraped data:', scrapedData);

          if (scrapedData.items.length === 0) {
            chrome.runtime.sendMessage({ status: 'empty', message: 'No items found on this page' });
            return;
          }

          // Send to backend
          const result = await sendToBackend(scrapedData);
          console.log('[UniFlow] Backend response:', result);

          // Also store result in chrome.storage for frontend pickup
          await chrome.storage.local.set({ last_spectrum_sync: result });

          chrome.runtime.sendMessage({
            status: 'success',
            imported_count: result.imported_count || 0,
            events_count: (result.events || []).length,
            resources_count: (result.resources || []).length,
            message: result.message || 'Import complete'
          });

        } catch (err) {
          console.error('[UniFlow] Import failed:', err);
          chrome.runtime.sendMessage({ status: 'error', message: err.message || 'Import failed' });
        }
      })();

      return true; // async response
    }
  });

  console.log('[UniFlow] Content script loaded on', location.href);
})();
