# Contributing

Thanks for wanting to help! This is a small, volunteer-run project, so please be patient with replies.

## Ways to help

- **Report a bug** or **suggest an idea**: open an [issue](../../issues/new/choose).
- **Fix something**: open a pull request (see below).
- **Security problem?** Please don't open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Ground rules

These keep the site safe for everyone who types their friends' details into it. Pull requests that break them won't be merged:

1. **No network requests.** No analytics, trackers, fonts, CDNs, APIs or remote scripts. The Content Security Policy keeps `connect-src 'none'` and `script-src 'self'`.
2. **No server-side storage.** Data stays in the browser and in share links only.
3. **No dependencies at runtime.** Plain HTML, CSS and JavaScript, no build step.
4. **Render user data as text.** Use `textContent` and the `h()` helper; never `innerHTML`, `eval` or `new Function`.
5. **Keep old share links working.** If you change the link format, add a new version byte and keep decoding the old ones.
6. **Never commit real registration numbers or postcodes**, not even in tests. Use made-up data.

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

Every pull request gets a Netlify preview link so changes can be tried on a phone before merging.

## Code of conduct

Be kind and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
