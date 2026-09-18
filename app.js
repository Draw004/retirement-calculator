(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const STORAGE_KEY = 'retirewise-v2-plan';

  const DEFAULTS = {
    mode: 'quick',
    currentAge: 35,
    retirementAge: 60,
    planningAge: 90,
    currentSavings: 1000000,
    currentMonthlyInvestment: 20000,
    preReturn: 10,
    postReturn: 7.5,
    bufferRate: 10,
    quickMonthlyExpense: 90000,
    quickRetirementPct: 65,
    quickInflation: 5,
    generalInflation: 5,
    healthInflation: 7,
    lifestyleInflation: 5,
    educationInflation: 7,
    phase1Pct: 110,
    phase2Pct: 90,
    phase3Pct: 70,
  };

  const DEFAULT_EXPENSES = [
    { name: 'Groceries & household', amount: 18000, inflationType: 'general', rule: 'adjust', setting: 100 },
    { name: 'Utilities & communication', amount: 6000, inflationType: 'general', rule: 'adjust', setting: 90 },
    { name: 'Home loan / rent', amount: 20000, inflationType: 'general', rule: 'end', setting: 55 },
    { name: 'School / tuition', amount: 18000, inflationType: 'education', rule: 'end', setting: 50 },
    { name: 'Transport / commuting', amount: 8000, inflationType: 'general', rule: 'adjust', setting: 50 },
    { name: 'Travel & leisure', amount: 7000, inflationType: 'lifestyle', rule: 'adjust', setting: 100 },
    { name: 'Healthcare', amount: 5000, inflationType: 'health', rule: 'adjust', setting: 160 },
    { name: 'Domestic help', amount: 3000, inflationType: 'general', rule: 'adjust', setting: 150 },
    { name: 'Other essentials', amount: 5000, inflationType: 'general', rule: 'adjust', setting: 100 },
  ];

  const DEFAULT_INCOMES = [
    { name: 'Pension / annuity', amount: 0, startAge: 60, growth: 0 },
    { name: 'Rental income', amount: 0, startAge: 60, growth: 3 },
  ];

  const DEFAULT_GOALS = [];
  let mode = DEFAULTS.mode;
  let lastResult = null;
  let suppressCalculate = false;

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function value(id, fallback = 0) {
    return num($(id)?.value, fallback);
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function formatINR(value, compact = false) {
    if (!Number.isFinite(value)) return '₹0';
    const sign = value < 0 ? '-' : '';
    const safe = Math.abs(value);
    if (compact) {
      if (safe >= 10000000) {
        const cr = safe / 10000000;
        return `${sign}₹${cr.toFixed(cr >= 100 ? 0 : cr >= 10 ? 1 : 2)} Cr`;
      }
      if (safe >= 100000) {
        const l = safe / 100000;
        return `${sign}₹${l.toFixed(l >= 100 ? 0 : l >= 10 ? 1 : 2)} L`;
      }
      if (safe >= 1000) return `${sign}₹${(safe / 1000).toFixed(safe >= 100000 ? 0 : 1)}k`;
    }
    return sign + new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(safe));
  }

  function effectiveMonthlyRate(annualPct) {
    return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  }

  function inflationOptions(selected) {
    return [
      ['general', 'General'], ['health', 'Healthcare'], ['lifestyle', 'Lifestyle'], ['education', 'Education']
    ].map(([v,l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('');
  }

  function expenseRuleOptions(selected) {
    return [
      ['adjust', 'Continue / adjust'], ['end', 'Ends at age'], ['start', 'Starts at retirement']
    ].map(([v,l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('');
  }

  function addExpenseRow(data = {}) {
    const tr = document.createElement('tr');
    tr.className = 'expense-row';
    const d = { name: 'New expense', amount: 0, inflationType: 'general', rule: 'adjust', setting: 100, ...data };
    tr.innerHTML = `
      <td><input class="table-input name exp-name" value="${escapeAttr(d.name)}" aria-label="Expense name"></td>
      <td><input class="table-input amount exp-amount" type="number" min="0" step="500" value="${num(d.amount)}" aria-label="Monthly amount"></td>
      <td><select class="table-select exp-inflation" aria-label="Inflation type">${inflationOptions(d.inflationType)}</select></td>
      <td><select class="table-select exp-rule" aria-label="Retirement rule">${expenseRuleOptions(d.rule)}</select></td>
      <td class="table-setting-cell"></td>
      <td><button class="remove-row" type="button" aria-label="Remove expense">×</button></td>`;
    $('expenseRows').appendChild(tr);
    renderExpenseSetting(tr, d.setting);
  }

  function renderExpenseSetting(tr, settingValue) {
    const rule = tr.querySelector('.exp-rule').value;
    const cell = tr.querySelector('.table-setting-cell');
    if (rule === 'end') {
      cell.innerHTML = `<div class="number-wrap suffix table-setting"><input class="exp-setting" type="number" min="18" max="110" value="${num(settingValue, 55)}" aria-label="Expense ends at age"><span>age</span></div>`;
    } else {
      const defaultPct = rule === 'start' ? 100 : 100;
      cell.innerHTML = `<div class="number-wrap suffix table-setting"><input class="exp-setting" type="number" min="0" max="500" value="${num(settingValue, defaultPct)}" aria-label="Percent at retirement"><span>%</span></div>`;
    }
  }

  function addIncomeRow(data = {}) {
    const d = { name: 'Other income', amount: 0, startAge: value('retirementAge', 60), growth: 0, ...data };
    const tr = document.createElement('tr');
    tr.className = 'income-row';
    tr.innerHTML = `
      <td><input class="table-input name inc-name" value="${escapeAttr(d.name)}" aria-label="Income source"></td>
      <td><input class="table-input amount inc-amount" type="number" min="0" step="500" value="${num(d.amount)}" aria-label="Monthly income"></td>
      <td><input class="table-input inc-start" type="number" min="18" max="110" value="${num(d.startAge, 60)}" aria-label="Income start age"></td>
      <td><div class="number-wrap suffix table-setting"><input class="inc-growth" type="number" min="-10" max="20" step="0.1" value="${num(d.growth)}" aria-label="Annual income increase"><span>%</span></div></td>
      <td><button class="remove-row" type="button" aria-label="Remove income">×</button></td>`;
    $('incomeRows').appendChild(tr);
  }

  function addGoalRow(data = {}) {
    const d = { name: 'Future goal', amount: 0, age: value('retirementAge', 60) + 5, inflationType: 'general', ...data };
    const tr = document.createElement('tr');
    tr.className = 'goal-row';
    tr.innerHTML = `
      <td><input class="table-input name goal-name" value="${escapeAttr(d.name)}" aria-label="Goal name"></td>
      <td><input class="table-input amount goal-amount" type="number" min="0" step="10000" value="${num(d.amount)}" aria-label="Goal amount"></td>
      <td><input class="table-input goal-age" type="number" min="18" max="110" value="${num(d.age)}" aria-label="Goal age"></td>
      <td><select class="table-select goal-inflation" aria-label="Goal inflation">${inflationOptions(d.inflationType)}</select></td>
      <td><button class="remove-row" type="button" aria-label="Remove goal">×</button></td>`;
    $('goalRows').appendChild(tr);
  }

  function escapeAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function readExpenses() {
    return qsa('.expense-row', $('expenseRows')).map(tr => ({
      name: tr.querySelector('.exp-name').value.trim() || 'Expense',
      amount: num(tr.querySelector('.exp-amount').value),
      inflationType: tr.querySelector('.exp-inflation').value,
      rule: tr.querySelector('.exp-rule').value,
      setting: num(tr.querySelector('.exp-setting')?.value, 100),
    }));
  }

  function readIncomes() {
    return qsa('.income-row', $('incomeRows')).map(tr => ({
      name: tr.querySelector('.inc-name').value.trim() || 'Income',
      amount: num(tr.querySelector('.inc-amount').value),
      startAge: num(tr.querySelector('.inc-start').value),
      growth: num(tr.querySelector('.inc-growth').value),
    }));
  }

  function readGoals() {
    return qsa('.goal-row', $('goalRows')).map(tr => ({
      name: tr.querySelector('.goal-name').value.trim() || 'Goal',
      amount: num(tr.querySelector('.goal-amount').value),
      age: num(tr.querySelector('.goal-age').value),
      inflationType: tr.querySelector('.goal-inflation').value,
    }));
  }

  function buildState(overrides = {}) {
    const s = {
      mode,
      currentAge: value('currentAge'), retirementAge: value('retirementAge'), planningAge: value('planningAge'),
      currentSavings: value('currentSavings'), currentMonthlyInvestment: value('currentMonthlyInvestment'),
      preReturn: value('preReturn'), postReturn: value('postReturn'), bufferRate: value('bufferRate'),
      quickMonthlyExpense: value('quickMonthlyExpense'), quickRetirementPct: value('quickRetirementPct'), quickInflation: value('quickInflation'),
      generalInflation: value('generalInflation'), healthInflation: value('healthInflation'), lifestyleInflation: value('lifestyleInflation'), educationInflation: value('educationInflation'),
      phase1Pct: value('phase1Pct'), phase2Pct: value('phase2Pct'), phase3Pct: value('phase3Pct'),
      expenses: readExpenses(), incomes: readIncomes(), goals: readGoals(),
    };
    return { ...s, ...overrides };
  }

  function inflationPct(type, s) {
    if (s.mode === 'quick') return s.quickInflation;
    if (type === 'health') return s.healthInflation;
    if (type === 'lifestyle') return s.lifestyleInflation;
    if (type === 'education') return s.educationInflation;
    return s.generalInflation;
  }

  function lifestylePhaseMultiplier(age, s) {
    if (age < s.retirementAge) return 1;
    const y = age - s.retirementAge;
    if (y < 10) return s.phase1Pct / 100;
    if (y < 20) return s.phase2Pct / 100;
    return s.phase3Pct / 100;
  }

  function detailedExpenseAtAge(exp, age, s, nominal = true) {
    if (exp.amount <= 0) return 0;
    let factor = 1;
    if (age < s.retirementAge) {
      if (exp.rule === 'start') return 0;
      if (exp.rule === 'end' && age >= exp.setting) return 0;
    } else {
      if (exp.rule === 'end') {
        if (age >= exp.setting) return 0;
      } else {
        factor = exp.setting / 100;
      }
      if (exp.inflationType === 'lifestyle') factor *= lifestylePhaseMultiplier(age, s);
    }
    const inflation = inflationPct(exp.inflationType, s) / 100;
    const years = Math.max(0, age - s.currentAge);
    const inflationFactor = nominal ? Math.pow(1 + inflation, years) : 1;
    return exp.amount * factor * inflationFactor;
  }

  function expenseAtAge(age, s, nominal = true) {
    if (s.mode === 'quick') {
      const inflation = s.quickInflation / 100;
      const inflated = s.quickMonthlyExpense * (nominal ? Math.pow(1 + inflation, Math.max(0, age - s.currentAge)) : 1);
      return age < s.retirementAge ? inflated : inflated * s.quickRetirementPct / 100;
    }
    return s.expenses.reduce((sum, exp) => sum + detailedExpenseAtAge(exp, age, s, nominal), 0);
  }

  function incomeAtAge(age, s) {
    if (s.mode === 'quick') return 0;
    return s.incomes.reduce((sum, inc) => {
      if (inc.amount <= 0 || age + 1e-9 < inc.startAge) return sum;
      const years = Math.max(0, age - inc.startAge);
      return sum + inc.amount * Math.pow(1 + inc.growth / 100, years);
    }, 0);
  }

  function goalFutureAmount(goal, s) {
    const inflation = inflationPct(goal.inflationType, s) / 100;
    return goal.amount * Math.pow(1 + inflation, Math.max(0, goal.age - s.currentAge));
  }

  function validateState(s) {
    const errors = [];
    if (s.currentAge < 18) errors.push('Current age must be at least 18.');
    if (s.retirementAge <= s.currentAge) errors.push('Retirement age must be greater than current age.');
    if (s.planningAge <= s.retirementAge) errors.push('Plan-until age must be greater than retirement age.');
    if (s.planningAge > 110) errors.push('Plan-until age cannot exceed 110 in this calculator.');
    if (s.preReturn < 0 || s.postReturn < 0 || s.bufferRate < 0) errors.push('Return and buffer assumptions cannot be negative.');
    if (s.mode === 'quick' && s.quickMonthlyExpense <= 0) errors.push('Enter a positive monthly household expense.');
    if (s.mode === 'detailed' && s.expenses.every(e => e.amount <= 0)) errors.push('Add at least one expense with a positive amount.');
    return errors;
  }

  function calculatePlan(s) {
    const errors = validateState(s);
    if (errors.length) return { errors };

    const monthsToRetire = Math.round((s.retirementAge - s.currentAge) * 12);
    const retirementMonths = Math.round((s.planningAge - s.retirementAge) * 12);
    const monthlyPost = effectiveMonthlyRate(s.postReturn);
    const monthlyPre = effectiveMonthlyRate(s.preReturn);

    const goalByMonth = new Map();
    if (s.mode === 'detailed') {
      for (const goal of s.goals) {
        if (goal.amount <= 0 || goal.age < s.retirementAge || goal.age > s.planningAge) continue;
        const m = clamp(Math.round((goal.age - s.retirementAge) * 12), 0, Math.max(0, retirementMonths - 1));
        goalByMonth.set(m, (goalByMonth.get(m) || 0) + goalFutureAmount(goal, s));
      }
    }

    let recurringExpensePV = 0;
    let retirementIncomePV = 0;
    let goalsPV = 0;
    let firstYearExpenseTotal = 0;
    let firstYearIncomeTotal = 0;
    const monthlyFlows = [];

    for (let m = 0; m < retirementMonths; m++) {
      const age = s.retirementAge + m / 12;
      const expense = expenseAtAge(age, s, true);
      const income = incomeAtAge(age, s);
      const goal = goalByMonth.get(m) || 0;
      const net = expense - income;
      const discount = Math.pow(1 + monthlyPost, m);
      recurringExpensePV += expense / discount;
      retirementIncomePV += income / discount;
      goalsPV += goal / discount;
      monthlyFlows.push({ m, age, expense, income, net, goal });
      if (m < 12) { firstYearExpenseTotal += expense; firstYearIncomeTotal += income; }
    }

    const baseCorpusPV = Math.max(0, recurringExpensePV - retirementIncomePV + goalsPV);
    const safetyBufferAmount = baseCorpusPV * s.bufferRate / 100;
    const requiredCorpus = baseCorpusPV + safetyBufferAmount;

    const futureExisting = s.currentSavings * Math.pow(1 + s.preReturn / 100, s.retirementAge - s.currentAge);
    let fvFactor = monthsToRetire;
    if (monthsToRetire > 0 && Math.abs(monthlyPre) > 1e-12) fvFactor = (Math.pow(1 + monthlyPre, monthsToRetire) - 1) / monthlyPre;
    const futureCurrentContrib = s.currentMonthlyInvestment * Math.max(0, fvFactor);
    const projectedCorpus = futureExisting + futureCurrentContrib;
    const gap = Math.max(0, requiredCorpus - projectedCorpus);

    const gapBeforeContrib = Math.max(0, requiredCorpus - futureExisting);
    const totalMonthlyNeeded = monthsToRetire > 0 && fvFactor > 0 ? gapBeforeContrib / fvFactor : 0;
    const extraMonthlyNeeded = Math.max(0, totalMonthlyNeeded - s.currentMonthlyInvestment);
    const fundedPct = requiredCorpus > 0 ? (projectedCorpus / requiredCorpus) * 100 : 100;

    const firstYearExpense = firstYearExpenseTotal / Math.max(1, Math.min(12, retirementMonths));
    const firstYearIncome = firstYearIncomeTotal / Math.max(1, Math.min(12, retirementMonths));
    const firstYearNet = Math.max(0, firstYearExpense - firstYearIncome);

    const currentTodayExpense = expenseAtAge(s.currentAge, s, false);
    const retirementLifestyleToday = expenseAtAge(s.retirementAge, s, false);
    // Same retirement lifestyle expressed in nominal future rupees at the selected retirement age.
    const retirementLifestyleFuture = expenseAtAge(s.retirementAge, s, true);

    // Keep every entered expense with a positive amount, in the same order as the planner.
    // This makes the retirement breakdown a complete audit trail rather than a filtered "changes only" list.
    const expenseChanges = s.mode === 'detailed' ? s.expenses.map(exp => {
      const today = detailedExpenseAtAge(exp, s.currentAge, s, false);
      const retirement = detailedExpenseAtAge(exp, s.retirementAge, s, false);
      const retirementFuture = detailedExpenseAtAge(exp, s.retirementAge, s, true);
      return {
        name: exp.name, amount: exp.amount, today, retirement, retirementFuture,
        change: retirement - today, rule: exp.rule, setting: exp.setting, inflationType: exp.inflationType
      };
    }).filter(x => x.amount > 0) : [];
    const monthlyReduced = s.mode === 'quick'
      ? Math.max(0, currentTodayExpense - retirementLifestyleToday)
      : expenseChanges.reduce((sum, x) => sum + Math.max(0, x.today - x.retirement), 0);
    const monthlyIncreased = s.mode === 'quick'
      ? Math.max(0, retirementLifestyleToday - currentTodayExpense)
      : expenseChanges.reduce((sum, x) => sum + Math.max(0, x.retirement - x.today), 0);

    // Simulate the portfolio path from the buffered required corpus.
    let balance = requiredCorpus;
    const portfolioPoints = [{ age: s.retirementAge, value: balance }];
    for (const flow of monthlyFlows) {
      balance -= flow.net;
      balance -= flow.goal;
      balance *= (1 + monthlyPost);
      if ((flow.m + 1) % 12 === 0 || flow.m === monthlyFlows.length - 1) {
        portfolioPoints.push({ age: Math.min(s.planningAge, s.retirementAge + (flow.m + 1) / 12), value: balance });
      }
    }

    const expensePoints = [];
    const spanYears = s.planningAge - s.currentAge;
    const step = spanYears > 55 ? 2 : 1;
    for (let age = s.currentAge; age <= s.planningAge + 1e-9; age += step) {
      expensePoints.push({ age, value: expenseAtAge(age, s, true) });
    }
    if (!expensePoints.some(p => Math.abs(p.age - s.retirementAge) < .001)) expensePoints.push({ age: s.retirementAge, value: expenseAtAge(s.retirementAge, s, true) });
    expensePoints.sort((a,b) => a.age - b.age);

    return {
      errors: [], s, requiredCorpus, baseCorpusPV, recurringExpensePV, retirementIncomePV, goalsPV, safetyBufferAmount,
      futureExisting, futureCurrentContrib, projectedCorpus, gap, totalMonthlyNeeded, extraMonthlyNeeded, fundedPct,
      firstYearExpense, firstYearIncome, firstYearNet, currentTodayExpense, retirementLifestyleToday, retirementLifestyleFuture, monthlyReduced, monthlyIncreased,
      expenseChanges, portfolioPoints, expensePoints, monthlyFlows,
    };
  }

  function setMode(newMode, recalc = true) {
    mode = newMode === 'detailed' ? 'detailed' : 'quick';
    $('quickPanel').classList.toggle('hidden', mode !== 'quick');
    $('detailedPanel').classList.toggle('hidden', mode !== 'detailed');
    $('quickModeBtn').classList.toggle('active', mode === 'quick');
    $('detailedModeBtn').classList.toggle('active', mode === 'detailed');
    $('modeHelp').textContent = mode === 'quick'
      ? "Fast estimate: one retirement-spending percentage and one inflation rate are applied to your household total."
      : 'Detailed planning: each expense can use its own inflation category, retirement rule and lifestyle phase, so the corpus may differ from Quick estimate.';
    if (recalc) calculateAndRender();
  }

  function calculateAndRender() {
    if (suppressCalculate) return;
    const s = buildState();
    const result = calculatePlan(s);
    const msg = $('validationMsg');
    msg.textContent = result.errors?.join(' ') || '';
    if (result.errors?.length) return;
    lastResult = result;
    renderResult(result);
  }

  function fundingStatusText(fundedPct) {
    if (fundedPct >= 110) return ['Above target under assumptions', 'Your projected retirement assets exceed the modelled target by at least 10% under the assumptions entered.'];
    if (fundedPct >= 100) return ['Target funded under assumptions', 'Your projected retirement assets meet or exceed the modelled target under the assumptions entered.'];
    if (fundedPct >= 75) return ['Most of the target is funded', 'Your projected retirement assets cover at least three quarters of the modelled target.'];
    if (fundedPct >= 50) return ['Partly funded', 'Your current savings plan covers roughly half to three quarters of the modelled target.'];
    return ['Funding gap to address', 'Your projected retirement assets cover less than half of the modelled target under these assumptions.'];
  }

  function expenseRuleSummary(exp, s) {
    const retirementAge = Math.round(s.retirementAge);
    const setting = num(exp.setting, 100);
    let summary;

    if (exp.rule === 'end') {
      const endAge = Math.round(setting);
      summary = endAge <= retirementAge
        ? `Ends at age ${endAge} · not included at retirement`
        : `Continues at retirement · ends at age ${endAge}`;
    } else if (exp.rule === 'start') {
      summary = `Starts at retirement at ${setting.toFixed(0)}% of today's amount`;
    } else if (Math.abs(setting - 100) < 0.5) {
      summary = `Continues at 100% of today's amount`;
    } else if (setting < 100) {
      summary = `Reduced to ${setting.toFixed(0)}% at retirement`;
    } else {
      summary = `Increases to ${setting.toFixed(0)}% at retirement`;
    }

    if (exp.inflationType === 'lifestyle' && !(exp.rule === 'end' && setting <= retirementAge)) {
      summary += ` · lifestyle phase ${s.phase1Pct.toFixed(0)}% in the first 10 years`;
    }
    return summary;
  }

  function renderExpenseChanges(r) {
    const list = $('expenseChangeList');
    const retirementAge = Math.round(r.s.retirementAge);
    const headingAge = $('expenseChangeRetirementAge');
    if (headingAge) headingAge.textContent = `all listed expenses · retirement age ${retirementAge} · future ₹`;

    if (r.s.mode !== 'detailed') {
      const pct = r.currentTodayExpense > 0 ? (r.retirementLifestyleToday / r.currentTodayExpense) * 100 : 0;
      list.innerHTML = `<div class="change-summary-only">
        <strong>${pct.toFixed(0)}%</strong>
        <span>of today's spending is set to remain at retirement in Quick mode.</span>
        <div class="change-quick-values">
          <div><span>Retirement lifestyle<br>in today's ₹</span><b>${formatINR(r.retirementLifestyleToday, true)}/mo</b></div>
          <div><span>Projected at retirement (age ${retirementAge})<br>in future ₹</span><b>${formatINR(r.retirementLifestyleFuture, true)}/mo</b></div>
        </div>
        <small>Quick mode uses one spending percentage and one inflation rate. Switch to Detailed planner for the full expense-by-expense breakdown.</small>
      </div>`;
      return;
    }

    if (!r.expenseChanges.length) {
      list.innerHTML = '<div class="change-summary-only"><strong>No expenses entered</strong><span>Add an expense with a positive monthly amount to build the detailed retirement breakdown.</span></div>';
      return;
    }

    list.innerHTML = r.expenseChanges.map(x => {
      const cls = x.change > 0 ? 'up' : x.change < 0 ? 'down' : '';
      const label = Math.abs(x.change) < 1 ? 'No lifestyle change' : x.change > 0 ? `+${formatINR(x.change)}` : `−${formatINR(Math.abs(x.change))}`;
      const ruleSummary = expenseRuleSummary(x, r.s);
      return `<div class="expense-change-row">
        <div class="expense-change-context">
          <strong>${escapeXml(x.name)}</strong>
          <span>Current today: ${formatINR(x.today)}/mo <em class="${cls}">${label}</em></span>
          <small class="expense-change-rule">${escapeXml(ruleSummary)}</small>
        </div>
        <div class="expense-change-values">
          <div><span>Retirement lifestyle<br>in today's ₹</span><b>${formatINR(x.retirement)}/mo</b></div>
          <div><span>Projected at retirement (age ${retirementAge})<br>in future ₹</span><b>${formatINR(x.retirementFuture)}/mo</b></div>
        </div>
      </div>`;
    }).join('');
  }

  function renderResult(r) {
    const s = r.s;
    $('yearsToRetire').textContent = (s.retirementAge - s.currentAge).toFixed(0);
    $('resultPlanningAge').textContent = s.planningAge.toFixed(0);
    $('requiredCorpus').textContent = formatINR(r.requiredCorpus, true);
    $('firstYearExpense').textContent = formatINR(r.firstYearExpense, true);
    const futureSpendLabel = $('futureSpendLabel');
    if (futureSpendLabel) futureSpendLabel.textContent = `Projected monthly spending at retirement (age ${Math.round(s.retirementAge)}, future ₹)`;
    const retirementProjectedSpend = $('retirementProjectedSpend');
    if (retirementProjectedSpend) retirementProjectedSpend.textContent = `${formatINR(r.retirementLifestyleFuture, true)}/mo`;
    $('firstYearIncome').textContent = r.firstYearIncome > 0 ? formatINR(r.firstYearIncome, true) : 'None entered';
    $('firstYearNet').textContent = `${formatINR(r.firstYearNet, true)}/mo`;
    $('projectedCorpus').textContent = formatINR(r.projectedCorpus, true);
    $('corpusGap').textContent = r.gap > 0 ? formatINR(r.gap, true) : 'No gap*';
    $('totalMonthlyNeeded').textContent = formatINR(r.totalMonthlyNeeded);
    $('extraMonthlyNeeded').textContent = r.extraMonthlyNeeded > 1 ? formatINR(r.extraMonthlyNeeded) : '₹0 under assumptions';

    const fundedDisplay = Math.min(999, Math.max(0, r.fundedPct));
    $('fundedPercent').textContent = `${fundedDisplay.toFixed(0)}%`;
    $('progressFill').style.width = `${Math.min(100, fundedDisplay)}%`;
    $('fundingMessage').textContent = r.fundedPct >= 100
      ? 'Your entered savings and current monthly investment meet or exceed the modelled target under these assumptions.'
      : `The current plan is projected to fund about ${Math.max(0, r.fundedPct).toFixed(0)}% of the modelled target.`;

    const [status, statusNote] = fundingStatusText(r.fundedPct);
    $('fundingStatus').textContent = status;
    $('fundingStatusNote').textContent = statusNote;

    $('todayVsRetirement').textContent = `${formatINR(r.currentTodayExpense, true)}/mo → ${formatINR(r.retirementLifestyleToday, true)}/mo`;
    $('todayVsFutureRetirement').textContent = `${formatINR(r.retirementLifestyleToday, true)}/mo → ${formatINR(r.retirementLifestyleFuture, true)}/mo`;
    $('todayVsFutureLabel').textContent = `Same retirement lifestyle: today's ₹ → at retirement (age ${Math.round(s.retirementAge)}) in future ₹`;
    $('todayVsRetirementNote').textContent = s.mode === 'quick'
      ? "Today's spending versus your selected retirement-spending percentage, both shown in today's purchasing power."
      : "Today's listed spending versus the first retirement-year lifestyle, before future inflation is applied.";
    const lifestyleDeltaPct = r.currentTodayExpense > 0 ? ((r.retirementLifestyleToday - r.currentTodayExpense) / r.currentTodayExpense) * 100 : 0;
    const narrative = $('budgetNarrative');
    if (narrative) {
      if (Math.abs(lifestyleDeltaPct) < 1) narrative.textContent = "Your retirement lifestyle is currently set to be about the same as today's spending, before future inflation.";
      else if (lifestyleDeltaPct < 0) narrative.textContent = `Based on these inputs, the retirement lifestyle is ${Math.abs(lifestyleDeltaPct).toFixed(0)}% lower than today's listed spending in today's purchasing power.`;
      else narrative.textContent = `Based on these inputs, the retirement lifestyle is ${lifestyleDeltaPct.toFixed(0)}% higher than today's listed spending in today's purchasing power.`;
    }
    $('monthlyReduced').textContent = `${formatINR(r.monthlyReduced, true)}/mo`;
    $('monthlyIncreased').textContent = `${formatINR(r.monthlyIncreased, true)}/mo`;

    $('quickTodayRetirementBudget').textContent = `${formatINR(s.quickMonthlyExpense * s.quickRetirementPct / 100)}/mo`;
    $('detailedExpenseTotal').textContent = formatINR(s.expenses.reduce((a,e) => a + Math.max(0,e.amount), 0));

    $('glanceTodaySpend').textContent = `${formatINR(r.currentTodayExpense, true)}/mo`;
    $('glanceRetirementSpend').textContent = `${formatINR(r.retirementLifestyleToday, true)}/mo`;
    $('glanceFutureSpend').textContent = `${formatINR(r.retirementLifestyleFuture, true)}/mo`;
    $('glanceFutureSpendLabel').textContent = `Projected monthly spending at retirement (age ${Math.round(s.retirementAge)})`;
    $('glanceReduced').textContent = `${formatINR(r.monthlyReduced, true)}/mo`;
    $('glanceIncreased').textContent = `${formatINR(r.monthlyIncreased, true)}/mo`;

    $('breakdownExpensePV').textContent = formatINR(r.recurringExpensePV, true);
    $('breakdownIncomePV').textContent = `−${formatINR(r.retirementIncomePV, true)}`;
    $('breakdownGoalsPV').textContent = formatINR(r.goalsPV, true);
    $('breakdownBuffer').textContent = formatINR(r.safetyBufferAmount, true);
    $('breakdownTotal').textContent = formatINR(r.requiredCorpus, true);
    renderExpenseChanges(r);

    renderLineChart($('expenseChart'), r.expensePoints, {
      retirementAge: s.retirementAge, valueFormatter: v => formatINR(v, true), yLabel: 'Monthly spending'
    });
    renderLineChart($('portfolioChart'), r.portfolioPoints, {
      retirementAge: null, valueFormatter: v => formatINR(v, true), yLabel: 'Portfolio'
    });
    $('expenseChartCaption').textContent = s.mode === 'detailed' ? 'Shows the full expense path, including costs that continue, change, start or end' : 'Quick mode applies your chosen retirement spending percentage';
    renderScenarios(s);
    buildPrintReport(r);
  }

  function renderLineChart(container, points, opts = {}) {
    if (!points || points.length < 2 || points.some(p => !Number.isFinite(p.value))) {
      container.innerHTML = '<div class="chart-empty">Not enough valid data to draw this chart.</div>';
      return;
    }
    const W = 720, H = 280, L = 62, R = 18, T = 18, B = 48;
    const xs = points.map(p => p.age), ys = points.map(p => Math.max(0, p.value));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const maxYRaw = Math.max(...ys, 1);
    const maxY = maxYRaw * 1.08;
    const x = v => L + (v - minX) / Math.max(1e-9, maxX - minX) * (W - L - R);
    const y = v => T + (1 - Math.max(0,v) / maxY) * (H - T - B);
    const poly = points.map(p => `${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const retirementLine = opts.retirementAge && opts.retirementAge > minX && opts.retirementAge < maxX
      ? `<line x1="${x(opts.retirementAge)}" y1="${T}" x2="${x(opts.retirementAge)}" y2="${H-B}" stroke="#d8a83b" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${x(opts.retirementAge)+5}" y="${T+13}" font-size="11" fill="#856112">Retire ${opts.retirementAge}</text>` : '';
    const tickValues = [0, maxY/2, maxY];
    const yGrid = tickValues.map(v => `<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#e7edf1"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#748292">${escapeXml(opts.valueFormatter ? opts.valueFormatter(v) : String(Math.round(v)))}</text>`).join('');
    const xTickValues = opts.retirementAge && opts.retirementAge > minX && opts.retirementAge < maxX
      ? [minX, opts.retirementAge, maxX]
      : [minX, (minX + maxX) / 2, maxX];
    const xTicks = [...new Set(xTickValues.map(v => Math.round(v)))].map(v => `<text x="${x(v)}" y="${H-19}" text-anchor="middle" font-size="10" fill="#748292">Age ${Math.round(v)}</text>`).join('');
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="presentation" aria-hidden="true">
      ${yGrid}${retirementLine}
      <polyline fill="none" stroke="#0e827a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" points="${poly}"/>
      <circle cx="${x(points[0].age)}" cy="${y(points[0].value)}" r="4" fill="#0e827a"/>
      <circle cx="${x(points[points.length-1].age)}" cy="${y(points[points.length-1].value)}" r="4" fill="#0e827a"/>
      ${xTicks}
      <text x="${L}" y="${H-3}" font-size="10" fill="#8995a2">${escapeXml(opts.yLabel || '')}</text>
    </svg>`;
  }

  function escapeXml(s) { return String(s).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }

  function scenarioResults(s) {
    return [s.retirementAge - 5, s.retirementAge, s.retirementAge + 5]
      .map(a => Math.round(a))
      .filter((a, i, arr) => a > s.currentAge && a < s.planningAge && arr.indexOf(a) === i)
      .map(age => ({ age, result: calculatePlan({ ...s, retirementAge: age }) }))
      .filter(x => !x.result.errors?.length);
  }

  function renderScenarios(s) {
    const grid = $('scenarioGrid');
    grid.innerHTML = '';
    for (const { age, result: scenario } of scenarioResults(s)) {
      const current = age === Math.round(s.retirementAge);
      const card = document.createElement('article');
      card.className = `scenario-item ${current ? 'current' : ''}`;
      card.innerHTML = `<span class="scenario-age">Retire at ${age}${current ? ' · current choice' : ''}</span>
        <span class="scenario-corpus-label">Corpus at age ${age} (future ₹)</span>
        <strong>${formatINR(scenario.requiredCorpus, true)}</strong>
        <dl>
          <div><dt>Years to save</dt><dd>${age - s.currentAge}</dd></div>
          <div><dt>Total monthly investment</dt><dd>${formatINR(scenario.totalMonthlyNeeded)}</dd></div>
          <div><dt>Projected funding</dt><dd>${Math.min(999, Math.max(0, scenario.fundedPct)).toFixed(0)}%</dd></div>
        </dl>
        ${current ? '<span class="current-scenario-note">Your selected retirement age</span>' : `<button type="button" class="scenario-use-button no-print" data-retirement-age="${age}">Use age ${age}</button>`}`;
      grid.appendChild(card);
    }
  }

  function reportRow(label, value, valueClass = '') {
    return `<tr><th>${escapeXml(label)}</th><td class="${valueClass}">${escapeXml(value)}</td></tr>`;
  }

  function buildPrintReport(r) {
    const s = r.s;
    const dateText = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
    $('reportGenerated').textContent = `Generated ${dateText}`;
    $('reportCorpus').textContent = formatINR(r.requiredCorpus, true);
    $('reportRetireLine').textContent = `Retire at age ${Math.round(s.retirementAge)} · plan through age ${Math.round(s.planningAge)}`;
    $('reportMonthlyNeeded').textContent = formatINR(r.totalMonthlyNeeded);
    $('reportTodaySpend').textContent = `${formatINR(r.currentTodayExpense)}/mo`;
    $('reportRetirementSpend').textContent = `${formatINR(r.retirementLifestyleToday)}/mo`;
    $('reportFutureSpend').textContent = `${formatINR(r.retirementLifestyleFuture)}/mo`;
    $('reportFutureSpendLabel').textContent = `Projected monthly spending at retirement (age ${Math.round(s.retirementAge)})`;
    $('reportProjectedCorpus').textContent = formatINR(r.projectedCorpus, true);
    $('reportFundingGap').textContent = r.gap > 0 ? formatINR(r.gap, true) : 'No gap*';
    $('reportFundedPct').textContent = `${Math.max(0, r.fundedPct).toFixed(0)}%`;
    const [reportStatus, reportStatusNote] = fundingStatusText(r.fundedPct);
    $('reportFundingStatus').textContent = reportStatus;
    $('reportExecutiveNote').textContent = reportStatusNote;
    $('reportFirstYearExpense').textContent = `${formatINR(r.firstYearExpense)}/mo`;
    $('reportFirstYearIncome').textContent = r.firstYearIncome > 0 ? `${formatINR(r.firstYearIncome)}/mo` : 'None entered';
    $('reportReduced').textContent = `${formatINR(r.monthlyReduced)}/mo`;
    $('reportIncreased').textContent = `${formatINR(r.monthlyIncreased)}/mo`;

    const assumptions = [
      ['Planner mode', s.mode === 'detailed' ? 'Detailed expense planner' : 'Quick estimate'],
      ['Current age', `${Math.round(s.currentAge)}`],
      ['Retirement age', `${Math.round(s.retirementAge)}`],
      ['Plan until age', `${Math.round(s.planningAge)}`],
      ['Current retirement savings', formatINR(s.currentSavings)],
      ['Current monthly retirement investment', formatINR(s.currentMonthlyInvestment)],
      ['Return before retirement', `${s.preReturn.toFixed(1)}% p.a.`],
      ['Return during retirement', `${s.postReturn.toFixed(1)}% p.a.`],
      ['Safety buffer', `${s.bufferRate.toFixed(0)}%`],
    ];
    if (s.mode === 'quick') {
      assumptions.push(['Current household expenses', `${formatINR(s.quickMonthlyExpense)}/mo`]);
      assumptions.push(['Spending remaining at retirement', `${s.quickRetirementPct.toFixed(0)}%`]);
      assumptions.push(['Inflation', `${s.quickInflation.toFixed(1)}% p.a.`]);
    } else {
      assumptions.push(['General inflation', `${s.generalInflation.toFixed(1)}% p.a.`]);
      assumptions.push(['Healthcare inflation', `${s.healthInflation.toFixed(1)}% p.a.`]);
      assumptions.push(['Lifestyle inflation', `${s.lifestyleInflation.toFixed(1)}% p.a.`]);
      assumptions.push(['Education inflation', `${s.educationInflation.toFixed(1)}% p.a.`]);
    }
    $('reportAssumptions').innerHTML = assumptions.map(([a,b]) => reportRow(a,b)).join('');

    $('reportBreakdown').innerHTML = [
      ['Recurring retirement expenses', formatINR(r.recurringExpensePV)],
      ['Less retirement income', `−${formatINR(r.retirementIncomePV)}`],
      ['One-time retirement goals', formatINR(r.goalsPV)],
      ['Safety buffer', formatINR(r.safetyBufferAmount)],
      ['Estimated corpus needed', formatINR(r.requiredCorpus)],
    ].map(([a,b], i, arr) => reportRow(a,b, i === arr.length - 1 ? 'report-total-value' : '')).join('');

    $('reportFunding').innerHTML = [
      ['Future value of existing savings', formatINR(r.futureExisting)],
      ['Future value of current contributions', formatINR(r.futureCurrentContrib)],
      ['Projected corpus at retirement', formatINR(r.projectedCorpus)],
      ['Funding gap', r.gap > 0 ? formatINR(r.gap) : 'No gap under assumptions'],
      ['Total monthly investment indicated', formatINR(r.totalMonthlyNeeded)],
      ['Additional monthly investment indicated', r.extraMonthlyNeeded > 1 ? formatINR(r.extraMonthlyNeeded) : '₹0 under assumptions'],
    ].map(([a,b]) => reportRow(a,b)).join('');

    const changesBlock = $('reportExpenseChangesBlock');
    if (s.mode === 'detailed' && r.expenseChanges.length) {
      changesBlock.style.display = '';
      $('reportExpenseChangeFutureHead').textContent = `Projected at retirement (age ${Math.round(s.retirementAge)}, future ₹)`;
      $('reportExpenseContext').textContent = `All listed expenses · retirement age ${Math.round(s.retirementAge)}`;
      $('reportExpenseChanges').innerHTML = r.expenseChanges.map(x => {
        const change = Math.abs(x.change) < 1 ? 'No lifestyle change' : x.change > 0 ? `+${formatINR(x.change)}` : `−${formatINR(Math.abs(x.change))}`;
        const todayToRetirement = `${formatINR(x.today)} → ${formatINR(x.retirement)}`;
        const ruleAndChange = `${expenseRuleSummary(x, s)} · ${change}`;
        return `<tr><td>${escapeXml(x.name)}</td><td>${escapeXml(todayToRetirement)}</td><td>${escapeXml(formatINR(x.retirementFuture))}</td><td>${escapeXml(ruleAndChange)}</td></tr>`;
      }).join('');
    } else {
      changesBlock.style.display = 'none';
      $('reportExpenseChanges').innerHTML = '';
      $('reportExpenseContext').textContent = 'Detailed planner required for expense-by-expense reporting';
    }

    $('reportScenarios').innerHTML = scenarioResults(s).map(({age, result}) => `<tr>
      <td>${age}${age === Math.round(s.retirementAge) ? ' (selected)' : ''}</td>
      <td>${escapeXml(formatINR(result.requiredCorpus))}</td>
      <td>${escapeXml(formatINR(result.totalMonthlyNeeded))}</td>
      <td>${Math.max(0, result.fundedPct).toFixed(0)}%</td>
    </tr>`).join('');

    renderLineChart($('reportExpenseChart'), r.expensePoints, {
      retirementAge: s.retirementAge, valueFormatter: v => formatINR(v, true), yLabel: 'Monthly spending'
    });
    renderLineChart($('reportPortfolioChart'), r.portfolioPoints, {
      retirementAge: null, valueFormatter: v => formatINR(v, true), yLabel: 'Portfolio'
    });
  }

  function bindDelegatedRows() {
    ['expenseRows','incomeRows','goalRows'].forEach(id => {
      $(id).addEventListener('input', calculateAndRender);
      $(id).addEventListener('change', (e) => {
        if (e.target.classList.contains('exp-rule')) {
          const tr = e.target.closest('tr');
          renderExpenseSetting(tr, e.target.value === 'end' ? value('retirementAge') - 5 : 100);
        }
        calculateAndRender();
      });
      $(id).addEventListener('click', e => {
        const btn = e.target.closest('.remove-row');
        if (!btn) return;
        btn.closest('tr').remove();
        calculateAndRender();
      });
    });
  }

  function serializePlan() {
    return buildState();
  }

  function applyPlan(data) {
    suppressCalculate = true;
    try {
      const scalarIds = [
        'currentAge','retirementAge','planningAge','currentSavings','currentMonthlyInvestment','preReturn','postReturn','bufferRate',
        'quickMonthlyExpense','quickRetirementPct','quickInflation','generalInflation','healthInflation','lifestyleInflation','educationInflation',
        'phase1Pct','phase2Pct','phase3Pct'
      ];
      scalarIds.forEach(id => { if (data[id] !== undefined && $(id)) $(id).value = data[id]; });
      $('expenseRows').innerHTML = ''; (data.expenses || DEFAULT_EXPENSES).forEach(addExpenseRow);
      $('incomeRows').innerHTML = ''; (data.incomes || DEFAULT_INCOMES).forEach(addIncomeRow);
      $('goalRows').innerHTML = ''; (data.goals || DEFAULT_GOALS).forEach(addGoalRow);
      setMode(data.mode || 'quick', false);
    } finally {
      suppressCalculate = false;
      calculateAndRender();
    }
  }

  function resetPlan() {
    applyPlan({ ...DEFAULTS, expenses: DEFAULT_EXPENSES, incomes: DEFAULT_INCOMES, goals: DEFAULT_GOALS });
    $('copyStatus').textContent = '';
    $('saveStatus').textContent = '';
  }

  function bindEvents() {
    $('quickModeBtn').addEventListener('click', () => setMode('quick'));
    $('detailedModeBtn').addEventListener('click', () => setMode('detailed'));
    $('resetBtn').addEventListener('click', resetPlan);
    $('addExpenseBtn').addEventListener('click', () => { addExpenseRow(); calculateAndRender(); });
    $('addIncomeBtn').addEventListener('click', () => { addIncomeRow(); calculateAndRender(); });
    $('addGoalBtn').addEventListener('click', () => { addGoalRow(); calculateAndRender(); });
    $('scenarioGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('.scenario-use-button');
      if (!btn) return;
      $('retirementAge').value = btn.dataset.retirementAge;
      calculateAndRender();
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    qsa('input', $('planner')).forEach(input => {
      if (!input.closest('tbody')) {
        input.addEventListener('input', calculateAndRender);
        input.addEventListener('change', calculateAndRender);
      }
    });

    $('copyBtn').addEventListener('click', async () => {
      if (!lastResult) return;
      const r = lastResult;
      const funded = Math.max(0, r.fundedPct).toFixed(0);
      const gapText = r.gap > 0 ? formatINR(r.gap) : 'No gap under assumptions';
      const extraText = r.extraMonthlyNeeded > 1 ? formatINR(r.extraMonthlyNeeded) : '₹0 under assumptions';
      const text = [
        'CARROWMONT RETIREMENT PLAN SUMMARY',
        '',
        `Planner mode: ${r.s.mode === 'detailed' ? 'Detailed planner' : 'Quick estimate'}`,
        `Retirement age: ${Math.round(r.s.retirementAge)}`,
        `Plan through age: ${Math.round(r.s.planningAge)}`,
        '',
        `Estimated corpus required: ${formatINR(r.requiredCorpus)}`,
        `Projected corpus at retirement: ${formatINR(r.projectedCorpus)}`,
        `Funding gap: ${gapText}`,
        `Projected funding: ${funded}%`,
        `Total monthly investment required: ${formatINR(r.totalMonthlyNeeded)}`,
        `Additional monthly investment vs current plan: ${extraText}`,
        '',
        `Today's monthly spending: ${formatINR(r.currentTodayExpense)}/mo`,
        `Retirement lifestyle in today's ₹: ${formatINR(r.retirementLifestyleToday)}/mo`,
        `Projected monthly spending at retirement (age ${Math.round(r.s.retirementAge)}): ${formatINR(r.retirementLifestyleFuture)}/mo`,
        '',
        'Educational planning estimate only. Results depend on the assumptions entered and actual outcomes may differ.',
        'carrowmont.com'
      ].join('\n');
      try { await navigator.clipboard.writeText(text); $('copyStatus').textContent = 'Carrowmont summary copied.'; }
      catch (_) { $('copyStatus').textContent = 'Copy is unavailable in this browser.'; }
    });

    $('printBtn').addEventListener('click', () => {
      if (!lastResult) return;
      buildPrintReport(lastResult);
      const originalTitle = document.title;
      document.title = `Carrowmont Retirement Planning Report - Age ${Math.round(lastResult.s.retirementAge)}`;
      const restoreTitle = () => { document.title = originalTitle; window.removeEventListener('afterprint', restoreTitle); };
      window.addEventListener('afterprint', restoreTitle);
      window.print();
      setTimeout(() => { if (document.title !== originalTitle) document.title = originalTitle; }, 2000);
    });
    $('savePlanBtn').addEventListener('click', () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePlan())); $('saveStatus').textContent = 'Plan saved in this browser.'; }
      catch (_) { $('saveStatus').textContent = 'Browser storage is unavailable.'; }
    });
    $('loadPlanBtn').addEventListener('click', () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { $('saveStatus').textContent = 'No saved plan found on this device.'; return; }
        applyPlan(JSON.parse(raw)); $('saveStatus').textContent = 'Saved plan loaded.';
      } catch (_) { $('saveStatus').textContent = 'The saved plan could not be loaded.'; }
    });
  }

  function init() {
    DEFAULT_EXPENSES.forEach(addExpenseRow);
    DEFAULT_INCOMES.forEach(addIncomeRow);
    DEFAULT_GOALS.forEach(addGoalRow);
    bindDelegatedRows();
    bindEvents();
    setMode(DEFAULTS.mode, false);
    const legacyYear = $('year'); if (legacyYear) legacyYear.textContent = new Date().getFullYear();
    calculateAndRender();
  }

  init();
})();
