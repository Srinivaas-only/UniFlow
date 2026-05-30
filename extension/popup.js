/**
 * UniFlow — Spectrum Importer Popup Controller V2
 *
 * Three-step flow: Detect → Preview (with checkboxes) → Commit → Result
 */
(function() {
  'use strict';

  // DOM refs
  const $ = id => document.getElementById(id);
  const statusDot = $('status-dot');
  const statusLabel = $('status-label');
  const statusBreakdown = $('status-breakdown');
  const previewBtn = $('preview-btn');
  const previewBtnText = $('preview-btn-text');
  const stepDetect = $('step-detect');
  const stepPreview = $('step-preview');
  const stepResult = $('step-result');
  const eventsList = $('events-list');
  const resourcesList = $('resources-list');
  const eventsSection = $('events-section');
  const resourcesSection = $('resources-section');
  const eventsCount = $('events-count');
  const resourcesCount = $('resources-count');
  const previewStatus = $('preview-status');
  const previewBreakdown = $('preview-breakdown');
  const importBtn = $('import-btn');
  const importBtnText = $('import-btn-text');
  const cancelBtn = $('cancel-btn');
  const doneBtn = $('done-btn');
  const resultArea = $('result-area');
  const skippedSection = $('skipped-section');
  const skippedToggle = $('skipped-toggle');
  const skippedList = $('skipped-list');
  const skippedCount = $('skipped-count');
  const debugBtn = $('debug-btn');
  const downloadBtn = $('download-btn');

  let currentPayload = null;
  let currentItemType = '';
  let debugMode = false;
  let tabId = null;

  // ── Helpers ──

  function showStep(step) {
    stepDetect.style.display = step === 'detect' ? 'block' : 'none';
    stepPreview.style.display = step === 'preview' ? 'block' : 'none';
    stepResult.style.display = step === 'result' ? 'block' : 'none';
  }

  function setStatus(state, text, breakdown) {
    statusDot.className = 'status-dot' + (state === 'inactive' ? ' inactive' : state === 'detecting' ? ' detecting' : '');
    statusLabel.textContent = text;
    statusBreakdown.textContent = breakdown || '';
  }

  function sendToTab(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ── Step 1: Detect page ──

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    tabId = tabs[0].id;
    const url = tabs[0].url || '';

    if (!url.includes('spectrum.um.edu.my')) {
      setStatus('inactive', 'Not on Spectrum');
      previewBtn.disabled = true;
      previewBtnText.textContent = 'Navigate to spectrum.um.edu.my';
      return;
    }

    sendToTab({ action: 'DETECT_PAGE' })
      .then(response => {
        if (!response) { setStatus('inactive', 'No response — refresh page'); return; }

        const { pageType, previewCount, previewName, breakdown } = response;

        if (pageType === 'unknown') {
          setStatus('inactive', 'Unsupported page');
          previewBtn.disabled = true;
          previewBtnText.textContent = 'Navigate to a supported page';
          return;
        }

        // Build breakdown text
        const bdParts = Object.entries(breakdown || {}).map(([k, v]) => `${v} ${k}${v !== 1 ? 's' : ''}`);
        const bdText = bdParts.join(', ');

        const pageLabels = {
          dashboard: 'Dashboard',
          course: previewName || 'Course',
          calendar: 'Calendar',
          my_courses: 'My Courses',
          assignment: 'Assignment',
          quiz: 'Quiz'
        };

        setStatus('active', `Detected: ${pageLabels[pageType] || pageType}`, bdText);
        currentItemType = `${pageType}_import`;

        if (previewCount > 0) {
          previewBtn.disabled = false;
          previewBtnText.textContent = `Preview ${previewCount} items`;
        } else if (pageType === 'my_courses') {
          previewBtn.disabled = false;
          previewBtnText.textContent = 'Preview (courses load async)';
        } else {
          previewBtn.disabled = true;
          previewBtnText.textContent = 'No items found on this page';
        }
      })
      .catch(err => {
        setStatus('inactive', 'Extension not loaded');
        previewBtn.disabled = true;
        previewBtnText.textContent = 'Refresh the Spectrum page first';
      });
  });

  // ── Step 2: Preview ──

  previewBtn.addEventListener('click', async () => {
    previewBtn.disabled = true;
    previewBtnText.innerHTML = '<span class="spinner"></span> Extracting...';

    try {
      const response = await sendToTab({ action: 'EXTRACT' });

      if (!response || response.status === 'error') {
        previewBtn.disabled = false;
        previewBtnText.textContent = 'Retry preview';
        setStatus('inactive', response?.message || 'Extraction failed');
        return;
      }

      currentPayload = response.payload;
      renderPreview(currentPayload);
      showStep('preview');
    } catch (err) {
      previewBtn.disabled = false;
      previewBtnText.textContent = 'Retry preview';
      setStatus('inactive', 'Error: ' + err.message);
    }
  });

  function renderPreview(payload) {
    const items = payload.raw_items || [];
    const skipped = payload.skipped || [];

    // Separate events and resources
    const events = items.filter(i => i.category === 'event');
    const resources = items.filter(i => i.category === 'resource');

    // Update header
    const totalSelected = items.filter(i => !i._already_imported).length;
    previewStatus.textContent = `Preview — ${items.length} items`;
    previewBreakdown.textContent = `${events.length} events, ${resources.length} resources`;

    // Render events
    if (events.length > 0) {
      eventsSection.style.display = 'block';
      eventsCount.textContent = `${events.filter(i => !i._already_imported).length}/${events.length} selected`;
      eventsList.innerHTML = events.map((item, idx) => renderItem(item, idx, 'event')).join('');
    } else {
      eventsSection.style.display = 'none';
    }

    // Render resources
    if (resources.length > 0) {
      resourcesSection.style.display = 'block';
      resourcesCount.textContent = `${resources.filter(i => !i._already_imported).length}/${resources.length} selected`;
      resourcesList.innerHTML = resources.map((item, idx) => renderItem(item, idx, 'resource')).join('');
    } else {
      resourcesSection.style.display = 'none';
    }

    // Render skipped
    if (skipped.length > 0) {
      skippedSection.style.display = 'block';
      skippedCount.textContent = `Skipped (${skipped.length})`;
      skippedList.innerHTML = skipped.map(s =>
        `<div class="skipped-item">${escapeHtml(s.name)} — ${escapeHtml(s.reason)}</div>`
      ).join('');
    } else {
      skippedSection.style.display = 'none';
    }

    // Wire up checkboxes
    document.querySelectorAll('.item-check').forEach(el => {
      el.addEventListener('click', () => {
        el.classList.toggle('checked');
        updateImportButton();
      });
    });

    updateImportButton();
  }

  function renderItem(item, idx, group) {
    const checked = !item._already_imported;
    const type = item.event_type || item.type || 'other';
    const dateStr = item.iso_date || item.name_embedded_date || '';
    const dateConf = item.date_confidence || (dateStr ? 'medium' : 'none');
    const isImported = item._already_imported;
    const needsReview = item.needs_llm;

    const indicators = [];
    if (isImported) indicators.push('<span class="item-indicator imported-indicator">🔁</span>');
    if (needsReview) indicators.push('<span class="item-indicator review-indicator" title="Date may need review">🤔</span>');

    return `
      <div class="item-card${isImported ? ' imported' : ''}">
        <div class="item-check${checked ? ' checked' : ''}" data-idx="${idx}" data-group="${group}"></div>
        <div class="item-body">
          <div class="item-name">${escapeHtml(item.raw_title || item.name)}</div>
          <div class="item-meta">
            <span class="item-badge type-${type}">${type}</span>
            ${dateStr ? `<span class="item-date${dateConf === 'low' ? ' low-confidence' : ''}">${dateStr}${item.time ? ' ' + item.time : ''}</span>` : ''}
            ${indicators.join('')}
          </div>
        </div>
      </div>
    `;
  }

  function updateImportButton() {
    const checked = document.querySelectorAll('.item-check.checked');
    importBtn.disabled = checked.length === 0;
    importBtnText.textContent = `Import ${checked.length} selected`;
  }

  function escapeHtml(text) {
    const el = document.createElement('span');
    el.textContent = text || '';
    return el.innerHTML;
  }

  // ── Cancel back to detect ──
  cancelBtn.addEventListener('click', () => {
    showStep('detect');
    previewBtn.disabled = false;
    previewBtnText.textContent = 'Preview items';
  });

  // ── Step 3: Commit ──
  importBtn.addEventListener('click', async () => {
    importBtn.disabled = true;
    importBtnText.innerHTML = '<span class="spinner"></span> Importing...';

    // Collect checked items
    const checkedEls = document.querySelectorAll('.item-check.checked');
    const indices = new Set([...checkedEls].map(el => el.dataset.idx));
    const groupMap = {};
    checkedEls.forEach(el => {
      groupMap[el.dataset.idx] = el.dataset.group;
    });

    const allItems = currentPayload.raw_items;
    const selectedItems = allItems.filter((_, idx) => indices.has(String(idx)));

    try {
      const response = await sendToTab({
        action: 'COMMIT',
        items: selectedItems,
        type: currentPayload.type
      });

      if (!response || response.status === 'error') {
        showError(response?.message || 'Import failed');
        return;
      }

      // Show result
      resultArea.className = 'result-area';
      resultArea.innerHTML = `
        <div style="display:flex;gap:16px;margin-bottom:6px;">
          <div><span class="count">${response.events_count || 0}</span><br><span class="label">Events</span></div>
          <div><span class="count">${response.resources_count || 0}</span><br><span class="label">Resources</span></div>
        </div>
        <div class="msg">${response.message || 'Import complete'}</div>
      `;
      showStep('result');

    } catch (err) {
      showError(err.message);
    }
  });

  function showError(msg) {
    resultArea.className = 'result-area error';
    resultArea.innerHTML = `<div class="msg">${escapeHtml(msg)}</div>`;
    showStep('result');
  }

  // ── Done → back to start ──
  doneBtn.addEventListener('click', () => {
    showStep('detect');
    previewBtn.disabled = false;
    previewBtnText.textContent = 'Preview items';
  });

  // ── Skipped toggle ──
  skippedToggle.addEventListener('click', () => {
    skippedList.classList.toggle('open');
  });

  // ── Debug controls ──
  debugBtn.addEventListener('click', async () => {
    debugMode = !debugMode;
    debugBtn.classList.toggle('active', debugMode);
    downloadBtn.style.display = debugMode ? 'flex' : 'none';

    try {
      await sendToTab({ action: 'SET_DEBUG', enabled: debugMode });
    } catch (e) { /* content script might not be loaded */ }
  });

  downloadBtn.addEventListener('click', async () => {
    try {
      await sendToTab({
        action: 'DOWNLOAD_DEBUG',
        data: {
          pageType: currentPayload?.type || 'unknown',
          rawItems: currentPayload?.raw_items || []
        }
      });
    } catch (e) { /* ignore */ }
  });
})();
