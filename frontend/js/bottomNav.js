// Shared Bottom Mobile Nav Component for UniFlow
// Usage: renderBottomNav('01') — pass the active page number
// Pages 01-08: Hub active, 09: Chat active
// Hidden on md+ screens

function renderBottomNav(activePage) {
    var navItems = [
        { id: 'hub', icon: 'token', label: 'Hub', href: '01.html', activeFor: ['01','02','03','04','05','06','07','08'] },
        { id: 'chat', icon: 'forum', label: 'Chat', href: '09.html', activeFor: ['09'] },
        { id: 'vault', icon: 'inventory_2', label: 'Vault', href: '03.html', activeFor: [] },
        { id: 'profile', icon: 'person', label: 'Profile', href: '#', activeFor: [] }
    ];

    var navLinks = navItems.map(function(item) {
        var isActive = item.activeFor.indexOf(activePage) !== -1;
        var classes = isActive
            ? 'flex flex-col items-center justify-center text-primary font-bold scale-110'
            : 'flex flex-col items-center justify-center text-on-surface-variant opacity-70 hover:opacity-100 transition-opacity';
        var iconStyle = isActive ? ' style="font-variation-settings: \'FILL\' 1;"' : '';
        return '<a class="' + classes + '" href="' + item.href + '">' +
            '<span class="material-symbols-outlined" data-icon="' + item.icon + '"' + iconStyle + '>' + item.icon + '</span>' +
            '<span class="font-label-sm text-label-sm">' + item.label + '</span>' +
            '</a>';
    }).join('\n');

    var navHTML =
        '<nav class="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md rounded-full px-6 py-3 bg-surface-container-low/60 backdrop-blur-3xl border border-white/10 shadow-[0_0_40px_rgba(208,188,255,0.1)] flex justify-around items-center z-50 md:hidden">' +
            navLinks +
        '</nav>';

    document.getElementById('bottomnav-mount').innerHTML = navHTML;
}