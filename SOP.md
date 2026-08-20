# RFM Operating Procedures

Reference this file for anything routine: turning on cloud sync, adding a
device, deploying a change, or fixing a git sync problem. Repo:
`https://github.com/rajmarine468/rfm-app`. Live app:
`https://rajmarine468.github.io/rfm-app/`.

## 1. One-time: turn on Firebase cloud sync

The app already has full cloud-sync code (`firebase-sync.js`, sign-up/sign-in
forms in `app.js`). It's off by default (`firebase-config.js` sets
`RFM_FIREBASE_CONFIG = null`) so the app runs local-only until this is done.

1. https://console.firebase.google.com → **Add project** → skip Analytics.
2. **Build → Authentication** → Get started → enable **Email/Password**.
3. **Build → Firestore Database** → Create database → **Production mode**.
4. **Project settings** (gear icon) → **Your apps** → **`</>`** (Web) → register
   (no Hosting needed) → copy the `firebaseConfig` object shown.
5. Paste that object into `firebase-config.js`, replacing the `null`:
   ```js
   window.RFM_FIREBASE_CONFIG = {
     apiKey: "...", authDomain: "...", projectId: "...",
     storageBucket: "...", messagingSenderId: "...", appId: "..."
   };
   ```
6. In the Firebase console, **Firestore Database → Rules**, paste the
   contents of `firestore.rules` from this repo, and **Publish**. (Rules
   restrict each account to its own data — see that file.)
7. Commit and push (see §3). GitHub Pages redeploys automatically.
8. Open the live URL, sign up with an email/password on the login screen's
   cloud-account form. That creates your Firestore document and switches
   this device to cloud mode.

## 2. Adding a new device once cloud sync is on

1. Open the live URL on the new device (or the installed home-screen app,
   if you've already added it there — see the app's `README.md` /
   `DEPLOY.md` for the install steps).
2. Sign in with the **same email/password** used in step 8 above (not
   "sign up" — that would create a second, empty account).
3. The device pulls your existing data from Firestore automatically.

Note: switching a device between local-PIN mode and cloud mode, or signing
into a second account, does not auto-merge data — whichever account you
sign into is the source of truth going forward for that device.

## 3. Making a change and deploying it

The app is plain HTML/CSS/JS with no build step, hosted on **GitHub
Pages** from the `main` branch root.

1. Edit files directly in the `rfm-app` folder.
2. Commit via GitHub Desktop (or `git commit`).
3. Push. GitHub Pages rebuilds automatically within about a minute — no
   `firebase deploy` needed (Firebase here is only used for the
   Auth/Firestore sync backend, not hosting).
4. Installed apps on phones pick up the update the next time they're
   opened (the service worker checks for a new version on load).

## 4. If GitHub Desktop shows "Newer commits on remote" / won't push

This happened once (2026-08-20) because the local repo and GitHub had two
separate, unrelated commit histories (one from `git init` locally, one
from an earlier GitHub web upload). Symptoms: push is rejected, or the
toolbar shows "Publish branch" even though the repo already exists on
GitHub.

Fix, in order:
1. Confirm which side has the actually-correct/newer content — don't
   assume; diff it (`git diff main origin/main`) or compare files.
2. If local is the one with everything (as it was that time), link the
   branches: `git branch --set-upstream-to=origin/main main`.
3. Restart GitHub Desktop so it re-reads the tracking state.
4. In GitHub Desktop, hold **Ctrl** over the top toolbar push/pull button
   — it changes to **"Force push origin"**. Click it, confirm the warning.
5. **Do not** click a plain "Pull origin" first when histories are
   unrelated — it can produce a messy merge instead of just fixing the
   link.

To avoid this recurring: don't edit files directly on github.com (web
editor) and locally in parallel without pulling first — pick one place to
make changes at a time.

## 5. Where things live

- `rfm-app/` — the current, actively developed source. Edit files here.
- `RFM_Finance_Manager_App/` (sibling folder) — an older, stale July 2026
  snapshot. Not maintained; ignore it for changes.
- `RFM_MASTER_CONTEXT.md` (one level up, in `CLAUDE/`) — the original
  product spec/mission doc.
