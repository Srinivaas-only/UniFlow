/**
 * UniFlow — Notification Center
 * Scans Store data to surface smart alerts for the user.
 * Rendered as a dropdown from the bell icon in the header.
 *
 * Requires: store.js loaded before this script.
 */

var UniNotifications = (function () {

    /* ── Helpers ── */
    function today() { return new Date().toISOString().slice(0, 10); }
    function tomorrow() {
        var d = new Date(); d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
    }
    function daysFromNow(n) {
        var d = new Date(); d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
    }
    function relativeDate(dateStr) {
        if (!dateStr) return '';
        var t = today();
        if (dateStr === t) return 'Today';
        if (dateStr === tomorrow()) return 'Tomorrow';
        var diff = Math.round((new Date(dateStr) - new Date(t)) / 86400000);
        if (diff < 0) return Math.abs(diff) + 'd overdue';
        return 'In ' + diff + 'd';
    }

    /* ── Read state ── */
    function getReadIds() {
        try { return JSON.parse(localStorage.getItem('uniflow_notif_read') || '[]'); } catch { return []; }
    }
    function markAsRead(id) {
        var read = getReadIds();
        if (read.indexOf(id) === -1) { read.push(id); localStorage.setItem('uniflow_notif_read', JSON.stringify(read)); }
    }
    function markAllRead(notifs) {
        var read = getReadIds();
        notifs.forEach(function (n) { if (read.indexOf(n.id) === -1) read.push(n.id); });
        localStorage.setItem('uniflow_notif_read', JSON.stringify(read));
    }

    /* ── Page mapping ── */
    var PAGE_MAP = {
        assignment: '03.html',
        event: '02.html',
        deadline: '02.html',
        exam: '02.html',
        budget: '07.html',
        expense: '07.html',
        scholarship: '08.html',
        group: '06.html',
        resource: '09.html'
    };

    function pageForType(type) { return PAGE_MAP[type] || '01.html'; }

    /* ── Generate notifications from Store data ── */
    function generate() {
        var notifs = [];
        var t = today();
        var weekAhead = daysFromNow(7);

        try {
            /* 1. Overdue Assignments */
            var assignments = Store.getAssignments();
            assignments.forEach(function (a) {
                if (a.completed) return;
                if (a.date && a.date < t) {
                    notifs.push({
                        id: 'overdue_' + (a.id || a.title),
                        icon: 'assignment_late',
                        iconColor: '#f87171',
                        iconBg: 'rgba(248,113,113,0.15)',
                        title: a.title || 'Assignment overdue',
                        subtitle: relativeDate(a.date),
                        type: 'assignment',
                        date: a.date
                    });
                }
            });

            /* 2. Events today & tomorrow */
            var upcoming = Store.getUpcomingEvents();
            upcoming.forEach(function (e) {
                if (e.type === 'expense') return;
                if (e.date === t) {
                    notifs.push({
                        id: 'today_' + (e.id || e.title),
                        icon: 'today',
                        iconColor: '#fbbf24',
                        iconBg: 'rgba(251,191,36,0.15)',
                        title: e.title || 'Event today',
                        subtitle: (e.time || '') + ' — Today',
                        type: e.type || 'event',
                        date: e.date
                    });
                } else if (e.date === tomorrow()) {
                    notifs.push({
                        id: 'tmrw_' + (e.id || e.title),
                        icon: 'event_upcoming',
                        iconColor: '#D6C4FF',
                        iconBg: 'rgba(214,196,255,0.15)',
                        title: e.title || 'Event tomorrow',
                        subtitle: (e.time || '') + ' — Tomorrow',
                        type: e.type || 'event',
                        date: e.date
                    });
                }
            });

            /* 3. Budget warning */
            var limit = Store.getBudgetLimit();
            if (limit > 0) {
                var totals = Store.getExpenseTotals();
                var pct = totals.total / limit;
                if (pct >= 0.8) {
                    notifs.push({
                        id: 'budget_warn',
                        icon: 'account_balance_wallet',
                        iconColor: pct >= 1 ? '#f87171' : '#fbbf24',
                        iconBg: pct >= 1 ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)',
                        title: pct >= 1 ? 'Budget exceeded!' : 'Budget almost spent',
                        subtitle: 'RM' + totals.total.toFixed(0) + ' of RM' + limit + ' used',
                        type: 'budget',
                        date: t
                    });
                }
            }

            /* 4. Scholarship deadlines within 7 days */
            var scholarships = Store.getSavedScholarships();
            scholarships.forEach(function (s) {
                if (s.deadline && s.deadline >= t && s.deadline <= weekAhead) {
                    notifs.push({
                        id: 'scholar_' + (s.title || '').slice(0, 20),
                        icon: 'school',
                        iconColor: '#4ade80',
                        iconBg: 'rgba(74,222,128,0.15)',
                        title: s.title || 'Scholarship deadline',
                        subtitle: relativeDate(s.deadline),
                        type: 'scholarship',
                        date: s.deadline
                    });
                }
            });

            /* 5. Group tasks due soon */
            var groups = Store.getGroups();
            groups.forEach(function (g) {
                if (!g.tasks) return;
                g.tasks.forEach(function (task) {
                    if (task.completed) return;
                    if (task.deadline && task.deadline >= t && task.deadline <= weekAhead) {
                        notifs.push({
                            id: 'group_' + g.id + '_' + (task.id || task.title),
                            icon: 'group',
                            iconColor: '#60a5fa',
                            iconBg: 'rgba(96,165,250,0.15)',
                            title: task.title || 'Group task due',
                            subtitle: (g.name || 'Group') + ' — ' + relativeDate(task.deadline),
                            type: 'group',
                            date: task.deadline
                        });
                    }
                });
            });

            /* 6. Exams within 7 days */
            var exams = Store.getEvents().filter(function (e) { return e.type === 'exam'; });
            exams.forEach(function (e) {
                if (e.date && e.date >= t && e.date <= weekAhead) {
                    notifs.push({
                        id: 'exam_' + (e.id || e.title),
                        icon: 'quiz',
                        iconColor: '#c084fc',
                        iconBg: 'rgba(192,132,252,0.15)',
                        title: e.title || 'Exam coming up',
                        subtitle: relativeDate(e.date),
                        type: 'exam',
                        date: e.date
                    });
                }
            });

        } catch (e) {
            console.warn('Notification generation error:', e);
        }

        /* Sort: overdue first, then by date */
        notifs.sort(function (a, b) {
            return (a.date || '9999').localeCompare(b.date || '9999');
        });

        return notifs;
    }

    /* ── Render dropdown ── */
    function renderDropdown(notifs) {
        var read = getReadIds();
        var unreadCount = notifs.filter(function (n) { return read.indexOf(n.id) === -1; }).length;

        /* Badge */
        var badge = document.getElementById('notif-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        /* Dropdown content */
        var html = '<div style="padding:12px 16px 8px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06);">';
        html += '<h4 style="font-size:14px;font-weight:700;color:#e5e0ee;margin:0;">Notifications</h4>';
        if (notifs.length > 0) {
            html += '<button id="notif-mark-all" style="font-size:11px;font-weight:600;color:#D6C4FF;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:8px;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(214,196,255,0.1)\'" onmouseout="this.style.background=\'transparent\'">Mark all read</button>';
        }
        html += '</div>';

        if (notifs.length === 0) {
            html += '<div style="padding:32px 16px;text-align:center;">';
            html += '<span class="material-symbols-outlined" style="font-size:32px;color:rgba(158,151,179,0.3);">notifications_off</span>';
            html += '<p style="font-size:13px;color:#948f99;margin-top:8px;">You\'re all caught up! 🎉</p>';
            html += '</div>';
        } else {
            html += '<div style="max-height:320px;overflow-y:auto;">';
            notifs.forEach(function (n) {
                var isRead = read.indexOf(n.id) !== -1;
                var opacity = isRead ? '0.5' : '1';
                var dot = isRead ? '' : '<div style="width:6px;height:6px;border-radius:50%;background:#D6C4FF;flex-shrink:0;"></div>';

                html += '<div class="notif-item" data-id="' + n.id + '" data-page="' + pageForType(n.type) + '" style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;cursor:pointer;opacity:' + opacity + ';transition:background 0.15s,opacity 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">';
                html += '<div style="width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + n.iconBg + ';">';
                html += '<span class="material-symbols-outlined" style="font-size:18px;color:' + n.iconColor + ';">' + n.icon + '</span>';
                html += '</div>';
                html += '<div style="flex:1;min-width:0;">';
                html += '<p style="font-size:12px;font-weight:600;color:#e5e0ee;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(n.title) + '</p>';
                html += '<p style="font-size:11px;color:#948f99;margin:2px 0 0;">' + escapeHtml(n.subtitle) + '</p>';
                html += '</div>';
                html += dot;
                html += '</div>';
            });
            html += '</div>';
        }

        return html;
    }

    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    /* ── Public API ── */
    return {
        generate: generate,
        renderDropdown: renderDropdown,
        markAsRead: markAsRead,
        markAllRead: markAllRead,
        getReadIds: getReadIds,
        pageForType: pageForType,
        relativeDate: relativeDate
    };

})();