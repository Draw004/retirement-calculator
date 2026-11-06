(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.CarrowmontRetirementCore=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  const VERSION='RETIREMENT-CORE-1.0';
  const FREQUENCY_PERIODS=Object.freeze({weekly:52,biweekly:26,semimonthly:24,fourweekly:13,monthly:12});
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function effectiveMonthlyRate(annualPct){return Math.pow(1+annualPct/100,1/12)-1;}
  function contributionSchedule(annualPct,years,frequency){
    const ppy=FREQUENCY_PERIODS[frequency]||FREQUENCY_PERIODS.monthly;
    const periods=Math.max(0,Math.round(Math.max(0,years)*ppy));
    const rate=Math.pow(1+annualPct/100,1/ppy)-1;
    const factor=periods<=0?0:(Math.abs(rate)>1e-12?(Math.pow(1+rate,periods)-1)/rate:periods);
    return {ppy,periods,rate,factor};
  }
  function inflationPct(type,s){if(s.mode==='quick')return s.quickInflation;if(type==='health')return s.healthInflation;if(type==='lifestyle')return s.lifestyleInflation;if(type==='education')return s.educationInflation;return s.generalInflation;}
  function lifestylePhaseMultiplier(age,s){if(age<s.retirementAge)return 1;const y=age-s.retirementAge;if(y<10)return s.phase1Pct/100;if(y<20)return s.phase2Pct/100;return s.phase3Pct/100;}
  function detailedExpenseAtAge(exp,age,s,nominal=true){
    if(exp.amount<=0)return 0;
    let factor=1;
    if(age<s.retirementAge){if(exp.rule==='start')return 0;if(exp.rule==='end'&&age>=exp.setting)return 0;}
    else{if(exp.rule==='end'){if(age>=exp.setting)return 0;}else{factor=exp.setting/100;}if(exp.inflationType==='lifestyle')factor*=lifestylePhaseMultiplier(age,s);}
    const inflation=inflationPct(exp.inflationType,s)/100;
    const years=Math.max(0,age-s.currentAge);
    const inflationFactor=nominal?Math.pow(1+inflation,years):1;
    return exp.amount*factor*inflationFactor;
  }
  function expenseAtAge(age,s,nominal=true){
    if(s.mode==='quick'){const inflation=s.quickInflation/100;const inflated=s.quickMonthlyExpense*(nominal?Math.pow(1+inflation,Math.max(0,age-s.currentAge)):1);return age<s.retirementAge?inflated:inflated*s.quickRetirementPct/100;}
    return s.expenses.reduce((sum,exp)=>sum+detailedExpenseAtAge(exp,age,s,nominal),0);
  }
  function incomeAtAge(age,s){if(s.mode==='quick')return 0;return s.incomes.reduce((sum,inc)=>{if(inc.amount<=0||age+1e-9<inc.startAge)return sum;const years=Math.max(0,age-inc.startAge);return sum+inc.amount*Math.pow(1+inc.growth/100,years);},0);}
  function goalFutureAmount(goal,s){const inflation=inflationPct(goal.inflationType,s)/100;return goal.amount*Math.pow(1+inflation,Math.max(0,goal.age-s.currentAge));}
  function validateState(s){
    const errors=[];
    if(s.currentAge<18)errors.push('Current age must be at least 18.');
    if(s.retirementAge<=s.currentAge)errors.push('Retirement age must be greater than current age.');
    if(s.planningAge<=s.retirementAge)errors.push('Plan-until age must be greater than retirement age.');
    if(s.planningAge>110)errors.push('Plan-until age cannot exceed 110 in this calculator.');
    if(s.preReturn<0||s.postReturn<0||s.bufferRate<0)errors.push('Return and buffer assumptions cannot be negative.');
    if(s.mode==='quick'&&s.quickMonthlyExpense<=0)errors.push('Enter a positive monthly household expense.');
    if(s.mode==='detailed'&&s.expenses.every(e=>e.amount<=0))errors.push('Add at least one expense with a positive amount.');
    return errors;
  }
  function calculatePlan(s){
    const errors=validateState(s);if(errors.length)return{errors};
    const monthsToRetire=Math.round((s.retirementAge-s.currentAge)*12);
    const retirementMonths=Math.round((s.planningAge-s.retirementAge)*12);
    const monthlyPost=effectiveMonthlyRate(s.postReturn);
    const goalByMonth=new Map();
    if(s.mode==='detailed')for(const goal of s.goals){if(goal.amount<=0||goal.age<s.retirementAge||goal.age>s.planningAge)continue;const m=clamp(Math.round((goal.age-s.retirementAge)*12),0,Math.max(0,retirementMonths-1));goalByMonth.set(m,(goalByMonth.get(m)||0)+goalFutureAmount(goal,s));}
    let recurringExpensePV=0,retirementIncomePV=0,goalsPV=0,firstYearExpenseTotal=0,firstYearIncomeTotal=0;const monthlyFlows=[];
    for(let m=0;m<retirementMonths;m++){
      const age=s.retirementAge+m/12,expense=expenseAtAge(age,s,true),income=incomeAtAge(age,s),goal=goalByMonth.get(m)||0,net=expense-income,discount=Math.pow(1+monthlyPost,m);
      recurringExpensePV+=expense/discount;retirementIncomePV+=income/discount;goalsPV+=goal/discount;monthlyFlows.push({m,age,expense,income,net,goal});if(m<12){firstYearExpenseTotal+=expense;firstYearIncomeTotal+=income;}
    }
    const baseCorpusPV=Math.max(0,recurringExpensePV-retirementIncomePV+goalsPV),safetyBufferAmount=baseCorpusPV*s.bufferRate/100,requiredCorpus=baseCorpusPV+safetyBufferAmount;
    const futureExisting=s.currentSavings*Math.pow(1+s.preReturn/100,s.retirementAge-s.currentAge),recurring=contributionSchedule(s.preReturn,s.retirementAge-s.currentAge,s.contributionFrequency),fvFactor=recurring.factor,futureCurrentContrib=s.currentMonthlyInvestment*Math.max(0,fvFactor),projectedCorpus=futureExisting+futureCurrentContrib,gap=Math.max(0,requiredCorpus-projectedCorpus);
    const gapBeforeContrib=Math.max(0,requiredCorpus-futureExisting),totalMonthlyNeeded=recurring.periods>0&&fvFactor>0?gapBeforeContrib/fvFactor:0,extraMonthlyNeeded=Math.max(0,totalMonthlyNeeded-s.currentMonthlyInvestment),fundedPct=requiredCorpus>0?(projectedCorpus/requiredCorpus)*100:100;
    const firstYearExpense=firstYearExpenseTotal/Math.max(1,Math.min(12,retirementMonths)),firstYearIncome=firstYearIncomeTotal/Math.max(1,Math.min(12,retirementMonths)),firstYearNet=Math.max(0,firstYearExpense-firstYearIncome);
    const currentTodayExpense=expenseAtAge(s.currentAge,s,false),retirementLifestyleToday=expenseAtAge(s.retirementAge,s,false),retirementLifestyleFuture=expenseAtAge(s.retirementAge,s,true);
    const expenseChanges=s.mode==='detailed'?s.expenses.map(exp=>{const today=detailedExpenseAtAge(exp,s.currentAge,s,false),retirement=detailedExpenseAtAge(exp,s.retirementAge,s,false),retirementFuture=detailedExpenseAtAge(exp,s.retirementAge,s,true);return{name:exp.name,amount:exp.amount,today,retirement,retirementFuture,change:retirement-today,rule:exp.rule,setting:exp.setting,inflationType:exp.inflationType};}).filter(x=>x.amount>0):[];
    const monthlyReduced=s.mode==='quick'?Math.max(0,currentTodayExpense-retirementLifestyleToday):expenseChanges.reduce((sum,x)=>sum+Math.max(0,x.today-x.retirement),0);
    const monthlyIncreased=s.mode==='quick'?Math.max(0,retirementLifestyleToday-currentTodayExpense):expenseChanges.reduce((sum,x)=>sum+Math.max(0,x.retirement-x.today),0);
    function simulatePortfolio(startBalance){let balance=Math.max(0,startBalance),depletionAge=null;const points=[{age:s.retirementAge,value:balance}];for(const flow of monthlyFlows){const beforeReturn=balance-flow.net-flow.goal;if(depletionAge===null&&beforeReturn<=0&&(flow.net+flow.goal)>0){depletionAge=flow.age;points.push({age:depletionAge,value:0,depletionPoint:true});}balance=Math.max(0,beforeReturn);if(balance>0)balance*=(1+monthlyPost);if((flow.m+1)%12===0||flow.m===monthlyFlows.length-1){const pointAge=Math.min(s.planningAge,s.retirementAge+(flow.m+1)/12);if(!points.some(p=>Math.abs(p.age-pointAge)<1e-9))points.push({age:pointAge,value:balance});}}points.sort((a,b)=>a.age-b.age);return{points,depletionAge};}
    const targetPortfolio=simulatePortfolio(requiredCorpus),currentPlanPortfolio=simulatePortfolio(projectedCorpus),portfolioPoints=targetPortfolio.points,currentPortfolioPoints=currentPlanPortfolio.points,projectedDepletionAge=currentPlanPortfolio.depletionAge;
    const expensePoints=[],spanYears=s.planningAge-s.currentAge,step=spanYears>55?2:1;for(let age=s.currentAge;age<=s.planningAge+1e-9;age+=step)expensePoints.push({age,value:expenseAtAge(age,s,true)});if(!expensePoints.some(p=>Math.abs(p.age-s.retirementAge)<.001))expensePoints.push({age:s.retirementAge,value:expenseAtAge(s.retirementAge,s,true)});expensePoints.sort((a,b)=>a.age-b.age);
    return{errors:[],s,requiredCorpus,baseCorpusPV,recurringExpensePV,retirementIncomePV,goalsPV,safetyBufferAmount,futureExisting,futureCurrentContrib,projectedCorpus,gap,totalMonthlyNeeded,extraMonthlyNeeded,fundedPct,contributionPeriods:recurring.periods,contributionPeriodsPerYear:recurring.ppy,firstYearExpense,firstYearIncome,firstYearNet,currentTodayExpense,retirementLifestyleToday,retirementLifestyleFuture,monthlyReduced,monthlyIncreased,expenseChanges,portfolioPoints,currentPortfolioPoints,projectedDepletionAge,expensePoints,monthlyFlows};
  }
  return Object.freeze({VERSION,FREQUENCY_PERIODS,effectiveMonthlyRate,contributionSchedule,inflationPct,lifestylePhaseMultiplier,detailedExpenseAtAge,expenseAtAge,incomeAtAge,goalFutureAmount,validateState,calculatePlan});
});
