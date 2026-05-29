/**
 * UniFlow — Spectrum Importer Popup Controller
 */
(function() {
  'use strict';

  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const importBtn = document.getElementById('import-btn');
  const btnText = document.getElementById('btn-text');
  const resultArea = document.getElementById('result-area');

  let currentPageType = 'unknown';
  let currentPreviewName = '';

  // ── Page type labels ──
  const PAGE_LABELS = {
    dashboard: { label: 'Dashboard', icon: 'dashboard' },
    course: { label: 'Course Page', icon: 'school' },
    calendar: { label: 'Calendar', icon: 'calendar_month' },
    my_courses: { label: 'My Courses', icon: 'menu_book' },
    unknown: { label: 'Unknown page', icon: 'help' }
  };

  // ── On popup open, detect page ──
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;
    const url = tabs[0].url || '';

    // Check if we're on Spectrum
    if (!url.includes('spectrum.um.edu.my')) {
      setStatus('inactive', 'Not on Spectrum');
      importBtn.disabled = true;
      btnText.textContent = 'Navigate to spectrum.um.edu.my';
      return;
    }

    // Send detect message to content script
    chrome.tabs.sendMessage(tabId, { action: 'DETECT_PAGE' }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('inactive', 'Extension not loaded');
        btnText.textContent = 'Refresh the Spectrum page first';
        return;
      }
      if (!response) {
        setStatus('inactive', 'No response');
        return;
      }

      currentPageType = response.pageType;
      currentPreviewName = response.previewName || '';
      const count = response.previewCount || 0;
      const pageLabel = PAGE_LABELS[currentPageType];

      if (currentPageType === 'unknown') {
        setStatus('inactive', 'Detected: Unsupported page');
        importBtn.disabled = true;
        btnText.textContent = 'Navigate to a supported page';
        return;
      }

      setStatus('active', `Detected: ${pageLabel.label}`);

      // Update button text
      switch (currentPageType) {
        case 'dashboard':
          btnText.textContent = `Import ${count} Upcoming Deadlines`;
          break;
        case 'course':
          btnText.textContent = `Import ${currentPreviewName || 'Course'}`;
          break;
        case 'calendar':
          btnText.textContent = `Import ${count} Calendar Events`;
          break;
        case 'my_courses':
          btnText.textContent = `Import ${count} Courses`;
          break;
      }

      importBtn.disabled = count === 0 && currentPageType !== 'my_courses';

      if (count === 0 && currentPageType !== 'my_courses') {
        setStatus('active', `${pageLabel.label} — no items found`);
      }
    });
  });

  // ── Import button click ──
  importBtn.addEventListener('click', () => {
    importBtn.disabled = true;
    btnText.innerHTML = '<span class="spinner"></span> Importing...';
    resultArea.style.display = 'none';
    resultArea.className = 'result-area';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      chrome.tabs.sendMessage(tabs[0].id, { action: 'START_IMPORT' });
    });
  });

  // ── Listen for results from content script ──
  chrome.runtime.onMessage.addListener((message) => {
    if (message.status === 'success') {
      importBtn.disabled = false;
      btnText.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">check_circle</span> Import Complete';

      resultArea.style.display = 'block';
      resultArea.className = 'result-area success';
      resultArea.innerHTML = `
        <div style="display:flex;gap:16px;margin-bottom:8px;">
          <div><span class="count">${message.events_count || 0}</span><br><span class="label">Events</span></div>
          <div><span class="count">${message.resources_count || 0}</span><br><span class="label">Resources</span></div>
        </div>
        <div style="color:#4ade80;font-weight:600;">${message.message}</div>
      `;

      // Reset button after 3s
      setTimeout(() => {
        const pageLabel = PAGE_LABELS[currentPageType];
        btnText.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">cloud_download</span> Re-import ${pageLabel.label}`;
      }, 3000);

    } else if (message.status === 'empty') {
      importBtn.disabled = true;
      btnText.textContent = 'No items found';
      resultArea.style.display = 'block';
      resultArea.className = 'result-area';
      resultArea.textContent = message.message;

    } else if (message.status === 'error') {
      importBtn.disabled = false;
      btnText.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">refresh</span> Try Again';
      resultArea.style.display = 'block';
      resultArea.className = 'result-area error';
      resultArea.textContent = message.message;
    }
  });

  function setStatus(state, text) {
    statusDot.className = 'status-dot' + (state === 'inactive' ? ' inactive' : state === 'detecting' ? ' detecting' : '');
    statusLabel.textContent = text;
  }
})();
