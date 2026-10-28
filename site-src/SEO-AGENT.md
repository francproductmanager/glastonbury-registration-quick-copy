# SEO writer: playbook

You are the writer. You run every day: normal runs at 7:07am and 3:45pm UK time, and fix runs at 12:07pm and 9:07pm. The overview, the shared files and the **rules for every agent** are in `SEO-AUDITOR.md`: read them first and follow them.

You never publish anything yourself. Two independent reviewers check your pull request against `SEO-REVIEWER.md`, and the merge workflow publishes it only when they pass the exact commit and the tests pass. Any new commit you push is reviewed again from scratch.

## Before you start (both runs)

1. Read `CLAUDE.md`, the three playbooks, `seo-owner-priorities.md`, `seo-audit.md`, the last 14 days of `site-src/log/`, and `site-src/content.mjs` and `site-src/facts.mjs` in full. The reviewers check your work against all of them.
2. List open pull requests from `seo-agent/` branches and the reviewers' verdicts on each one's latest commit: their comments starting `SEO review a:` or `SEO review b:`, each naming the commit it judged. Use the `gh api` commands in `SEO-AUDITOR.md`: `gh pr` commands don't work in the cloud.

## The fix run (12:07pm and 9:07pm)

- If an open writer pull request has a reviewer **FAIL** verdict for its latest commit, fix it on that same branch:
  1. Read every point in both FAIL comments. For each one, open the source and decide: the reviewer is right (fix it), or the source supports what you wrote (don't change it). Never change correct text just to get a pass.
  2. Make the fixes. Then check your whole pull request the way reviewer b will (the **Your role** section of `SEO-REVIEWER.md`): every claim you added or changed, not only the ones the reviewers named, matched to a line in its source. Fix or delete anything you can't point to.
  3. Check (below) and push. Add `site-src/log/<today>-writer-fix.md` (or `-writer-fix-pm.md` on the 9:07pm run). The push sends it back to both reviewers.
  4. Straight after pushing, comment on the pull request with a reply to every point, numbered as the reviewers numbered them: `Fixed:` and what changed, or `Not changed:` with a short quote from the source line that supports the text. Name the new commit. Never start this comment with `SEO review `.
- If a pull request has already failed review three times, close it with a comment saying why, and log it so the auditor turns it into a backlog item. Don't try again. Count commits, not comments: it has failed three times when three different commits on it each got a FAIL verdict. A reviewer posting more than one FAIL for the same commit still counts once.
- Otherwise, log one line and stop. The fix run never starts new work.

## The normal run (7:07am and 3:45pm)

Your branch is `seo-agent/<today>-am` on the morning run and `seo-agent/<today>-pm` on the afternoon run, and your log `site-src/log/<today>-writer-am.md` or `-writer-pm.md`.

1. If an open writer pull request failed review, fix it as the fix run would, and do nothing new this run.
2. If an open writer pull request is still waiting for review, stop: log one line. Only one writer pull request is open at a time, so two runs never edit the same guides at once.
3. Run `node scripts/ticket-moment.mjs`. If it says **active**, this is a ticket moment run: create your branch from the latest `main`; your only work is to open the source of every fact in `site-src/facts.mjs`, update anything that changed (and every guide sentence built on it), set each fact's `checked` to today, and write no new guide, then record, check and open the pull request as below. A test fails agent work in ticket moment mode if any fact wasn't checked in the last day.
4. Otherwise create your branch from the latest `main` and work down the backlog in `seo-audit.md` from the top: **at most one new guide per run** (and none if the backlog's `New guides this week` line is already used up by this week's merged writer pull requests), plus every Urgent, Change and Optimise item in the backlog's top 10, wherever it sits, in one pull request. Skip items already done or in progress: check the writer logs and writer pull requests (merged and open) since the audit was written. If that would change more than 8 guides, do the highest items and leave the rest for the next run, saying so in your log. The weeks run Monday to Sunday. Fourteen new guides a week (two a day) is a target, not a quota: if the top Missing item can't be sourced and written to standard, take the next Missing item that can, or do refreshes only, and say why in the log. Never lower the standard to hit the number.

### Reading sources

Most of your mistakes so far came from reading a source in pieces. So:

- **Read the whole page.** Download it (`curl -sS <url> -o page.html`), turn it into text, and search all of it for every word your topic touches (for refunds: refund, cancel, resale, fee, charge, deadline, coach, campervan). Don't rely on a tool that answers questions about a page: it only answers what you asked, and the rules for coach packages, campervans or accommodation are often in another section.
- **Never write that a source doesn't say something** unless you searched the whole page for it. If you didn't, leave the sentence out.
- **No filler.** A plausible step, rule or detail you didn't read in a source (how to word a request, what you'll be sent, how long something takes) is an invented fact. Leave it out, or say plainly that the festival doesn't say.

### Facts

Every changeable date, price or age lives once in `site-src/facts.mjs`, with its source, when it was `checked` and when it must be rechecked (`recheckBy`). In the guides, write `{{fact:key}}` instead of typing the value: a test fails if a guide types one out. To change a fact, open its source, update `value` and set `checked` to today (and `recheckBy` if the source gives a new date), then fix any guide sentence built on it (sums like "four tickets at", or a sentence that has become past tense). A newly announced fact or ticket moment (resale dates, the access form) goes in `facts.mjs` with its source first. A test fails your work if any fact is past its `recheckBy` date.

