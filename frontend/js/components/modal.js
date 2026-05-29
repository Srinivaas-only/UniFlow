/**
 * UniFlow — Reusable Modal Component
 * Replaces native alert() with a styled glassmorphism modal.
 *
 * Usage:
 *   showModal({
 *     title: 'Confirm Delete',
 *     message: 'Are you sure you want to delete this item?',
 *     type: 'danger',            // 'success' | 'error' | 'warning' | 'danger' | 'info'
 *     confirmText: 'Delete',     // default: 'Confirm'
 *     cancelText: 'Cancel',      // default: 'Cancel'
 *     showCancel: true,          // default: true
 *     onConfirm: function() { … }
 *   });
 *
 *   // Quick info modal (no cancel button):
 *   showModal({ title: 'Saved!', message: 'Your changes have been saved.', type: 'success' });
 */

/* ── Icon + color config per type ── */
var MODAL_TYPES = {
    success: { icon: 'check_circle', iconColor: '#4ade80', btnBg: '#4ade80', btnText: '#12111A' },
    error:   { icon: 'error',        iconColor: '#f87171', btnBg: '#f87171', btnText: '#12111A' },
    warning: { icon: 'warning',      iconColor: '#fbbf24', btnBg: '#fbbf24', btnText: '#12111A' },
    danger:  { icon: 'delete',       iconColor: '#f87171', btnBg: '#f87171', btnText: '#12111A' },
    info:    { icon: 'info',         iconColor: '#D6C4FF', btnBg: '#D6C4FF', btnText: '#12111A' }
};

/* ── Default config ── */
var DEFAULT_TYPE = 'info';

function showModal(opts) {
    /* Merge options with defaults */
    var title      = (opts && opts.title) || 'Notice';
    var message    = (opts && opts.message) || '';
    var type       = (opts && opts.type && MODAL_TYPES[opts.type]) ? opts.type : DEFAULT_TYPE;
    var confirmTxt = (opts && opts.confirmText) || 'Confirm';
    var cancelTxt  = (opts && opts.cancelText) || 'Cancel';
    var showCancel = (opts && typeof opts.showCancel === 'boolean') ? opts.showCancel : true;
    var onConfirm  = (opts && opts.onConfirm) || null;

    var cfg = MODAL_TYPES[type];

    /* Remove any existing modal */
    var existing = document.getElementById('uniflow-modal-backdrop');
    if (existing) existing.remove();

    /* ── Build backdrop ── */
    var backdrop = document.createElement('div');
    backdrop.id = 'uniflow-modal-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity 0.25s ease;';

    /* ── Build card ── */
    var card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:420px;background:rgba(28,26,36,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:1.5rem;padding:2rem;transform:scale(0.92);transition:transform 0.25s ease;';

    /* ── Icon ── */
    var iconWrap = document.createElement('div');
    iconWrap.style.cssText = 'width:48px;height:48px;border-radius:1rem;display:flex;align-items:center;justify-content:center;margin-bottom:1rem;background:rgba(255,255,255,0.06);';
    iconWrap.innerHTML = '<span class="material-symbols-outlined" style="font-size:28px;color:' + cfg.iconColor + ';">' + cfg.icon + '</span>';

    /* ── Title ── */
    var titleEl = document.createElement('h3');
    titleEl.style.cssText = 'font-size:1.125rem;font-weight:700;color:#e5e0ee;margin-bottom:0.5rem;';
    titleEl.textContent = title;

    /* ── Message ── */
    var msgEl = document.createElement('p');
    msgEl.style.cssText = 'font-size:0.875rem;color:rgba(229,224,238,0.7);line-height:1.5;margin-bottom:1.5rem;';
    msgEl.textContent = message;

    /* ── Buttons container ── */
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;';

    /* Cancel button */
    if (showCancel) {
        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelTxt;
        cancelBtn.style.cssText = 'padding:0.625rem 1.25rem;border-radius:0.875rem;font-size:0.8125rem;font-weight:700;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#9e97b3;cursor:pointer;transition:background 0.2s;';
        cancelBtn.onmouseenter = function() { this.style.background = 'rgba(255,255,255,0.06)'; };
        cancelBtn.onmouseleave = function() { this.style.background = 'transparent'; };
        cancelBtn.onclick = function() { closeModal(); };
        btnRow.appendChild(cancelBtn);
    }

    /* Confirm button */
    var confirmBtn = document.createElement('button');
    confirmBtn.textContent = confirmTxt;
    confirmBtn.style.cssText = 'padding:0.625rem 1.25rem;border-radius:0.875rem;font-size:0.8125rem;font-weight:700;border:none;cursor:pointer;transition:transform 0.15s,filter 0.2s;background:' + cfg.btnBg + ';color:' + cfg.btnText + ';';
    confirmBtn.onmouseenter = function() { this.style.filter = 'brightness(1.1)'; };
    confirmBtn.onmouseleave = function() { this.style.filter = 'brightness(1)'; };
    confirmBtn.onmousedown  = function() { this.style.transform = 'scale(0.97)'; };
    confirmBtn.onmouseup    = function() { this.style.transform = 'scale(1)'; };
    confirmBtn.onclick = function() {
        if (typeof onConfirm === 'function') onConfirm();
        closeModal();
    };
    btnRow.appendChild(confirmBtn);

    /* ── Assemble ── */
    card.appendChild(iconWrap);
    card.appendChild(titleEl);
    card.appendChild(msgEl);
    card.appendChild(btnRow);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    /* ── Animate in ── */
    requestAnimationFrame(function() {
        backdrop.style.opacity = '1';
        card.style.transform = 'scale(1)';
    });

    /* ── Close on backdrop click ── */
    backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) closeModal();
    });

    /* ── Close on Escape key ── */
    document.addEventListener('keydown', _modalEscHandler);
}

function _modalEscHandler(e) {
    if (e.key === 'Escape') closeModal();
}

function closeModal() {
    var backdrop = document.getElementById('uniflow-modal-backdrop');
    if (!backdrop) return;
    var card = backdrop.firstChild;

    /* Animate out */
    backdrop.style.opacity = '0';
    if (card) card.style.transform = 'scale(0.92)';

    setTimeout(function() {
        if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }, 250);

    document.removeEventListener('keydown', _modalEscHandler);
}