// Links in site-src/content.mjs may only go to https: pages, mailto: addresses, paths on this
// site or anchors on the page. Anything else (javascript:, data:, http:, "//other.site") stops
// the build instead of being published. Used by build.mjs and checked by the tests.
export function safeUrl(u) {
  if (/^(https:\/\/|mailto:|\/(?!\/)|#)/i.test(u) && !/[\s\0-\x1f]/.test(u)) return u;
  throw new Error(`Unsafe link in site-src/content.mjs: ${JSON.stringify(u)}. Use https:, mailto:, a /path or a #anchor.`);
}
