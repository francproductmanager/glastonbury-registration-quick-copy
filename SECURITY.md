# Security policy

People type their friends' registration numbers and postcodes into this site, so security reports are taken seriously.

## Reporting a problem

**Please don't open a public issue.** Instead, use GitHub's private reporting: go to the **Security** tab of this repository and click **Report a vulnerability**.

Please include:
- what the problem is and what an attacker could do with it
- steps to reproduce it, or a proof of concept
- the browser and device you used

You'll get a reply as soon as possible. This is a volunteer project, so please allow a few days.

## What's in scope

- Anything that lets data leave the browser (network requests, CSP bypasses)
- Script injection (XSS), including via crafted share links
- Ways for one person's saved pages to be read by someone else
- Any way for ad code from the guides site (`site/`) to run on, or read data from, the tool's address

## What's out of scope

- Someone reading a share link they were sent. Links are encoded, not encrypted, by design, and the site says so.
- Attacks that need an unlocked device or a malicious browser extension.
