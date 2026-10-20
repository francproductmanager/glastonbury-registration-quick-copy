// Home page visit counter. Kept apart from app.js, which still makes no network requests.
// This asks this same site's /api/visits for the total (see netlify/functions/visits.mjs).
// It sends no data: no cookies, no referrer, and nothing about anyone's group. The first
// home page view in a browser session counts as a visit; later views only read the total.
(() => {
  // Show the total on the home page? Visits are counted either way; the total can be read at
  // /api/visits. Hidden while the site is new and the number is small.
  const SHOW_TOTAL = false;
  let total = null, pending = null;
  function load() {
    if (pending) return pending;
    let first = true;
    try { first = !sessionStorage.getItem("tdqc:visit-counted"); sessionStorage.setItem("tdqc:visit-counted", "1"); } catch {}
    pending = fetch("/api/visits", { method: first ? "POST" : "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Number.isSafeInteger(d.count) && d.count > 0) total = d.count; })
      .catch(() => {});
    return pending;
  }
  // Counting waits until the page has loaded, so it never competes with the page itself
  const loaded = new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true })));
  // app.js calls this after drawing a screen; only the home page has a .visit-count
  function fill(root) {
    if (!(root || document).querySelector(".visit-count")) return;
    loaded.then(load).then(() => {
      if (total == null || !SHOW_TOTAL) return; // no number rather than a wrong one
      for (const el of document.querySelectorAll(".visit-count")) el.textContent = `${total.toLocaleString("en-GB")} ${total === 1 ? "visit" : "visits"}`;
    });
  }
  window.GQCVisits = { fill };
})();