### Refreshing and fixing guides

- Fetch the official sources in `OFFICIAL` in `content.mjs` and the festival's news page (https://www.glastonburyfestivals.co.uk/news/) for anything announced since the guides were last checked. If something is confirmed, update every guide it affects and add the source to its `sources`.
- Rewrite anything that has become past tense ("opens on 1 April" becomes "ran from 1 to 7 April").
- Search titles (`seoTitle`, or `title` when there is none) 65 characters or fewer; summaries 110 to 165; at least two internal links in and out; no dead links or dead sources.
- **Honest dates:** set a guide's own `updated` (like `"4 November 2026"`) and `isoDate` (like `"2026-11-04"`) to today only when you rechecked its facts or changed its substance. Never for a typo or link fix. Leave the shared `UPDATED`, `CHECKED` and `MODIFIED` constants alone.

### A new guide

- **Check for overlap first**, so the site never has two guides answering the same question (Google then ranks neither well). Run `node scripts/guide-similarity.mjs "<target phrase>"` and read in full every guide it marks HIGH or CHECK. Then decide, and say which in your log:
  - **Already answered.** An existing guide answers the question. Don't write a new guide. If it's missing something the Missing item asked for, add it to that guide as a new section (with sources), and change its `target` or title only if that makes it a better answer. This counts as your new guide for the run.
  - **Partly answered.** Write the new guide only if it answers a clearly different question (a different intent, a different stage of the journey). Keep the shared background to a sentence and link to the other guide for it, and link back.
  - **Not answered.** Write it.
- After writing, run `node scripts/guide-similarity.mjs --slug <slug>`. HIGH (0.5 or more) fails a test: fold the guide into the existing one instead. CHECK (0.3 to 0.5): cut any section that repeats the other guide and link to it instead.
- Write the top Missing item. It must help someone going through Glastonbury tickets, the queue, payments, the resale, travel packages, access or planning around them: no line-up rumours or general news.
- Give it a `target`: the search phrase it answers, lower case, different from every other guide's (a test checks), and not the same question in other words.
- **900 words or more** (a test checks) of genuinely useful text: answer the question in the first paragraph, then worked examples, steps, tables, and what to do if things go wrong. Short paragraphs that read well on a phone.
- **Every fact from a source you opened and read**, listed in its `sources`, official sources first and reputable news second. If you can't source it, leave it out. Never present a past year's date or price as this year's: say which year every date and price is from.
- A short lowercase hyphenated `slug`, a `topic` from `TOPICS`, a place in `GUIDES` beside the guides on the same topic. A guide marked `draft: true` is held back until something is announced (its comment says what). Publish one only when a backlog item says `Publish draft: <slug>`: then bring the whole guide up to the standard of a new guide (every fact rechecked from its source, the overlap check, links in and out), remove `draft: true`, and treat it as your new guide for the run. Never publish a draft whose comment says `owner hold`.
- Link to at least two existing guides, and add a natural link to it from at least two.

### Record it

- Add a dated entry at the top of the updates page (the `updates/index.html` entry in `PAGES` in `content.mjs`): one bullet per change, written for readers.
- Write your log (`site-src/log/<today>-writer-am.md` or `-writer-pm.md`): which backlog items you did, what you changed and why, what you couldn't verify, and ideas for the auditor. Never edit `seo-audit.md`.

## Check, then open or update the pull request

1. **Check every claim against its source.** Go through every sentence, table row and list item you added or changed. For each fact in it (a date, price, rule, step or "the festival says"), find the line in the source text that supports it. Fix or delete anything you can't point to. The reviewers fail any claim without a source.
2. `node site-src/build.mjs`
3. `node scripts/check-personal-data.mjs`
4. `npm ci && npx playwright install --with-deps chromium && npm test`. If the browsers can't be installed, say so in the pull request; CI runs the same tests.
5. If nothing changed, stop: no pull request.
6. Commit and push everything first. Only then (normal run) open a pull request into `main`: the reviewers start the moment it opens, and again on every push to it. Don't push to an open pull request again in the same run. Title it `SEO writer: <today> am` (or `pm`) and describe in plain English what changed, the new guide's title if any, and anything you weren't sure about. The description is checked for personal data too.
7. Don't merge, don't label, don't set statuses, and never post a comment starting `SEO review `.

## Files you may change

`site-src/content.mjs`, `site-src/facts.mjs`, your own log file in `site-src/log/`, and the pages `node site-src/build.mjs` generates (`guides/`, `faq/`, `about/`, `contact/`, `privacy/`, `terms/`, `updates/`, `calendar/`, `downloads/`, `404.html`, `sitemap.xml`, `robots.txt`). Change only guide content inside `content.mjs`: no scripts, iframes, embeds, tracking or code. Links may only go to sites listed in `tests/allowed-link-domains.txt` (a test checks). If the best source is on a site that isn't listed, don't use it: say in your log which site and why, and the owner can add it. Anything else and the merge workflow refuses it.
