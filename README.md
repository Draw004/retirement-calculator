# RetireWise V2.2.3 — Retirement Breakdown & Mode Transparency Patch

V2.2.3 improves the detailed-planner audit trail and explains why Quick Estimate and Detailed Planner can legitimately produce different retirement corpus figures.

## What changed

- The on-screen **Retirement expense breakdown** now shows every entered expense with a positive monthly amount.
- Expenses are shown in the same order as the planner; unchanged, reduced, increased, starting and ending expenses are all retained.
- The previous seven-row display limit has been removed.
- Each expense now includes a plain-language retirement rule, such as “Ends at age 55”, “Reduced to 90%”, or “Continues at 100%”.
- The breakdown continues to show both retirement lifestyle in today’s rupees and the projected nominal amount at retirement in future rupees.
- Quick/Detailed mode now includes a visible explanation that the two modes use different assumptions and are not expected to match.
- The default **Travel & leisure** retirement setting has changed from 130% to 100%. Lifestyle-phase multipliers still apply, avoiding an unintentionally confusing default double uplift.
- The Detailed Planner explains that a Lifestyle expense’s retirement percentage and lifestyle-phase percentage are multiplied together.
- The printable retirement report now includes all detailed expenses and shows each expense’s rule/change.
- FAQ and Methodology pages have been updated to document these behaviours.

## Calculation model

The core cash-flow engine is unchanged. Detailed Planner still:

- creates monthly retirement cash flows;
- applies the selected inflation category to each expense;
- applies start/end/adjust retirement rules;
- applies lifestyle-phase multipliers to Lifestyle expenses;
- subtracts retirement income;
- adds one-time goals;
- discounts future retirement cash flows using the selected post-retirement return;
- applies the selected safety buffer; and
- compares the target with projected savings and monthly contributions.

Quick Estimate remains a simplified model using one retirement-spending percentage and one inflation rate. Therefore, a Quick result and a Detailed result can differ even when today’s total spending is the same.

## Updating GitHub Pages

Upload all files in this folder to the root of the existing `retirement-calculator` repository and commit the changes. GitHub Pages settings do not need to be changed.

Suggested commit message: `Upgrade to RetireWise V2.2.3`.
