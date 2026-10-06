# Glasto Quick Copy

[![Tests](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/test.yml/badge.svg)](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/test.yml) [![Live site matches source](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/verify-live.yml/badge.svg)](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/verify-live.yml) [![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**Use the tool: https://glastobolt.co.uk/** ([try the demo](https://glastobolt.co.uk/demo.html), [guides](https://glastobolt.co.uk/guides/))

Through the Glasto queue? Fill in your whole group in seconds. Put everyone's registration numbers and postcodes on one page before ticket day, then tap to copy and paste each one into the booking form.

> Not affiliated with Glastonbury Festival or See Tickets.

## How it works

1. **Add your group.** Everyone's reg numbers and postcodes, together on one page. You can type them in or paste them from a message, and anyone missing a postcode is flagged.
2. **Send everyone the link.** It opens the same page on their phones. They see a preview and choose whether to save it.
3. **Tap, paste, next.** Each box goes blue once it's copied, the next one is highlighted, and a progress bar counts what's done. "Keep screen on" stops your phone locking while you book.

## Privacy

- **Saved on your phone only.** Groups live in your browser's local storage. No accounts, no database.
- **The tool's code never sends your group anywhere.** `app.js` makes no network requests (the tests check this).
- **The site shows Google ads.** That keeps it free. Like any site with Google ads, Google's ad code runs on its pages, and Google uses cookies to show and measure ads (with a consent message in the UK, EEA and Switzerland). Ads only appear in fixed slots, never next to the copy buttons. See the [privacy policy](https://glastobolt.co.uk/privacy/).
- **Security policy.** Because of the ads, the Content Security Policy allows Google's ad servers. It still blocks plugins, `<base>` hijacking and form submissions, and stops other sites embedding the pages.
- **Share links carry the data themselves.** First names, reg numbers and postcodes are packed into the part of the link after `#`, which browsers never send to a server. Surnames are left out. It's encoded, not encrypted, so only send it to your group.
- **Opening a link saves nothing** until you tap "Save to this phone".
- **Your clipboard.** Some keyboards, like Gboard, keep a clipboard history. You can clear it after ticket day.

## Is the live tool really running this code?

- **Automatic deploys only.** Netlify deploys the tool straight from `main`. Changes reach `main` only through pull requests that pass the tests.
- **The footer shows the running version**, linking to that exact commit.
- **A public check runs every 6 hours** and after every change. It downloads the live site, compares every file byte for byte with the repo and checks the security headers. That's the "Live site matches source" badge above.
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
| `ads.js` | The ad slots and their AdSense ad unit IDs (see below) |
| `style.css`, `guides.css`, `fonts/` | Styles and self-hosted fonts (Newsreader, Instrument Sans, IBM Plex Mono, all OFL) |
| `guides/`, `faq/`, `about/`, `contact/`, `privacy/`, `terms/`, `404.html`, `sitemap.xml`, `robots.txt` | Guides and info pages, generated from `site-src/` |
| `site-src/` | Content (`content.mjs`) and generator (`build.mjs`) for those pages |
| `ads.txt` | Google's AdSense publisher line |
| `netlify.toml` | Hosting config and security headers |
| `tests/` | Automated browser tests |
| `scripts/verify-live.sh` | Checks the live site matches the repo |

### Share link format

Links look like `/#/s/<code>`. The code is a small binary format, base64url-encoded: a version byte, then per person a first name, the reg number as a 5-byte integer and the postcode packed at 6 bits per character. Older formats still open. Details are in the comments in `app.js`.

## Running it locally

```sh
npx serve .
```

After editing `site-src/content.mjs`, rebuild the guides and info pages:

```sh
node site-src/build.mjs
```

## Tests

The tests drive the site in a headless browser: every screen and action, the import parser, copy states, wake lock, share links, validation, corrupted data, malicious input, the security policy, the ad slots and AdSense's requirements.

```sh
npm install
npx playwright install chromium
npm test
```

They also run on every pull request.

## Ads

Ads only appear in **named slots** that we place page by page. Google never places ads anywhere else, so keep **Auto ads switched off** in AdSense for this site.

| Slot | Where |
|---|---|
| `home-end` | Home: after the questions |
| `create-end` | Paste screen: below the Create button |
| `editor-end` | Add or edit people: below Save |
| `group-between` | Ticket day: between one person and the next (5 for a group of 6), each in its own dashed, labelled panel with extra space around it |
| `group-end` | Ticket day: at the very bottom, below sharing and Edit/Delete |
| `data-end` | How your data is handled: at the bottom |
| `guide-top`, `guide-mid`, `guide-end` | Each guide: after the intro, halfway through, before Related guides |
| `guides-end` | Guides list: at the bottom |
| `faq-mid`, `faq-end` | FAQ: halfway down, and at the bottom |
| `about-end` | About: at the bottom |

There are no ads on Privacy, Terms, Contact or the 404 page.

Every slot currently uses the **"Standard"** responsive display unit (`2945530362`). To give a slot its own unit (for separate reporting, or another format), create it in AdSense under **Ads > By ad unit** and put its `data-ad-slot` number next to the slot in `ads.js`. A slot set to `""` stays hidden, and a slot whose ad doesn't load takes up no space.

**Consent:** in AdSense, under **Privacy and messaging**, publish Google's consent message for the UK, EEA and Switzerland (the option with Consent, Do not consent and Manage options).

## Domain

The site's address is **glastobolt.co.uk** (canonical links and the sitemap use it; change `SITE.url` in `site-src/content.mjs` and `link rel="canonical"` in `index.html` if it moves). In Netlify it's added under Domain management and set as the primary domain, so `glastoquickcopy.netlify.app` and `www` redirect to it.

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem privately, see [SECURITY.md](SECURITY.md).

## About

Made by a product manager (not a developer) who got fed up copy-pasting registration numbers on ticket day. Built with the help of AI coding tools.

## Licence

The code is [MIT](LICENSE). The fonts are under the SIL Open Font License (see `fonts/`).
