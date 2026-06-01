/**
 * UniFlow — Web Bridge Content Script
 *
 * Runs on the UniFlow web app domain (localhost / deployed).
 * Reads data that the Spectrum content script stored in chrome.storage.local
 * and pushes it into the UniFlow page's window.localStorage.
 *
 * This bridges the cross-origin gap: the Spectrum content script
 * runs on spectrum.um.edu.my and cannot write to the UniFlow page's
 * localStorage directly.
 */
(() => {
  'use strict';

  const STORAGE_KEYS = [
    'spectrum_pending',
    'spectrum_resources_all'
  ];

  // Track last known state to avoid unnecessary writes
  let lastPendingHash = '';
  let lastResourcesHash = '';

  function hashStr(str) {
    let hash = 0;
    const s = typeof str === 'string' ? str : JSON.stringify(str);
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }

  /**
   * Merge Spectrum events directly into Store.events via localStorage.
   * This is the single source of truth — screens read from Store.events,
   * not from a temporary spectrumSync key that gets cleared.
   */
  function mergeEventsIntoStore(events) {
    if (!events || events.length === 0) return false;

    var raw = window.localStorage.getItem('uniflow_events');
    var existing = raw ? JSON.parse(raw) : [];
    var newCount = 0;

    events.forEach(function(e) {
      // Dedupe: skip if already merged (match on source + title + date or source_url)
      var isDuplicate = existing.some(function(ex) {
        if (ex.source !== 'spectrum') return false;
        if (e.date && ex.date) return ex.title === e.title && ex.date === e.date;
        return ex.title === e.title && (ex.source_url || '') === (e.source_url || '');
      });
      if (!isDuplicate) {
        existing.push({
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          title: e.title,
          date: e.date || '',
          time: e.time || null,
          type: e.type || 'other',
          source: 'spectrum',
          source_url: e.source_url || '',
          course_code: e.course_code || '',
          course_name: e.course_name || '',
          completion_status: e.completion_status || null,
          completed: false,
          createdAt: new Date().toISOString()
        });
        newCount++;
      }
    });

    if (newCount > 0) {
      window.localStorage.setItem('uniflow_events', JSON.stringify(existing));
    }
    return newCount > 0;
  }

  /**
   * Merge Spectrum resources directly into Store.spectrumResources via localStorage.
   */
  function mergeResourcesIntoStore(resources) {
    if (!resources || resources.length === 0) return false;

    var raw = window.localStorage.getItem('uniflow_spectrumResources');
    var existing = raw ? JSON.parse(raw) : [];
    var existingByKey = {};
    existing.forEach(function(r) {
      var key = (r.url || r.source_url || '') || ('_t_' + (r.title || ''));
      if (key) existingByKey[key] = r;
    });

    var changed = false;
    resources.forEach(function(r) {
      var url = r.url || r.source_url || '';
      var key = url || ('_t_' + (r.title || ''));
      if (!key) return;
      if (existingByKey[key]) {
        // Update with better data if available
        var ex = existingByKey[key];
        ['course_code', 'course_name', 'file_type', 'section', 'title'].forEach(function(field) {
          if (r[field] && r[field] !== 'other' && (!ex[field] || ex[field] === '' || ex[field] === 'other')) {
            ex[field] = r[field];
            changed = true;
          }
        });
      } else {
        existing.push(r);
        existingByKey[key] = r;
        changed = true;
      }
    });

    if (changed) {
      window.localStorage.setItem('uniflow_spectrumResources', JSON.stringify(existing));
    }
    return changed;
  }

  function pushToPageLocalStorage() {
    chrome.storage.local.get(STORAGE_KEYS, (data) => {
      let changed = false;

      if (data.spectrum_pending) {
        const pendingJson = JSON.stringify(data.spectrum_pending);
        const newHash = hashStr(pendingJson);
        if (newHash !== lastPendingHash) {
          lastPendingHash = newHash;
          const pending = data.spectrum_pending;

          // Map events from backend response
          var mappedEvents = (pending.events || []).map(e => ({
            title: e.title,
            date: e.iso_date || e.date || '',
            time: e.time || null,
            type: e.type || 'other',
            source_url: e.source_url || '',
            course_code: e.course_code || '',
            course_name: e.course_name || '',
            completion_status: e.completion_status || null,
            module_id: e.module_id || null,
            event_id: e.event_id || null
          }));

          // Map resources from backend response
          var mappedResources = (pending.resources || []).map(r => ({
            title: r.title,
            url: r.url || r.source_url || '',
            type: r.type || 'resource',
            modtype: r.modtype || '',
            course_code: r.course_code || '',
            course_name: r.course_name || '',
            section: r.section || '',
            file_type: r.file_type || 'other'
          }));

          // Also write spectrumSync for backwards compatibility with screens that read it
          // But the PRIMARY merge happens via mergeEventsIntoStore/mergeResourcesIntoStore
          window.localStorage.setItem('uniflow_spectrumSync', JSON.stringify({
            events: mappedEvents,
            resources: mappedResources,
            synced_at: pending.synced_at || new Date().toISOString()
          }));

          // DIRECTLY merge into Store's localStorage keys — this is the reliable path
          var eventsChanged = mergeEventsIntoStore(mappedEvents);
          var resourcesChanged = mergeResourcesIntoStore(mappedResources);

          // Store sync time
          window.localStorage.setItem('uniflow_lastSpectrumSyncTime', JSON.stringify(
            pending.synced_at || new Date().toISOString()
          ));

          changed = true;

          // Clean up spectrum_pending from chrome.storage after bridging
          chrome.storage.local.remove('spectrum_pending');
        }
      }

      if (data.spectrum_resources_all) {
        const resJson = JSON.stringify(data.spectrum_resources_all);
        const newResHash = hashStr(resJson);
        if (newResHash !== lastResourcesHash) {
          lastResourcesHash = newResHash;
          // Merge accumulated resources from all imports
          var accChanged = mergeResourcesIntoStore(data.spectrum_resources_all);
          changed = true;
        }
      }

      if (changed) {
        // Dispatch event so the page can react immediately
        window.dispatchEvent(new CustomEvent('uniflow:spectrum-data-ready', {}));
      }
    });
  }

  // Run immediately on load
  pushToPageLocalStorage();

  // Poll every 3 seconds to detect new imports from the extension
  setInterval(pushToPageLocalStorage, 3000);

  // Also listen for explicit messages from other extension components
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'BRIDGE_DATA_UPDATE') {
      pushToPageLocalStorage();
      sendResponse({ status: 'ok' });
    }
  });
})();
