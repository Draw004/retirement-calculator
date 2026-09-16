# RetireWise V2 - Smart Retirement Planner

A static, mobile-friendly retirement planning web app for GitHub Pages. No server, database, framework or API key is required.

## What changed in V2

- Quick estimate mode: model the percentage of today's spending likely to remain after retirement.
- Detailed planner: each expense can continue/change, end at a chosen age, or start at retirement.
- Separate inflation assumptions for general, healthcare, lifestyle and education spending.
- Lifestyle phases for the first 10 years, next 10 years and later retirement.
- Pension, rental and annuity income can offset portfolio withdrawals.
- One-time retirement goals are added at the selected age and inflation-adjusted from today's value.
- Month-by-month retirement cash-flow model.
- Existing savings + current monthly retirement contributions are projected to retirement.
- Calculates modelled corpus, funding gap, total monthly contribution requirement and extra contribution versus the current plan.
- Expense timeline, portfolio path and retirement-age scenario comparison.
- Save/load plan locally in the browser.
- Print / Save PDF through the browser's print dialog.

## Replace your existing GitHub Pages site

Your existing repository already contains `index.html`, `styles.css`, `app.js` and `README.md`.

1. Open your `retirement-calculator` repository on GitHub.
2. Choose **Add file -> Upload files**.
3. Upload the four V2 files from this folder.
4. GitHub will warn that files with the same names already exist; continue so the uploaded versions replace them in the new commit.
5. Scroll down and click **Commit changes**.
6. Wait about 1-3 minutes for GitHub Pages to redeploy.
7. Refresh your existing live URL. You do not need a new repository or Pages configuration.

## Calculation model

The detailed planner creates monthly cash flows from retirement age through the selected planning age.

For each expense, RetireWise:

1. Starts from the user-entered amount in today's rupees.
2. Applies the inflation rate assigned to that category from current age to each future month.
3. Applies the retirement rule (continue/change, end at age, or start at retirement).
4. Applies lifestyle-phase multipliers only to categories tagged Lifestyle.

Retirement income is subtracted from expenses. One-time goals are inserted in the selected retirement month after being inflated from today's rupees.

The required corpus is the present value at retirement of those monthly net cash flows using the selected post-retirement return, plus the chosen safety buffer.

Existing savings and monthly contributions are projected to retirement using the selected pre-retirement return.

## Important limitation

The model assumes fixed inflation and fixed investment returns. Actual returns and inflation vary, taxes are not modelled, and sequence-of-returns risk can materially affect outcomes. The app is an educational planning tool, not financial advice.
