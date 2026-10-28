// The home page's "Latest" guides and countdown. Kept apart from app.js, which still makes no
// network requests. This reads /updates/latest.json, a plain file on this site that
// `node site-src/build.mjs` writes from the updates page, so the list moves on by itself whenever
// a guide is added or changed. It sends no data: no cookies, no referrer, nothing about anyone's
// group. Everything is drawn as text, so nothing in the file can run as code.
(() => {
  let data = null;
  const pending = fetch("/updates/latest.json", { credentials: "omit", referrerPolicy: "no-referrer" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => { if (d && Array.isArray(d.items) && d.items.length) data = d; })
    .catch(() => {});

  const el = (tag, cls, ...kids) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const k of kids) if (k != null) e.append(k);
    return e;
  };
  const isDay = (s) => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s);
  // Only links to the guides on this site
  const isGuide = (s) => typeof s === "string" && /^\/guides\/[a-z0-9-]+\/$/.test(s);
  // A date like "2026-10-28" as a local day (midnight), so day counts don't depend on the hour
  const dayOf = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysFrom = (a, b) => Math.round((b - a) / 864e5);
  const fmt = (d, opts) => d.toLocaleDateString("en-GB", opts);
  function when(s) {
    const ago = daysFrom(dayOf(s), today());
    return ago === 0 ? "Today" : ago === 1 ? "Yesterday" : fmt(dayOf(s), { day: "numeric", month: "short" });
  }
  // "1 to 7 April 2027", or "23 June 2027" for a single day
  function range(a, b) {
    const s = dayOf(a), e = dayOf(b);
    if (a === b) return fmt(e, { day: "numeric", month: "long", year: "numeric" });
    return `${fmt(s, s.getMonth() === e.getMonth() ? { day: "numeric" } : { day: "numeric", month: "long" })} to ${fmt(e, { day: "numeric", month: "long", year: "numeric" })}`;
  }

  function story(item, lead) {
    return el("a", lead ? "story story-lead" : "story",
      el("span", "story-meta",
        el("span", item.tag === "New" ? "tag tag-new" : "tag", item.tag === "New" ? "New" : "Updated"),
        el("span", "story-date", when(item.date)),
        lead && typeof item.topic === "string" ? el("span", null, item.topic) : null),
      el("span", "story-title", String(item.title)),
      lead && typeof item.summary === "string" ? el("span", "story-sum", item.summary) : null);
  }
  function countdown(dates) {
    const now = today();
    const rows = dates.filter(d => d && typeof d.title === "string" && isDay(d.start) && isDay(d.end) && dayOf(d.end) >= now).slice(0, 3).map(d => {
      const left = daysFrom(now, dayOf(d.start));
      return el("div", "cd-row",
        left > 0 ? el("span", "cd-num", String(left), el("span", "cd-unit", left === 1 ? " day" : " days")) : el("span", "cd-num cd-now", "Now"),
        el("span", "cd-what", el("span", "cd-title", d.title), el("span", "cd-date", range(d.start, d.end))));
    });
    if (!rows.length) return null;
    const keyDates = el("a", "cd-link", "All the 2027 key dates");
    keyDates.href = "/guides/glastonbury-2027-key-dates/";
    return el("aside", "countdown", el("p", "cd-cap", "Countdown"), ...rows, keyDates);
  }
  function draw(box) {
    const items = data.items.filter(i => i && isGuide(i.href) && typeof i.title === "string" && isDay(i.date));
    if (!items.length) return;
    const links = items.map((item, i) => { const a = story(item, i === 0); a.href = item.href; return a; });
    const list = el("ul", "story-list", ...links.slice(1).map(a => el("li", null, a)));
    const meta = box.querySelector(".latest-meta");
    if (meta && isDay(data.updated)) {
      const ago = daysFrom(dayOf(data.updated), today());
      meta.replaceChildren(el("span", "live-dot"), `Guides updated ${ago === 0 ? "today" : ago === 1 ? "yesterday" : "on " + fmt(dayOf(data.updated), { day: "numeric", month: "long", year: "numeric" })}`);
    }
    box.querySelector(".latest-feed").replaceChildren(links[0], list);
    const cd = Array.isArray(data.dates) ? countdown(data.dates) : null;
    box.querySelector(".latest-countdown").replaceChildren(...(cd ? [cd] : []));
    box.hidden = false;
  }
  // app.js calls this after drawing a screen; only the home page has a .latest section
  function fill(root) {
    const box = (root || document).querySelector(".latest");
    if (box) pending.then(() => { if (data && box.isConnected) draw(box); });
  }
  window.GQCLatest = { fill };
})();
