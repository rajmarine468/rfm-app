# Rajender Finance Manager (RFM)

A personal wealth, tax, retirement and family command center — installable
as a real app icon on your phone (Progressive Web App), no App Store needed.

Plain HTML/CSS/JS, no build step. All data stays in the browser's local
storage on your device by default; optional free Firebase cloud sync can be
turned on later to keep multiple devices in sync.

## Run it locally (on this PC)

Open `index.html` directly in a browser, or serve the folder with any
static file server. Service-worker offline caching only activates once the
app is served over `http(s)://` (browsers block it on `file://`), so use a
local server or a real deployment to test that part.

## Get it on your phone

See [DEPLOY.md](DEPLOY.md) for step-by-step hosting options. Short version:
host this folder anywhere that serves static files over HTTPS, then open
the URL on your phone and use "Add to Home Screen" (iOS Safari) or
"Install app" (Android Chrome).

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell and page structure |
| `app.js` | All app logic — dashboard, wealth, fixed income, retirement, tax, goals, family, reports, settings |
| `styles.css` | Visual styling |
| `manifest.json` | Makes the app installable (name, icon, colors) |
| `service-worker.js` | Offline caching |
| `icons/` | App icons |
| `firebase-config.js` | Your Firebase project keys (placeholder — app runs fully offline until filled in) |
| `firebase-sync.js` | Optional cloud sync logic (inactive until `firebase-config.js` is configured) |
| `firestore.rules` | Security rules for optional cloud sync — restricts your data to your account only |
| `firebase.json` | Firebase Hosting/deploy configuration (only needed if you choose Firebase in DEPLOY.md) |

## A note on your data

Your first real investment (Wint Wealth, ₹101,898.93, 19-Jul-2026, Order ID
ww152344) and your PPF account are already recorded in the app. Review them
under Fixed Income / Retirement and correct any details as statements
arrive.

This app is not a bank-grade encrypted vault. Avoid entering banking
passwords, card numbers, or full Aadhaar numbers.
