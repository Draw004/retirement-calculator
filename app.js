(() => {
  const $ = (id) => document.getElementById(id);

  const defaults = {
    currentAge: 35,
    retirementAge: 60,
    monthlyExpense: 60000,
    inflationRate: 6,
    retirementYears: 25,
    postReturn: 8,
    preReturn: 10,
    currentSavings: 1000000,
    bufferRate: 10,
  };

  const ids = Object.keys(defaults);

  function n(id) {
    const value = Number($(id).value);
    return Number.isFinite(value) ? value : 0;
  }

  function formatINR(value, compact = false) {
    if (!Number.isFinite(value)) return '₹0';
    const safe = Math.max(0, value);
    if (compact) {
      if (safe >= 10000000) return `₹${(safe / 10000000).toFixed(safe >= 100000000 ? 0 : 2)} Cr`;
      if (safe >= 100000) return `₹${(safe / 100000).toFixed(safe >= 1000000 ? 1 : 2)} L`;
      if (safe >= 1000) return `₹${(safe / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(Math.round(safe));
  }

  function effectiveMonthlyRate(annualPercent) {
    const annual = annualPercent / 100;
    return Math.pow(1 + annual, 1 / 12) - 1;
  }

  function calculate() {
    const currentAge = n('currentAge');
    const retirementAge = n('retirementAge');
    const monthlyExpense = n('monthlyExpense');
    const inflation = n('inflationRate') / 100;
    const retirementYears = n('retirementYears');
    const postReturnPct = n('postReturn');
    const preReturnPct = n('preReturn');
    const currentSavings = n('currentSavings');
    const buffer = n('bufferRate') / 100;

    const msg = $('validationMsg');
    msg.textContent = '';

    if (retirementAge <= currentAge) {
      msg.textContent = 'Retirement age must be greater than current age.';
      return;
    }
    if (monthlyExpense <= 0 || retirementYears <= 0) {
      msg.textContent = 'Please enter positive monthly expenses and retirement years.';
      return;
    }
    if ([inflation, postReturnPct, preReturnPct, buffer].some(v => !Number.isFinite(v)) || inflation < 0 || postReturnPct < 0 || preReturnPct < 0 || buffer < 0) {
      msg.textContent = 'Rates cannot be negative.';
      return;
    }

    const yearsToRetire = retirementAge - currentAge;
    const monthsToRetire = yearsToRetire * 12;
    const retirementMonths = Math.round(retirementYears * 12);

    // Expense at retirement, expressed in first-month retirement rupees.
    const futureMonthlyExpense = monthlyExpense * Math.pow(1 + inflation, yearsToRetire);

    // Monthly growing-annuity-due model: first withdrawal occurs at retirement,
    // later withdrawals increase with inflation while the remaining corpus earns post-retirement return.
    const monthlyInflation = effectiveMonthlyRate(inflation * 100);
    const monthlyPostReturn = effectiveMonthlyRate(postReturnPct);
    const q = (1 + monthlyInflation) / (1 + monthlyPostReturn);

    let baseCorpus;
    if (Math.abs(q - 1) < 1e-10) {
      baseCorpus = futureMonthlyExpense * retirementMonths;
    } else {
      baseCorpus = futureMonthlyExpense * (1 - Math.pow(q, retirementMonths)) / (1 - q);
    }

    const requiredCorpus = baseCorpus * (1 + buffer);

    const preAnnual = preReturnPct / 100;
    const futureSavings = currentSavings * Math.pow(1 + preAnnual, yearsToRetire);
    const gap = Math.max(0, requiredCorpus - futureSavings);

    const monthlyPreReturn = effectiveMonthlyRate(preReturnPct);
    let monthlySip = 0;
    if (gap > 0 && monthsToRetire > 0) {
      if (Math.abs(monthlyPreReturn) < 1e-12) {
        monthlySip = gap / monthsToRetire;
      } else {
        monthlySip = gap * monthlyPreReturn / (Math.pow(1 + monthlyPreReturn, monthsToRetire) - 1);
      }
    }

    const funded = requiredCorpus > 0 ? Math.min(100, (futureSavings / requiredCorpus) * 100) : 100;

    $('yearsToRetire').textContent = yearsToRetire.toFixed(0);
    $('futureMonthlyExpense').textContent = formatINR(futureMonthlyExpense, true);
    $('requiredCorpus').textContent = formatINR(requiredCorpus, true);
    $('futureSavings').textContent = formatINR(futureSavings, true);
    $('corpusGap').textContent = formatINR(gap, true);
    $('monthlySip').textContent = gap <= 0 ? 'Already funded*' : formatINR(monthlySip);
    $('fundedPercent').textContent = `${funded.toFixed(0)}% funded`;
    $('progressFill').style.width = `${funded}%`;

    window.retirementResult = {
      yearsToRetire, futureMonthlyExpense, requiredCorpus, futureSavings, gap, monthlySip,
      assumptions: { inflation: inflation * 100, postReturnPct, preReturnPct, retirementYears, buffer: buffer * 100 }
    };
  }

  function syncRange(numberId, rangeId) {
    const number = $(numberId);
    const range = $(rangeId);
    number.addEventListener('input', () => {
      range.value = Math.min(Number(range.max), Math.max(Number(range.min), Number(number.value) || Number(range.min)));
      calculate();
    });
    range.addEventListener('input', () => {
      number.value = range.value;
      calculate();
    });
  }

  syncRange('currentAge', 'currentAgeRange');
  syncRange('retirementAge', 'retirementAgeRange');
  syncRange('monthlyExpense', 'monthlyExpenseRange');

  ids.filter(id => !['currentAge', 'retirementAge', 'monthlyExpense'].includes(id)).forEach(id => {
    $(id).addEventListener('input', calculate);
    $(id).addEventListener('change', calculate);
  });

  $('resetBtn').addEventListener('click', () => {
    ids.forEach(id => { $(id).value = defaults[id]; });
    $('currentAgeRange').value = defaults.currentAge;
    $('retirementAgeRange').value = defaults.retirementAge;
    $('monthlyExpenseRange').value = defaults.monthlyExpense;
    $('copyStatus').textContent = '';
    calculate();
  });

  $('copyBtn').addEventListener('click', async () => {
    const r = window.retirementResult;
    if (!r) return;
    const text = `Retirement estimate: ${r.yearsToRetire} years to retirement. Estimated monthly expense at retirement: ${formatINR(r.futureMonthlyExpense)}. Target corpus: ${formatINR(r.requiredCorpus)}. Projected existing savings: ${formatINR(r.futureSavings)}. Additional corpus needed: ${formatINR(r.gap)}. Estimated monthly investment: ${r.gap <= 0 ? 'already funded based on assumptions' : formatINR(r.monthlySip)}. Assumptions: ${r.assumptions.inflation}% inflation, ${r.assumptions.postReturnPct}% post-retirement return, ${r.assumptions.preReturnPct}% pre-retirement return, ${r.assumptions.retirementYears} retirement years.`;
    try {
      await navigator.clipboard.writeText(text);
      $('copyStatus').textContent = 'Result copied.';
    } catch (_) {
      $('copyStatus').textContent = 'Copy unavailable in this browser.';
    }
  });

  $('year').textContent = new Date().getFullYear();
  calculate();
})();
