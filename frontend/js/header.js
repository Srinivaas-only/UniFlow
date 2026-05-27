// Shared Header Component for UniFlow
// Usage: renderHeader({ title: 'Page Title', subtitle: 'Optional subtitle' })
// Right side (notifications + profile) is always the same

function renderHeader(options) {
    const title = options.title || '';
    const subtitle = options.subtitle || '';
    const showSearch = options.search !== false;

    const leftContent = title
        ? '<div class="flex flex-col">' +
            '<h2 class="font-headline-lg text-headline-lg font-bold tracking-tighter text-primary">' + title + '</h2>' +
            (subtitle ? '<span class="text-label-sm text-on-surface-variant opacity-80">' + subtitle + '</span>' : '') +
          '</div>'
        : '<div class="relative">' +
            '<span class="material-symbols-outlined text-primary text-2xl" data-icon="search">search</span>' +
          '</div>';

    const headerHTML =
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
                    '<img alt="Adam William profile" class="w-10 h-10 rounded-full border-2 border-primary/20" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAeHEu9otQhM_u1D7Z3ah7IsgHoGsVpfTcLZoCde-J3-RSR5UrdnuyRs3lEmbaTmEKJtO_D9CWz86HjRwtfI-9w8OOUAhmdfeZOh4R3p_YTZkBf7Wk4GVreiVOU0xxs4-WMPEAlYpldjBtgC1lDDqDkzezCFsEVVzHJ8E9EbYmq0M33hBMDtip5A_Hlvl0xiSJH5hISoIu2U8epNIBySCQudTX0i-iSatxU-CA67opf8AaoNJDTriuWS8Mb4_hoN9V4vU1C6BNbM5-c"/>' +
                '</div>' +
            '</div>' +
        '</header>';

    document.getElementById('header-mount').innerHTML = headerHTML;
}