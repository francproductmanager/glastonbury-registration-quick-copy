# Glasto Quick Copy

[![Tests](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/test.yml/badge.svg)](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/test.yml) [![Live site matches source](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/verify-live.yml/badge.svg)](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/verify-live.yml) [![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**Use the tool: https://glastoquickcopy.netlify.app/** ([try the demo](https://glastoquickcopy.netlify.app/demo.html))

Through the Glasto queue? Fill in your whole group in seconds. Put everyone's registration numbers and postcodes on one page before ticket day, then tap to copy and paste each one into the booking form.

> Not affiliated with Glastonbury Festival or See Tickets.

## How it works

1. **Paste your group chat.** Names, reg numbers and postcodes get picked out for you, and anyone missing a postcode is flagged.
2. **Send everyone the link.** It opens the same page on their phones. They see a preview and choose whether to save it.
3. **Tap, paste, next.** Each box goes blue once it's copied, the next one is highlighted, and a progress bar counts what's done. "Keep screen on" stops your phone locking while you book.

## Two sites, on purpose

This repo contains two separate websites:

| | The tool (repo root) | The guides site (`site/`) |
|---|---|---|
| What | The copy tool itself | Guides, FAQ, About, Privacy, Terms |
| Ads | **Never** | Google AdSense |
| Security policy | Strict: blocks every network request | Normal, so ads can load |
| Your group's data | Saved in your browser only | Not involved |

They live on **different web addresses**, for example `app.yourdomain.co.uk` and `yourdomain.co.uk`. Browsers keep each address's saved data separate, so ad code on the guides site can never read the groups saved in the tool. The tool's Netlify config also refuses to serve the guides site's files.

## Privacy (the tool)

- **Saved on your phone only.** Groups live in your browser's local storage. No accounts, no database.
- **It can't connect anywhere.** The Content Security Policy blocks every network request (`connect-src 'none'`), every external script, style and font.
- **Share links carry the data themselves.** First names, reg numbers and postcodes are packed into the part of the link after `#`, which browsers never send to a server. Surnames are left out. It's encoded, not encrypted, so only send it to your group.
- **Opening a link saves nothing** until you tap "Save to this phone".
- **Your clipboard.** Some keyboards, like Gboard, keep a clipboard history. You can clear it after ticket day.

## Is the live tool really running this code?

- **Automatic deploys only.** Netlify deploys the tool straight from `main`. Changes reach `main` only through pull requests that pass the tests.
- **The footer shows the running version**, linking to that exact commit.
- **A public check runs every 6 hours** and after every change. It downloads the live tool, compares every file byte for byte with the repo and checks the security headers. That's the "Live site matches source" badge above.
- **No build step.** The only change made at deploy time is the commit stamp (see `netlify.toml`).

Check it yourself:

```sh
git clone https://github.com/francproductmanager/glastonbury-registration-quick-copy
cd glastonbury-registration-quick-copy
git checkout <version shown in the tool's footer>
bash scripts/verify-live.sh
```

## Project structure

| Path | What it is |
|---|---|
| `index.html`, `demo.html` | The tool's pages (the demo uses made-up people and saves nothing) |
| `app.js` | All the tool's logic: screens, import parser, local storage, copy boxes, share links |
| `style.css`, `fonts/` | Styles and self-hosted fonts (Newsreader, Instrument Sans, IBM Plex Mono, all OFL) |
| `netlify.toml` | The tool's hosting config and security headers |
| `site-src/` | Content and generator for the guides site |
| `site/` | The generated guides site, plus its own `netlify.toml`, `ads.txt` and `deploy.sh` |
| `tests/` | Automated browser tests for both sites |
| `scripts/verify-live.sh` | Checks the live tool matches the repo |

### Share link format

Links look like `/#/s/<code>`. The code is a small binary format, base64url-encoded: a version byte, then per person a first name, the reg number as a 5-byte integer and the postcode packed at 6 bits per character. Older formats still open. Details are in the comments in `app.js`.

## Running it locally

```sh
npx serve .        # the tool
npx serve site     # the guides site
```

After editing `site-src/content.mjs`, rebuild the guides site:

```sh
node site-src/build.mjs
```

## Tests

The tests drive both sites in a headless browser: every screen and action, the import parser, copy states, wake lock, share links, validation, corrupted data, malicious input, the security policy and the guides site's AdSense requirements.

```sh
npm install
npx playwright install chromium
npm test
```

They also run on every pull request.

## Setting up the guides site and your domain

1. Buy a domain, for example `yourdomain.co.uk`.
2. **Tool:** in the existing Netlify site, add the custom domain `app.yourdomain.co.uk`.
3. **Guides site:** in Netlify, add a new site from this repo with **base directory** `site`. Give it the domain `yourdomain.co.uk`. Under Environment variables, set `APP_URL` to `https://app.yourdomain.co.uk`.
4. In the tool's `app.js`, set `GUIDES_URL` to `https://yourdomain.co.uk/` so the tool links to the guides.
5. In AdSense, add `yourdomain.co.uk`, then turn on Google's consent message under **Privacy and messaging** for the UK, EEA and Switzerland.

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem privately, see [SECURITY.md](SECURITY.md).

## About

Made by a product manager (not a developer) who got fed up copy-pasting registration numbers on ticket day. Built with the help of AI coding tools.

## Licence

The code is [MIT](LICENSE). The fonts are under the SIL Open Font License (see `fonts/`).
