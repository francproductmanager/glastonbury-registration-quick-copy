# Writer, fix run, 2026-10-30

Pull request #69 (`seo-agent/2026-10-30-am`), commit 0e99eff: reviewer a PASS, reviewer b FAIL (two points). First failed commit on this pull request.

## Point 1 (reviewer b): VPN sentence in the phone guide
Reviewer right. I downloaded NME's 2027 sell-out report and the 2025 sale FAQ in full. NME says buyers got "access restricted" messages "despite saying they were not using VPNs". The FAQ says "Refreshing the page, using multiple tabs or many devices can look like suspicious behaviour and can harm your chances of getting through by triggering anti-bot software", and doesn't mention VPNs (searched the whole page). No source I read supports "Don't use a VPN", so I removed it. The paragraph now says to stick to your normal connection, quotes the FAQ's three examples, and reports NME accurately (even buyers who said they weren't on a VPN got the message).

## Point 2 (reviewer b): Time Out credited with the general sale
Reviewer right. Time Out (2 October 2026) was written after the coach sale ("The Glastonbury coach sale took place on October 1") and couldn't report the general sale. NME covers the general sale: "Fans once again had to enter their registration details before accessing the virtual queue, with the same registration tied to a single queue position".
- Tips guide: the queue paragraph now credits Time Out for the coach sale (captcha, queue ID, only once, no multiple tabs or devices) and NME for the general sale.
- Checklist: "Time Out (coach sale) and NME (general sale) reported", and `NEWS.nme2027` added to its sources.
- Phone guide: the same split, since reviewer b flagged the attribution there too (table row 6).

## My own check of the whole pull request
Matched every other added or changed claim to a line in the info page, the 2025 sale FAQ or NME again today (registration reopening, email access, annual check, lock, suspension, Royal Mail late May to June, signature, tracking, lead booker, first name, separate balances, 7 days, mid-May coach vouchers, photo ID, responsibility to pay, bots cancelled, 10 minutes and back of the queue, 2025 times, dates, price and deposit). All found.

`check-sources.mjs --slug` on all 15 changed guides: 25 pages, 0 dead or moved, 5 blocked. Opened the blocked ones with curl: three See Tickets pages 403 (bot block), ITV no answer, WhatsApp 400. Can't tell they're gone, so left them. Build, personal data check and all 93 tests pass.

## Idea for the auditor
The queue guide (`how-the-ticket-queue-works`, not in this pull request) still says "Don't use a VPN. The anti-bot checks look for unusual connections." and credits Time Out alone for 2027 queue changes. Same problems as these two points: worth a backlog item.
