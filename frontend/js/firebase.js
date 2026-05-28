// Firebase Configuration and Initialization
// Loaded via CDN compat scripts (no bundler needed)

const firebaseConfig = {
    apiKey: "AIzaSyAX-5LY2Whw_V50W_o0CeQflM4xTC2beT4",
    authDomain: "uniflow-b1239.firebaseapp.com",
    projectId: "uniflow-b1239",
    storageBucket: "uniflow-b1239.firebasestorage.app",
    messagingSenderId: "659536567356",
    appId: "1:659536567356:web:d5bd067d29a8a39a533739"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Auth
const firebaseAuth = firebase.auth();
const firebaseDb = firebase.firestore();

// ── Helper: Check if user is logged in ──
function requireAuth() {
    return new Promise(function(resolve, reject) {
        firebaseAuth.onAuthStateChanged(function(user) {
            if (user) {
                resolve(user);
            } else {
                reject(new Error('Not authenticated'));
            }
        });
    });
}

// ── Helper: Get current user (sync) ──
function getCurrentUser() {
    return firebaseAuth.currentUser;
}

// ── Helper: Logout ──
function firebaseLogout() {
    return firebaseAuth.signOut();
}