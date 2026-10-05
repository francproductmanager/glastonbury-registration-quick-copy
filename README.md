# Glastonbury Registration Quick Copy

[![Tests](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/test.yml/badge.svg)](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/test.yml) [![Live site matches source](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/verify-live.yml/badge.svg)](https://github.com/francproductmanager/glastonbury-registration-quick-copy/actions/workflows/verify-live.yml) [![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

**Use it now → https://glastoquickcopy.netlify.app/** · [See the demo](https://glastoquickcopy.netlify.app/demo.html)

A tiny web page for Glastonbury ticket day. Put your group's registration numbers and postcodes on one page, then tap each one to copy it straight into the ticket site. No more scrolling back through the group chat while the clock runs.

> Not affiliated with Glastonbury Festival or See Tickets.

## How it works

1. **Create your page.** Add up to 6 people: name, registration number and postcode.
2. **On ticket day, tap to copy.** Each number and postcode is a big button. Tap it, paste it into the ticket site, and it turns green so you know who's done.
3. **Share with your group.** Copy the link at the bottom of your page and send it to your friends. It opens the same page on their phones, ready to use.

## Privacy

- **Nothing is stored on a server.** Pages are saved in your browser's local storage, on your device only. There are no accounts and no database.
- **The site can't send your data anywhere.** Its Content Security Policy blocks every network request (`connect-src 'none'`).
- **Share links carry the data themselves.** The group's first names, registration numbers and postcodes are packed into the part of the link after `#`, which browsers never send to the server. Surnames are left out.
- **Share links are encoded, not encrypted.** Anyone who has a link can read it, so only send it to your group, like you would the numbers themselves.
- **Your phone's clipboard may remember what you copy.** Some keyboards (for example Gboard on Android) keep a short clipboard history, so copied numbers can stay there for a while. You can clear it from the keyboard's clipboard menu after ticket day.

## Is the live site really running this code?

Yes, and you don't have to take my word for it:

- **Automatic deploys only.** The live site is deployed by Netlify straight from the `main` branch of this repo. Changes reach `main` only through pull requests that pass the tests.
- **The footer shows the running version.** Every page shows "running version `abc1234`", linking to that exact commit here on GitHub.
- **A public check runs every 6 hours** and after every change. It downloads the live site and compares each file, byte for byte, with the repo, and checks the security headers. The result is the **"Live site matches source"** badge at the top of this page; click it to see every run.
- **No build step.** The files in the repo are the files you get. The only thing changed at deploy time is the commit stamp in the footer (see `netlify.toml`).

### Check it yourself

```sh
git clone https://github.com/francproductmanager/glastonbury-registration-quick-copy
cd glastonbury-registration-quick-copy
git checkout <version shown in the site's footer>
bash scripts/verify-live.sh
```

Or skip trusting the hosted site entirely and [run your own copy](#running-it-locally). It's just a few static files.

## Project structure

It's a plain static site: no framework, no build step, no dependencies at runtime.

| File | What it does |
|---|---|
| `index.html` | The app shell |
| `demo.html` | Same app, loaded with made-up example data |
| `app.js` | All the logic: pages, local storage, copy buttons, share links |
| `style.css` | Styles (light and dark mode) |
| `netlify.toml` | Hosting config and security headers |
| `tests/` | Automated browser tests |
| `scripts/verify-live.sh` | Checks the live site matches the repo |

### Share link format

Links look like `/#/s/<code>`. The code is a small binary format, base64url-encoded:

- byte 0: format version
- per person: name length + UTF-8 first name, one byte holding the reg-number digit count and postcode length, the reg number as a 5-byte integer, then the postcode packed at 6 bits per character

Older link formats still open. Full details are in the comments in `app.js`.

## Running it locally

Any static file server works:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tests

The tests run the real app in a headless browser. They check that share links round-trip exactly, that malformed data and links don't break the page, that injected scripts never run, and that the page can't make network requests.

```sh
npm install
npx playwright install chromium
npm test
```

They also run automatically on every pull request.

## Contributing

Ideas, bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem privately, see [SECURITY.md](SECURITY.md).

## About

Made by a product manager (not a developer) who got fed up copy-pasting registration numbers on ticket day. Built with the help of AI coding tools.

## Licence

[MIT](LICENSE)
