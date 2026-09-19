# Carrowmont Retirement Planner V2.4.0

Global-ready retirement planning web app for Carrowmont.

## V2.4.0
- Shared Carrowmont country/currency selector, using the same persistent region and currency preferences as the Inflation Calculator.
- Supports INR, USD, CAD, GBP, AUD, NZD, EUR, CNY, JPY, KRW, SGD, AED, SAR, CHF, BRL, MXN, ZAR, IDR, MYR, THB, PHP, VND, HKD, TWD, RUB and TRY.
- Money is formatted using the selected locale; Indian users retain lakh/crore compact formatting while other locales use their familiar compact notation.
- Country/currency selection changes formatting only: no FX conversion and no automatic country-specific inflation, return, tax, pension or retirement-account assumptions.
- Non-India first-time sessions start monetary example inputs at zero to avoid presenting India-sized sample amounts as dollars, pounds or other currencies.
- Existing saved retirement plans remain compatible.
- Core retirement calculation engine is unchanged from V2.3.1.

Deploy all files in this folder to the root of the existing `retirement-calculator` GitHub Pages repository.
