// Shared Loading Component for UniFlow
// Usage: Call initLoading('Loading message...') after DOM is ready
// Requires: #loading-overlay and #page-content elements in the page

function initLoading(message) {
    var msg = message || 'Loading...';
    var style = document.createElement('style');
    style.textContent =
        '.loading-spinner {' +
            'width: 48px;' +
            'height: 48px;' +
            'border: 3px solid rgba(207, 189, 248, 0.2);' +
            'border-top-color: #cfbdf8;' +
            'border-radius: 50%;' +
            'animation: spin 0.8s linear infinite;' +
        '}' +
        '@keyframes spin {' +
            'to { transform: rotate(360deg); }' +
        '}' +
        '#loading-overlay {' +
            'transition: opacity 0.3s ease;' +
        '}' +
        '#loading-overlay.fade-out {' +
            'opacity: 0;' +
        '}' +
        '#page-content {' +
            'opacity: 0;' +
            'transition: opacity 0.4s ease;' +
        '}' +
        '#page-content.visible {' +
            'opacity: 1;' +
        '}';
    document.head.appendChild(style);

    var overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.innerHTML =
            '<div class="flex flex-col items-center justify-center min-h-[60vh] py-20">' +
                '<div class="loading-spinner mb-6"></div>' +
                '<p class="text-on-surface-variant font-label-sm text-label-sm">' + msg + '</p>' +
            '</div>';
    }
}

function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    var content = document.getElementById('page-content');

    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(function() {
            overlay.style.display = 'none';
            if (content) content.classList.add('visible');
        }, 300);
    }
}