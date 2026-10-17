(() => {
  'use strict';

  const LIMITS = Object.freeze({
    startingBalance: [0.01, 10_000_000_000],
    startingWithdrawal: [0, 1_000_000_000],
    annualReturn: [-99.99, 100],
    withdrawalGrowth: [-10, 30],
    horizonMonths: [1, 1200],
    startingAge: [18, 100],
    targetAge: [18.01, 120],
    targetEndingBalance: [0, 10_000_000_000]
  });
  const EPSILON = 1e-7;

  const finite = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function monthlyRate(annualReturnPct) {
    const annual = finite(annualReturnPct) / 100;
    if (1 + annual <= 0) throw new Error('Annual return must be greater than -100%.');
    return Math.pow(1 + annual, 1 / 12) - 1;
  }

  function normalize(raw = {}) {
    const mode = raw.mode === 'support' ? 'support' : 'runway';
    const useAge = Boolean(raw.useAge);
    const startAge = raw.startAge === '' || raw.startAge == null ? null : finite(raw.startAge, NaN);
    let targetMonths = Math.trunc(finite(raw.targetMonths, 0));
    const targetAge = raw.targetAge === '' || raw.targetAge == null ? null : finite(raw.targetAge, NaN);
    if (mode === 'support' && useAge && Number.isFinite(startAge) && Number.isFinite(targetAge)) {
      targetMonths = Math.round((targetAge - startAge) * 12);
    }
    return {
      mode,
      startingBalance: finite(raw.startingBalance),
      startingWithdrawal: finite(raw.startingWithdrawal),
      annualReturn: finite(raw.annualReturn),
      inflationLinked: raw.inflationLinked !== false,
      withdrawalGrowth: finite(raw.withdrawalGrowth),
      timing: raw.timing === 'end' ? 'end' : 'beginning',
      maxMonths: Math.trunc(finite(raw.maxMonths, 1200)),
      startAge: Number.isFinite(startAge) ? startAge : null,
      useAge,
      targetMonths,
      targetAge: Number.isFinite(targetAge) ? targetAge : null,
      targetEndingBalance: finite(raw.targetEndingBalance)
    };
  }

  function validate(raw = {}) {
    const s = normalize(raw);
    const errors = [];
    const range = (value, limits, label) => {
      if (!Number.isFinite(value) || value < limits[0] || value > limits[1]) {
        errors.push(`${label} must be between ${limits[0]} and ${limits[1]}.`);
      }
    };
    range(s.startingBalance, LIMITS.startingBalance, 'Starting retirement savings');
    range(s.annualReturn, LIMITS.annualReturn, 'Expected annual return');
    if (s.inflationLinked) range(s.withdrawalGrowth, LIMITS.withdrawalGrowth, 'Withdrawal increase');
    if (s.startAge !== null) range(s.startAge, LIMITS.startingAge, 'Starting age');

    if (s.mode === 'runway') {
      range(s.startingWithdrawal, LIMITS.startingWithdrawal, 'Starting monthly withdrawal');
      if (s.startingWithdrawal <= 0) errors.push('Starting monthly withdrawal must be greater than zero.');
      if (!Number.isInteger(s.maxMonths) || s.maxMonths < LIMITS.horizonMonths[0] || s.maxMonths > LIMITS.horizonMonths[1]) {
        errors.push('Maximum model horizon must be between 1 month and 100 years.');
      }
    } else {
      if (!Number.isInteger(s.targetMonths) || s.targetMonths < LIMITS.horizonMonths[0] || s.targetMonths > LIMITS.horizonMonths[1]) {
        errors.push('Target duration must be between 1 month and 100 years.');
      }
      if (s.useAge) {
        if (s.startAge === null) errors.push('Starting age is required when solving to a target age.');
        if (s.targetAge === null) errors.push('Target age is required when solving to a target age.');
        if (s.startAge !== null && s.targetAge !== null) {
          if (s.targetAge <= s.startAge) errors.push('Target age must be greater than starting age.');
          if (s.targetAge > LIMITS.targetAge[1]) errors.push('Target age cannot be greater than 120.');
        }
      }
      range(s.targetEndingBalance, LIMITS.targetEndingBalance, 'Target ending balance');
    }
    return { state: s, valid: errors.length === 0, errors };
  }

  function scheduledWithdrawal(startingWithdrawal, monthIndex, growthPct, inflationLinked) {
    if (!inflationLinked) return startingWithdrawal;
    const yearIndex = Math.floor((monthIndex - 1) / 12);
    return startingWithdrawal * Math.pow(1 + growthPct / 100, yearIndex);
  }

  function simulate(raw = {}) {
    const s = normalize(raw);
    const horizonMonths = Math.max(1, Math.min(1200, Math.trunc(finite(raw.horizonMonths, s.maxMonths || s.targetMonths || 1200))));
    const rate = monthlyRate(s.annualReturn);
    const schedule = [];
    let balance = Math.max(0, s.startingBalance);
    let totalWithdrawals = 0;
    let totalInvestmentChange = 0;
    let depleted = false;
    let depletionMonth = null;

    for (let month = 1; month <= horizonMonths; month += 1) {
      const opening = balance;
      const planned = Math.max(0, scheduledWithdrawal(s.startingWithdrawal, month, s.withdrawalGrowth, s.inflationLinked));
      let actualWithdrawal = 0;
      let investmentChange = 0;
      let ending = opening;

      if (s.timing === 'beginning') {
        actualWithdrawal = Math.min(planned, Math.max(0, opening));
        const afterWithdrawal = Math.max(0, opening - actualWithdrawal);
        if (planned > opening + EPSILON || afterWithdrawal <= EPSILON) {
          ending = 0;
          depleted = true;
        } else {
          investmentChange = afterWithdrawal * rate;
          ending = afterWithdrawal + investmentChange;
          if (ending <= EPSILON) { ending = 0; depleted = true; }
        }
      } else {
        investmentChange = opening * rate;
        const afterGrowth = Math.max(0, opening + investmentChange);
        actualWithdrawal = Math.min(planned, afterGrowth);
        ending = Math.max(0, afterGrowth - actualWithdrawal);
        if (planned > afterGrowth + EPSILON || ending <= EPSILON) {
          ending = 0;
          depleted = true;
        }
      }

      totalWithdrawals += actualWithdrawal;
      totalInvestmentChange += investmentChange;
      schedule.push({
        month,
        age: s.startAge === null ? null : s.startAge + month / 12,
        openingBalance: opening,
        plannedWithdrawal: planned,
        withdrawal: actualWithdrawal,
        investmentChange,
        endingBalance: ending
      });
      balance = ending;
      if (depleted) { depletionMonth = month; break; }
    }

    if (Math.abs(balance) <= EPSILON) balance = 0;
    return {
      state: s,
      monthlyRate: rate,
      horizonMonths,
      schedule,
      annualSummary: annualSummary(schedule, s.startAge),
      depleted,
      depletionMonth,
      monthsModeled: schedule.length,
      endingBalance: balance,
      totalWithdrawals,
      totalInvestmentChange,
      firstYearAnnualWithdrawal: schedule.slice(0, 12).reduce((sum, row) => sum + row.withdrawal, 0),
      firstYearWithdrawalRate: s.startingBalance > 0 ? (s.startingWithdrawal * 12 / s.startingBalance) * 100 : 0
    };
  }

  function annualSummary(schedule, startAge = null) {
    const rows = [];
    for (let offset = 0; offset < schedule.length; offset += 12) {
      const chunk = schedule.slice(offset, offset + 12);
      if (!chunk.length) continue;
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      rows.push({
        year: Math.floor(offset / 12) + 1,
        age: startAge === null ? null : startAge + (offset + chunk.length) / 12,
        openingBalance: first.openingBalance,
        totalWithdrawals: chunk.reduce((sum, row) => sum + row.withdrawal, 0),
        investmentChange: chunk.reduce((sum, row) => sum + row.investmentChange, 0),
        endingBalance: last.endingBalance,
        startingMonthlyWithdrawal: first.plannedWithdrawal
      });
    }
    return rows;
  }

  function solveStartingWithdrawal(raw = {}) {
    const v = validate({ ...raw, mode: 'support' });
    if (!v.valid) return { ok: false, errors: v.errors, state: v.state };
    const s = v.state;
    const targetMonths = s.targetMonths;
    const target = Math.max(0, s.targetEndingBalance);
    const noWithdrawal = simulate({ ...s, startingWithdrawal: 0, horizonMonths: targetMonths });
    if (noWithdrawal.endingBalance + 0.005 < target) {
      return { ok: false, errors: ['The target ending balance is higher than this portfolio can reach under the selected return without withdrawals.'], state: s };
    }

    let low = 0;
    let high = Math.max(1, s.startingBalance / Math.max(1, targetMonths));
    const endingFor = withdrawal => simulate({ ...s, startingWithdrawal: withdrawal, horizonMonths: targetMonths });
    let hiResult = endingFor(high);
    let guard = 0;
    while (!hiResult.depleted && hiResult.endingBalance > target && guard < 80) {
      high *= 2;
      hiResult = endingFor(high);
      guard += 1;
      if (high > LIMITS.startingWithdrawal[1] * 4) break;
    }
    high = Math.min(high, LIMITS.startingWithdrawal[1]);

    for (let i = 0; i < 96; i += 1) {
      const mid = (low + high) / 2;
      const res = endingFor(mid);
      const ending = res.depleted ? 0 : res.endingBalance;
      if (ending > target) low = mid;
      else high = mid;
    }
    const withdrawal = (low + high) / 2;
    const result = endingFor(withdrawal);
    return {
      ok: true,
      state: { ...s, startingWithdrawal: withdrawal },
      startingWithdrawal: withdrawal,
      result,
      targetMonths,
      targetEndingBalance: target,
      firstYearAnnualWithdrawal: result.firstYearAnnualWithdrawal,
      firstYearWithdrawalRate: s.startingBalance > 0 ? (withdrawal * 12 / s.startingBalance) * 100 : 0
    };
  }

  function sensitivity(raw = {}) {
    const s = normalize(raw);
    return [-2, 0, 2].map(delta => {
      const annualReturn = clamp(s.annualReturn + delta, LIMITS.annualReturn[0], LIMITS.annualReturn[1]);
      if (s.mode === 'support') {
        const solved = solveStartingWithdrawal({ ...s, annualReturn, mode: 'support' });
        return { delta, annualReturn, ok: solved.ok, startingWithdrawal: solved.startingWithdrawal ?? 0, result: solved.result || null };
      }
      const result = simulate({ ...s, annualReturn, horizonMonths: s.maxMonths });
      return { delta, annualReturn, ok: true, startingWithdrawal: s.startingWithdrawal, result };
    });
  }

  function calculate(raw = {}) {
    const v = validate(raw);
    if (!v.valid) return { ok: false, errors: v.errors, state: v.state };
    const s = v.state;
    if (s.mode === 'support') {
      const solved = solveStartingWithdrawal(s);
      if (!solved.ok) return solved;
      return { ...solved, sensitivity: sensitivity({ ...solved.state, mode: 'support' }) };
    }
    const result = simulate({ ...s, horizonMonths: s.maxMonths });
    return { ok: true, state: s, result, sensitivity: sensitivity(s) };
  }

  window.CarrowmontWithdrawalCore = {
    LIMITS,
    EPSILON,
    normalize,
    validate,
    monthlyRate,
    scheduledWithdrawal,
    simulate,
    annualSummary,
    solveStartingWithdrawal,
    sensitivity,
    calculate,
    clamp
  };
})();
