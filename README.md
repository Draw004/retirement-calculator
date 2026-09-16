# RetireWise V2.2 — Website Readiness Release

This package is a static website designed to replace the current GitHub Pages files in the `retirement-calculator` repository.

## What changed in V2.2

- New public home page (`index.html`)
- Retirement calculator moved to `planner.html`
- Dedicated pages: How it works, Methodology, About, FAQ, Financial Disclaimer, Privacy, Terms, Contact
- Improved desktop/mobile navigation and footer
- Cleaner planner hero and results explanation
- Empty advertising placeholder removed from the public experience
- SEO titles/descriptions/canonical tags
- `sitemap.xml` and `robots.txt`
- Disabled Google Analytics configuration placeholder (`site-config.js`)
- Search Console verification placeholder documented in the page `<head>` comments
- 404 page

## Important deployment change

Because the calculator now lives at `planner.html`, upload **all files in this package**, not only the old four files. GitHub Pages will still use `index.html` as the home page.

## Publish on GitHub Pages

1. Open the existing `retirement-calculator` repository.
2. Choose **Add file → Upload files**.
3. Upload every file from this folder (or extract the ZIP and drag all files).
4. Commit with a message such as `Upgrade to RetireWise V2.2`.
5. Wait 1–3 minutes, then refresh the existing GitHub Pages URL with Ctrl+F5.
6. Do not change the Pages branch/root settings.

## Google Analytics (not active by default)

Open `site-config.js` and change:

```js
GA_MEASUREMENT_ID: ""
```

to your future Google Analytics measurement ID, for example `G-XXXXXXXXXX`. Only do this after you intentionally choose to use Analytics and review the privacy/consent requirements that apply to your launch.

## Google Search Console

When Search Console gives you an HTML meta verification tag, paste it into the `<head>` of each page where the comment says `SEARCH CONSOLE`. For a custom domain, DNS verification is often easier because it covers the whole domain.

## Before commercial launch

- Choose and verify the permanent brand/domain.
- Replace the beta GitHub contact route with a business email.
- Have Privacy, Terms and Disclaimer reviewed for your actual business model, especially before enabling analytics, ads, accounts, payments, adviser referrals or storing financial data.
- Re-run calculator validation tests after any formula change.

The site is educational and does not provide investment, tax, legal or insurance advice.
