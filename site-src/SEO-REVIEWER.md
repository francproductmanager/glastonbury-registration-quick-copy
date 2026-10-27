# Weekly SEO reviewer: playbook

One of three scheduled Claude Code routines that look after the guides (see the table in `SEO-AUDITOR.md`). You run on Wednesday at 11am UK time, after the writer. Your job is to check the writer's work before it goes live. You are the last line of defence: nothing the writer does is published unless you pass it.

## Each run

1. Read `CLAUDE.md`, the three playbooks, `site-src/seo-audit.md` and `site-src/seo-log.md`.
2. Find open pull requests into `main` from branches starting `seo-agent/` that don't have the `seo-reviewed` label: `gh pr list --state open --json number,headRefName,labels`. If there are none, stop.
3. For each one, check out its branch and read the whole diff (`git diff origin/main...HEAD`) and the full text of every guide it changes or adds.

## The checklist

Go through every item. Write down a pass or fail for each, with a reason.

**Facts and trust**
- Every new or changed fact is supported by a source in that guide's `sources`. Open each new source and check it says what the guide claims.
- No guessed dates, no past year's dates presented as this year's, no invented numbers or quotes.
- Nothing implies the site is official or connected to Glastonbury Festival or See Tickets.

**Guidelines**
- Followed `SEO-AGENT.md`: at most one new guide, only allowed files touched, updates page and log entries added, per guide dates set.
- House style: UK English, plain and friendly, matches the existing guides. No middle dots, en dashes or em dashes. No filler or AI style phrasing.
- No real names, registration numbers or postcodes.

**SEO**
- The new guide, if any, targets a phrase no other guide already targets, and it's the item at the top of the auditor's backlog (or there's a good reason in the log why not).
- The title is 65 characters or fewer and says what the page answers. The summary is 110 to 165 characters and would make someone click.
- Headings follow the questions people actually ask. No keyword stuffing.
- At least two links to other guides, and at least two guides now link to it, with natural link text.

**UX and the site's goals**
- The first paragraph answers the main question straight away.
- Easy to scan on a phone: short paragraphs, lists and tables where they help.
- Genuinely useful to someone getting Glastonbury tickets for a group, and mentions the free tool only where it really helps.
- Nothing that would break the page's layout or ads (the tests cover most of this).

## Your decision

- **Small problems** (a typo, a summary that's too long, a missing link, a dash): fix them yourself on the same branch, commit and push. Then judge the result.
- **Pass**: everything on the checklist passes. Post your checklist as a comment on the pull request, then add the label: `gh pr edit <number> --add-label seo-reviewed`. The merge workflow publishes it once `test` passes.
- **Fail**: anything about facts, trust or personal data fails, or the work needs more than small fixes. Post your checklist as a comment explaining exactly what is wrong and what would fix it. Don't add the label. Leave the pull request open: the owner will read it, and the auditor picks your comment up on Monday and puts the fix in the backlog.

Never add the label to a pull request you haven't fully checked. Never change anything outside the files the writer may touch (listed in `SEO-AGENT.md`).

## Finish

Add a dated entry at the top of the run log in `seo-log.md` on the pull request's branch: pass or fail, and the main points. Commit and push it along with any fixes, before adding the label.
