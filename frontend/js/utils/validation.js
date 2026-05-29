/**
 * UniFlow — Inline Form Validation Utility
 *
 * Provides real-time visual validation for form fields.
 * Matches the dark glassmorphism theme (red errors, green success).
 *
 * Usage:
 *   // Attach validation to a field:
 *   UniValidation.bind(inputElement, [UniValidation.rules.required, UniValidation.rules.email]);
 *
 *   // Check if all bound fields are valid:
 *   var allGood = UniValidation.allValid();
 *
 *   // Validate a single value programmatically:
 *   var err = UniValidation.rules.email.fn('not-an-email'); // returns error string or null
 */

var UniValidation = (function () {

    /* ── Validation Rules ── */
    var rules = {
        required: {
            fn: function (val) {
                return val.trim() === '' ? 'This field is required' : null;
            }
        },
        email: {
            fn: function (val) {
                if (val.trim() === '') return null; // let .required handle empty
                var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return re.test(val) ? null : 'Please enter a valid email address';
            }
        },
        password: {
            fn: function (val) {
                if (val === '') return null; // let .required handle empty
                return val.length < 8 ? 'Password must be at least 8 characters' : null;
            }
        },
        name: {
            fn: function (val) {
                if (val.trim() === '') return null;
                return val.trim().length < 2 ? 'Name must be at least 2 characters' : null;
            }
        }
    };

    /* ── Tracked fields ── */
    var _fields = [];

    /* ── Style constants ── */
    var ERROR_BORDER = '2px solid #f87171';   /* rose-400 */
    var SUCCESS_BORDER = '2px solid #4ade80'; /* green-400 */
    var NEUTRAL_BORDER = '';                    /* reset to original */

    /* ── Show / clear error for a specific input ── */
    function showError(input, message) {
        input.style.border = ERROR_BORDER;

        /* Remove existing error */
        var existing = input.parentNode.querySelector('.unival-error');
        if (existing) existing.remove();

        /* Inject error text */
        var span = document.createElement('span');
        span.className = 'unival-error';
        span.style.cssText = 'display:block;font-size:11px;color:#f87171;margin-top:4px;padding-left:4px;';
        span.textContent = '⚠ ' + message;
        input.parentNode.appendChild(span);
    }

    function showSuccess(input) {
        input.style.border = SUCCESS_BORDER;

        /* Remove existing error */
        var existing = input.parentNode.querySelector('.unival-error');
        if (existing) existing.remove();
    }

    function clearState(input) {
        input.style.border = NEUTRAL_BORDER;

        var existing = input.parentNode.querySelector('.unival-error');
        if (existing) existing.remove();
    }

    /* ── Validate a single field (returns true if valid) ── */
    function validateField(entry) {
        var input = entry.input;
        var val = input.value;
        var ruleList = entry.rules;
        var hasValue = val.trim() !== '';

        /* Don't validate untouched empty fields */
        if (!entry.touched && !hasValue) return true;

        for (var i = 0; i < ruleList.length; i++) {
            var err = ruleList[i].fn(val);
            if (err) {
                showError(input, err);
                entry.valid = false;
                return false;
            }
        }

        /* All rules passed */
        if (hasValue) {
            showSuccess(input);
        } else {
            clearState(input);
        }
        entry.valid = true;
        return true;
    }

    /* ── Public API ── */

    /**
     * Bind validation rules to an input field.
     * @param {HTMLInputElement} input
     * @param {Array} ruleArray  e.g. [UniValidation.rules.required, UniValidation.rules.email]
     */
    function bind(input, ruleArray) {
        var entry = {
            input: input,
            rules: ruleArray,
            touched: false,
            valid: false
        };
        _fields.push(entry);

        /* Mark touched on blur, then validate */
        input.addEventListener('blur', function () {
            entry.touched = true;
            validateField(entry);
        });

        /* Real-time validation once touched */
        input.addEventListener('input', function () {
            if (entry.touched) validateField(entry);
        });

        return entry;
    }

    /**
     * Check if all bound fields are currently valid.
     * Also forces validation on all (marks them touched).
     * @returns {boolean}
     */
    function allValid() {
        var valid = true;
        for (var i = 0; i < _fields.length; i++) {
            _fields[i].touched = true;
            if (!validateField(_fields[i])) valid = false;
        }
        return valid;
    }

    /**
     * Reset all fields (clear visual states and touched flags).
     */
    function reset() {
        for (var i = 0; i < _fields.length; i++) {
            _fields[i].touched = false;
            _fields[i].valid = false;
            clearState(_fields[i].input);
        }
    }

    /**
     * Clear all tracked fields (call before re-binding).
     */
    function clear() {
        _fields = [];
    }

    return {
        rules: rules,
        bind: bind,
        allValid: allValid,
        reset: reset,
        clear: clear
    };

})();