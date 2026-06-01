/**
 * UniFlow Data Store — localStorage + Firestore sync
 * All screens read/write through this module.
 * localStorage is the fast primary store; Firestore syncs in the background.
 */
// Auto-detect backend URL: use same host on port 8000, or override via localStorage
const BACKEND_URL = localStorage.getItem("uniflow_backend_url") || 
    (window.location.protocol === "file:" 
        ? "http://localhost:8000" 
        : window.location.protocol + "//" + window.location.hostname + ":8000");

const Store = {
  // ── Helpers ──
  _get(key) {
    try {
      const raw = localStorage.getItem("uniflow_" + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  _set(key, val) {
    localStorage.setItem("uniflow_" + key, JSON.stringify(val));
    this._syncToFirestore(key, val);
  },

  // ── Firestore Background Sync ──
  _syncToFirestore(key, val) {
    try {
      if (typeof firebaseDb === 'undefined' || !firebaseDb) return;
      var user = firebaseAuth.currentUser;
      if (!user) return;
      var data = {};
      data[key] = val;
      data['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
      firebaseDb.collection('users').doc(user.uid).set(data, { merge: true })
        .catch(function(e) { console.warn('Firestore sync failed for', key, e); });
    } catch(e) { /* fail silently */ }
  },

  /**
   * Load all user data from Firestore into localStorage.
   * Called after login/signup before redirecting to dashboard.
   * Firestore is the source of truth — it overwrites localStorage.
   */
  async loadFromFirestore() {
    try {
      if (typeof firebaseDb === 'undefined' || !firebaseDb) return;
      var user = firebaseAuth.currentUser;
      if (!user) return;

      // Clear stale data from previous user first
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith('uniflow_')) {
          keysToRemove.push(localStorage.key(i));
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });

      var doc = await firebaseDb.collection('users').doc(user.uid).get();
      if (doc.exists) {
        var data = doc.data();
        var keys = ['events', 'groups', 'budgetLimit', 'uniEvents',
                     'savedScholarships', 'savedResources', 'savedInternships',
                     'spectrumResources', 'profile', 'chatHistory'];
        keys.forEach(function(k) {
          if (data[k] !== undefined) {
            localStorage.setItem('uniflow_' + k, JSON.stringify(data[k]));
          }
        });
      }
    } catch(e) {
      console.warn('Failed to load from Firestore', e);
    }
  },

  // ── Events ──
  getEvents() {
    return this._get("events") || [];
  },
  addEvents(events) {
    const existing = this.getEvents();
    const withIds = events.map(e => ({
      ...e,
      id: "evt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      completed: false,
    }));
    const merged = [...withIds, ...existing];
    this._set("events", merged);
    return withIds;
  },
  toggleEventComplete(id) {
    const events = this.getEvents();
    const evt = events.find(e => e.id === id);
    if (evt) evt.completed = !evt.completed;
    this._set("events", events);
    return evt;
  },
  getUpcomingEvents(limit) {
    const now = new Date().toISOString().slice(0, 10);
    const events = this.getEvents()
      .filter(e => e.date >= now && e.type !== "expense")
      .sort((a, b) => a.date.localeCompare(b.date));
    return limit ? events.slice(0, limit) : events;
  },

  // ── Assignments ──
  getAssignments() {
    return this.getEvents().filter(e => e.type === "assignment" || (e.type === "deadline" && e.source === "spectrum"));
  },
  getAssignmentStats() {
    const all = this.getAssignments();
    const completed = all.filter(a => a.completed).length;
    return { total: all.length, completed, percent: all.length ? Math.round(completed / all.length * 100) : 0 };
  },
  getPendingAssignments() {
    return this.getAssignments().filter(e => !e.completed && e.completion_status !== 'complete');
  },
  getCompleteAssignments() {
    return this.getAssignments().filter(e => e.completed === true || e.completion_status === 'complete');
  },
  markAssignmentComplete(id) {
    const events = this.getEvents();
    const evt = events.find(e => e.id === id);
    if (evt) {
      evt.completed = true;
      evt.completion_status = 'complete';
      evt.completed_at = new Date().toISOString();
      this._set("events", events);
    }
    return evt;
  },

  // ── Expenses ──
  getExpenses() {
    return this.getEvents().filter(e => e.type === "expense");
  },
  getExpenseTotals() {
    const expenses = this.getExpenses();
    const byCategory = {};
    let total = 0;
    expenses.forEach(e => {
      const amt = parseFloat((e.amount || "0").replace(/[^0-9.]/g, "")) || 0;
      const cat = e.category || "other";
      byCategory[cat] = (byCategory[cat] || 0) + amt;
      total += amt;
    });
    return { total, byCategory, count: expenses.length };
  },

  // ── Groups ──
  getGroups() {
    return this._get("groups") || [];
  },
  saveGroup(group) {
    const groups = this.getGroups();
    const idx = groups.findIndex(g => g.id === group.id);
    if (idx >= 0) groups[idx] = group;
    else groups.push(group);
    this._set("groups", groups);
    return group;
  },
  createGroup(name) {
    const group = {
      id: "grp_" + Date.now(),
      name,
      members: [],
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    return this.saveGroup(group);
  },
  deleteGroup(id) {
    const groups = this.getGroups().filter(g => g.id !== id);
    this._set("groups", groups);
  },

  // ── Budget Limit ──
  getBudgetLimit() {
    return this._get("budgetLimit") || 0;
  },
  setBudgetLimit(limit) {
    this._set("budgetLimit", limit);
  },

  // ── University Events ──
  getUniEvents() {
    return this._get("uniEvents") || [];
  },
  setUniEvents(events) {
    this._set("uniEvents", events);
  },

  // ── Chat History ──
  getChatHistory() {
    try { return this._get("chatHistory") || []; } catch { return []; }
  },
  addChatMessage(msg) {
    try {
      const history = this.getChatHistory();
      history.push({ ...msg, ts: Date.now() });
      // Keep last 100 messages
      if (history.length > 100) history.splice(0, history.length - 100);
      this._set("chatHistory", history);
    } catch {}
  },
  clearChatHistory() {
    try { this._set("chatHistory", []); } catch {}
  },

  // ── User Profile ──
  getProfile() {
    try { return this._get("profile") || { name: "", onboarded: false }; } catch { return { name: "", onboarded: false }; }
  },
  setProfile(profile) {
    try { this._set("profile", profile); } catch {}
  },

  // ── Saved Scholarships ──
  getSavedScholarships() {
    try { return this._get("savedScholarships") || []; } catch { return []; }
  },
  saveScholarship(s) {
    try {
      const saved = this.getSavedScholarships();
      if (!saved.find(x => x.title === s.title)) {
        saved.push(s);
        this._set("savedScholarships", saved);
      }
    } catch {}
  },
  removeSavedScholarship(title) {
    try {
      const saved = this.getSavedScholarships().filter(x => x.title !== title);
      this._set("savedScholarships", saved);
    } catch {}
  },

  // ── Saved Resources ──
  getSavedResources() {
    try { return this._get("savedResources") || []; } catch { return []; }
  },
  saveResource(r) {
    try {
      const saved = this.getSavedResources();
      if (!saved.find(x => x.link === r.link)) {
        saved.push(r);
        this._set("savedResources", saved);
      }
    } catch {}
  },

  // ── Saved Internships ──
  getSavedInternships() {
    try { return this._get("savedInternships") || []; } catch { return []; }
  },
  saveInternship(i) {
    try {
      const saved = this.getSavedInternships();
      if (!saved.find(x => x.link === i.link)) {
        saved.push(i);
        this._set("savedInternships", saved);
      }
    } catch {}
  },
  removeSavedInternship(link) {
    try {
      const saved = this.getSavedInternships().filter(x => x.link !== link);
      this._set("savedInternships", saved);
    } catch {}
  },

  // ── Spectrum Resources (imported from Chrome extension) ──
  getSpectrumResources() {
    try { return this._get("spectrumResources") || []; } catch { return []; }
  },
  getSpectrumResourcesByCourse() {
    var resources = this.getSpectrumResources();
    var byCourse = {};
    resources.forEach(function(r) {
      var code = r.course_code || "Uncategorized";
      if (!byCourse[code]) byCourse[code] = { code: code, name: r.course_name || code, items: [] };
      byCourse[code].items.push(r);
    });
    return Object.values(byCourse);
  },
  addSpectrumResources(resources) {
    try {
      var existing = this.getSpectrumResources();
      var existingByKey = {};
      existing.forEach(function(r) {
        var key = (r.url || r.source_url || '') || ('_t_' + (r.title || ''));
        if (key) existingByKey[key] = r;
      });

      var added = 0;
      var updated = 0;
      resources.forEach(function(r) {
        var url = r.url || r.source_url || '';
        var key = url || ('_t_' + (r.title || ''));
        if (!key) return;

        if (existingByKey[key]) {
          // Update existing item with any non-empty fields from the new data
          var existingItem = existingByKey[key];
          var fieldsToMerge = ['course_code', 'course_name', 'file_type', 'section', 'title', 'modtype'];
          fieldsToMerge.forEach(function(field) {
            if (r[field] && r[field] !== 'other' && (!existingItem[field] || existingItem[field] === '' || existingItem[field] === 'other')) {
              existingItem[field] = r[field];
              updated++;
            }
          });
        } else {
          existing.push(r);
          existingByKey[key] = r;
          added++;
        }
      });

      if (added > 0 || updated > 0) {
        this._set("spectrumResources", existing);
      }
      return added;
    } catch { return 0; }
  },

  // ── API Calls ──
  async parseMessage(message) {
    const res = await fetch(BACKEND_URL + "/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.detail) || "Server error: " + res.status);
    }
    return res.json();
  },

  async searchScholarships(profile) {
    const res = await fetch(BACKEND_URL + "/api/scholarships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.detail) || "Server error: " + res.status);
    }
    return res.json();
  },

  async searchResources(subject) {
    const res = await fetch(BACKEND_URL + "/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.detail) || "Server error: " + res.status);
    }
    return res.json();
  },

  async scrapeUniCalendar(university) {
    const res = await fetch(BACKEND_URL + "/api/uni-scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ university }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.detail) || "Server error: " + res.status);
    }
    return res.json();
  },

  async searchInternships(profile) {
    const res = await fetch(BACKEND_URL + "/api/internships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.detail) || "Server error: " + res.status);
    }
    return res.json();
  },
};