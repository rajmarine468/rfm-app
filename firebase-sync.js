/* ============================================================
   Cloud sync layer. Only does anything if firebase-config.js has
   set a real window.RFM_FIREBASE_CONFIG *and* the Firebase compat
   SDKs loaded successfully. Otherwise app.js falls back to
   local-device (PIN) mode automatically.
   ============================================================ */

(function () {
  "use strict";
  const cfg = window.RFM_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || typeof firebase === "undefined") {
    return; // no cloud sync configured — local mode only
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();

  function docRef(uid) { return db.collection("rfm_users").doc(uid); }

  window.RFMSync = {
    async signIn(email, password) {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const snap = await docRef(cred.user.uid).get();
      return snap.exists ? snap.data() : null;
    },
    async signUp(email, password) {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      return null; // caller will seed fresh state
    },
    async push(state) {
      const user = auth.currentUser;
      if (!user) return;
      await docRef(user.uid).set(state, { merge: false });
    },
    async pull() {
      const user = auth.currentUser;
      if (!user) return null;
      const snap = await docRef(user.uid).get();
      return snap.exists ? snap.data() : null;
    }
  };
})();
