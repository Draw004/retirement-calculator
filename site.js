(() => {
  document.querySelectorAll('[data-current-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  // Optional Google Analytics loader. It does nothing while the ID is blank.
  const id = window.RETIREWISE_CONFIG && window.RETIREWISE_CONFIG.GA_MEASUREMENT_ID;
  if (id && /^G-[A-Z0-9]+$/i.test(id)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
  }
})();
