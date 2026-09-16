# RetireWise – Retirement Corpus Calculator

A static, mobile-friendly retirement calculator that can be hosted on any normal web host. No database or server is required for this first version.

## What it calculates

- Years remaining until retirement
- Monthly expenses at retirement after inflation
- Inflation-adjusted retirement corpus using a monthly growing-withdrawal model
- Future value of existing retirement savings
- Remaining retirement corpus gap
- Estimated monthly investment needed to close the gap
- Optional safety buffer

## Formula notes

1. Future monthly expense = current monthly expense × (1 + annual inflation) ^ years to retirement.
2. Retirement corpus is modeled as a monthly growing annuity due. The first monthly withdrawal occurs at retirement, withdrawals rise with inflation, and the remaining corpus earns the post-retirement return.
3. Existing savings grow at the assumed pre-retirement return.
4. Monthly investment is the regular end-of-month contribution required to fund the remaining gap at the assumed pre-retirement return.

This is an educational planning model, not investment advice. It does not model taxes, pension income, sequence-of-return risk, fees, irregular cash flows or product-specific features.

## Run locally

Open `index.html` directly, or from this folder run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Put it online

### Easiest route: GitHub Pages
1. Create a GitHub account and a new repository.
2. Upload `index.html`, `styles.css`, and `app.js`.
3. In the repository settings, enable Pages from the main branch.
4. Connect a custom domain when ready.

### Other easy hosts
The same folder can be deployed on Cloudflare Pages, Netlify, Vercel, or nearly any shared web host.

## Monetization placeholders

The page intentionally includes:
- an advertisement placeholder below the hero area;
- a monetization CTA block below the calculator.

Possible revenue models:
- display ads after the site develops meaningful traffic;
- sponsored financial-education placements;
- paid premium calculators/reports;
- newsletter or membership;
- lead generation for appropriately licensed professionals, subject to applicable law and platform rules.

Before monetizing personalized financial recommendations or regulated financial products, obtain appropriate legal/compliance advice for the markets you serve.

## Rebranding

Search the files for `RetireWise` and replace it with your chosen brand. Update the page title, description, logo letter and footer.

## Recommended next version

- optional pension/EPF/NPS income;
- one-time retirement goals (travel, child's education, home, medical reserve);
- step-up SIP calculation;
- downloadable PDF retirement report;
- save/share via URL;
- charts showing corpus depletion by age;
- email capture and premium report;
- analytics and consent management;
- admin-editable assumptions and content.
