// Shared Header Component for UniFlow
// Usage: renderHeader({ title: 'Page Title', subtitle: 'Optional subtitle' })
// Right side (notifications + profile) is always the same

// ── Auth Guard ──
// Redirect to login if not authenticated (runs on all dashboard pages)
(function() {
    if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.onAuthStateChanged(function(user) {
            if (!user) {
                window.location.href = './login.html';
            }
        });
    }
})();

// ── Dynamically load notifications.js (if Store is available) ──
(function() {
    if (typeof UniNotifications === 'undefined') {
        var s = document.createElement('script');
        s.src = '../js/components/notifications.js';
        s.async = false;
        document.currentScript.parentNode.insertBefore(s, document.currentScript.nextSibling);
    }
})();

function renderHeader(options) {
    var title = options.title || '';
    var subtitle = options.subtitle || '';

    // Get user name from Firebase or localStorage
    var userName = 'Student';
    var userPhotoURL = null;
    try {
        var user = firebaseAuth.currentUser;
        if (user && user.displayName) {
            userName = user.displayName;
        } else {
            var profile = JSON.parse(localStorage.getItem('uniflow_profile') || '{}');
            if (profile.name) userName = profile.name;
        }
        if (user && user.photoURL) userPhotoURL = user.photoURL;
    } catch(e) {}

    // Generate initials for avatar
    var initials = userName.split(' ').map(function(w) { return w[0] || ''; }).join('').toUpperCase().slice(0, 2);
    if (!initials) initials = 'U';

    var avatarHTML = userPhotoURL
        ? '<img alt="' + userName + '" class="w-10 h-10 rounded-full border-2 border-primary/20 object-cover" src="' + userPhotoURL + '"/>'
        : '<div class="w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-primary" style="background:rgba(214,196,255,0.15);">' + initials + '</div>';

    var leftContent = title
        ? '<div class="flex flex-col">' +
            '<h2 class="font-headline-lg text-headline-lg font-bold tracking-tighter text-primary">' + title + '</h2>' +
            (subtitle ? '<span class="text-label-sm text-on-surface-variant opacity-80">' + subtitle + '</span>' : '') +
          '</div>'
        : '<div class="relative">' +
            '<span class="material-symbols-outlined text-primary text-2xl" data-icon="search">search</span>' +
          '</div>';

    var headerHTML =
        '<header class="fixed top-0 left-0 md:left-[280px] right-0 z-30 h-20 px-margin-mobile md:px-margin-desktop flex justify-between items-center bg-surface-dim/80 backdrop-blur-2xl border-b border-white/5">' +
            '<div class="flex items-center gap-4">' +
                '<button class="md:hidden p-2 text-primary hover:bg-white/5 rounded-full transition-colors" onclick="toggleSidebar()">' +
                    '<span class="material-symbols-outlined" data-icon="menu">menu</span>' +
                '</button>' +
                leftContent +
            '</div>' +
            '<div class="flex items-center gap-gutter">' +
                '<div class="flex items-center gap-4">' +
                    '<button id="notif-btn" class="relative p-2 text-on-surface-variant hover:bg-white/5 rounded-full transition-colors" title="Notifications">' +
                        '<span class="material-symbols-outlined">notifications</span>' +
                        '<span id="notif-badge" style="display:none;position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:#f87171;font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;">0</span>' +
                    '</button>' +
                '</div>' +
                '<div class="flex items-center gap-3 pl-4 border-l border-white/10">' +
                    '<div class="text-right hidden sm:block">' +
                        '<p class="font-label-sm text-label-sm text-on-surface font-bold">' + userName + '</p>' +
                        '<p class="text-[10px] text-primary uppercase tracking-widest">UniFlow Student</p>' +
                    '</div>' +
                    '<button id="profile-btn" class="cursor-pointer bg-transparent border-none p-0 outline-none">' +
                        avatarHTML +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</header>' +
        '<div id="profile-dropdown" class="hidden fixed z-50 w-48 rounded-xl shadow-2xl border border-white/10 py-1" style="background: #1a1825;">' +
            '<a href="profile.html" class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer bg-transparent border-none no-underline" style="color: #f1eff5; text-decoration: none;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'transparent\'">' +
                '<span class="material-symbols-outlined text-base" style="color: #948f99;">person</span>' +
                'My Profile' +
            '</a>' +
            '<button id="logout-btn" class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer bg-transparent border-none" style="color: #f1eff5;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'transparent\'">' +
                '<span class="material-symbols-outlined text-base" style="color: #948f99;">logout</span>' +
                'Log out' +
            '</button>' +
        '</div>' +
        '<div id="notif-dropdown" class="hidden fixed z-50 w-80 rounded-2xl shadow-2xl border border-white/10 overflow-hidden" style="background:#1a1825;"></div>';

    document.getElementById('header-mount').innerHTML = headerHTML;

    // ── Notification Center ──
    if (typeof UniNotifications !== 'undefined') {
        var notifBtn = document.getElementById('notif-btn');
        var notifDropdown = document.getElementById('notif-dropdown');
        var currentNotifs = [];

        function refreshNotifications() {
            currentNotifs = UniNotifications.generate();
            if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
                notifDropdown.innerHTML = UniNotifications.renderDropdown(currentNotifs);
                bindNotifEvents();
            }
            /* Update badge */
            var badge = document.getElementById('notif-badge');
            if (badge) {
                var read = UniNotifications.getReadIds();
                var unread = currentNotifs.filter(function(n) { return read.indexOf(n.id) === -1; }).length;
                if (unread > 0) {
                    badge.textContent = unread > 9 ? '9+' : unread;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }

        function bindNotifEvents() {
            /* Mark all read button */
            var markAllBtn = document.getElementById('notif-mark-all');
            if (markAllBtn) {
                markAllBtn.onclick = function() {
                    UniNotifications.markAllRead(currentNotifs);
                    refreshNotifications();
                };
            }
            /* Click individual notification */
            var items = notifDropdown.querySelectorAll('.notif-item');
            items.forEach(function(el) {
                el.onclick = function() {
                    var id = el.getAttribute('data-id');
                    var page = el.getAttribute('data-page');
                    UniNotifications.markAsRead(id);
                    notifDropdown.classList.add('hidden');
                    window.location.href = './' + page;
                };
            });
        }

        /* Initial badge count */
        currentNotifs = UniNotifications.generate();
        var badge = document.getElementById('notif-badge');
        if (badge) {
            var read = UniNotifications.getReadIds();
            var unread = currentNotifs.filter(function(n) { return read.indexOf(n.id) === -1; }).length;
            if (unread > 0) {
                badge.textContent = unread > 9 ? '9+' : unread;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        notifBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            /* Close profile dropdown if open */
            var pd = document.getElementById('profile-dropdown');
            if (pd) pd.classList.add('hidden');

            /* Toggle notification dropdown */
            if (notifDropdown.classList.contains('hidden')) {
                currentNotifs = UniNotifications.generate();
                notifDropdown.innerHTML = UniNotifications.renderDropdown(currentNotifs);
                var rect = notifBtn.getBoundingClientRect();
                notifDropdown.style.top = (rect.bottom + 8) + 'px';
                notifDropdown.style.right = (window.innerWidth - rect.right) + 'px';
                notifDropdown.classList.remove('hidden');
                bindNotifEvents();
            } else {
                notifDropdown.classList.add('hidden');
            }
        });

        /* Close notif dropdown when clicking outside */
        document.addEventListener('click', function(e) {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
                notifDropdown.classList.add('hidden');
            }
        });

        /* Auto-refresh every 5 minutes */
        setInterval(refreshNotifications, 300000);
    }

    // ── Profile dropdown toggle ──
    var profileBtn = document.getElementById('profile-btn');
    var profileDropdown = document.getElementById('profile-dropdown');
    var logoutBtn = document.getElementById('logout-btn');

    profileBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // Position dropdown below profile button
        var rect = profileBtn.getBoundingClientRect();
        profileDropdown.style.top = (rect.bottom + 8) + 'px';
        profileDropdown.style.right = (window.innerWidth - rect.right) + 'px';
        profileDropdown.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== profileBtn && !profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });

    // ── Log out handler ──
    logoutBtn.addEventListener('click', function() {
        // Clear all uniflow data from localStorage
        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).startsWith('uniflow_')) {
                keysToRemove.push(localStorage.key(i));
            }
        }
        keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
        // Use Firebase logout if available, otherwise just redirect
        if (typeof firebaseAuth !== 'undefined') {
            firebaseAuth.signOut().then(function() {
                window.location.href = './login.html';
            }).catch(function() {
                window.location.href = './login.html';
            });
        } else {
            window.location.href = './login.html';
        }
    });
}