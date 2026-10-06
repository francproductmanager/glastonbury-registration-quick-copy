// Home page visit counter. Kept apart from app.js, which still makes no network requests.
// This asks this same site's /api/visits for the total (see netlify/functions/visits.mjs).
// It sends no data: no cookies, no referrer, and nothing about anyone's group. The first
// home page view in a browser session counts as a visit; later views only read the total.
(() => {
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
  // app.js calls this after drawing a screen; only the home page has a .visit-count
  function fill(root) {
    if (!(root || document).querySelector(".visit-count")) return;
    load().then(() => {
      if (total == null) return; // no number rather than a wrong one
      for (const el of document.querySelectorAll(".visit-count")) el.textContent = `${total.toLocaleString("en-GB")} ${total === 1 ? "visit" : "visits"}`;
    });
  }
  window.GQCVisits = { fill };
})();
