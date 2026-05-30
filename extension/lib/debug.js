/**
 * UniFlow — Debug Logger
 *
 * When debug mode is enabled, logs every selector hit/miss to console
 * and provides a "Download Debug Bundle" function.
 */
(function (root) {
  'use strict';

  const PREFIX = '[UniFlow]';
  const DEBUG_PREFIX = '[UniFlow DEBUG]';

  let _debugMode = false;

  /**
   * Enable or disable debug mode.
   * @param {boolean} enabled
   */
  function setDebugMode(enabled) {
    _debugMode = !!enabled;
    console.log(PREFIX, `Debug mode ${_debugMode ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if debug mode is on.
   */
  function isDebugMode() {
    return _debugMode;
  }

  /**
   * Log a debug message (only if debug mode is on).
   */
  function debug(...args) {
    if (_debugMode) console.log(DEBUG_PREFIX, ...args);
  }

  /**
   * Log a warning (always visible, but extra context in debug mode).
   */
  function warn(...args) {
    console.warn(PREFIX, ...args);
  }

  /**
   * Log an error (always visible).
   */
  function error(...args) {
    console.error(PREFIX, ...args);
  }

  /**
   * Log an info message (always visible).
   */
  function info(...args) {
    console.log(PREFIX, ...args);
  }

  /**
   * Log a selector result — what we searched for and what we found.
   * Only logs in debug mode.
   * @param {string} context — e.g. "dashboard:event_link"
   * @param {string} selector — CSS selector used
   * @param {Element|null} result — what was found
   * @param {string} [value] — extracted value
   */
  function logSelector(context, selector, result, value) {
    if (!_debugMode) return;
    const status = result ? '✅ HIT' : '❌ MISS';
    const valStr = value !== undefined ? ` → "${String(value).slice(0, 100)}"` : '';
    console.log(`${DEBUG_PREFIX} ${status} [${context}] ${selector}${valStr}`);
  }

  /**
   * Build and download a debug bundle JSON file.
   * Contains everything about the current extraction for debugging.
   * @param {object} data — { pageUrl, bodyClass, pageType, rawItems, processedItems, backendResponse, errors }
   */
  function downloadDebugBundle(data) {
    const bundle = {
      timestamp: new Date().toISOString(),
      page_url: data.pageUrl || location.href,
      body_class: data.bodyClass || document.body.className,
      page_type: data.pageType || 'unknown',
      raw_items: data.rawItems || [],
      processed_items: data.processedItems || [],
      backend_response: data.backendResponse || null,
      errors: data.errors || [],
      user_agent: navigator.userAgent,
      extension_version: '2.0.0'
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uniflow-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export
  root.UniFlowDebug = {
    setDebugMode,
    isDebugMode,
    debug,
    warn,
    error,
    info,
    logSelector,
    downloadDebugBundle
  };
})(typeof self !== 'undefined' ? self : this);
