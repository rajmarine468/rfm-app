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

  /* ---------------- utilities ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function formatINR(n) {
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

  /* ---------------- default / seed data ---------------- */
  function seedState() {
    return {
      profile: { name: "Rajender", pinHash: null, createdAt: new Date().toISOString() },
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
      goals: [],
      family: [],
      income: [],
      history: [] // net-worth snapshots, populated by Reports
    };
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

    state = loadState() || seedState();
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
      state = remote || loadState() || seedState();
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

  /* ---------------- navigation ---------------- */
  let currentPage = "dashboard";
  function goToPage(page) {
    currentPage = page;
    $$("#sidebar .nav").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    render();
    $("#main").scrollTop = 0;
  }

  /* ---------------- derived totals ---------------- */
  function totals() {
    const assetsTotal = state.assets.reduce((s, a) => s + Number(a.value || 0), 0);
    const investTotal = state.investments.reduce((s, i) => s + Number(i.currentValue || 0), 0);
    const liabTotal = state.liabilities.reduce((s, l) => s + Number(l.amount || 0), 0);
    const netWorth = assetsTotal + investTotal - liabTotal;
    return { assetsTotal, investTotal, liabTotal, netWorth };
  }

  /* ---------------- render router ---------------- */
  function render() {
    const main = $("#main");
    const renderers = {
      dashboard: renderDashboard,
      wealth: renderWealth,
      fixedIncome: renderFixedIncome,
      retirement: renderRetirement,
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
    const recentInvest = [...state.investments].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 4);
    return `
      <div class="page">
        <div class="page-head">
          <div>
            <div class="eyebrow">Overview</div>
            <h2>Dashboard</h2>
          </div>
        </div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card ${t.netWorth >= 0 ? "positive" : "negative"}">
            <div class="label">Net Worth</div>
            <div class="value">${formatINR(t.netWorth)}</div>
            <div class="sub">Assets + investments − liabilities</div>
          </div>
          <div class="card stat-card">
            <div class="label">Investments</div>
            <div class="value">${formatINR(t.investTotal)}</div>
            <div class="sub">${state.investments.length} holding${state.investments.length === 1 ? "" : "s"}</div>
          </div>
          <div class="card stat-card ${t.liabTotal > 0 ? "negative" : ""}">
            <div class="label">Liabilities</div>
            <div class="value">${formatINR(t.liabTotal)}</div>
            <div class="sub">${state.liabilities.length} item${state.liabilities.length === 1 ? "" : "s"}</div>
          </div>
        </div>

        <div class="section-title">Recent Investments</div>
        <div class="card">
          ${recentInvest.length ? `<div class="item-list">${recentInvest.map(investRow).join("")}</div>`
            : emptyState("No investments yet", "Use Quick Add to record your first holding.")}
        </div>

        <div class="section-title">Goals in Progress</div>
        <div class="card">
          ${state.goals.length ? `<div class="item-list">${state.goals.slice(0, 4).map(goalRow).join("")}</div>`
            : emptyState("No goals yet", "Add a goal to start tracking progress.")}
        </div>
      </div>`;
  }

  function investRow(inv) {
    return `<div class="item-row">
      <div class="meta">
        <div class="name">${escapeHtml(inv.name)} <span class="tag ${inv.type === "PPF" ? "gold" : ""}">${escapeHtml(inv.type)}</span></div>
        <div class="sub">${escapeHtml(inv.institution || "")}${inv.accountNumber ? " · " + escapeHtml(inv.accountNumber) : ""}</div>
      </div>
      <div class="amount">${formatINR(inv.currentValue)}</div>
    </div>`;
  }
  function goalRow(g) {
    const pct = g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    return `<div class="item-row">
      <div class="meta">
        <div class="name">${escapeHtml(g.name)}</div>
        <div class="sub">${formatINR(g.currentAmount)} of ${formatINR(g.targetAmount)} · ${pct}% · target ${formatDate(g.targetDate)}</div>
      </div>
    </div>`;
  }

  function emptyState(big, small) {
    return `<div class="empty-state"><div class="big">${escapeHtml(big)}</div><div>${escapeHtml(small)}</div></div>`;
  }

  /* ---------------- WEALTH (assets, liabilities, general investments) ---------------- */
  function renderWealth() {
    const t = totals();
    const generalInvest = state.investments.filter((i) => !["PPF", "EPF", "NPS"].includes(i.type) && !["Bond", "FD", "RD"].includes(i.type));
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
              <div class="row-actions"><button class="danger" data-del="asset" data-id="${a.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No assets recorded", "Property, gold, vehicles — add what you own.")}
        </div>
        <div id="form-asset"></div>

        <div class="section-title">Liabilities <button class="btn-add" data-open-form="liability">+ Add liability</button></div>
        <div class="card">
          ${state.liabilities.length ? `<div class="item-list">${state.liabilities.map((l) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(l.name)}<span class="tag">${escapeHtml(l.category || "Loan")}</span></div><div class="sub">Updated ${formatDate(l.updatedAt)}</div></div>
              <div class="amount">${formatINR(l.amount)}</div>
              <div class="row-actions"><button class="danger" data-del="liability" data-id="${l.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No liabilities recorded", "Loans and dues you owe will appear here.")}
        </div>
        <div id="form-liability"></div>

        <div class="section-title">Other Investments <button class="btn-add" data-open-form="investment">+ Add investment</button></div>
        <div class="card">
          ${generalInvest.length ? `<div class="item-list">${generalInvest.map(investRowWithActions).join("")}</div>` : emptyState("No general investments", "Stocks, mutual funds and more can be added here.")}
        </div>
        <div id="form-investment"></div>
      </div>`;
  }

  function investRowWithActions(inv) {
    return `<div class="item-row">
      <div class="meta">
        <div class="name">${escapeHtml(inv.name)} <span class="tag">${escapeHtml(inv.type)}</span></div>
        <div class="sub">${escapeHtml(inv.institution || "")}</div>
      </div>
      <div class="amount">${formatINR(inv.currentValue)}</div>
      <div class="row-actions"><button class="danger" data-del="investment" data-id="${inv.id}">Remove</button></div>
    </div>`;
  }

  /* ---------------- FIXED INCOME (bonds, FDs, RDs) ---------------- */
  function renderFixedIncome() {
    const items = state.investments.filter((i) => ["Bond", "FD", "RD"].includes(i.type));
    const total = items.reduce((s, i) => s + Number(i.currentValue || 0), 0);
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Bonds · FDs · RDs</div><h2>Fixed Income</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card"><div class="label">Fixed Income Value</div><div class="value">${formatINR(total)}</div><div class="sub">${items.length} instrument${items.length === 1 ? "" : "s"}</div></div>
        </div>
        <div class="section-title">Holdings <button class="btn-add" data-open-form="fixedincome">+ Add fixed income</button></div>
        <div class="card">
          ${items.length ? items.map(fixedIncomeCard).join("") : emptyState("No fixed-income holdings yet", "Add bonds, fixed deposits or recurring deposits.")}
        </div>
        <div id="form-fixedincome"></div>
      </div>`;
  }
  function fixedIncomeCard(inv) {
    return `<div class="card" style="margin-bottom:12px;">
      <div class="item-row" style="border:none; padding-bottom:6px;">
        <div class="meta">
          <div class="name">${escapeHtml(inv.name)} <span class="tag">${escapeHtml(inv.type)}</span></div>
          <div class="sub">${escapeHtml(inv.institution || "")}${inv.accountNumber ? " · " + escapeHtml(inv.accountNumber) : ""}</div>
        </div>
        <div class="amount">${formatINR(inv.currentValue)}</div>
        <div class="row-actions"><button class="danger" data-del="investment" data-id="${inv.id}">Remove</button></div>
      </div>
      <div class="grid grid-3" style="margin-top:8px;">
        <div class="sub">Principal<br><strong>${formatINR(inv.principal)}</strong></div>
        <div class="sub">Rate<br><strong>${inv.interestRate != null ? inv.interestRate + "%" : "—"}</strong></div>
        <div class="sub">Maturity<br><strong>${formatDate(inv.maturityDate)}</strong></div>
      </div>
    </div>`;
  }

  /* ---------------- RETIREMENT (PPF, EPF, NPS) ---------------- */
  function renderRetirement() {
    const items = state.investments.filter((i) => ["PPF", "EPF", "NPS"].includes(i.type));
    const total = items.reduce((s, i) => s + Number(i.currentValue || 0), 0);
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">PPF · EPF · NPS</div><h2>Retirement</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="grid grid-3">
          <div class="card stat-card"><div class="label">Retirement Corpus</div><div class="value">${formatINR(total)}</div><div class="sub">${items.length} account${items.length === 1 ? "" : "s"}</div></div>
        </div>
        <div class="section-title">Accounts <button class="btn-add" data-open-form="retirement">+ Add retirement account</button></div>
        ${items.length ? items.map(retirementCard).join("") : `<div class="card">${emptyState("No retirement accounts yet", "PPF, EPF and NPS accounts will appear here.")}</div>`}
        <div id="form-retirement"></div>
      </div>`;
  }
  function retirementCard(inv) {
    const contribs = (inv.contributions || []).slice().reverse().slice(0, 5);
    return `<div class="card" style="margin-bottom:14px;">
      <div class="item-row" style="border:none; padding-bottom:4px;">
        <div class="meta">
          <div class="name">${escapeHtml(inv.name)} <span class="tag gold">${escapeHtml(inv.type)}</span></div>
          <div class="sub">${escapeHtml(inv.holder || "")}${inv.accountNumber ? " · A/c " + escapeHtml(inv.accountNumber) : ""}</div>
        </div>
        <div class="amount">${formatINR(inv.currentValue)}</div>
        <div class="row-actions"><button class="danger" data-del="investment" data-id="${inv.id}">Remove</button></div>
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

  /* ---------------- TAX ---------------- */
  function renderTax() {
    const eightyC = state.investments.filter((i) => ["PPF", "EPF"].includes(i.type)).reduce((s, i) => s + Number(i.investedThisYear || 0), 0);
    const cap = 150000;
    const pct = Math.min(100, Math.round((eightyC / cap) * 100));
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Deductions</div><h2>Tax</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="card">
          <div class="form-title">Section 80C tracker (old regime)</div>
          <div class="sub" style="margin-bottom:10px;">Based on PPF / EPF contributions recorded this financial year.</div>
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
        <div class="page-head"><div><div class="eyebrow">Plan ahead</div><h2>Goals</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="section-title">Your goals <button class="btn-add" data-open-form="goal">+ Add goal</button></div>
        <div class="card">
          ${state.goals.length ? `<div class="item-list">${state.goals.map((g) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(g.name)}</div><div class="sub">Target ${formatDate(g.targetDate)}</div></div>
              <div class="amount">${formatINR(g.currentAmount)} / ${formatINR(g.targetAmount)}</div>
              <div class="row-actions"><button class="danger" data-del="goal" data-id="${g.id}">Remove</button></div>
            </div>`).join("")}</div>` : emptyState("No goals yet", "Retirement, a house, education — set a target and track it.")}
        </div>
        <div id="form-goal"></div>
      </div>`;
  }

  /* ---------------- FAMILY ---------------- */
  function renderFamily() {
    return `
      <div class="page">
        <div class="page-head"><div><div class="eyebrow">Household</div><h2>Family</h2></div></div>
        <div class="ledger-rule"></div>
        <div class="section-title">Family members <button class="btn-add" data-open-form="family">+ Add member</button></div>
        <div class="card">
          ${state.family.length ? `<div class="item-list">${state.family.map((f) => `
            <div class="item-row">
              <div class="meta"><div class="name">${escapeHtml(f.name)}<span class="tag">${escapeHtml(f.relation || "")}</span></div><div class="sub">${f.dob ? "DOB " + formatDate(f.dob) : ""}</div></div>
              <div class="row-actions"><button class="danger" data-del="family" data-id="${f.id}">Remove</button></div>
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
        <div class="page-head"><div><div class="eyebrow">Summary</div><h2>Reports</h2></div></div>
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
          <div class="form-title">Quick Add</div>
          <div class="sub">The ＋ Quick Add button in the header opens the assets, liabilities, investments, goals, family and income forms — the fastest way to log something without changing pages.</div>
        </div>
        <div class="section-title">Where things live</div>
        <div class="card">
          <div class="item-list">
            <div class="item-row"><div class="meta"><div class="name">Wealth</div><div class="sub">Assets, liabilities and general investments (stocks, mutual funds)</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Fixed Income</div><div class="sub">Bonds, fixed deposits and recurring deposits</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Retirement</div><div class="sub">PPF, EPF and NPS accounts with contribution history</div></div></div>
            <div class="item-row"><div class="meta"><div class="name">Tax</div><div class="sub">A simple Section 80C tracker based on your retirement contributions</div></div></div>
          </div>
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
        { key: "type", label: "Type", type: "select", options: ["Stock", "Mutual Fund", "ETF", "Gold", "Other"] },
        { key: "institution", label: "Institution / broker", type: "text" },
        { key: "currentValue", label: "Current value (₹)", type: "number", required: true }
      ],
      submit(data) { addInvestment(data); }
    },
    fixedincome: {
      title: "Add fixed income",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "type", label: "Type", type: "select", options: ["Bond", "FD", "RD"] },
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
        { key: "type", label: "Type", type: "select", options: ["PPF", "EPF", "NPS"] },
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

  function fieldHtml(f) {
    if (f.type === "select") {
      return `<select id="f_${f.key}" ${f.required ? "required" : ""}>
        <option value="">Select…</option>
        ${f.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
      </select>`;
    }
    return `<input id="f_${f.key}" type="${f.type}" ${f.type === "number" ? 'step="any"' : ""} placeholder="${escapeHtml(f.placeholder || "")}" ${f.required ? "required" : ""}>`;
  }

  function openInlineForm(key, containerSel) {
    const def = FORM_DEFS[key];
    if (!def) return;
    const container = $(containerSel || `#form-${key}`);
    if (!container) return;
    container.innerHTML = `
      <div class="card form-card">
        <div class="form-title">${escapeHtml(def.title)}</div>
        <form data-form-key="${key}">
          <div class="form-grid">
            ${def.fields.map((f) => `<div class="field"><label>${escapeHtml(f.label)}</label>${fieldHtml(f)}</div>`).join("")}
          </div>
          <div class="form-footer">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" class="btn-ghost" data-cancel-form>Cancel</button>
          </div>
        </form>
      </div>`;
    const form = $(`form[data-form-key="${key}"]`, container);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {};
      def.fields.forEach((f) => { data[f.key] = $(`#f_${f.key}`, form).value.trim(); });
      def.submit(data);
      saveState();
      container.innerHTML = "";
      render();
    });
    $("[data-cancel-form]", container).addEventListener("click", () => { container.innerHTML = ""; });
  }

  /* ---------------- page-level event wiring ---------------- */
  function wirePageEvents(page) {
    $$("[data-open-form]", $("#main")).forEach((btn) => {
      btn.addEventListener("click", () => openInlineForm(btn.dataset.openForm));
    });
    $$("[data-del]", $("#main")).forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.del, id = btn.dataset.id;
        const map = { asset: "assets", liability: "liabilities", investment: "investments", goal: "goals", family: "family", income: "income" };
        const arrName = map[kind];
        if (!arrName) return;
        if (!confirm("Remove this item?")) return;
        state[arrName] = state[arrName].filter((x) => x.id !== id);
        saveState();
        render();
      });
    });

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
        const pageForKind = { asset: "wealth", liability: "wealth", investment: "wealth", goal: "goals", family: "family", income: "wealth" };
        goToPage(pageForKind[kind] || "dashboard");
        setTimeout(() => openInlineForm(kind), 50);
      });
    });
  }

  /* ---------------- boot ---------------- */
  function wireStaticEvents() {
    $("#loginForm").addEventListener("submit", handleLocalLogin);
    $("#cloudLoginForm").addEventListener("submit", handleCloudSignIn);
    $("#cloudSignUpBtn").addEventListener("click", handleCloudSignUp);
    $("#lockBtn").addEventListener("click", handleLock);
    $$("#sidebar .nav").forEach((btn) => btn.addEventListener("click", () => goToPage(btn.dataset.page)));
    $("#menuBtn").addEventListener("click", () => $("#sidebar").scrollIntoView({ behavior: "smooth" }));
    wireQuickAdd();
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireStaticEvents();
    initLoginView();

    const session = getSession();
    if (session) {
      state = loadState() || seedState();
      enterApp();
    }
  });

  // expose for debugging / firebase-sync.js hooks
  window.RFM = { getState: () => state, setState: (s) => { state = s; render(); }, saveState, formatINR, formatDate };
})();
