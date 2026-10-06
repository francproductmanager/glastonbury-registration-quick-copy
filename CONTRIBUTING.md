# Contributing

Thanks for wanting to help! This is a small, volunteer-run project, so please be patient with replies.

## Ways to help

- **Report a bug** or **suggest an idea**: open an [issue](../../issues/new/choose).
- **Fix something**: open a pull request (see below).
- **Security problem?** Please don't open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Ground rules

These keep the tool safe for everyone who types their friends' details into it. Pull requests that break them won't be merged.

**The tool** (repo root: `index.html`, `demo.html`, `app.js`, `style.css`, `fonts/`):

1. **The tool's code makes no network requests.** No analytics, trackers, CDNs, APIs, remote fonts or remote scripts. The only outside code is Google's AdSense loader, and ads only go in the named slots in `ads.js`. The Content Security Policy must keep `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` and `frame-ancestors 'none'`. Never use inline `style=""` attributes.
2. **No server-side storage.** Data stays in the browser and in share links only.
3. **No dependencies at runtime.** Plain HTML, CSS and JavaScript, no build step.
4. **Render user data as text.** Use `textContent` and the `h()` helper; never `innerHTML`, `eval` or `new Function`.
5. **Keep old share links working.** If you change the link format, add a new version byte and keep decoding the old ones.
6. **Never commit real registration numbers or postcodes**, not even in tests. Use made-up data.
7. **No em dashes, en dashes or middle dots** in anything we write. The tests check this.

**The guides and info pages** (`guides/`, `faq/`, `about/`, `contact/`, `privacy/`, `terms/`, `404.html`, `sitemap.xml`, `robots.txt`) are generated from `site-src/`. Edit `site-src/content.mjs`, run `node site-src/build.mjs` and commit both. Keep facts sourced and dated. **Ads** only go in named slots (`{ ad: "name" }` in content, `ad("name")` in `app.js`, listed in `ads.js`), and never next to the copy buttons.

The automated tests check several of these.

## Making a change

1. Fork the repo and create a branch from `main`.
2. Make your change. Keep pull requests small and focused on one thing.
3. Run the tests:
   ```sh
   npm install
   npx playwright install chromium
   npm test
   ```
4. Open a pull request and fill in the template. Screenshots help for visual changes.

Include screenshots for visual changes, since preview deploys are switched off for security.

## Code of conduct

Be kind and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
