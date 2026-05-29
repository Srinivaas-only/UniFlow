// UniFlow Auth Guard
// Protects pages that require authentication.
// Usage: Include after firebase.js, then call initAuthGuard() in DOMContentLoaded.
// The script will:
//   1. Show a loading spinner
//   2. Check Firebase auth state
//   3. If logged in → call onAuthenticated(user) and reveal page
//   4. If not logged in → redirect to index.html (main landing page)
//   5. Timeout after 5 seconds → show connection error

function initAuthGuard(opts) {
    var options = opts || {};
    var onAuthenticated = options.onAuthenticated || function() {};
    var loadingEl = document.getElementById('auth-loading');
    var contentEl = document.getElementById('page-content');

    // Ensure content is hidden initially
    if (contentEl) {
        contentEl.style.opacity = '0';
        contentEl.style.pointerEvents = 'none';
    }

    // Show auth loading spinner if element exists
    if (loadingEl) {
        loadingEl.innerHTML =
            '<div class="flex flex-col items-center justify-center min-h-[60vh] py-20">' +
                '<div style="width:44px;height:44px;border:3px solid rgba(207,189,248,0.2);border-top-color:#cfbdf8;border-radius:50%;animation:authSpin 0.8s linear infinite;margin-bottom:1.5rem;"></div>' +
                '<p class="text-on-surface-variant text-sm font-medium">Verifying your session...</p>' +
                '<p class="text-on-surface-variant/50 text-xs mt-1">This won\'t take a moment</p>' +
            '</div>';
    }

    // Add spinner keyframes
    if (!document.getElementById('auth-guard-styles')) {
        var style = document.createElement('style');
        style.id = 'auth-guard-styles';
        style.textContent =
            '@keyframes authSpin { to { transform: rotate(360deg); } }' +
            '#page-content { transition: opacity 0.4s ease; }';
        document.head.appendChild(style);
    }

    // Timeout — if auth takes too long, show error
    var authTimeout = setTimeout(function() {
        if (loadingEl) {
            loadingEl.innerHTML =
                '<div class="flex flex-col items-center justify-center min-h-[60vh] py-20 text-center">' +
                    '<span class="material-symbols-outlined text-rose-400 text-5xl mb-4">cloud_off</span>' +
                    '<p class="text-rose-400 font-bold text-lg mb-2">Connection timed out</p>' +
                    '<p class="text-on-surface-variant text-sm mb-6 max-w-xs">We couldn\'t verify your session because the connection took too long. Please check your internet and try again.</p>' +
                    '<button onclick="location.reload()" class="px-6 py-3 bg-primary text-on-primary rounded-2xl font-bold hover:brightness-110 active:scale-[0.97] transition-all">' +
                        '<span class="material-symbols-outlined text-sm align-middle mr-1">refresh</span> Retry' +
                    '</button>' +
                '</div>';
        }
    }, 5000);

    // Check auth state
    if (typeof firebaseAuth === 'undefined') {
        clearTimeout(authTimeout);
        console.error('authGuard: firebaseAuth is not defined. Make sure firebase.js is loaded before authGuard.js.');
        if (loadingEl) {
            loadingEl.innerHTML =
                '<div class="flex flex-col items-center justify-center min-h-[60vh] py-20 text-center">' +
                    '<span class="material-symbols-outlined text-rose-400 text-5xl mb-4">error</span>' +
                    '<p class="text-rose-400 font-bold text-lg mb-2">Setup error</p>' +
                    '<p class="text-on-surface-variant text-sm mb-4">Firebase is not configured. Please check your setup or refresh the page.</p>' +
                    '<button onclick="location.reload()" class="px-6 py-3 bg-primary text-on-primary rounded-2xl font-bold">Refresh Page</button>' +
                '</div>';
        }
        return;
    }

    firebaseAuth.onAuthStateChanged(function(user) {
        clearTimeout(authTimeout);

        if (user) {
            // Authenticated — reveal page content
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) {
                contentEl.style.display = '';
                contentEl.style.opacity = '1';
                contentEl.style.pointerEvents = 'auto';
            }
            onAuthenticated(user);
        } else {
            // Not authenticated — redirect to main landing page
            window.location.href = '../index.html';
        }
    });
}