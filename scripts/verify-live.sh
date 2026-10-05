#!/usr/bin/env bash
# Checks that the live site is serving exactly the files in this repo, at the expected commit.
#   bash scripts/verify-live.sh            # expects the commit you have checked out
#   TRIES=20 bash scripts/verify-live.sh   # wait up to ~10 min for a deploy to finish
set -euo pipefail

SITE="${SITE:-https://glastoquickcopy.netlify.app}"
EXPECT="$(git rev-parse HEAD)"
TRIES="${TRIES:-1}"
FILES=(index.html demo.html app.js style.css robots.txt)
tmp="$(mktemp -d)"

# 1. Which commit is live? (stamped into <meta name="source-commit"> at deploy time)
for attempt in $(seq 1 "$TRIES"); do
  live="$(curl -fsSL "$SITE/index.html?v=$RANDOM" | sed -n 's/.*name="source-commit" content="\([^"]*\)".*/\1/p')"
  if [ "$live" = "$EXPECT" ]; then break; fi
  if [ "$attempt" = "$TRIES" ]; then
    echo "::error::The live site is running ${live:-an unknown version}, expected $EXPECT"
    exit 1
  fi
  echo "Live site is on ${live:-?}, waiting for $EXPECT to deploy ($attempt/$TRIES)..."
  sleep 30
done
echo "✓ Live site is running commit $EXPECT"

# 2. Every file must be byte-for-byte identical to the repo (apart from the commit stamp)
fail=0
for f in "${FILES[@]}"; do
  curl -fsSL "$SITE/$f?v=$RANDOM" -o "$tmp/$f"
  case "$f" in *.html) sed -i "s/content=\"$EXPECT\"/content=\"__COMMIT_REF__\"/" "$tmp/$f" ;; esac
  if cmp -s "$f" "$tmp/$f"; then
    echo "✓ $f is identical to the repo"
  else
    echo "::error::$f on the live site differs from the repo"
    diff "$f" "$tmp/$f" | head -20 || true
    fail=1
  fi
done

# 3. The security headers must be in place
headers="$(curl -fsSI "$SITE/")"
if grep -qi "^content-security-policy:.*connect-src 'none'" <<<"$headers"; then
  echo "✓ Security policy header blocks all network requests"
else
  echo "::error::The Content-Security-Policy header is missing or has changed"
  fail=1
fi

exit "$fail"
