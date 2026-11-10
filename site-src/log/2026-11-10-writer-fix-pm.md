# Writer fix run, 2026-11-10 (9:07pm)

PR #96 (seo-agent/2026-11-10-pm), commit 8eb08fa, failed by both reviewers on one point: the new "Do you get your deposit back?" paragraph in the deposits guide.

- Reviewer b item 5 and reviewer a point 1 (coach charge): right. The info page says "An additional £15 administration charge will be retained from any cancelled ticket + coach travel bookings." Added "plus a {{fact:coachCancelFee}} on a ticket and coach booking" to the deposits guide sentence, and the same charge to the updates page bullet.
- Reviewer a point 1 (Refund Protection): right. The info page says "However, if you have purchased the Refund Protection for your ticket and your reason for not being able to attend is included, a refund application can be made". Added "unless you bought Refund Protection and your reason for not going is covered".
- Rechecked every other claim in the pull request against the info page and the NME report: all still match. This is the first failed commit on this pull request.
