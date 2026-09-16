# RetireWise V2.1 - Smart Retirement Planner

A static, mobile-friendly retirement planning web app for GitHub Pages. No server, database, framework or API key is required.

## What is new in V2.1

V2.1 keeps the V2 cash-flow engine and adds a stronger results and reporting layer:

- Clear comparison of today's spending vs retirement lifestyle in today's purchasing power.
- Monthly costs removed/reduced and costs added/increased.
- Funding-status explanation based on the projected funding ratio.
- Corpus construction breakdown: recurring retirement expenses, retirement-income offset, one-time goals and safety buffer.
- Expense-change list showing which categories disappear, reduce or increase.
- Clickable retirement-age scenarios so users can switch to an earlier or later retirement age in one click.
- Dedicated print-ready Retirement Planning Report with assumptions, funding breakdown, expense changes, scenario comparison and charts.
- The report can be saved as PDF using the browser's Print / Save as PDF option.

## Core planner features

- Quick estimate mode: model the percentage of today's spending likely to remain after retirement.
- Detailed planner: each expense can continue/change, end at a chosen age, or start at retirement.
- Separate inflation assumptions for general, healthcare, lifestyle and education spending.
- Lifestyle phases for the first 10 years, next 10 years and later retirement.
- Pension, rental and annuity income can offset portfolio withdrawals.
- One-time retirement goals are added at the selected age and inflation-adjusted from today's value.
- Month-by-month retirement cash-flow model.
- Existing savings + current monthly retirement contributions are projected to retirement.
- Calculates modelled corpus, funding gap, total monthly contribution requirement and extra contribution versus the current plan.
- Expense timeline and retirement portfolio path.
- Save/load plan locally in the browser.

## Replace your existing GitHub Pages site

Your existing repository already contains `index.html`, `styles.css`, `app.js` and `README.md`.

1. Open your `retirement-calculator` repository on GitHub.
2. Choose **Add file -> Upload files**.
3. Upload the four V2.1 files from this folder.
4. Confirm replacement of the existing files and commit the changes.
5. Wait about 1-3 minutes for GitHub Pages to redeploy.
6. Refresh your existing live URL. You do not need a new repository or new Pages configuration.

## Calculation model

The detailed planner creates monthly cash flows from retirement age through the selected planning age.

For each expense, RetireWise starts from the user-entered amount in today's rupees, applies the selected inflation category, applies the retirement rule, and applies lifestyle-phase multipliers to categories tagged Lifestyle.

Retirement income is subtracted from expenses. One-time goals are inserted at the selected retirement month after being inflation-adjusted from today's value.

The estimated corpus is the amount required at retirement to fund those month-by-month net cash flows using the selected post-retirement return, plus the selected safety buffer.

The V2.1 corpus breakdown reports the recurring-expense present value, retirement-income offset, one-time-goal present value and safety buffer separately so the user can see how the target is constructed.

Existing savings and monthly contributions are projected to retirement using the selected pre-retirement return.

## Important limitation

The model uses constant assumptions and does not model taxes, investment fees, market volatility or sequence-of-returns risk. Actual inflation, returns, healthcare costs and longevity can differ materially. Results are educational planning estimates and are not investment, tax, legal or insurance advice.
