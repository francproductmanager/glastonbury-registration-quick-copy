#!/bin/sh
# Netlify build step for the guides site. It only fills in addresses; the pages are prebuilt.
#   URL      set by Netlify: this site's primary address (your custom domain once added)
#   APP_URL  set it in Netlify (Site configuration > Environment variables) to the tool's address
set -eu
SITE_URL="${URL:-}"
APP_URL="${APP_URL:-https://glastoquickcopy.netlify.app}"
find . -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) -exec sed -i "s#__SITE_URL__#${SITE_URL}#g" {} +
printf '/start %s/ 302\n' "${APP_URL%/}" > _redirects
