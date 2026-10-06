# Notes for AI coding sessions

- **Never put real people's registration numbers, postcodes or names in the repo**: not in code, tests, docs, commit messages or PR text. Use the made-up values listed in `scripts/check-personal-data.mjs`. If a user pastes real details into the chat (for example a WhatsApp export to debug the parser), use them only to try things locally, then write tests with made-up values in the same shape.
- Run `node scripts/check-personal-data.mjs` before committing. CI runs it on every PR (files, new commits and the PR description) and blocks the merge if it fails.
- No middle dots, en dashes or em dashes anywhere (a test checks this).
- Every change goes through a pull request; `main` is protected and needs the `test` check.
- The owner is a product manager, not a developer. Explain things plainly.
