// Shared Header Component for UniFlow
// Usage: renderHeader({ title: 'Page Title', subtitle: 'Optional subtitle' })
// Right side (notifications + profile) is always the same

function renderHeader(options) {
    var title = options.title || '';
    var subtitle = options.subtitle || '';

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
                    '<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" data-icon="notifications">notifications</span>' +
                    '<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors hidden sm:block" data-icon="monitoring">monitoring</span>' +
                '</div>' +
                '<div class="flex items-center gap-3 pl-4 border-l border-white/10">' +
                    '<div class="text-right hidden sm:block">' +
                        '<p class="font-label-sm text-label-sm text-on-surface font-bold">Adam William</p>' +
                        '<p class="text-[10px] text-primary uppercase tracking-widest">Medical Sciences</p>' +
                    '</div>' +
                    '<button id="profile-btn" class="cursor-pointer bg-transparent border-none p-0 outline-none">' +
                        '<img alt="Adam William profile" class="w-10 h-10 rounded-full border-2 border-primary/20" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAeHEu9otQhM_u1D7Z3ah7IsgHoGsVpfTcLZoCde-J3-RSR5UrdnuyRs3lEmbaTmEKJtO_D9CWz86HjRwtfI-9w8OOUAhmdfeZOh4R3p_YTZkBf7Wk4GVreiVOU0xxs4-WMPEAlYpldjBtgC1lDDqDkzezCFsEVVzHJ8E9EbYmq0M33hBMDtip5A_Hlvl0xiSJH5hISoIu2U8epNIBySCQudTX0i-iSatxU-CA67opf8AaoNJDTriuWS8Mb4_hoN9V4vU1C6BNbM5-c"/>' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</header>' +
        '<div id="profile-dropdown" class="hidden fixed z-50 w-48 rounded-xl shadow-2xl border border-white/10 py-1" style="background: #1a1825;">' +
            '<button class="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer bg-transparent border-none" style="color: #f1eff5;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'transparent\'">' +
                '<span class="material-symbols-outlined text-base" style="color: #948f99;">logout</span>' +
                'Log out' +
            '</button>' +
        '</div>';

    document.getElementById('header-mount').innerHTML = headerHTML;

    // ── Profile dropdown toggle ──
    var profileBtn = document.getElementById('profile-btn');
    var profileDropdown = document.getElementById('profile-dropdown');

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
}
