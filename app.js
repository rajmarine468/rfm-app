/* ============================================================
   Rajender Finance Manager — app.js
   Vanilla JS, localStorage-backed, optional cloud sync via
   firebase-sync.js (only activates if firebase-config.js sets
   a real config — otherwise the app runs fully offline).
   ============================================================ */

(function () {
  "use strict";

  const LS_KEY = "rfm_state_v1";
  const LS_SESSION = "rfm_session_v1";

  const FIXED_INCOME_TYPES = ["FD", "Corporate FD", "RD", "Bond", "Sovereign Gold Bond", "Post Office Scheme", "Debenture"];
  const RETIREMENT_TYPES = ["PPF", "EPF", "VPF", "NPS", "Superannuation"];
  const GENERAL_INVEST_TYPES = ["Stock", "Mutual Fund", "ETF", "Gold", "Real Estate", "Insurance / ULIP", "Cryptocurrency", "Other"];
  const PENSION_TYPES = ["Military Pension", "Civil / Govt Pension", "Family Pension", "NPS Annuity", "Additional Pension (Other)"];

  /* ---------------- utilities ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function formatINR(n) {
    if (state && state.settings && state.settings.hideAmounts) return "₹••••••";
    n = Number(n) || 0;
    const neg = n < 0;
    n = Math.abs(n);
    const str = n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return (neg ? "-₹" : "₹") + str;
  }
  function formatDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function infoIcon(text) {
    if (!text) return "";
    return ` <button type="button" class="info-icon" data-info="${escapeHtml(text)}" aria-label="What is this?">ⓘ</button>`;
  }

  /* ---------------- default / seed data ---------------- */
  function seedState() {
    return {
      profile: { name: "Rajender", pinHash: null, createdAt: new Date().toISOString() },
      settings: { hideAmounts: false },
      assets: [],
      liabilities: [],
      investments: [
        {
          id: uid(),
          type: "PPF",
          name: "Public Provident Fund",
          institution: "Bank of India",
          accountNumber: "86110PPF000000000112",
          holder: "Rajendersingh Negi",
          openingDate: "2022-09-06",
          maturityDate: "2038-04-01",
          principal: 149929,
          currentValue: 149929,
          interestRate: 7.1,
          investedThisYear: 45700,
          contributions: [
            { date: "2026-06-17", amount: 45000, channel: "BC Channel", balanceAfter: 149229 }
          ],
          notes: "Eligible for Section 80C deduction.",
          updatedAt: new Date().toISOString()
        }
      ],
      pensions: [],
      goals: [],
      family: [],
      income: [],
      history: [] // net-worth snapshots, populated by Reports
    };
  }

  function normalizeState(s) {
    if (!s) return s;
    if (!s.settings) s.settings = { hideAmounts: false };
    if (typeof s.settings.hideAmounts !== "boolean") s.settings.hideAmounts = false;
    if (!s.pensions) s.pensions = [];
    if (!s.income) s.income = [];
    if (!s.assets) s.assets = [];
    if (!s.liabilities) s.liabilities = [];
    if (!s.investments) s.investments = [];
    if (!s.goals) s.goals = [];
    if (!s.family) s.family = [];
    if (!s.history) s.history = [];
    if (!s.meta) s.meta = { migrations: [] };
    if (!s.meta.migrations) s.meta.migrations = [];
    applyDataMigrations(s);
    return s;
  }

  /* ---------------- one-time data migrations ----------------
     Each migration runs at most once per device/account (tracked in
     s.meta.migrations), and only adds an entry if a matching one isn't
     already present — so redeploying this file is safe and won't
     duplicate anything or overwrite edits you've since made. */
  function applyDataMigrations(s) {
    const done = s.meta.migrations;
    const applied = (id) => done.includes(id);

    const MIGRATION_ID = "2026-08-19-wint-stablebonds-ppf-snapshot";
    if (!applied(MIGRATION_ID)) {
      const hasNamra = s.investments.some((i) => i.institution === "Wint" && i.name === "Namra Finance");
      if (!hasNamra) {
        s.investments.push({
          id: uid(),
          type: "Bond",
          name: "Namra Finance",
          institution: "Wint",
          principal: 101899,
          currentValue: 102826,
          interestRate: 11.25,
          maturityDate: "2028-09-19",
          notes: "YTM 11.25%. Gains ₹927 as of 19-Aug-2026 (tenure left 2y 1m at that date — maturity date estimated from this). App shows a TDS-saving prompt referencing Form 15G/15H (labelled 'Form 121' in-app — verify exact form when reviewing).",
          updatedAt: "2026-08-19T00:00:00.000Z"
        });
      }

      const hasSatin = s.investments.some((i) => i.name === "Satin Finserv Limited");
      if (!hasSatin) {
        s.investments.push({
          id: uid(),
          type: "Bond",
          name: "Satin Finserv Limited",
          institution: "Stable Bonds",
          principal: 199140,
          currentValue: 199519,
          interestRate: 12.10,
          maturityDate: "2028-06-29",
          notes: "Series Jun'28. Credit rating A- (Stable). 2 units purchased. Invested 13-Aug-2026, settled 14-Aug-2026. Gains ₹379 as of 19-Aug-2026.",
          updatedAt: "2026-08-19T00:00:00.000Z"
        });
      }

      const ppf = s.investments.find((i) => i.type === "PPF" && i.accountNumber === "86110PPF000000000112");
      if (ppf) {
        ppf.contributions = ppf.contributions || [];
        const hasContribution = (date, amount) => ppf.contributions.some((c) => c.date === date && Number(c.amount) === Number(amount));
        if (!hasContribution("2026-06-17", 700)) {
          ppf.contributions.push({ date: "2026-06-17", amount: 700, channel: "BC Channel", balanceAfter: 149929 });
        }
        if (!hasContribution("2026-03-31", 4147)) {
          ppf.contributions.push({ date: "2026-03-31", amount: 4147, channel: null, balanceAfter: null });
        }
        ppf.currentValue = 149929;
        ppf.principal = 149929;
        ppf.investedThisYear = 45700;
        ppf.interestRate = 7.1;
      }

      done.push(MIGRATION_ID);
    }
  }

  let state = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn("RFM: could not read local data", e); }
    return null;
  }
  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    if (window.RFMSync && typeof window.RFMSync.push === "function") {
      window.RFMSync.push(state).catch((e) => console.warn("RFM cloud sync failed", e));
    }
    updateSyncStatus();
  }

  /* ---------------- auth / session ---------------- */
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(LS_SESSION) || "null"); } catch (e) { return null; }
  }
  function setSession(s) { sessionStorage.setItem(LS_SESSION, JSON.stringify(s)); }
  function clearSession() { sessionStorage.removeItem(LS_SESSION); }

  function cloudConfigured() {
    return !!(window.RFM_FIREBASE_CONFIG && window.RFM_FIREBASE_CONFIG.apiKey && window.RFMSync);
  }

  function initLoginView() {
    const localForm = $("#loginForm");
    const cloudForm = $("#cloudLoginForm");
    const modeNote = $("#modeNote");

    if (cloudConfigured()) {
      cloudForm.classList.remove("hidden");
      localForm.classList.add("hidden");
      modeNote.textContent = "Cloud sync is active — your data follows your account across devices.";
    } else {
      localForm.classList.remove("hidden");
      cloudForm.classList.add("hidden");
      modeNote.textContent = "Cloud sync isn't configured, so RFM is running in local-device mode. Your data stays on this device.";
    }
  }

  async function handleLocalLogin(e) {
    e.preventDefault();
    const name = $("#loginName").value.trim() || "Rajender";
    const pin = $("#loginPin").value.trim();
    if (!/^\d{4,6}$/.test(pin)) { alert("Enter a 4–6 digit PIN."); return; }

    state = normalizeState(loadState() || seedState());
    const pinHash = await sha256(pin);

    if (!state.profile.pinHash) {
      // first run — set the PIN
      state.profile.pinHash = pinHash;
      state.profile.name = name;
      saveState();
    } else if (state.profile.pinHash !== pinHash) {
      alert("Incorrect PIN for this device.");
      return;
    }
    state.profile.name = name || state.profile.name;
    setSession({ mode: "local", name: state.profile.name });
    enterApp();
  }

  async function handleCloudSignIn(e) {
    e.preventDefault();
    await cloudAuthAction("signIn");
  }
  async function handleCloudSignUp() {
    await cloudAuthAction("signUp");
  }
  async function cloudAuthAction(kind) {
    const email = $("#cloudEmail").value.trim();
    const password = $("#cloudPassword").value;
    const errEl = $("#cloudAuthError");
    errEl.classList.add("hidden");
    if (!window.RFMSync || typeof window.RFMSync[kind] !== "function") {
      errEl.textContent = "Cloud sync isn't available right now.";
      errEl.classList.remove("hidden");
      return;
    }
    try {
      const remote = await window.RFMSync[kind](email, password);
      state = normalizeState(remote || loadState() || seedState());
      saveState();
      setSession({ mode: "cloud", name: state.profile.name, email });
      enterApp();
    } catch (err) {
      errEl.textContent = err && err.message ? err.message : "Something went wrong. Please try again.";
      errEl.classList.remove("hidden");
    }
  }

  function handleLock() {
    clearSession();
    $("#appView").classList.add("hidden");
    $("#loginView").classList.remove("hidden");
    initLoginView();
  }

  function enterApp() {
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#headerSubtitle").textContent = state.profile.name
      ? `Welcome back, ${state.profile.name} · Offline-capable · installable app`
      : "Offline-capable · installable app";
    updateSyncStatus();
    updateHideAmountsBtn();
    goToPage("dashboard");
  }

  function updateSyncStatus() {
    const el = $("#syncStatus");
    const session = getSession();
    if (session && session.mode === "cloud") {
      el.textContent = "☁ Synced";
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  function toggleHideAmounts() {
    if (!state.settings) state.settings = { hideAmounts: false };
    state.settings.hideAmounts = !state.settings.hideAmounts;
    saveState();
    updateHideAmountsBtn();
    render();
  }
  function updateHideAmountsBtn() {
    const btn = $("#hideAmountsBtn");
    if (!btn || !state) return;
    const on = !!(state.settings && state.settings.hideAmounts);
    btn.classList.toggle("active-hide", on);
    btn.title = on ? "Show amounts" : "Hide amounts";
  }

  /* ---------------- navigation ---------------- */
  let currentPage = "dashboard";
  let dashboardInvestFilter = "all";

  function goToPage(page) {
    currentPage = page;
    $$("#sidebar .nav").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    render();
    $("#main").scrollTop = 0;
  }

  function pageForInvestmentType(type) {
    if (RETIREMENT_TYPES.includes(type)) return "retirement";
    if (FIXED_INCOME_TYPES.includes(type)) return "fixedIncome";
    return "wealth";
  }

  function highlightRow(id) {
    const el = $(`[data-id="${id}"]`, $("#main"));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash-highlight");
    setTimeout(() => el.classList.remove("flash-highlight"), 1600);
  }

  /* ---------------- derived totals ---------------- */
  function totals() {
    const assetsTotal = state.assets.reduce((s, a) => s + Number(a.value || 0), 0);
    const investTotal = state.investments.reduce((s, i) => s + Number(i.currentValue || 0), 0);
    const liabTotal = state.liabilities.reduce((s, l) => s + Number(l.amount || 0), 0);
    const netWorth = assetsTotal + investTotal - liabTotal;
    return { assetsTotal, investTotal, liabTotal, netWorth };
  }

  function monthlyIncomeTotal() {
    const incomeMonthly = (state.income || []).reduce((s, i) => {
      const amt = Number(i.amount || 0);
      if (i.frequency === "Annual") return s + amt / 12;
      if (i.frequency === "One-time") return s;
      return s + amt;
    }, 0);
    const pensionMonthly = (state.pensions || []).reduce((s, p) => s + Number(p.monthlyAmount || 0), 0);
    return incomeMonthly + pensionMonthly;
  }

  /* ---------------- projected interest & reminders ----------------
     Both are computed fresh from state + the current date on every
     render, so they're accurate whenever you open the app — including
     "every morning" without needing any stored/scheduled state. */
  function projectedInterestBreakdown() {
    return state.investments
      .filter((i) => i.interestRate != null && i.currentValue != null)
      .map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        rate: Number(i.interestRate),
        expected: Number(i.currentValue || 0) * Number(i.interestRate) / 100
      }))
      .sort((a, b) => b.expected - a.expected);
  }
  function projectedAnnualInterestTotal() {
    return projectedInterestBreakdown().reduce((s, r) => s + r.expected, 0);
  }

  function buildReminders() {
    const today = new Date();
    const msDay = 86400000;
    const items = [];

    state.investments
      .filter((i) => FIXED_INCOME_TYPES.includes(i.type) && i.maturityDate)
      .forEach((i) => {
        const days = Math.round((new Date(i.maturityDate) - today) / msDay);
        if (days >= 0 && days <= 120) {
          items.push(`⏳ ${i.name} matures in ${days} day${days === 1 ? "" : "s"} (${formatDate(i.maturityDate)}) — plan reinvestment.`);
        } else if (days < 0 && days >= -14) {
          items.push(`✅ ${i.name} matured on ${formatDate(i.maturityDate)} — check payout/reinvestment.`);
        }
      });

    const eightyCLimit = 150000;
    state.investments
      .filter((i) => ["PPF", "EPF", "VPF"].includes(i.type))
      .forEach((i) => {
        const invested = Number(i.investedThisYear || 0);
        if (invested < eightyCLimit) {
          const fyEndYear = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
          const fyEnd = new Date(fyEndYear, 2, 31);
          const daysLeft = Math.round((fyEnd - today) / msDay);
          items.push(`💰 ₹${Math.round(eightyCLimit - invested).toLocaleString("en-IN")} of 80C headroom left in ${i.name} — ${daysLeft} day${daysLeft === 1 ? "" : "s"} to FY-end (31 Mar).`);
        }
      });

    return items;
  }

  /* ---------------- render router ---------------- */
  function render() {
    const main = $("#main");
    const renderers = {
      dashboard: renderDashboard,
      wealth: renderWealth,
      fixedIncome: renderFixedIncome,
      retirement: renderRetirement,
      pension: renderPension,
      tax: renderTax,
      goals: renderGoals,
      family: renderFamily,
      reports: renderReports,
      learn: renderLearn,
      settings: renderSettings
    };
    main.innerHTML = (renderers[currentPage] || renderDashboard)();
    wirePageEvents(currentPage);
  }

  /* ---------------- DASHBOARD ---------------- */
  function renderDashboard() {
    const t = totals();
    const monthlyIncome = monthlyIncomeTotal();

    const filterMap = {
      fixedIncome: (i) => FIXED_INCOME_TYPES.includes(i.type),
      retirement: (i) => RETIREMENT_TYPES.includes(i.type),
      wealth: (i) => !FIXED_INCOME_TYPES.includes(i.type) && !RETIREMENT_TYPES.includes(i.type)
    };
    const filtered = dashboardInvestFilter === "all"
      ? state.investments
      : state.investments.filter(filterMap[dashboardInvestFilter] || (() => true));
    const recentInvest = [...filtered].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 8);
    const reminders = buildReminders();
    const interestBreakdown = projectedInterestBreakdown();
    const projectedInterest = projectedAnnualInterestTotal();

    return `
      <div class="page">
        <div class="page-head">
          <div>
            <div class="eyebrow">Overview</div>
            <h2>Dashboard</h2>
          </div>
        </div>
        <div class="ledger-rule"></div>
        ${reminders.length ? `
        <div class="card" style="margin-bottom:16px;">
          <div class="section-title" style="margin:0 0 8px;">Today's Reminders${infoIcon("Generated fresh each time you open the app, from maturity dates and 80C contribution limits — no setup needed.")}</div>
          ${reminders.map((r) => `<div class="pill-note" style="margin-top:8px;">${escapeHtml(r)}</div>`).join("")}
        </div>` : ""}
        <div class="grid grid-4">
          <div class="card stat-card linkable ${t.netWorth >= 0 ? "positive" : "negative"}" data-goto="reports">
            <div class="label">Net Worth${infoIcon("Assets + investments − liabilities. Tap to see the trend over time in Reports.")}</div>
            <div class="value">${formatINR(t.netWorth)}</div>
            <div class="sub">Assets + investments − liabilities</div>
          </div>
          <div class="card stat-card linkable" data-goto="wealth">
            <div class="label">Investments${infoIcon("Total current value of every holding — general investments, fixed income, retirement accounts. Tap to manage them.")}</div>
            <div class="value">${formatINR(t.investTotal)}</div>
            <div class="sub">${state.investments.length} holding${state.investments.length === 1 ? "" : "s"}</div>
          </div>
          <div class="card stat-card linkable ${t.liabTotal > 0 ? "negative" : ""}" data-goto="wealth">
            <div class="label">Liabilities${infoIcon("Loans and dues you owe. Tap to view or add liabilities under Wealth.")}</div>
            <div class="value">${formatINR(t.liabTotal)}</div>
            <div class="sub">${state.liabilities.length} item${state.liabilities.length === 1 ? "" : "s"}</div>
          </div>
          <div class="card stat-card linkable" data-goto="wealth">
            <div class="label">Monthly Income${infoIcon("Recurring income sources plus any pension income, normalised to a monthly figure. Tap to manage income sources.")}</div>
            <div class="value">${formatINR(monthlyIncome)}</div>
            <div class="sub">Income + pension, per month</div>
          </div>
        </div>

        <div class="section-title">Expected Future Interest${infoIcon("Projected annual interest income if current rates and balances hold, based on each holding's rate × current value. An estimate, not a guarantee — actual bond/FD payouts depend on the instrument's own schedule.")}</div>
        <div class="card" style="margin-bottom:16px;">
          <div class="grid grid-2">
            <div class="stat-card"><div class="label">Projected Annual Interest</div><div class="value">${formatINR(projectedInterest)}</div><div class="sub">Across ${interestBreakdown.length} interest-bearing holding${interestBreakdown.length === 1 ? "" : "s"}</div></div>
            <div class="stat-card"><div class="label">≈ Monthly Equivalent</div><div class="value">${formatINR(projectedInterest / 12)}</div><div class="sub">Projected interest ÷ 12</div></div>
          </div>
          ${interestBreakdown.length ? `<div class="item-list" style="margin-top:12px;">${interestBreakdown.map((r) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(r.name)} <span class="tag ${RETIREMENT_TYPES.includes(r.type) ? "gold" : ""}">${escapeHtml(r.type)}</span></div><div class="sub">${r.rate}% p.a.</div></div>
              <div class="amount">${formatINR(r.expected)}/yr</div>
            </div>`).join("")}</div>` : emptyState("No interest-bearing holdings yet", "Add a bond, FD or retirement account to see projected interest here.")}
        </div>

        <div class="section-title-row">
          <div class="section-title" style="margin:0;">Recent Investments${infoIcon("Your most recently updated holdings across every section. Click a row to jump straight to it.")}</div>
          <select id="dashInvestFilter" class="dash-filter">
            <option value="all" ${dashboardInvestFilter === "all" ? "selected" : ""}>All</option>
            <option value="fixedIncome" ${dashboardInvestFilter === "fixedIncome" ? "selected" : ""}>Fixed Income</option>
            <option value="retirement" ${dashboardInvestFilter === "retirement" ? "selected" : ""}>Retirement</option>
            <option value="wealth" ${dashboardInvestFilter === "wealth" ? "selected" : ""}>General / Other</option>
          </select>
        </div>
        <div class="card">
          ${recentInvest.length ? `<div class="item-list scroll-list">${recentInvest.map(investRowDash).join("")}</div>`
            : emptyState("No investments yet", "Use Quick Add to record your first holding.")}
        </div>

        <div class="section-title">Goals in Progress${infoIcon("Your savings goals and how close you are to each target. Click one to open Goals.")}</div>
        <div class="card">
          ${state.goals.length ? `<div class="item-list scroll-list">${state.goals.map(goalRowDash).join("")}</div>`
            : emptyState("No goals yet", "Add a goal to start tracking progress.")}
        </div>
      </div>`;
  }

  function investRowDash(inv) {
    return `<div class="item-row clickable-row" data-nav-inv="${inv.id}">
      <div class="meta">
        <div class="name">${escapeHtml(inv.name)} <span class="tag ${RETIREMENT_TYPES.includes(inv.type) ? "gold" : ""}">${escapeHtml(inv.type)}</span></div>
        <div class="sub">${escapeHtml(inv.institution || "")}${inv.accountNumber ? " · " + escapeHtml(inv.accountNumber) : ""}</div>
      </div>
      <div class="amount">${formatINR(inv.currentValue)}</div>
    </div>`;
  }
  function investRow(inv) {
    return `<div class="item-row">
      <div class="meta">
        <div class="name">${escapeHtml(inv.name)} <span class="tag ${RETIREMENT_TYPES.includes(inv.type) ? "gold" : ""}">${escapeHtml(inv.type)}</span></div>
        <div class="sub">${escapeHtml(inv.institution || "")}${inv.accountNumber ? " · " + escapeHtml(inv.accountNumber) : ""}</div>
      </div>
      <div class="amount">${formatINR(inv.currentValue)}</div>
    </div>`;
  }
  function goalRowDash(g) {
    const pct = g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    return `<div class="item-row clickable-row" data-nav-goal="${g.id}">
      <div class="meta">
        <div class="name">${escapeHtml(g.name)}</div>
        <div class="sub">${formatINR(g.currentAmount)} of ${formatINR(g.targetAmount)} · ${pct}% · target ${formatDate(g.targetDate)}</div>
      </div>
    </div>`;
  }

  function emptyState(big, small) {
    return `<div class="empty-state"><div class="big">${escapeHtml(big)}</div><div>${escapeHtml(small)}</div></div>`;
  }

  /* ---------------- WEALTH (assets, liabilities, income, general investments) ---------------- */
  function renderWealth() {
    const t = totals();
    const generalInvest = state.investments.filter((i) => !RETIREMENT_TYPES.includes(i.type) && !FIXED_INCOME_TYPES.includes(i.type));
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Net worth</div><h2>Wealth</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card"><div class="label">Assets</div><div class="value">${formatINR(t.assetsTotal)}</div></div>
          <div class="card stat-card"><div class="label">Investments</div><div class="value">${formatINR(t.investTotal)}</div></div>
          <div class="card stat-card negative"><div class="label">Liabilities</div><div class="value">${formatINR(t.liabTotal)}</div></div>
        </div>

        <div class="section-title">Assets <button class="btn-add" data-open-form="asset">+ Add asset</button></div>
        <div class="card">
          ${state.assets.length ? `<div class="item-list">${state.assets.map((a) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(a.name)}<span class="tag">${escapeHtml(a.category || "Asset")}</span></div><div class="sub">Updated ${formatDate(a.updatedAt)}</div></div>
              <div class="amount">${formatINR(a.value)}</div>
              <div class="row-actions"><button data-edit="asset" data-id="${a.id}">Edit</button><button class="danger" data-del="asset" data-id="${a.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No assets recorded", "Property, gold, vehicles — add what you own.")}
        </div>
        <div id="form-asset"></div>

        <div class="section-title">Liabilities <button class="btn-add" data-open-form="liability">+ Add liability</button></div>
        <div class="card">
          ${state.liabilities.length ? `<div class="item-list">${state.liabilities.map((l) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(l.name)}<span class="tag">${escapeHtml(l.category || "Loan")}</span></div><div class="sub">Updated ${formatDate(l.updatedAt)}</div></div>
              <div class="amount">${formatINR(l.amount)}</div>
              <div class="row-actions"><button data-edit="liability" data-id="${l.id}">Edit</button><button class="danger" data-del="liability" data-id="${l.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No liabilities recorded", "Loans and dues you owe will appear here.")}
        </div>
        <div id="form-liability"></div>

        <div class="section-title">Income Sources${infoIcon("Recurring income like salary, rent or a side income. Pension income has its own dedicated Pension tab.")} <button class="btn-add" data-open-form="income">+ Add income</button></div>
        <div class="card">
          ${state.income.length ? `<div class="item-list">${state.income.map(incomeRow).join("")}</div>` : emptyState("No income sources recorded", "Salary, rent and other recurring income.")}
        </div>
        <div id="form-income"></div>

        <div class="section-title">Other Investments${infoIcon("General market-linked holdings: stocks, mutual funds, ETFs, gold, real estate, insurance/ULIP, crypto. For FDs/Bonds use Fixed Income; for PPF/EPF/NPS use Retirement.")} <button class="btn-add" data-open-form="investment">+ Add investment</button></div>
        <div class="card">
          ${generalInvest.length ? `<div class="item-list">${generalInvest.map(investRowWithActions).join("")}</div>` : emptyState("No general investments", "Stocks, mutual funds and more can be added here.")}
        </div>
        <div id="form-investment"></div>
      </div>`;
  }

  function incomeRow(inc) {
    return `<div class="item-row">
      <div class="meta"><div class="name">${escapeHtml(inc.source)}<span class="tag">${escapeHtml(inc.frequency || "Monthly")}</span></div></div>
      <div class="amount">${formatINR(inc.amount)}</div>
      <div class="row-actions"><button data-edit="income" data-id="${inc.id}">Edit</button><button class="danger" data-del="income" data-id="${inc.id}">Remove</button></div>
    </div>`;
  }

  function investRowWithActions(inv) {
    return `<div class="item-row" data-id="${inv.id}">
      <div class="meta">
        <div class="name">${escapeHtml(inv.name)} <span class="tag">${escapeHtml(inv.type)}</span></div>
        <div class="sub">${escapeHtml(inv.institution || "")}</div>
      </div>
      <div class="amount">${formatINR(inv.currentValue)}</div>
      <div class="row-actions"><button data-edit="investment" data-id="${inv.id}">Edit</button><button class="danger" data-del="investment" data-id="${inv.id}">Remove</button></div>
    </div>`;
  }

  /* ---------------- FIXED INCOME (bonds, FDs, RDs, and similar) ---------------- */
  function renderFixedIncome() {
    const items = state.investments.filter((i) => FIXED_INCOME_TYPES.includes(i.type));
    const total = items.reduce((s, i) => s + Number(i.currentValue || 0), 0);
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">FDs · Bonds · RDs · SGBs</div><h2>Fixed Income${infoIcon("Instruments with a fixed or predictable return: bank/corporate FDs, RDs, bonds, sovereign gold bonds, post office schemes, debentures.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card"><div class="label">Fixed Income Value</div><div class="value">${formatINR(total)}</div><div class="sub">${items.length} instrument${items.length === 1 ? "" : "s"}</div></div>
        </div>
        <div class="section-title">Holdings <button class="btn-add" data-open-form="fixedincome">+ Add fixed income</button></div>
        <div class="card">
          ${items.length ? items.map(fixedIncomeCard).join("") : emptyState("No fixed-income holdings yet", "Add bonds, fixed deposits, recurring deposits and similar instruments.")}
        </div>
        <div id="form-fixedincome"></div>
      </div>`;
  }
  function fixedIncomeCard(inv) {
    return `<div class="card" data-id="${inv.id}" style="margin-bottom:12px;">
      <div class="item-row" style="border:none; padding-bottom:6px;">
        <div class="meta">
          <div class="name">${escapeHtml(inv.name)} <span class="tag">${escapeHtml(inv.type)}</span></div>
          <div class="sub">${escapeHtml(inv.institution || "")}${inv.accountNumber ? " · " + escapeHtml(inv.accountNumber) : ""}</div>
        </div>
        <div class="amount">${formatINR(inv.currentValue)}</div>
        <div class="row-actions"><button data-edit="fixedincome" data-id="${inv.id}">Edit</button><button class="danger" data-del="investment" data-id="${inv.id}">Remove</button></div>
      </div>
      <div class="grid grid-3" style="margin-top:8px;">
        <div class="sub">Principal<br><strong>${formatINR(inv.principal)}</strong></div>
        <div class="sub">Rate<br><strong>${inv.interestRate != null ? inv.interestRate + "%" : "—"}</strong></div>
        <div class="sub">Maturity<br><strong>${formatDate(inv.maturityDate)}</strong></div>
      </div>
    </div>`;
  }

  /* ---------------- RETIREMENT (PPF, EPF, VPF, NPS, Superannuation) ---------------- */
  function renderRetirement() {
    const items = state.investments.filter((i) => RETIREMENT_TYPES.includes(i.type));
    const total = items.reduce((s, i) => s + Number(i.currentValue || 0), 0);
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">PPF · EPF · VPF · NPS</div><h2>Retirement${infoIcon("Retirement accounts you're still building up: PPF, EPF, VPF, NPS and Superannuation. For pension income you already receive, see the Pension tab.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card"><div class="label">Retirement Corpus</div><div class="value">${formatINR(total)}</div><div class="sub">${items.length} account${items.length === 1 ? "" : "s"}</div></div>
        </div>
        <div class="section-title">Accounts <button class="btn-add" data-open-form="retirement">+ Add retirement account</button></div>
        ${items.length ? items.map(retirementCard).join("") : `<div class="card">${emptyState("No retirement accounts yet", "PPF, EPF, VPF, NPS and Superannuation accounts will appear here.")}</div>`}
        <div id="form-retirement"></div>
      </div>`;
  }
  function retirementCard(inv) {
    const contribs = (inv.contributions || []).slice().reverse().slice(0, 5);
    return `<div class="card" data-id="${inv.id}" style="margin-bottom:14px;">
      <div class="item-row" style="border:none; padding-bottom:4px;">
        <div class="meta">
          <div class="name">${escapeHtml(inv.name)} <span class="tag gold">${escapeHtml(inv.type)}</span></div>
          <div class="sub">${escapeHtml(inv.holder || "")}${inv.accountNumber ? " · A/c " + escapeHtml(inv.accountNumber) : ""}</div>
        </div>
        <div class="amount">${formatINR(inv.currentValue)}</div>
        <div class="row-actions"><button data-edit="retirement" data-id="${inv.id}">Edit</button><button class="danger" data-del="investment" data-id="${inv.id}">Remove</button></div>
      </div>
      <div class="grid grid-3" style="margin-top:10px;">
        <div class="sub">Opening date<br><strong>${formatDate(inv.openingDate)}</strong></div>
        <div class="sub">Maturity date<br><strong>${formatDate(inv.maturityDate)}</strong></div>
        <div class="sub">Interest rate<br><strong>${inv.interestRate != null ? inv.interestRate + "%" : "—"}</strong></div>
      </div>
      ${inv.investedThisYear != null ? `<div class="pill-note">Invested this year: <strong>${formatINR(inv.investedThisYear)}</strong></div>` : ""}
      ${contribs.length ? `
        <div class="section-title" style="margin-top:16px;">Recent contributions</div>
        ${contribs.map((c) => `<div class="contribution-row"><span>${formatDate(c.date)} · ${escapeHtml(c.channel || "")}</span><span>${formatINR(c.amount)} <span style="color:var(--ink-soft)">(bal. ${formatINR(c.balanceAfter)})</span></span></div>`).join("")}
      ` : ""}
    </div>`;
  }

  /* ---------------- PENSION (income you already receive) ---------------- */
  function renderPension() {
    const items = state.pensions || [];
    const totalMonthly = items.reduce((s, p) => s + Number(p.monthlyAmount || 0), 0);
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Guaranteed monthly income</div><h2>Pension${infoIcon("Pension income you already receive — military, civil, family pension or an NPS annuity payout. Unlike Fixed Income, there's no principal or maturity date here, just a recurring monthly amount.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card"><div class="label">Monthly Pension Income</div><div class="value">${formatINR(totalMonthly)}</div><div class="sub">${items.length} pension${items.length === 1 ? "" : "s"}</div></div>
        </div>
        <div class="section-title">Pensions <button class="btn-add" data-open-form="pension">+ Add pension</button></div>
        <div class="card">
          ${items.length ? `<div class="item-list">${items.map(pensionRow).join("")}</div>` : emptyState("No pensions recorded", "Add military, civil, family or annuity pension income.")}
        </div>
        <div id="form-pension"></div>
      </div>`;
  }
  function pensionRow(p) {
    return `<div class="item-row" data-id="${p.id}">
      <div class="meta">
        <div class="name">${escapeHtml(p.label)} <span class="tag gold">${escapeHtml(p.pensionType || "Pension")}</span></div>
        <div class="sub">${escapeHtml(p.source || "")}${p.startDate ? " · since " + formatDate(p.startDate) : ""}</div>
      </div>
      <div class="amount">${formatINR(p.monthlyAmount)}/mo</div>
      <div class="row-actions"><button data-edit="pension" data-id="${p.id}">Edit</button><button class="danger" data-del="pension" data-id="${p.id}">Remove</button></div>
    </div>`;
  }

  /* ---------------- TAX ---------------- */
  function renderTax() {
    const eightyC = state.investments.filter((i) => ["PPF", "EPF", "VPF"].includes(i.type)).reduce((s, i) => s + Number(i.investedThisYear || 0), 0);
    const cap = 150000;
    const pct = Math.min(100, Math.round((eightyC / cap) * 100));
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Deductions</div><h2>Tax${infoIcon("A simple Section 80C tracker based on your PPF/EPF/VPF contributions this financial year. Not tax advice.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="card">
          <div class="form-title">Section 80C tracker (old regime)</div>
          <div class="sub" style="margin-bottom:10px;">Based on PPF / EPF / VPF contributions recorded this financial year.</div>
          <div style="background:var(--teal-50); border-radius:20px; height:14px; overflow:hidden; border:1px solid var(--line);">
            <div style="height:100%; width:${pct}%; background:var(--teal-700);"></div>
          </div>
          <div class="sub" style="margin-top:8px;">${formatINR(eightyC)} of ${formatINR(cap)} used (${pct}%)</div>
        </div>
        <div class="section-title">Notes</div>
        <div class="card">
          <div class="pill-note">This is a simple tracker for your own records, not tax advice. Confirm figures with your CA or the official ITR portal before filing.</div>
        </div>
      </div>`;
  }

  /* ---------------- GOALS ---------------- */
  function renderGoals() {
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Plan ahead</div><h2>Goals${infoIcon("Savings targets like a house, education or a trip. Track how much you've saved against the target.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="section-title">Your goals <button class="btn-add" data-open-form="goal">+ Add goal</button></div>
        <div class="card">
          ${state.goals.length ? `<div class="item-list">${state.goals.map((g) => `
            <div class="item-row" data-id="${g.id}">
              <div class="meta"><div class="name">${escapeHtml(g.name)}</div><div class="sub">Target ${formatDate(g.targetDate)}</div></div>
              <div class="amount">${formatINR(g.currentAmount)} / ${formatINR(g.targetAmount)}</div>
              <div class="row-actions"><button data-edit="goal" data-id="${g.id}">Edit</button><button class="danger" data-del="goal" data-id="${g.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No goals yet", "Retirement, a house, education — set a target and track it.")}
        </div>
        <div id="form-goal"></div>
      </div>`;
  }

  /* ---------------- FAMILY ---------------- */
  function renderFamily() {
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Household</div><h2>Family${infoIcon("A simple record of dependants for your financial planning — nominee details, policy numbers, notes.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="section-title">Family members <button class="btn-add" data-open-form="family">+ Add member</button></div>
        <div class="card">
          ${state.family.length ? `<div class="item-list">${state.family.map((f) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(f.name)}<span class="tag">${escapeHtml(f.relation || "")}</span></div><div class="sub">${f.dob ? "DOB " + formatDate(f.dob) : ""}</div></div>
              <div class="row-actions"><button data-edit="family" data-id="${f.id}">Edit</button><button class="danger" data-del="family" data-id="${f.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No family members added", "Track dependents relevant to your financial plan.")}
        </div>
        <div id="form-family"></div>
      </div>`;
  }

  /* ---------------- REPORTS ---------------- */
  function renderReports() {
    const t = totals();
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Summary</div><h2>Reports${infoIcon("Save periodic net-worth snapshots to build a trend over time, and export a full JSON backup.")}</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="card">
          <div class="form-title">Current snapshot</div>
          <div class="grid grid-2">
            <div class="sub">Assets<br><strong>${formatINR(t.assetsTotal)}</strong></div>
            <div class="sub">Investments<br><strong>${formatINR(t.investTotal)}</strong></div>
            <div class="sub">Liabilities<br><strong>${formatINR(t.liabTotal)}</strong></div>
            <div class="sub">Net worth<br><strong>${formatINR(t.netWorth)}</strong></div>
          </div>
          <div class="form-footer">
            <button class="btn-primary" id="saveSnapshotBtn">Save snapshot</button>
            <button class="btn-ghost" id="exportJsonBtn">Export data (JSON)</button>
          </div>
        </div>
        <div class="section-title">Snapshot history</div>
        <div class="card">
          ${state.history.length ? `<div class="item-list">${state.history.slice().reverse().map((h) => `
            <div class="item-row"><div class="meta"><div class="name">${formatDate(h.date)}</div></div><div class="amount">${formatINR(h.netWorth)}</div></div>`).join("")}</div>`
            : emptyState("No snapshots saved", "Save a snapshot to start tracking net worth over time.")}
        </div>
      </div>`;
  }

  /* ---------------- LEARN ---------------- */
  function renderLearn() {
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Guide</div><h2>Learn Your RFM</h2></div></div>
        <div class="ledger-rule"></div>

        <div class="card">
          <div class="form-title">Where things live</div>
          <div class="item-list">
            <div class="item-row"><div class="meta"><div class="name">Dashboard</div><div class="sub">Net worth, investments, liabilities and monthly income at a glance. Every card and row is clickable — tap one to jump straight to the full record. Use the filter dropdown on Recent Investments to narrow the list.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Wealth</div><div class="sub">Assets, liabilities, income sources and general investments — stocks, mutual funds, ETFs, gold, real estate, insurance/ULIP, crypto.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Fixed Income</div><div class="sub">FDs, corporate FDs, RDs, bonds, sovereign gold bonds, post office schemes and debentures — instruments with a fixed or predictable return.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Retirement</div><div class="sub">PPF, EPF, VPF, NPS and Superannuation accounts you're still building, with contribution history.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Pension</div><div class="sub">Pension income you already receive — military, civil, family pension or an NPS annuity. No principal or maturity fields, just a monthly amount.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Tax</div><div class="sub">A simple Section 80C tracker based on your PPF/EPF/VPF contributions this year. Not tax advice.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Goals</div><div class="sub">Savings targets with a progress bar against how much you've saved.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Family</div><div class="sub">A simple household record — nominees, policy numbers, notes.</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Reports</div><div class="sub">Save net-worth snapshots over time and export a full JSON backup.</div></div></div>
          </div>
        </div>

        <div class="section-title">Adding, editing and removing entries</div>
        <div class="card">
          <div class="sub">Every list has a <strong>+ Add</strong> button to log a new entry. Existing rows have <strong>Edit</strong> (opens the same form pre-filled so you can correct or update it in place) and <strong>Remove</strong> (deletes it — this can't be undone). The ＋ Quick Add button in the header is a shortcut to the add forms from anywhere in the app.</div>
        </div>

        <div class="section-title">Privacy — hiding amounts</div>
        <div class="card">
          <div class="sub">Tap the 👁 icon in the header (or the button in Settings) to mask every ₹ amount on screen with ••••••. Handy if someone's looking over your shoulder. Tap again to reveal. This only affects the display — your data isn't changed.</div>
        </div>

        <div class="section-title">Info tooltips</div>
        <div class="card">
          <div class="sub">Tap the small ⓘ icon next to any tab name or form field (especially "Type" dropdowns) for a plain-language explanation of what it means and where it belongs.</div>
        </div>

        <div class="section-title">Backup and privacy of your data</div>
        <div class="card">
          <div class="pill-note">RFM stores everything only on the device you're using — there's no server, and nothing leaves your phone unless you deliberately set up optional cloud sync (see Settings). Export a backup from Reports or Settings regularly, especially before resetting or switching devices.</div>
        </div>
      </div>`;
  }

  /* ---------------- SETTINGS ---------------- */
  function renderSettings() {
    const session = getSession();
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Account</div><h2>Settings</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="card">
          <div class="form-title">Profile</div>
          <div class="sub">Name: <strong>${escapeHtml(state.profile.name)}</strong></div>
          <div class="sub">Mode: <strong>${session && session.mode === "cloud" ? "Cloud sync" : "Local device"}</strong></div>
        </div>
        <div class="section-title">Privacy</div>
        <div class="card">
          <div class="sub" style="margin-bottom:10px;">Hide all ₹ amounts on screen — toggle any time from the 👁 icon in the header, or here.</div>
          <div class="form-footer">
            <button class="btn-ghost" id="toggleHideBtn">${state.settings && state.settings.hideAmounts ? "Show amounts" : "Hide amounts"}</button>
          </div>
        </div>
        <div class="section-title">Data</div>
        <div class="card">
          <div class="sub" style="margin-bottom:10px;">Export a full backup, or reset all data on this device.</div>
          <div class="form-footer">
            <button class="btn-ghost" id="exportJsonBtn2">Export data (JSON)</button>
            <button class="btn-ghost" id="resetDataBtn" style="color:var(--clay); border-color:var(--clay-soft);">Reset all data</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- inline add-forms ---------------- */
  const FORM_DEFS = {
    asset: {
      title: "Add asset",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "category", label: "Category", type: "text", placeholder: "Property, Gold, Vehicle…" },
        { key: "value", label: "Current value (₹)", type: "number", required: true }
      ],
      submit(data) {
        state.assets.push({ id: uid(), name: data.name, category: data.category, value: Number(data.value || 0), updatedAt: new Date().toISOString() });
      }
    },
    liability: {
      title: "Add liability",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "category", label: "Category", type: "text", placeholder: "Home loan, Credit card…" },
        { key: "amount", label: "Outstanding amount (₹)", type: "number", required: true }
      ],
      submit(data) {
        state.liabilities.push({ id: uid(), name: data.name, category: data.category, amount: Number(data.amount || 0), updatedAt: new Date().toISOString() });
      }
    },
    investment: {
      title: "Add investment",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "type", label: "Type", type: "select", options: GENERAL_INVEST_TYPES, info: "General market-linked holdings. For FDs/Bonds use Fixed Income, for PPF/EPF/NPS use Retirement, for pension income use the Pension tab." },
        { key: "institution", label: "Institution / broker", type: "text" },
        { key: "currentValue", label: "Current value (₹)", type: "number", required: true }
      ],
      submit(data) { addInvestment(data); }
    },
    fixedincome: {
      title: "Add fixed income",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "type", label: "Type", type: "select", options: [...FIXED_INCOME_TYPES, "Other"], info: "FD/RD have a fixed tenure and guaranteed return. Bonds and Sovereign Gold Bonds move with rates/gold price. Post Office Scheme covers NSC/KVP-type instruments." },
        { key: "institution", label: "Issuer / bank", type: "text" },
        { key: "accountNumber", label: "Account / folio no.", type: "text" },
        { key: "principal", label: "Principal (₹)", type: "number" },
        { key: "currentValue", label: "Current value (₹)", type: "number", required: true },
        { key: "interestRate", label: "Interest rate (%)", type: "number" },
        { key: "maturityDate", label: "Maturity date", type: "date" }
      ],
      submit(data) { addInvestment(data); }
    },
    retirement: {
      title: "Add retirement account",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "type", label: "Type", type: "select", options: [...RETIREMENT_TYPES, "Other"], info: "PPF & VPF are voluntary savings; EPF is employer-linked; NPS is market-linked with an annuity at retirement; Superannuation is an employer retirement benefit." },
        { key: "institution", label: "Bank / provider", type: "text" },
        { key: "accountNumber", label: "Account number", type: "text" },
        { key: "openingDate", label: "Opening date", type: "date" },
        { key: "maturityDate", label: "Maturity date", type: "date" },
        { key: "currentValue", label: "Current balance (₹)", type: "number", required: true },
        { key: "investedThisYear", label: "Invested this year (₹)", type: "number" },
        { key: "interestRate", label: "Interest rate (%)", type: "number" }
      ],
      submit(data) { addInvestment(data); }
    },
    pension: {
      title: "Add pension",
      fields: [
        { key: "label", label: "Label", type: "text", required: true, placeholder: "e.g. Army Pension, LIC Annuity" },
        { key: "pensionType", label: "Pension type", type: "select", options: PENSION_TYPES, info: "Military/Civil/Family pension are government-paid. NPS Annuity is the payout from your NPS corpus. Use Additional Pension for any other recurring pension-like income." },
        { key: "monthlyAmount", label: "Monthly amount (₹)", type: "number", required: true },
        { key: "source", label: "Paid by (bank / PDA / insurer)", type: "text" },
        { key: "startDate", label: "Start date", type: "date" },
        { key: "notes", label: "Notes", type: "text" }
      ],
      submit(data) {
        state.pensions.push({
          id: uid(),
          label: data.label,
          pensionType: data.pensionType || "Additional Pension (Other)",
          monthlyAmount: Number(data.monthlyAmount || 0),
          source: data.source || "",
          startDate: data.startDate || "",
          notes: data.notes || "",
          updatedAt: new Date().toISOString()
        });
      }
    },
    goal: {
      title: "Add goal",
      fields: [
        { key: "name", label: "Goal name", type: "text", required: true },
        { key: "targetAmount", label: "Target amount (₹)", type: "number", required: true },
        { key: "currentAmount", label: "Current amount (₹)", type: "number" },
        { key: "targetDate", label: "Target date", type: "date" }
      ],
      submit(data) {
        state.goals.push({ id: uid(), name: data.name, targetAmount: Number(data.targetAmount || 0), currentAmount: Number(data.currentAmount || 0), targetDate: data.targetDate });
      }
    },
    family: {
      title: "Add family member",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "relation", label: "Relation", type: "text", placeholder: "Spouse, Child, Parent…" },
        { key: "dob", label: "Date of birth", type: "date" }
      ],
      submit(data) {
        state.family.push({ id: uid(), name: data.name, relation: data.relation, dob: data.dob });
      }
    },
    income: {
      title: "Add income",
      fields: [
        { key: "source", label: "Source", type: "text", required: true },
        { key: "amount", label: "Amount (₹)", type: "number", required: true },
        { key: "frequency", label: "Frequency", type: "select", options: ["Monthly", "Annual", "One-time"] }
      ],
      submit(data) {
        state.income.push({ id: uid(), source: data.source, amount: Number(data.amount || 0), frequency: data.frequency });
      }
    }
  };

  function addInvestment(data) {
    state.investments.push({
      id: uid(),
      type: data.type || "Other",
      name: data.name,
      institution: data.institution || "",
      accountNumber: data.accountNumber || "",
      holder: data.holder || state.profile.name,
      openingDate: data.openingDate || "",
      maturityDate: data.maturityDate || "",
      principal: Number(data.principal || data.currentValue || 0),
      currentValue: Number(data.currentValue || 0),
      interestRate: data.interestRate !== undefined && data.interestRate !== "" ? Number(data.interestRate) : null,
      investedThisYear: data.investedThisYear !== undefined && data.investedThisYear !== "" ? Number(data.investedThisYear) : null,
      contributions: [],
      notes: "",
      updatedAt: new Date().toISOString()
    });
  }

  function fieldHtml(f, existing) {
    const raw = existing ? existing[f.key] : "";
    const val = raw == null ? "" : raw;
    if (f.type === "select") {
      return `<select id="f_${f.key}" ${f.required ? "required" : ""}>
        <option value="">Select…</option>
        ${f.options.map((o) => `<option value="${escapeHtml(o)}" ${String(o) === String(val) ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
      </select>`;
    }
    return `<input id="f_${f.key}" type="${f.type}" ${f.type === "number" ? 'step="any"' : ""} placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(val)}" ${f.required ? "required" : ""}>`;
  }

  const RECORD_ARRAY = { asset: "assets", liability: "liabilities", investment: "investments", fixedincome: "investments", retirement: "investments", pension: "pensions", goal: "goals", family: "family", income: "income" };

  function openInlineForm(key, containerSel, editId) {
    const def = FORM_DEFS[key];
    if (!def) return;
    const container = $(containerSel || `#form-${key}`);
    if (!container) return;
    const arrName = RECORD_ARRAY[key];
    const existing = editId ? (state[arrName] || []).find((x) => x.id === editId) : null;
    const isEdit = !!existing;

    container.innerHTML = `
      <div class="card form-card">
        <div class="form-title">${isEdit ? "Edit " + escapeHtml(def.title.replace(/^Add /i, "")) : escapeHtml(def.title)}</div>
        <form data-form-key="${key}">
          <div class="form-grid">
            ${def.fields.map((f) => `<div class="field"><label>${escapeHtml(f.label)}${infoIcon(f.info)}</label>${fieldHtml(f, existing)}</div>`).join("")}
          </div>
          <div class="form-footer">
            <button type="submit" class="btn-primary">${isEdit ? "Save changes" : "Save"}</button>
            <button type="button" class="btn-ghost" data-cancel-form>Cancel</button>
          </div>
        </form>
      </div>`;
    const form = $(`form[data-form-key="${key}"]`, container);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {};
      def.fields.forEach((f) => { data[f.key] = $(`#f_${f.key}`, form).value.trim(); });
      if (isEdit) {
        def.fields.forEach((f) => {
          let v = data[f.key];
          if (f.type === "number") v = v === "" ? (f.required ? 0 : null) : Number(v);
          existing[f.key] = v;
        });
        existing.updatedAt = new Date().toISOString();
      } else {
        def.submit(data);
      }
      saveState();
      container.innerHTML = "";
      render();
    });
    $("[data-cancel-form]", container).addEventListener("click", () => { container.innerHTML = ""; });
  }

  /* ---------------- page-level event wiring ---------------- */
  function wirePageEvents(page) {
    const main = $("#main");

    $$("[data-open-form]", main).forEach((btn) => {
      btn.addEventListener("click", () => openInlineForm(btn.dataset.openForm));
    });
    $$("[data-edit]", main).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.edit, id = btn.dataset.id;
        openInlineForm(key, null, id);
        setTimeout(() => {
          const el = $(`#form-${key}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      });
    });
    $$("[data-del]", main).forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.del, id = btn.dataset.id;
        const map = { asset: "assets", liability: "liabilities", investment: "investments", pension: "pensions", goal: "goals", family: "family", income: "income" };
        const arrName = map[kind];
        if (!arrName) return;
        if (!confirm("Remove this item?")) return;
        state[arrName] = state[arrName].filter((x) => x.id !== id);
        saveState();
        render();
      });
    });

    // dashboard: clickable KPI cards
    $$("[data-goto]", main).forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".info-icon")) return;
        goToPage(card.dataset.goto);
      });
    });
    // dashboard: clickable investment rows
    $$("[data-nav-inv]", main).forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.dataset.navInv;
        const inv = state.investments.find((i) => i.id === id);
        if (!inv) return;
        goToPage(pageForInvestmentType(inv.type));
        setTimeout(() => highlightRow(id), 60);
      });
    });
    // dashboard: clickable goal rows
    $$("[data-nav-goal]", main).forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.dataset.navGoal;
        goToPage("goals");
        setTimeout(() => highlightRow(id), 60);
      });
    });
    // dashboard: investment filter dropdown
    const filterSel = $("#dashInvestFilter", main);
    if (filterSel) {
      filterSel.addEventListener("change", () => {
        dashboardInvestFilter = filterSel.value;
        render();
      });
    }

    if (page === "reports") {
      const snapBtn = $("#saveSnapshotBtn");
      if (snapBtn) snapBtn.addEventListener("click", () => {
        state.history.push({ date: new Date().toISOString(), netWorth: totals().netWorth });
        saveState();
        render();
      });
      const expBtn = $("#exportJsonBtn");
      if (expBtn) expBtn.addEventListener("click", exportData);
    }
    if (page === "settings") {
      const expBtn2 = $("#exportJsonBtn2");
      if (expBtn2) expBtn2.addEventListener("click", exportData);
      const toggleBtn = $("#toggleHideBtn");
      if (toggleBtn) toggleBtn.addEventListener("click", toggleHideAmounts);
      const resetBtn = $("#resetDataBtn");
      if (resetBtn) resetBtn.addEventListener("click", () => {
        if (!confirm("This will permanently erase all RFM data on this device. Continue?")) return;
        state = seedState();
        state.profile.pinHash = null;
        saveState();
        handleLock();
      });
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rfm-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- quick add dialog ---------------- */
  function wireQuickAdd() {
    const dialog = $("#quickDialog");
    $("#quickAddBtn").addEventListener("click", () => dialog.showModal());
    $$("[data-quick]", dialog).forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.quick;
        dialog.close();
        const pageForKind = { asset: "wealth", liability: "wealth", investment: "wealth", pension: "pension", goal: "goals", family: "family", income: "wealth" };
        goToPage(pageForKind[kind] || "dashboard");
        setTimeout(() => openInlineForm(kind), 50);
      });
    });
  }

  /* ---------------- info tooltip popover ---------------- */
  function showInfoPopover(target, text) {
    const pop = $("#infoPopover");
    if (!pop) return;
    pop.textContent = text;
    pop.classList.remove("hidden");
    const width = Math.min(280, window.innerWidth - 24);
    pop.style.width = width + "px";
    const r = target.getBoundingClientRect();
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
    let top = r.bottom + 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
    requestAnimationFrame(() => {
      const ph = pop.offsetHeight;
      if (top + ph > window.innerHeight - 10) {
        pop.style.top = Math.max(10, r.top - ph - 8) + "px";
      }
    });
  }
  function hideInfoPopover() {
    const pop = $("#infoPopover");
    if (pop) { pop.classList.add("hidden"); pop.dataset.owner = ""; }
  }
  function wireInfoPopover() {
    document.addEventListener("click", (e) => {
      const icon = e.target.closest(".info-icon");
      if (icon) {
        e.preventDefault();
        e.stopPropagation();
        const pop = $("#infoPopover");
        const wasOpenForThis = pop && !pop.classList.contains("hidden") && pop.dataset.owner === icon.dataset.info;
        hideInfoPopover();
        if (!wasOpenForThis) {
          pop.dataset.owner = icon.dataset.info;
          showInfoPopover(icon, icon.dataset.info);
        }
        return;
      }
      if (!e.target.closest(".info-popover")) hideInfoPopover();
    });
    window.addEventListener("scroll", hideInfoPopover, true);
    window.addEventListener("resize", hideInfoPopover);
  }

  /* ---------------- boot ---------------- */
  function wireStaticEvents() {
    $("#loginForm").addEventListener("submit", handleLocalLogin);
    $("#cloudLoginForm").addEventListener("submit", handleCloudSignIn);
    $("#cloudSignUpBtn").addEventListener("click", handleCloudSignUp);
    $("#lockBtn").addEventListener("click", handleLock);
    const hideBtn = $("#hideAmountsBtn");
    if (hideBtn) hideBtn.addEventListener("click", toggleHideAmounts);
    $$("#sidebar .nav").forEach((btn) => btn.addEventListener("click", () => goToPage(btn.dataset.page)));
    $("#menuBtn").addEventListener("click", () => $("#sidebar").scrollIntoView({ behavior: "smooth" }));
    wireQuickAdd();
    wireInfoPopover();
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireStaticEvents();
    initLoginView();

    const session = getSession();
    if (session) {
      state = normalizeState(loadState() || seedState());
      enterApp();
    }
  });

  // expose for debugging / firebase-sync.js hooks
  window.RFM = { getState: () => state, setState: (s) => { state = normalizeState(s); render(); }, saveState, formatINR, formatDate };
})();
