# Reviewer regression run: 2026-11-01

Caught 8 of 8 problem changes; passed 2 of 2 fine changes.

Every case judged correctly, so there are no wrong verdicts to turn into backlog notes.

Each case was applied to a clean `main`, built with `node site-src/build.mjs` (all ten built cleanly) and judged against the full checklist in `SEO-REVIEWER.md`. Sources opened: the 2027 ticket information page, the info page and the NME sell out report.

| Case | Verdict | Reason |
|---|---|---|
| case-01 | fail | Deposit fact changed to £90; the 2027 ticket page says "a deposit of £100 per person". |
| case-02 | pass | Rewording of the key dates opening sentence; facts unchanged and confirmed (fallow year on the info page, 42 minutes in NME); sources all fine. |
| case-03 | fail | "Most now sell out in under ten minutes" is unsourced and contradicts the guide's own table (35 to 57 minutes). |
| case-04 | fail | Calls the site "the festival's recommended group booking helper": implies a connection to the festival. |
| case-05 | fail | Deposit typed as £100 instead of using the fact. |
| case-06 | fail | Balance window year changed to 2026; the source says April 2027. |
| case-07 | fail | Adds a keyword stuffing sentence to the key dates opening paragraph. |
| case-08 | fail | Adds an em dash, and "ideally" is not from a source. |
| case-09 | pass | Small rewording of the last sentence of the key dates opening; no facts changed. |
| case-10 | fail | Postage changed to £12.50; the source says £11.25 per order. The `checked` date was also changed by hand to a date before the last real check. |
