# Weekly SEO auditor: playbook

One of three scheduled Claude Code routines that look after the guides. Each starts fresh, with no memory of the others' reasoning: they share only the files in this repo.

| When (UK time) | Agent | Playbook | Can publish? |
|---|---|---|---|
| Monday 7am | Auditor | this file | No: it only updates the audit |
| Wednesday 7am | Writer | `SEO-AGENT.md` | Only after the reviewer passes it |
| Wednesday 11am | Reviewer | `SEO-REVIEWER.md` | No: it approves or blocks |

Your job is to keep `site-src/seo-audit.md` a complete, honest picture of the site's content, and to turn it into a prioritised backlog the writer works from. You don't change any page.

## Each run

1. Read `CLAUDE.md`, the three playbooks, `site-src/seo-audit.md`, `site-src/seo-log.md` and `site-src/content.mjs` in full. Get today's date with `date -u +%Y-%m-%d`.
2. **Check what changed since last week.** Read the writer's and reviewer's latest log entries and the merged pull requests (`git log --since="8 days ago" --oneline`). Mark finished backlog items as done, with the date.
3. **Audit every guide**, and the FAQ, and update its row in the inventory table:
   - The search phrase it targets, and the searcher's intent (know, do, or decide).
   - Word count, last checked date, number of internal links in and out.
   - Title length (aim for 65 characters or fewer) and summary length (110 to 165 characters).
   - Whether its facts are still current, checked against the official sources in `content.mjs` and the festival's news page.
   - Overlap with another guide on the same phrase (cannibalisation).
   - UX: does it answer the question in the first paragraph, is it easy to scan, does it point to the tool where that genuinely helps, and does it read well on a phone.
   - A health score: Good, Needs work or Urgent.
4. **Look for gaps.** Think through what someone goes through from registration to arriving at the festival, and the questions they'd type into Google at each stage. List those the site doesn't answer. Use the festival's announcements and the seasonal calendar: what will people be searching for in the next six weeks?
5. **Rewrite the backlog**, highest priority first, at most 10 items. Each item has a type (Missing, Change or Optimise), the guide or new slug, what exactly to do, why it matters for searchers, and the source to use. Put anything time sensitive (a newly announced date, a sale coming up) at the top.
6. Add a short dated entry at the top of the run log in `seo-log.md` saying what you audited and the biggest findings.

## Priorities, in order

1. Wrong or out of date facts. These damage trust and can cost people tickets.
2. Searches coming up soon (before a sale, the balance window or the resale).
3. Missing answers to common questions.
4. Weak pages: thin, hard to scan, or competing with another guide.
5. Small SEO tidying: titles, summaries and links.

## Rules

- Same house style as the other playbooks: UK English, **no middle dots, en dashes or em dashes**, no personal data.
- Only change `site-src/seo-audit.md` and `site-src/seo-log.md`. Anything else and the pull request won't merge automatically.
- Be specific and honest. "Rewrite intro" is useless; "the first paragraph doesn't say when the resale is; lead with the date" is useful. If something can't be verified, say so.

## Finish

1. `node scripts/check-personal-data.mjs`
2. Create the branch `seo-audit/<today>`, commit, push and open a pull request into `main` titled `SEO audit: <today>`, with a plain English summary of the top three backlog items. Don't merge it: the merge workflow does once `test` passes.
