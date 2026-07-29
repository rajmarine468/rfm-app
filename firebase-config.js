/* ============================================================
   Optional cloud sync configuration.
   Leave RFM_FIREBASE_CONFIG as null to run RFM fully offline in
   local-PIN mode (this is the default and requires nothing else).

   To turn on cloud sync across devices:
   1. Create a free project at https://console.firebase.google.com
   2. Enable Authentication (Email/Password) and Firestore.
   3. Paste your project's config object below.
   ============================================================ */

window.RFM_FIREBASE_CONFIG = null;

// Example (do not use these placeholder values):
// window.RFM_FIREBASE_CONFIG = {
//   apiKey: "AIzaSy...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.appspot.com",
//   messagingSenderId: "000000000000",
//   appId: "1:000000000000:web:xxxxxxxxxxxxxxxx"
// };
