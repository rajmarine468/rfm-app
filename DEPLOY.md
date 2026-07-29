# Getting RFM onto your phone

Phones can't install a PWA from a `file://` path on a PC — it needs to be
served from a real HTTPS URL first. This PC doesn't have Node.js installed,
which the original Firebase-CLI plan needs, so the fastest path today is a
no-install drag-and-drop host. Pick one:

## Option A — Netlify Drop (fastest, no installs, do this today)

1. On this PC, open https://app.netlify.com/drop in a browser.
2. Drag the whole `rfm-app` folder onto the page.
3. Netlify serves it instantly and gives you a live HTTPS URL
   (e.g. `https://random-name-123.netlify.app`).
4. To keep that URL permanently (instead of it expiring), click "Claim"
   and sign up free — otherwise it's still fully usable, just unclaimed.
5. On your iPhone, open the URL in **Safari** → Share icon → **Add to Home
   Screen**.
6. On your Android phone, open the URL in **Chrome** → ⋮ menu → **Install
   app** (or **Add to Home screen**).

You now have a real app icon on your phone. Data stays local to each device
in this mode.

## Option B — GitHub Pages (durable, free, tied to your GitHub account)

1. Create a new repository on https://github.com/new (e.g. `rfm-app`).
2. From this folder:
   ```
   git remote add origin https://github.com/<your-username>/rfm-app.git
   git push -u origin main
   ```
3. In the repo on GitHub: **Settings → Pages → Source: Deploy from a
   branch → main / (root)**. Save.
4. GitHub gives you a URL like `https://<your-username>.github.io/rfm-app/`.
5. Install on your phone the same way as steps 5–6 in Option A.

## Option C — Firebase Hosting (only if you want cross-device cloud sync)

This is the path described in the app's Settings/Firebase files
(`firebase.json`, `firestore.rules`, `firebase-sync.js`) and matches the
original Stage 2 sync plan. It needs Node.js, which isn't installed on
this PC yet:

1. Install Node.js: https://nodejs.org
2. In this folder:
   ```
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase deploy --only hosting
   ```
3. To turn on cross-device sync afterward, follow the Firebase steps in
   `README.md` / fill in `firebase-config.js`, then redeploy.

## Updating the app later

Whichever host you pick, redeploying is: make the change → redeploy
(Netlify: drag the folder again; GitHub Pages: `git push`; Firebase:
`firebase deploy`). Installed apps pick up the update automatically next
time they're opened, since the service worker checks for new versions.
