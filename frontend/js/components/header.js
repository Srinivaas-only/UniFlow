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
                    '<span title="Coming soon" class="material-symbols-outlined text-on-surface-variant cursor-not-allowed opacity-50" data-icon="notifications">notifications</span>' +
                    '<span title="Coming soon" class="material-symbols-outlined text-on-surface-variant cursor-not-allowed opacity-50 hidden sm:block" data-icon="monitoring">monitoring</span>' +
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
        '</div>';

    document.getElementById('header-mount').innerHTML = headerHTML;

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