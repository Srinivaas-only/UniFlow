/**
 * UniFlow — Spectrum Content Script V2
 *
 * Runs on spectrum.um.edu.my. Dispatches to extractors, handles
 * message protocol with popup, and sends data to backend.
 *
 * Depends on (loaded via manifest): lib/debug.js, lib/dateParser.js,
 * lib/classifier.js, lib/dedupe.js, lib/extractors.js
 */
(() => {
  'use strict';

  const BACKEND_URL = 'http://localhost:8000';
  const EX = window.UniFlowExtractors;
  const DBG = window.UniFlowDebug;
  const DEDUPE = window.UniFlowDedupe;

  // ── Page Detection ──

  function detectPageType() {
    const body = document.body ? document.body.className : '';
    const path = location.pathname;

    if (body.includes('pagelayout-mydashboard')) return 'dashboard';
    if (body.includes('path-course-view') || body.includes('pagelayout-incourse')) return 'course';
    if (body.includes('path-calendar')) return 'calendar';
    if (path.includes('/my/courses') || body.includes('pagelayout-mycourses')) return 'my_courses';
    if (body.includes('path-mod-assign')) return 'assignment';
    if (body.includes('path-mod-quiz')) return 'quiz';
    return 'unknown';
  }

  // ── Quick preview counts (fast, no full extraction) ──

  function getPreviewInfo(pageType) {
    let previewName = '';
    let previewCount = 0;
    let breakdown = {};

    switch (pageType) {
      case 'dashboard': {
        const items = document.querySelectorAll('[data-region="event-item"]');
        previewCount = items.length;
        breakdown = { events: previewCount };
        break;
      }
      case 'course': {
        const h1 = document.querySelector('.page-header-headings h1') ||
                    document.querySelector('#region-main h1');
        previewName = h1 ? h1.textContent.trim() : '';
        const all = document.querySelectorAll('[class*="modtype_"]');
        previewCount = all.length;
        // Quick breakdown by type
        all.forEach(el => {
          const cls = [...el.classList].find(c => c.startsWith('modtype_'));
          const t = cls ? cls.replace('modtype_', '') : 'other';
          breakdown[t] = (breakdown[t] || 0) + 1;
        });
        break;
      }
      case 'calendar': {
        const links = document.querySelectorAll('a[data-event-id][title]');
        previewCount = links.length;
        breakdown = { events: previewCount };
        break;
      }
      case 'my_courses': {
        const cards = document.querySelectorAll('a[href*="/course/view.php?id="]');
        previewCount = cards.length;
        breakdown = { courses: previewCount };
        break;
      }
      case 'assignment': {
        const h1 = document.querySelector('h1');
        previewName = h1 ? h1.textContent.trim() : 'Assignment';
        previewCount = 1;
        breakdown = { assignment: 1 };
        break;
      }
    }

    return { pageType, previewCount, previewName, breakdown };
  }

  // ── Full extraction dispatch ──

  async function runExtraction(pageType) {
    DBG.info(`Starting extraction for page type: ${pageType}`);
    let result;

    switch (pageType) {
      case 'dashboard':
        result = EX.extractDashboard();
        break;
      case 'course':
        result = EX.extractCourse();
        break;
      case 'calendar':
        result = EX.extractCalendar();
        break;
      case 'my_courses':
        result = await EX.extractMyCourses();
        break;
      case 'assignment':
      case 'quiz':
        result = EX.extractAssignment();
        break;
      default:
        throw new Error(`Unknown page type: ${pageType}`);
    }

    DBG.info(`Extraction complete: ${(result.items || []).length} items, ${(result.skipped || []).length} skipped`);

    // Build payload
    const payload = {
      type: `${pageType}_import`,
      source_url: location.href,
      extracted_at: new Date().toISOString(),
      course_context: result.course || null,
      raw_items: result.items || [],
      skipped: result.skipped || []
    };

    return payload;
  }

  // ── Send to backend ──

  async function sendToBackend(payload) {
    try {
      const response = await fetch(BACKEND_URL + '/api/spectrum-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        DBG.warn('Backend unreachable, storing locally');
        const storageKey = 'uniflow_pending_' + payload.type;
        await chrome.storage.local.set({ [storageKey]: payload });
        throw new Error('Backend not running. Data saved locally. Start the backend and try again.');
      }
      throw err;
    }
  }

  // ── Message handler ──

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Detect page + quick preview
    if (request.action === 'DETECT_PAGE') {
      const pageType = detectPageType();
      const preview = getPreviewInfo(pageType);
      sendResponse(preview);
      return false;
    }

    // Full extraction (for preview)
    if (request.action === 'EXTRACT') {
      (async () => {
        try {
          const pageType = detectPageType();
          const payload = await runExtraction(pageType);

          // Check against dedupe history
          const history = await DEDUPE.loadImportHistory();
          payload.raw_items.forEach(item => {
            item._already_imported = DEDUPE.isAlreadyImported(item, history);
          });

          sendResponse({ status: 'ok', payload });
        } catch (err) {
          DBG.error('Extraction failed:', err);
          sendResponse({ status: 'error', message: err.message });
        }
      })();
      return true;
    }

    // Commit selected items to backend
    if (request.action === 'COMMIT') {
      (async () => {
        try {
          const { items, type } = request;
          DBG.info(`Committing ${items.length} items of type ${type}`);

          const payload = {
            type: type,
            source_url: location.href,
            extracted_at: new Date().toISOString(),
            raw_items: items
          };

          const result = await sendToBackend(payload);
          DBG.info('Backend response:', result);

          // Mark items as imported in dedupe history
          const history = await DEDUPE.loadImportHistory();
          DEDUPE.markImported(items, history);
          await DEDUPE.saveImportHistory(history);

          // Store result for frontend pickup
          await chrome.storage.local.set({
            spectrum_pending: result,
            last_spectrum_sync_time: new Date().toISOString()
          });

          sendResponse({
            status: 'success',
            events_count: (result.events || []).length,
            resources_count: (result.resources || []).length,
            imported_count: result.imported_count || 0,
            message: result.message || 'Import complete'
          });
        } catch (err) {
          DBG.error('Commit failed:', err);
          sendResponse({ status: 'error', message: err.message });
        }
      })();
      return true;
    }

    // Toggle debug mode
    if (request.action === 'SET_DEBUG') {
      DBG.setDebugMode(request.enabled);
      sendResponse({ status: 'ok', debugMode: request.enabled });
      return false;
    }

    // Download debug bundle
    if (request.action === 'DOWNLOAD_DEBUG') {
      DBG.downloadDebugBundle(request.data || {});
      sendResponse({ status: 'ok' });
      return false;
    }
  });

  DBG.info(`Content script V2 loaded on ${location.href} (page type: ${detectPageType()})`);
})();
