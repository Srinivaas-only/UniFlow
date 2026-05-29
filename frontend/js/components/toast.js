/**
 * UniFlow Toast Notification Component
 * Usage: Toast.show('Message', 'success')  // success | error | warning | info
 */
var Toast = (function() {
    // Ensure container exists
    function getContainer() {
        var container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:380px;width:calc(100% - 48px);';
            document.body.appendChild(container);
        }
        return container;
    }

    var icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    var colors = {
        success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#34d399', icon: '#10b981' },
        error: { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', text: '#fb7185', icon: '#f43f5e' },
        warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', icon: '#f59e0b' },
        info: { bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)', text: '#93bbfd', icon: '#60a5fa' }
    };

    function show(message, type) {
        type = type || 'info';
        var c = colors[type] || colors.info;
        var icon = icons[type] || icons.info;

        var toast = document.createElement('div');
        toast.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:16px;border:1px solid ' + c.border + ';background:' + c.bg + ';backdrop-filter:blur(16px);font-family:"Plus Jakarta Sans",sans-serif;font-size:13px;font-weight:600;color:' + c.text + ';transform:translateX(120%);transition:transform 0.3s ease,opacity 0.3s ease;opacity:0;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

        toast.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px;color:' + c.icon + ';flex-shrink:0;">' + icon + '</span><span style="flex:1;">' + message + '</span>';

        var container = getContainer();
        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(function() {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // Auto dismiss after 3.5s
        setTimeout(function() {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3500);

        return toast;
    }

    return { show: show };
})();