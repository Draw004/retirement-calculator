(() => {
  'use strict';

  function plainClone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function isoDateOnly(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function displayDate(date, locale = 'en-IN') {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  function filename(slug, date = new Date()) {
    const safeSlug = String(slug || 'report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report';
    return `${safeSlug}-${isoDateOnly(date)}`;
  }

  function createReportModel(spec = {}) {
    const generated = spec.generatedAt instanceof Date ? spec.generatedAt : new Date(spec.generatedAt || Date.now());
    const locale = spec.locale || 'en-IN';
    const model = {
      schemaVersion: spec.schemaVersion || '1.0',
      toolId: spec.toolId || '',
      toolName: spec.toolName || '',
      generatedAt: generated.toISOString(),
      generatedDate: isoDateOnly(generated),
      generatedDisplay: displayDate(generated, locale),
      locale,
      country: spec.country || '',
      currency: spec.currency || '',
      methodology: plainClone(spec.methodology || {}),
      inputs: plainClone(spec.inputs || {}),
      calculatedResults: plainClone(spec.calculatedResults || {}),
      assumptions: plainClone(spec.assumptions || []),
      extras: plainClone(spec.extras || {})
    };
    return model;
  }

  window.CarrowmontReportEngine = {
    createReportModel,
    displayDate,
    filename,
    isoDateOnly
  };
})();
