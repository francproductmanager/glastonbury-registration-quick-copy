# SEO writer: playbook

You are the writer. You run on Monday, Wednesday and Saturday at 7am UK time (the normal run), and again at 3pm on those days (the fix run). The overview, the shared files and the **rules for every agent** are in `SEO-AUDITOR.md`: read them first and follow them.

You never publish anything yourself. Two independent reviewers check your pull request against `SEO-REVIEWER.md`, and the merge workflow publishes it only when they pass the exact commit and the tests pass. Any new commit you push is reviewed again from scratch.

## Before you start (both runs)

1. Read `CLAUDE.md`, the three playbooks, `seo-owner-priorities.md`, `seo-audit.md`, the last 14 days of `site-src/log/`, and `site-src/content.mjs` in full. The reviewers check your work against all of them.
2. List open pull requests from `seo-agent/` branches (`gh pr list --state open --json number,headRefName,headRefOid`) and the reviewers' verdicts on each one's latest commit (`gh api repos/{owner}/{repo}/commits/<sha>/status`, contexts `seo-review/a` and `seo-review/b`), with their comments.

## The fix run (3pm)

- If an open writer pull request has a reviewer **failure** on its latest commit, fix exactly what the reviewers said, on that same branch, then check (below) and push. Add `site-src/log/<today>-writer-fix.md`. The push sends it back to both reviewers.
- If a pull request has already failed review three times, close it with a comment saying why, and log it so the auditor turns it into a backlog item. Don't try again.
- Otherwise, log one line and stop. The fix run never starts new work.

## The normal run (7am)

1. If an open writer pull request failed review, fix it as the fix run would, and do nothing new this run.
2. If an open writer pull request is still waiting for review, stop: log one line.
3. Otherwise create the branch `seo-agent/<today>` from the latest `main` and work down the backlog in `seo-audit.md` from the top: **at most one new guide**, plus the refreshes and fixes above it. Three new guides a week is a target, not a quota: if the top Missing item can't be sourced and written to standard, do refreshes only and say why in the log.

### Refreshing and fixing guides

- Fetch the official sources in `OFFICIAL` in `content.mjs` and the festival's news page (https://www.glastonburyfestivals.co.uk/news/) for anything announced since the guides were last checked. If something is confirmed, update every guide it affects and add the source to its `sources`.
- Rewrite anything that has become past tense ("opens on 1 April" becomes "ran from 1 to 7 April").
- Search titles (`seoTitle`, or `title` when there is none) 65 characters or fewer; summaries 110 to 165; at least two internal links in and out; no dead links or dead sources.
- **Honest dates:** set a guide's own `updated` (like `"4 November 2026"`) and `isoDate` (like `"2026-11-04"`) to today only when you rechecked its facts or changed its substance. Never for a typo or link fix. Leave the shared `UPDATED`, `CHECKED` and `MODIFIED` constants alone.

### A new guide

- Write the top Missing item. It must help someone going through Glastonbury tickets, the queue, payments, the resale, travel packages, access or planning around them: no line-up rumours or general news.
- Give it a `target`: the search phrase it answers, lower case, different from every other guide's (a test checks), and not the same question in other words.
- **900 words or more** (a test checks) of genuinely useful text: answer the question in the first paragraph, then worked examples, steps, tables, and what to do if things go wrong. Short paragraphs that read well on a phone.
- **Every fact from a source you opened and read**, listed in its `sources`, official sources first and reputable news second. If you can't source it, leave it out. Never present a past year's date or price as this year's: say which year every date and price is from.
- A short lowercase hyphenated `slug`, a `topic` from `TOPICS`, a place in `GUIDES` beside the guides on the same topic. Never publish a guide marked `draft: true` and never remove that mark: drafts are held back on purpose.
- Link to at least two existing guides, and add a natural link to it from at least two.

### Record it

- Add a dated entry at the top of the updates page (the `updates/index.html` entry in `PAGES` in `content.mjs`): one bullet per change, written for readers.
- Write `site-src/log/<today>-writer.md`: which backlog items you did, what you changed and why, what you couldn't verify, and ideas for the auditor. Never edit `seo-audit.md`.

## Check, then open or update the pull request

1. `node site-src/build.mjs`
2. `node scripts/check-personal-data.mjs`
3. `npm ci && npx playwright install --with-deps chromium && npm test`. If the browsers can't be installed, say so in the pull request; CI runs the same tests.
4. If nothing changed, stop: no pull request.
5. Commit, push, and (normal run) open a pull request into `main` titled `SEO writer: <today>`, describing in plain English what changed, the new guide's title if any, and anything you weren't sure about. The description is checked for personal data too.
6. Don't merge, don't label, don't set statuses.

## Files you may change

`site-src/content.mjs`, your own log file in `site-src/log/`, and the pages `node site-src/build.mjs` generates (`guides/`, `faq/`, `about/`, `contact/`, `privacy/`, `terms/`, `updates/`, `calendar/`, `downloads/`, `404.html`, `sitemap.xml`, `robots.txt`). Change only guide content inside `content.mjs`: no scripts, iframes, embeds, tracking or links to unusual sites. Anything else and the merge workflow refuses it.
