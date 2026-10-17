(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const L = window.CarrowmontLocale;
  const C = window.CarrowmontWithdrawalCore;
  const HANDOFF_KEY = 'carrowmont_retirement_withdrawal_handoff_v1';
  let mode = 'runway';
  let last = null;
  let pendingImport = null;

  const finite = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const money = (value, compact = false) => L
    ? (compact ? L.formatCompactMoney(value, { maximumFractionDigits: 2 }) : L.formatMoney(value, { maximumFractionDigits: 0 }))
    : String(Math.round(value));
  const pct = value => `${finite(value).toFixed(1).replace(/\.0$/, '')}%`;
  const region = () => L?.getRegion?.() || 'OTHER';
  const currency = () => L?.getCurrency?.() || 'INR';

  function identity(code = region()) {
    if (code === 'IN') return { title:'Retirement SWP / Withdrawal Calculator', eyebrow:'Retirement SWP & income planning', boundary:'Carrowmont models a generic invested portfolio and regular withdrawals. It does not model a specific mutual-fund scheme, NAV history, unit redemptions, exit loads or tax treatment.' };
    if (code === 'GB' || code === 'IE') return { title:'Retirement Drawdown Calculator', eyebrow:'Retirement drawdown planning', boundary:'This calculator illustrates portfolio withdrawals under user-entered assumptions. It does not calculate pension tax, provider charges, tax-free cash, access eligibility or statutory pension rules.' };
    if (code === 'US' || code === 'CA') return { title:'Retirement Withdrawal Calculator', eyebrow:'Retirement withdrawal planning', boundary:'This calculator is an educational portfolio-withdrawal model. It does not calculate taxes, Social Security, CPP/OAS, required distributions or provider-specific rules.' };
    if (code === 'AU' || code === 'NZ') return { title:'Retirement Withdrawal Calculator', eyebrow:'Retirement withdrawal planning', boundary:'This calculator does not automatically apply statutory pension, superannuation, KiwiSaver, minimum-withdrawal, access-age or tax rules.' };
    return { title:'Retirement Withdrawal & Drawdown Calculator', eyebrow:'Retirement income planning', boundary:'Carrowmont uses one jurisdiction-neutral calculation engine. Country selection changes terminology and context, not the underlying mathematics.' };
  }

  function setMode(next, track = true) {
    mode = next === 'support' ? 'support' : 'runway';
    const support = mode === 'support';
    $('runwayModeBtn').classList.toggle('active', !support);
    $('supportModeBtn').classList.toggle('active', support);
    $('runwayModeBtn').setAttribute('aria-pressed', String(!support));
    $('supportModeBtn').setAttribute('aria-pressed', String(support));
    $('startingWithdrawalField').hidden = support;
    $('supportFields').hidden = !support;
    $('maxYearsField').hidden = support;
    $('primaryResultTitle').textContent = support ? 'Modelled starting withdrawal' : 'Modelled savings runway';
    if (track) window.CarrowmontAnalytics?.track?.('calculator_mode_change', { mode });
    calculateAndRender();
  }

  function horizonMode() {
    return document.querySelector('input[name="horizonMode"]:checked')?.value || 'years';
  }

  function syncHorizonFields() {
    const ageMode = horizonMode() === 'age';
    $('targetYearsField').hidden = ageMode;
    $('targetAgeField').hidden = !ageMode;
    calculateAndRender();
  }

  function inputs() {
    const startAgeRaw = $('startAge').value.trim();
    const startAge = startAgeRaw === '' ? '' : finite(startAgeRaw, '');
    const ageMode = mode === 'support' && horizonMode() === 'age';
    const targetMonths = ageMode
      ? Math.round((finite($('targetAge').value) - finite(startAgeRaw)) * 12)
      : Math.round(finite($('targetYears').value, 30) * 12);
    return {
      mode,
      startingBalance: finite($('startingBalance').value),
      startingWithdrawal: finite($('startingWithdrawal').value),
      annualReturn: finite($('annualReturn').value),
      inflationLinked: $('inflationToggle').checked,
      withdrawalGrowth: finite($('withdrawalGrowth').value),
      timing: $('timing').value,
      maxMonths: Math.round(finite($('maxYears').value, 100) * 12),
      startAge,
      useAge: ageMode,
      targetMonths,
      targetAge: ageMode ? finite($('targetAge').value) : null,
      targetEndingBalance: finite($('targetEndingBalance').value)
    };
  }

  function duration(months) {
    const m = Math.max(0, Math.round(months || 0));
    const y = Math.floor(m / 12);
    const rem = m % 12;
    if (!y) return `${rem} ${rem === 1 ? 'month' : 'months'}`;
    if (!rem) return `${y} ${y === 1 ? 'year' : 'years'}`;
    return `${y} ${y === 1 ? 'year' : 'years'} ${rem} ${rem === 1 ? 'month' : 'months'}`;
  }

  function ageText(startAge, months) {
    if (!Number.isFinite(Number(startAge))) return '';
    const total = Math.round(Number(startAge) * 12 + months);
    const y = Math.floor(total / 12), m = total % 12;
    return m ? `around age ${y} years ${m} months` : `around age ${y}`;
  }

  function renderIdentity() {
    const id = identity();
    $('productLabel').textContent = id.title;
    $('heroEyebrow').textContent = id.eyebrow;
    $('localeBoundaryNote').textContent = id.boundary;
    document.querySelectorAll('[data-currency-prefix]').forEach(el => { el.textContent = L?.currencySymbol?.() || currency(); });
  }

  function renderInvalid(errors) {
    $('validationMsg').textContent = errors.join(' ');
    $('primaryResultValue').textContent = '—';
    $('primaryResultSub').textContent = 'Review the highlighted assumptions.';
    ['resultStartingWithdrawal','resultWithdrawalRate','resultTotalWithdrawals','resultEndingBalance'].forEach(id => { $(id).textContent = '—'; });
    $('withdrawalBalanceChart').innerHTML = '<div class="withdrawal-chart-empty">Enter valid assumptions to see the balance path.</div>';
    $('sensitivityGrid').innerHTML = '';
    $('annualScheduleBody').innerHTML = '';
  }

  function renderResult(calc) {
    $('validationMsg').textContent = '';
    const s = calc.state;
    const r = calc.result;
    if (mode === 'runway') {
      const months = r.depleted ? r.depletionMonth : r.horizonMonths;
      $('primaryResultLabel').textContent = r.depleted ? 'Portfolio reaches zero after' : 'Balance remains above zero through';
      $('primaryResultValue').textContent = duration(months);
      const age = ageText(s.startAge, months);
      $('primaryResultSub').textContent = r.depleted
        ? `${age ? `${age} · ` : ''}month-level depletion under the selected assumptions.`
        : `${age ? `${age} · ` : ''}Carrowmont does not describe through-horizon survival as “forever”.`;
      $('resultTotalWithdrawalLabel').textContent = r.depleted ? 'Total modelled withdrawals through depletion' : 'Total modelled withdrawals through horizon';
    } else {
      $('primaryResultLabel').textContent = 'Starting monthly withdrawal for the selected horizon';
      $('primaryResultValue').textContent = money(calc.startingWithdrawal);
      const horizon = s.useAge && s.targetAge ? `to age ${Math.round(s.targetAge)}` : `for ${duration(s.targetMonths)}`;
      $('primaryResultSub').textContent = `${horizon}, ending near ${money(s.targetEndingBalance)} under these constant assumptions.`;
      $('resultTotalWithdrawalLabel').textContent = 'Total modelled withdrawals through horizon';
    }
    $('resultStartingWithdrawal').textContent = money(mode === 'support' ? calc.startingWithdrawal : s.startingWithdrawal);
    $('resultWithdrawalRate').textContent = pct(r.firstYearWithdrawalRate);
    $('resultTotalWithdrawals').textContent = money(r.totalWithdrawals);
    $('resultEndingBalance').textContent = money(r.endingBalance);
    $('resultReturn').textContent = `Return ${pct(s.annualReturn)}`;
    $('resultGrowth').textContent = s.inflationLinked ? `Withdrawal increase ${pct(s.withdrawalGrowth)}` : 'Fixed nominal withdrawal';
    $('resultTiming').textContent = s.timing === 'beginning' ? 'Beginning-of-month withdrawals' : 'End-of-month withdrawals';
    renderChart(r, s);
    renderSensitivity(calc.sensitivity, s);
    renderAnnualTable(r.annualSummary);
  }

  function renderChart(result, s) {
    const host = $('withdrawalBalanceChart');
    const annual = result.annualSummary;
    const points = [{x:0, y:s.startingBalance, label:'Start'}].concat(annual.map(row => ({x:row.year, y:row.endingBalance, label:`Year ${row.year}`})));
    if (points.length < 2) { host.innerHTML = '<div class="withdrawal-chart-empty">Not enough model periods to draw the chart.</div>'; return; }
    const W=760,H=320,Lm=72,Rm=22,T=20,B=50;
    const maxX=Math.max(1,...points.map(p=>p.x));
    const maxY=Math.max(1,...points.map(p=>p.y));
    const x=v=>Lm+(v/maxX)*(W-Lm-Rm);
    const y=v=>T+(1-v/maxY)*(H-T-B);
    const path=points.map((p,i)=>`${i?'L':'M'} ${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');
    const yTicks=[0,.25,.5,.75,1].map(f=>maxY*f);
    const tickYears=[0,Math.round(maxX/2),maxX].filter((v,i,a)=>a.indexOf(v)===i);
    const dep=result.depleted?points[points.length-1]:null;
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <rect x="${Lm}" y="${T}" width="${W-Lm-Rm}" height="${H-T-B}" rx="8" fill="#fbfdfe" stroke="#d9e3ea"/>
      ${yTicks.map(v=>`<line x1="${Lm}" x2="${W-Rm}" y1="${y(v)}" y2="${y(v)}" stroke="#e4ebef"/><text x="${Lm-9}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#617187">${escapeXml(money(v,true))}</text>`).join('')}
      ${tickYears.map(v=>`<text x="${x(v)}" y="${H-18}" text-anchor="middle" font-size="11" fill="#617187">${v===0?'Start':`Year ${v}`}</text>`).join('')}
      <path d="${path}" fill="none" stroke="#0e827a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dep?`<circle cx="${x(dep.x)}" cy="${y(dep.y)}" r="5" fill="#b93838"/><text x="${Math.max(Lm+45,x(dep.x)-8)}" y="${Math.max(34,y(dep.y)-10)}" text-anchor="end" font-size="11" font-weight="700" fill="#9d3333">Depleted</text>`:''}
    </svg>`;
    $('chartCaption').textContent = result.depleted ? `The model reaches zero after ${duration(result.depletionMonth)}.` : `The balance remains above zero through ${duration(result.horizonMonths)}.`;
  }

  function renderSensitivity(items, s) {
    const host=$('sensitivityGrid');
    host.innerHTML=items.map(item=>{
      let headline='—', detail='';
      if (mode==='support') {
        headline=item.ok?money(item.startingWithdrawal):'Not feasible';
        detail='starting monthly withdrawal';
      } else if (item.result) {
        headline=item.result.depleted?duration(item.result.depletionMonth):`Through ${duration(item.result.horizonMonths)}`;
        detail=item.result.depleted?'modelled runway':'balance remains above zero';
      }
      return `<div class="sensitivity-card ${item.delta===0?'base':''}"><span>${pct(item.annualReturn)} annual return${item.delta===0?' · selected':''}</span><strong>${escapeXml(headline)}</strong><small>${escapeXml(detail)}</small></div>`;
    }).join('');
  }

  function renderAnnualTable(rows) {
    const preview = rows.length > 35 ? rows.slice(0, 30).concat(rows.slice(-5)) : rows;
    $('annualScheduleBody').innerHTML = preview.map((row,i)=>`<tr${rows.length>35 && i===30?' class="schedule-gap-row"':''}><td>${row.year}</td><td>${row.age===null?'—':formatAge(row.age)}</td><td>${money(row.openingBalance)}</td><td>${money(row.totalWithdrawals)}</td><td>${signedMoney(row.investmentChange)}</td><td>${money(row.endingBalance)}</td><td>${money(row.startingMonthlyWithdrawal)}</td></tr>`).join('');
    $('annualTableNote').textContent = rows.length > 35 ? `Previewing first 30 and last 5 years · CSV/PDF use the full schedule` : `${rows.length} annual rows`;
  }

  function formatAge(age) {
    const months=Math.round(age*12), y=Math.floor(months/12), m=months%12;
    return m?`${y}y ${m}m`:`${y}`;
  }
  function signedMoney(v) { const n=finite(v); return `${n<0?'−':n>0?'+':''}${money(Math.abs(n))}`; }
  function escapeXml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function calculateAndRender() {
    if (!$('startingBalance')) return;
    $('withdrawalGrowthField').hidden = !$('inflationToggle').checked;
    const calc = C.calculate(inputs());
    last = calc.ok ? calc : null;
    if (!calc.ok) renderInvalid(calc.errors || ['Review the assumptions.']);
    else renderResult(calc);
  }

  function buildSummary() {
    if (!last) return '';
    const s=last.state,r=last.result,id=identity();
    const lines=[
      `CARROWMONT ${id.title.toUpperCase()} SUMMARY`, '',
      `Country / region: ${L?.getProfile?.().label || 'Other / International'}`,
      `Currency: ${currency()}`,
      `Mode: ${mode==='runway'?'How long could savings last?':'What starting withdrawal could savings support?'}`,
      `Starting retirement savings: ${money(s.startingBalance)}`,
      `Starting monthly withdrawal: ${money(mode==='support'?last.startingWithdrawal:s.startingWithdrawal)}`,
      `Expected annual return: ${pct(s.annualReturn)}`,
      `${s.inflationLinked?'Annual withdrawal increase':'Withdrawal treatment'}: ${s.inflationLinked?pct(s.withdrawalGrowth):'Fixed nominal amount'}`,
      `Withdrawal timing: ${s.timing==='beginning'?'Beginning of month':'End of month'}`,
      ''
    ];
    if(mode==='runway') lines.push(`Modelled runway: ${r.depleted?duration(r.depletionMonth):`through ${duration(r.horizonMonths)}`}${s.startAge!==null?` (${ageText(s.startAge,r.depleted?r.depletionMonth:r.horizonMonths)})`:''}`);
    else lines.push(`Target horizon: ${s.useAge?`to age ${s.targetAge}`:duration(s.targetMonths)}`,`Target ending balance: ${money(s.targetEndingBalance)}`);
    lines.push(`First-year withdrawal rate: ${pct(r.firstYearWithdrawalRate)}`,`Total modelled withdrawals: ${money(r.totalWithdrawals)}`,`Modelled ending balance: ${money(r.endingBalance)}`,'','Educational illustration only. Constant-return assumptions do not predict real market paths; sequence of returns can materially change outcomes.','carrowmont.com');
    return lines.join('\n');
  }

  async function copySummary() {
    if (!last) return;
    const text=buildSummary();
    let ok=false;
    try { await navigator.clipboard.writeText(text); ok=true; } catch (_) {
      try { const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); ok=document.execCommand('copy'); ta.remove(); } catch (_) {}
    }
    $('copyStatus').textContent=ok?'Carrowmont Summary copied.':'Copy is unavailable in this browser.';
    window.CarrowmontAnalytics?.track?.('copy_summary');
  }

  function csvCell(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadCsv() {
    if (!last) return;
    const rows=[['Year','Age','Opening balance','Total withdrawals','Modelled investment change','Ending balance','Starting monthly withdrawal'],...last.result.annualSummary.map(r=>[r.year,r.age===null?'':formatAge(r.age),r.openingBalance.toFixed(2),r.totalWithdrawals.toFixed(2),r.investmentChange.toFixed(2),r.endingBalance.toFixed(2),r.startingMonthlyWithdrawal.toFixed(2)])];
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='carrowmont-retirement-withdrawal-schedule.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function reportModel() {
    if (!last) return null;
    return {
      identity: identity(),
      region: L?.getProfile?.().label || 'Other / International',
      currency: currency(),
      mode,
      state: JSON.parse(JSON.stringify(last.state)),
      result: JSON.parse(JSON.stringify(last.result)),
      sensitivity: JSON.parse(JSON.stringify(last.sensitivity || [])),
      summary: buildSummary(),
      generatedAt: new Date().toISOString()
    };
  }

  async function generateReport() {
    if (!last || !window.CarrowmontWithdrawalPdfRenderer || !window.CarrowmontPdfExport) return;
    const btn=$('reportBtn'),status=$('reportDownloadStatus');btn.disabled=true;btn.setAttribute('aria-busy','true');status.textContent='Preparing your report...';
    try{
      const model=reportModel();
      const canvases=await window.CarrowmontWithdrawalPdfRenderer.render(model);
      const date=new Date().toISOString().slice(0,10);
      await window.CarrowmontPdfExport.downloadCanvases(canvases,{filename:`retirement-withdrawal-report-${date}.pdf`,quality:.95});
      status.textContent='Report has been downloaded.';
      window.CarrowmontAnalytics?.track?.('report_generate');
    }catch(err){console.error('Retirement withdrawal report generation failed',err);status.textContent='The report could not be generated. Please refresh the page and try again.';}
    finally{btn.disabled=false;btn.removeAttribute('aria-busy');}
  }

  function consumeImport() {
    try { const raw=sessionStorage.getItem(HANDOFF_KEY); sessionStorage.removeItem(HANDOFF_KEY); if(!raw)return; const p=JSON.parse(raw); if(!p||p.version!==1)return; pendingImport=p; }
    catch(_){ pendingImport=null; }
    if(!pendingImport)return;
    const profile=pendingImport.regionLabel || pendingImport.region || 'Retirement Planner';
    $('retirementImportCopy').textContent=`${profile} values are staged for review: projected savings ${money(pendingImport.projectedCorpus||0)}, modelled target ${money(pendingImport.requiredCorpus||0)}, and portfolio-funded monthly need ${money(pendingImport.monthlyNeed||0)}.`;
    $('retirementImportPanel').hidden=false;
    $('useProjectedImport').hidden=!(pendingImport.projectedCorpus>0);
    $('useTargetImport').hidden=!(pendingImport.requiredCorpus>0);
  }

  function applyImport(which) {
    if(!pendingImport)return;
    if(pendingImport.region && pendingImport.currency && L?.setLocale) L.setLocale(pendingImport.region,pendingImport.currency);
    const balance=which==='target'?pendingImport.requiredCorpus:pendingImport.projectedCorpus;
    if(balance>0)$('startingBalance').value=String(balance);
    if(pendingImport.monthlyNeed>0)$('startingWithdrawal').value=String(pendingImport.monthlyNeed);
    if(Number.isFinite(Number(pendingImport.retirementAge)))$('startAge').value=String(pendingImport.retirementAge);
    if(Number.isFinite(Number(pendingImport.postReturn)))$('annualReturn').value=String(pendingImport.postReturn);
    if(Number.isFinite(Number(pendingImport.inflation)))$('withdrawalGrowth').value=String(pendingImport.inflation);
    $('retirementImportPanel').hidden=true; pendingImport=null; calculateAndRender();
  }

  function bind() {
    $('runwayModeBtn').addEventListener('click',()=>setMode('runway'));
    $('supportModeBtn').addEventListener('click',()=>setMode('support'));
    qsa('input,select',$('calculator')).forEach(el=>{el.addEventListener('input',calculateAndRender);el.addEventListener('change',calculateAndRender);});
    qsa('input[name="horizonMode"]').forEach(el=>el.addEventListener('change',syncHorizonFields));
    $('copyBtn').addEventListener('click',copySummary);$('csvBtn').addEventListener('click',downloadCsv);$('reportBtn').addEventListener('click',generateReport);
    $('useProjectedImport').addEventListener('click',()=>applyImport('projected'));$('useTargetImport').addEventListener('click',()=>applyImport('target'));$('dismissImport').addEventListener('click',()=>{$('retirementImportPanel').hidden=true;pendingImport=null;});
    window.addEventListener('carrowmont:localechange',()=>{renderIdentity();calculateAndRender();});
  }

  function init(){renderIdentity();bind();syncHorizonFields();consumeImport();calculateAndRender();}
  init();
})();
