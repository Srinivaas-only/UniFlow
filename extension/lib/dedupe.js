/**
 * UniFlow — Deduplication against chrome.storage
 *
 * Tracks previously imported items by URL + event_id + module_id.
 * Prevents double-imports and marks already-seen items in preview.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'uniflow_imported_items';

  /**
   * Load the set of previously imported item fingerprints.
   * @returns {Promise<Set<string>>}
   */
  async function loadImportHistory() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] || [];
      return new Set(items);
    } catch (e) {
      return new Set();
    }
  }

  /**
   * Save updated import history.
   * @param {Set<string>} history
   */
  async function saveImportHistory(history) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: [...history] });
    } catch (e) {
      console.warn('[UniFlow] Failed to save import history:', e);
    }
  }

  /**
   * Generate a fingerprint for an item.
   * Uses URL (most reliable), then event_id, then module_id + name.
   * @param {object} item
   * @returns {string}
   */
  function fingerprint(item) {
    if (item.url) return `url:${item.url}`;
    if (item.event_id) return `eid:${item.event_id}`;
    if (item.module_id) return `mid:${item.module_id}:${(item.name || '').slice(0, 30)}`;
    return `name:${(item.name || item.raw_title || '').slice(0, 50)}`;
  }

  /**
   * Check if an item has already been imported.
   * @param {object} item
   * @param {Set<string>} history
   * @returns {boolean}
   */
  function isAlreadyImported(item, history) {
    return history.has(fingerprint(item));
  }

  /**
   * Mark items as imported by adding their fingerprints to history.
   * @param {Array<object>} items
   * @param {Set<string>} history
   */
  function markImported(items, history) {
    for (const item of items) {
      history.add(fingerprint(item));
    }
  }

  /**
   * Deduplicate a list of items against each other (intra-list dedup).
   * Keeps the more complete version when duplicates are found.
   * @param {Array<object>} items
   * @returns {Array<object>}
   */
  function dedupeList(items) {
    const seen = new Map();
    const result = [];

    for (const item of items) {
      const fp = fingerprint(item);

      if (!seen.has(fp)) {
        seen.set(fp, item);
        result.push(item);
      } else {
        // Merge: keep the one with more data
        const existing = seen.get(fp);
        const existingFields = Object.values(existing).filter(v => v && v !== '').length;
        const itemFields = Object.values(item).filter(v => v && v !== '').length;
        if (itemFields > existingFields) {
          const idx = result.indexOf(existing);
          if (idx !== -1) result[idx] = item;
          seen.set(fp, item);
        }
      }
    }

    return result;
  }

  // Export
  root.UniFlowDedupe = {
    loadImportHistory,
    saveImportHistory,
    fingerprint,
    isAlreadyImported,
    markImported,
    dedupeList
  };
})(typeof self !== 'undefined' ? self : this);
