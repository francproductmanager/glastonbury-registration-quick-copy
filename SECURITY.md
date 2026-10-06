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

- Anything that makes the tool's own code send data out of the browser
- Script injection (XSS), including via crafted share links
- Ways for one person's saved pages to be read by someone else
- Bypasses of the protections the security policy keeps (`object-src`, `base-uri`, `form-action`, `frame-ancestors`)

## What's out of scope

- Google's ad code itself. The site shows Google AdSense ads, so Google's ad script runs on the site's pages, as on any site with Google ads. Report problems with it to Google.
- Someone reading a share link they were sent. Links are encoded, not encrypted, by design, and the site says so.
- Attacks that need an unlocked device or a malicious browser extension.
