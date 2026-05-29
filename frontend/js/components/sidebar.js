// Shared Sidebar Component for UniFlow
// Usage: renderSidebar('01') — pass the active page number as string

function renderSidebar(activePage) {
    const navItems = [
        { id: '01', icon: 'grid_view', label: 'The Hub', href: '01.html' },
        { id: '02', icon: 'calendar_month', label: 'Schedule', href: '02.html' },
        { id: '03', icon: 'folder_shared', label: 'Resources', href: '03.html' },
        { id: '05', icon: 'edit_document', label: 'Assignments', href: '05.html' },
        { id: '06', icon: 'group_work', label: 'Group Projects', href: '06.html' },
        { id: '07', icon: 'account_balance_wallet', label: 'Budget', href: '07.html' },
        { id: '08', icon: 'school', label: 'Scholarships', href: '08.html' },
        { id: 'internships', icon: 'work', label: 'Internships', href: 'internships.html' }
    ];

    const navLinks = navItems.map(item => {
        const isActive = item.id === activePage;
        const classes = isActive
            ? 'bg-white/10 text-primary border-l-4 border-primary px-4 py-3 flex items-center gap-3 transition-transform translate-x-1'
            : 'text-on-surface-variant px-4 py-3 flex items-center gap-3 hover:bg-white/5 hover:translate-x-2 transition-all duration-300';
        return '<a class="' + classes + '" href="' + item.href + '">' +
            '<span class="material-symbols-outlined" data-icon="' + item.icon + '">' + item.icon + '</span>' +
            '<span class="font-body-md text-body-md">' + item.label + '</span>' +
            '</a>';
    }).join('\n');

    const isAIActive = activePage === '09';
    const aiButtonClasses = isAIActive
        ? 'w-full py-4 rounded-full bg-primary text-on-primary font-bold shadow-xl shadow-primary/30 flex items-center justify-center gap-2 ring-2 ring-primary/50 scale-[1.02] transition-transform'
        : 'w-full py-4 rounded-full bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform';

    const sidebarHTML =
        '<aside id="sidebar" class="fixed left-0 top-0 h-full w-[280px] z-40 bg-surface-container-lowest/30 backdrop-blur-xl border-r border-white/10 shadow-2xl flex flex-col py-8 gap-4 transform -translate-x-full md:translate-x-0 transition-transform duration-300">' +
            '<div class="px-8 mb-4">' +
                '<a href="01.html" class="block">' +
                    '<h1 class="font-headline-lg text-headline-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary hover:opacity-80 transition-opacity">UniFlow</h1>' +
                    '<p class="font-label-sm text-label-sm text-on-surface-variant opacity-70">High Achiever Tier</p>' +
                '</a>' +
            '</div>' +
            '<nav class="flex-1 px-4 space-y-2">' +
                navLinks +
            '</nav>' +
            '<div class="px-6 mb-6">' +
                '<a class="' + aiButtonClasses + '" href="09.html">' +
                    '<span class="material-symbols-outlined" data-icon="bolt">bolt</span>' +
                    'AI Command' +
                '</a>' +
            '</div>' +
            '<div class="px-4 border-t border-white/5 pt-6 space-y-2">' +
                '<a class="text-on-surface-variant px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-all" href="settings.html">' +
                    '<span class="material-symbols-outlined" data-icon="settings">settings</span>' +
                    '<span class="font-body-md text-body-md">Settings</span>' +
                '</a>' +
                '<a class="text-on-surface-variant px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-all" href="help.html">' +
                    '<span class="material-symbols-outlined" data-icon="help">help</span>' +
                    '<span class="font-body-md text-body-md">Support</span>' +
                '</a>' +
            '</div>' +
        '</aside>' +
        '<div id="sidebar-backdrop" class="fixed inset-0 bg-black/50 z-30 hidden md:hidden" onclick="toggleSidebar()"></div>';

    document.getElementById('sidebar-mount').innerHTML = sidebarHTML;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const isOpen = !sidebar.classList.contains('-translate-x-full');

    if (isOpen) {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
    }
}