/* ============================================================
   Optional cloud sync configuration.
   Leave RFM_FIREBASE_CONFIG as null to run RFM fully offline in
   local-PIN mode (this is the default and requires nothing else).

   To turn on cloud sync across devices:
   1. Create a free project at https://console.firebase.google.com
   2. Enable Authentication (Email/Password) and Firestore.
   3. Paste your project's config object below.
   ============================================================ */

window.RFM_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoPqzNLBYPGmq3Vb4S7pQ5n5fdusqiGWw",
  authDomain: "rfm-app-6a098.firebaseapp.com",
  projectId: "rfm-app-6a098",
  storageBucket: "rfm-app-6a098.firebasestorage.app",
  messagingSenderId: "767083136562",
  appId: "1:767083136562:web:a72e3a8171bdc742c7de2b"
};
