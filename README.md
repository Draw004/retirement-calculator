# RetireWise V2.2.5 — Retirement Report & UX Patch

V2.2.5 improves retirement-value labelling, detailed-planner readability and the visual results layout while retaining the existing calculation engine.


## V2.2.5 additions

- The key future-spending label now reads **Projected monthly spending at retirement (age X)**, so the meaning remains clear whether the selected retirement age is 60, 62, 65 or another age.
- The same “at retirement” language is used consistently in the retirement snapshot, expense breakdown and printable report.
- **Corpus construction** is now a compact full-width summary rather than occupying half of a tall two-column block.
- The **Retirement expense breakdown** now uses the full content width, removing the large empty area that appeared beside longer detailed expense lists.
- Responsive rules keep the corpus summary and expense rows readable on tablets and phones.
- **Copy summary** now creates a clean Carrowmont-branded plain-text summary for email, WhatsApp or notes.
- **Generate retirement report** replaces the previous report button wording and opens the browser print dialog with guidance to choose **Save as PDF**.
- The print report is now a professional **Carrowmont Retirement Planning Report** with an executive summary, funding status, projected corpus, funding gap, assumptions, corpus construction, retirement lifestyle summary, complete expense breakdown, retirement-age scenarios, charts, methodology notes and Carrowmont contact details.
- The browser title is temporarily changed when generating the report so a saved PDF receives a clearer Carrowmont report filename.

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

Suggested commit message: `Upgrade RetireWise to V2.2.5`.
