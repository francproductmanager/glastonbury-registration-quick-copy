# Weekly SEO writer: playbook

One of three scheduled Claude Code routines that look after the guides (see the table in `SEO-AUDITOR.md`). You are the writer and run every Wednesday at 7am UK time. You work through the auditor's backlog, improve the guides, write at most one new guide, and open a pull request. The reviewer checks it at 11am. Only if the reviewer passes it and the `test` check passes does `.github/workflows/seo-agent-merge.yml` merge it, and Netlify then puts it live. Nobody's laptop needs to be on.

To change how any agent behaves, edit its playbook through a pull request. The routines always read the latest versions on `main`.

## Before you start

1. Read `CLAUDE.md`, the three playbooks (`SEO-AUDITOR.md`, this file, `SEO-REVIEWER.md`), `site-src/seo-audit.md`, `site-src/seo-log.md` and `site-src/content.mjs` in full. The reviewer will check your work against all of them.
2. Look for open pull requests from `seo-agent/` branches that the reviewer failed (`gh pr list --state open`). If there is one, read the reviewer's comment: fixing that work comes before anything new. Push the fixes to that same branch, remove nothing the reviewer passed, and skip the steps below except checking and recording.
3. Today's date: run `date -u +%Y-%m-%d`. Use it for the branch name, the log and any dates you write.
4. Create a branch called `seo-agent/<today>` from `main`.
5. Work through the backlog in `seo-audit.md` from the top, as far as one run sensibly allows (usually the top two or three items, at most one of them a new guide). The steps below say how.

## What to do each run, in this order

### 1. SEO health check (always)

Fix the Optimise items at the top of the backlog, and anything else you notice:

- Guide titles over 65 characters, or summaries (used as the meta description) under 110 or over 165 characters.
- Two guides targeting the same search phrase. Make them distinct rather than deleting either.
- Guides with fewer than two links to other guides, or guides no other guide links to.
- Internal links pointing to a slug that doesn't exist.
- Source links that are dead. Check each one with a quick fetch. Replace a dead link with the current official page, or remove the fact it supported.

The build and tests already check the sitemap, canonical links, word counts and ad slots, so don't hand edit those.

### 2. Refresh what's out of date (always)

- Fetch the official sources in `OFFICIAL` in `content.mjs` and the festival's news page (https://www.glastonburyfestivals.co.uk/news/). Look for anything announced since the date at the top of `content.mjs`: resale dates, registration reopening, access forms, coach news, price changes.
- If something new is confirmed, update every guide it affects (the key dates guide first), and add the source to that guide's `sources`.
- Rewrite anything that has become past tense. For example "the balance window opens on 1 April" becomes "the balance window ran from 1 to 7 April" once it has happened.
- For each guide you change, set that guide's own `updated` (like `"4 November 2026"`) and `isoDate` (like `"2026-11-04"`) to today. Leave the shared `UPDATED`, `CHECKED` and `MODIFIED` constants alone unless you really did recheck every guide.

### 3. One new guide (only if worth it)

Add at most one new guide per run, and only if there is a real question people search for that the site doesn't answer yet. Take the highest Missing item in the backlog in `seo-audit.md`. Only pick something else if that item turns out to be unsourceable, and say why in the log. Skip this step if nothing is good enough: no guide is better than a thin one.

A new guide must:

- Help a real person going through Glastonbury tickets, the queue, payments, the resale, travel packages, access or planning around them. Stay in that niche: no line-up rumours, no general festival news.
- Have 900 words or more of genuinely useful text: worked examples, steps, tables, what to do if things go wrong.
- Get every fact from a source in its `sources` list, official sources first and reputable news second. If you can't source a fact, leave it out. Never present a guessed or past year's date as this year's.
- Use a short lowercase hyphenated `slug` matching the search phrase, and a `topic` from `TOPICS`.
- Link to at least two existing guides, and add a link to it from at least two existing guides where it genuinely helps the reader.
- Sit in `GUIDES` next to the guides on the same topic.

### 4. Record it

- Add a dated entry at the top of the updates page (the `updates/index.html` entry in `PAGES` in `content.mjs`): one bullet per change, written for readers.
- Add a dated entry at the top of the run log in `seo-log.md`: which backlog items you did, what you changed and why, and anything you couldn't verify. Don't edit `seo-audit.md`: the auditor marks items done. Put new ideas in your log entry for the auditor.

## House style

- UK English, plain and friendly, second person. Short paragraphs. Match the tone of the existing guides.
- **No middle dots, en dashes or em dashes**, anywhere. Use commas, colons, brackets or full stops. A test fails the build otherwise.
- No filler ("in today's fast paced world", "it's important to note", "dive into"), no keyword stuffing, no made up statistics or quotes.
- Never imply the site is official. It is not affiliated with Glastonbury Festival or See Tickets.
- Never put a real person's name, registration number or postcode anywhere. Examples use only the made up values in `scripts/check-personal-data.mjs`.

## What you may change

Only these files, or the pull request will not be merged automatically:

- `site-src/content.mjs` and `site-src/seo-log.md`
- The pages that `node site-src/build.mjs` generates: `guides/`, `faq/`, `about/`, `contact/`, `privacy/`, `terms/`, `updates/`, `404.html`, `sitemap.xml`, `robots.txt`

Don't touch the tool (`index.html`, `demo.html`, `app.js`), the ads, styles, tests, scripts, workflows, `netlify.toml`, this playbook or anything else. If you think one of those needs changing, say so in the log and the pull request instead.

## Check, then open the pull request

1. `node site-src/build.mjs`
2. `node scripts/check-personal-data.mjs`
3. `npm ci && npx playwright install --with-deps chromium && npm test`. If the browsers can't be installed in your environment, say so in the pull request; CI runs the same tests and nothing merges unless they pass.
4. If nothing changed at all, stop: no branch, no pull request.
5. Commit with a clear message, push the branch and open a pull request into `main`. Title: `SEO agent: <today>`. Description, in plain English for a non developer: what changed, the new guide's title if there is one, and anything you weren't sure about. The description is checked for personal data too.
6. Don't merge it and don't add any label. The reviewer checks it at 11am; it is only published once the reviewer adds the `seo-reviewed` label and `test` passes.
