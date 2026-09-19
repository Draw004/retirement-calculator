(function () {
  "use strict";
  const L = window.CarrowmontLocale;
  if (!L) return;

  function $(id) { return document.getElementById(id); }

  function populate(menuRoot) {
    const regionSelect = menuRoot.querySelector('#regionSelect');
    const currencySelect = menuRoot.querySelector('#currencySelect');
    if (regionSelect && !regionSelect.options.length) {
      regionSelect.innerHTML = Object.entries(L.regions)
        .map(([code, p]) => `<option value="${code}">${p.label}</option>`).join('');
    }
    if (currencySelect && !currencySelect.options.length) {
      currencySelect.innerHTML = Object.entries(L.currencies)
        .map(([code, c]) => `<option value="${code}">${code} — ${c.label}</option>`).join('');
    }
  }

  function sync() {
    const profile = L.getProfile();
    const currency = L.getCurrency();
    document.querySelectorAll('#localeSummary').forEach(el => { el.textContent = `${profile.label} · ${currency}`; });
    document.querySelectorAll('#regionSelect').forEach(el => { el.value = L.getRegion(); });
    document.querySelectorAll('#currencySelect').forEach(el => { el.value = currency; });
    document.querySelectorAll('[data-currency-prefix]').forEach(el => { el.textContent = L.currencySymbol(currency); });
    document.querySelectorAll('[data-currency-code]').forEach(el => { el.textContent = currency; });
    document.querySelectorAll('[data-region-label]').forEach(el => { el.textContent = profile.label; });
    document.querySelectorAll('[data-locale-money]').forEach(el => {
      const n = Number(el.getAttribute('data-locale-money')) || 0;
      const compact = el.hasAttribute('data-compact');
      const suffix = el.getAttribute('data-suffix') || '';
      el.textContent = `${compact ? L.formatCompactMoney(n) : L.formatMoney(n)}${suffix}`;
    });
  }

  function closeMenu(menu, discardPending = false) {
    if (!menu) return;
    if (discardPending && typeof menu._resetPending === 'function') menu._resetPending();
    menu.open = false;
  }

  function initMenu(menu) {
    populate(menu);
    const regionSelect = menu.querySelector('#regionSelect');
    const currencySelect = menu.querySelector('#currencySelect');
    const doneBtn = menu.querySelector('#localeDoneBtn');
    let pendingRegion = L.getRegion();
    let pendingCurrency = L.getCurrency();

    function resetPending() {
      pendingRegion = L.getRegion();
      pendingCurrency = L.getCurrency();
      if (regionSelect) regionSelect.value = pendingRegion;
      if (currencySelect) currencySelect.value = pendingCurrency;
    }
    menu._resetPending = resetPending;

    if (regionSelect) regionSelect.addEventListener('change', e => {
      pendingRegion = e.target.value;
      const profile = L.regions[pendingRegion];
      if (profile && L.currencies[profile.currency]) {
        pendingCurrency = profile.currency;
        if (currencySelect) currencySelect.value = pendingCurrency;
      }
    });
    if (currencySelect) currencySelect.addEventListener('change', e => {
      pendingCurrency = e.target.value;
    });
    if (doneBtn) doneBtn.addEventListener('click', () => {
      if (typeof L.setLocale === 'function') L.setLocale(pendingRegion, pendingCurrency);
      else {
        L.setRegion(pendingRegion, { syncCurrency: false });
        L.setCurrency(pendingCurrency);
      }
      closeMenu(menu, false);
    });
    menu.addEventListener('toggle', () => {
      if (menu.open) resetPending();
    });
  }

  document.querySelectorAll('.locale-menu').forEach(initMenu);
  document.addEventListener('pointerdown', (event) => {
    document.querySelectorAll('.locale-menu[open]').forEach(menu => {
      if (!menu.contains(event.target)) closeMenu(menu, true);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.locale-menu[open]').forEach(menu => {
      closeMenu(menu, true);
      menu.querySelector('summary')?.focus();
    });
  });
  window.addEventListener('carrowmont:localechange', () => {
    sync();
    document.querySelectorAll('.locale-menu:not([open])').forEach(menu => menu._resetPending?.());
  });
  window.CarrowmontLocaleUI = { sync };
  sync();
})();
