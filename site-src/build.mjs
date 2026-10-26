// Builds the guides, FAQ and info pages into the site root from site-src/content.mjs.
//   node site-src/build.mjs
// The output is committed, so Netlify serves plain files exactly as they are in the repo.
// The tool itself (index.html, demo.html, app.js) is hand-written and never touched here.
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, PAGES, GUIDES as ALL_GUIDES, TOPICS, CALENDAR, CALENDAR_FEED, DOWNLOADS, LASTMOD } from "./content.mjs";
import { safeUrl } from "./safe-url.mjs";

// A guide marked draft: true is kept in content.mjs but not published, so it can wait for the
// festival's own announcement and go live by deleting one line.
const GUIDES = ALL_GUIDES.filter((g) => !g.draft);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = ROOT;
const URL_ = SITE.url;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inline markup allowed in content: **bold** and [text](url). Everything else is escaped.
// Every link must pass safeUrl (see safe-url.mjs), or the build stops.
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => {
      const external = /^https:/i.test(safeUrl(u));
      return `<a href="${u}"${external ? ' rel="noopener"' : ""}>${t}</a>`;
    });
}
function blocks(list) {
  return list.map((b) => {
    if (typeof b === "string") return `<p>${inline(b)}</p>`;
    if (b.h2) return `<h2 id="${b.id || slug(b.h2)}">${inline(b.h2)}</h2>`;
    if (b.h3) return `<h3>${inline(b.h3)}</h3>`;
    if (b.ul) return `<ul>${b.ul.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`;
    if (b.ol) return `<ol>${b.ol.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`;
    if (b.tip) return `<aside class="tip"><p>${inline(b.tip)}</p></aside>`;
    // a message to copy into a group chat
    if (b.msg) return `<blockquote class="msg"><p>${inline(b.msg)}</p></blockquote>`;
    // a checklist people can tick on screen or print (nothing is saved)
    if (b.checks) return `<ul class="checks">${b.checks.map((x) => `<li><label><input type="checkbox"> <span>${inline(x)}</span></label></li>`).join("")}</ul>`;
    if (b.img) return `<figure class="shot"><img src="${esc(safeUrl(b.img.src))}" width="${+b.img.width}" height="${+b.img.height}" alt="${esc(b.img.alt)}" loading="lazy"><figcaption>${inline(b.img.caption)}</figcaption></figure>`;
    if (b.chart) return chart(b.chart);
    // a short silent clip of the tool; the caption says what it shows for anyone who can't watch it
    if (b.video) return `<figure class="shot"><video src="${esc(safeUrl(b.video.src))}" poster="${esc(safeUrl(b.video.poster))}" width="${+b.video.width}" height="${+b.video.height}" controls muted playsinline preload="none"></video><figcaption>${inline(b.video.caption)}</figcaption></figure>`;
    // links to the calendar files built from CALENDAR
    if (b.calendar) return `<ul class="cal-links">${b.calendar.map((id) => { const e = CALENDAR.find((c) => c.id === id); if (!e) throw new Error("unknown calendar entry " + id); return `<li><a href="/calendar/${e.id}.ics" download>Add to calendar: ${esc(e.title)}</a></li>`; }).join("")}</ul>`;
    if (b.table) return `<div class="table-wrap"><table><thead><tr>${b.table.head.map((x) => `<th scope="col">${inline(x)}</th>`).join("")}</tr></thead><tbody>${b.table.rows.map((r) => `<tr>${r.map((x, i) => (i ? `<td>${inline(x)}</td>` : `<th scope="row">${inline(x)}</th>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
    if (b.faq) return `<div class="faq-list">${b.faq.map(([q, a]) => `<details class="faq"><summary><span>${inline(q)}</span><span class="faq-sign" aria-hidden="true"></span></summary>${(Array.isArray(a) ? a : [a]).map((x) => `<p>${inline(x)}</p>`).join("")}</details>`).join("")}</div>`;
    if (b.cta) return `<p class="cta"><a class="btn btn-primary" href="${esc(safeUrl(b.href || "/#/new"))}">${inline(b.cta)}</a></p>`;
    if (b.ad) return `<div class="ad-slot" data-slot="${esc(b.ad)}"></div>`;
    if (b.cards) return `<div class="cards">${b.cards.map((g) => `<a class="gcard" href="/guides/${g.slug}/"><span class="gtitle">${inline(g.title)}</span><span class="gsum">${inline(g.summary)}</span></a>`).join("")}</div>`;
    throw new Error("unknown block " + JSON.stringify(b));
  }).join("\n");
}
// A horizontal bar chart drawn as inline SVG, so it needs no script. Colours come from guides.css.
function chart({ title, unit, rows, note }) {
  const W = 360, label = 112, bar = 24, gap = 12, top = 6, max = Math.max(...rows.map((r) => r[1]));
  const H = top + rows.length * (bar + gap);
  const scale = (v) => Math.round(((W - label - 92) * v) / max);
  const bars = rows.map(([name, v, shown], i) => {
    const y = top + i * (bar + gap);
    return `<text class="c-label" x="${label - 10}" y="${y + bar / 2 + 5}" text-anchor="end">${esc(name)}</text><rect class="c-bar" x="${label}" y="${y}" width="${scale(v)}" height="${bar}" rx="4"/><text class="c-value" x="${label + scale(v) + 8}" y="${y + bar / 2 + 5}">${esc(shown || `${v} ${unit}`)}</text>`;
  }).join("");
  return `<figure class="chart"><svg viewBox="0,0,${W},${H}" role="img" aria-label="${esc(title)}: ${esc(rows.map(([n, v, shown]) => `${n}, ${shown || `${v} ${unit}`}`).join("; "))}">${bars}</svg><figcaption>${inline(title)}${note ? `. ${inline(note)}` : ""}</figcaption></figure>`;
}
// iCalendar files: one per date in CALENDAR, so readers can add a deadline to their own calendar,
// and one feed with every date, which calendar apps that subscribe to it check for new dates.
const icsText = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
function vevent({ id, title, start, end, allDay, description }) {
  // timed entries are given in UTC (a trailing Z), so no time zone block is needed
  const when = allDay ? [`DTSTART;VALUE=DATE:${start.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${end.replace(/-/g, "")}`] : [`DTSTART:${start}`, `DTEND:${end}`];
  return ["BEGIN:VEVENT", `UID:${id}@${URL_.replace(/^https:\/\//, "")}`, `DTSTAMP:${LASTMOD.replace(/-/g, "")}T000000Z`, ...when,
    `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(description)}`, `URL:${URL_}/guides/glastonbury-2027-key-dates/`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${icsText(title)}`, "END:VALARM", "END:VEVENT"];
}
function ics(events, name) {
  const fold = (line) => line.match(/.{1,74}/g).join("\r\n ");
  const head = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${SITE.name}//Glastonbury dates//EN`, "CALSCALE:GREGORIAN"];
  if (name) head.push(`X-WR-CALNAME:${icsText(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:P1D", "X-PUBLISHED-TTL:P1D");
  return [...head, ...events.flatMap(vevent), "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
// An Atom feed of the updates page, for anyone who follows sites in a feed reader
function atom(page) {
  const entries = [];
  for (const b of page.body) {
    if (b.h2) entries.push({ title: b.h2, id: slug(b.h2), items: [] });
    else if (b.ul && entries.length) entries[entries.length - 1].items.push(...b.ul);
  }
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const iso = (t) => { const [d, m, y] = t.split(" "); return `${y}-${String(MONTHS.indexOf(m) + 1).padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`; };
  const abs = (html) => html.replace(/href="\//g, `href="${URL_}/`);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${esc(SITE.name)}: site updates</title>
<link href="${URL_}${page.path}feed.xml" rel="self"/>
<link href="${URL_}${page.path}"/>
<id>${URL_}${page.path}</id>
<updated>${iso(entries[0].title)}</updated>
<author><name>${esc(SITE.name)}</name></author>
${entries.map((e) => `<entry><title>${esc(e.title)}</title><id>${URL_}${page.path}#${e.id}</id><link href="${URL_}${page.path}#${e.id}"/><updated>${iso(e.title)}</updated><content type="html">${esc(abs(`<ul>${e.items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`))}</content></entry>`).join("\n")}
</feed>
`;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Search results show about 60 characters of a title, so the site name is added only when it
// fits, and never twice. A page can give a shorter seoTitle for the <title> than its heading.
const SUFFIX = ` | ${SITE.name}`;
function pageTitle(title) {
  if (title.length > 60) throw new Error(`title over 60 characters, give it a shorter seoTitle: ${title}`);
  return title.includes(SITE.name) || title.length + SUFFIX.length > 60 ? title : title + SUFFIX;
}
function layout({ path, title, seoTitle, description, body, updated, jsonld }) {
  const full = pageTitle(seoTitle || title);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${URL_}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${path.startsWith("/guides/") && path !== "/guides/" ? "article" : "website"}">
<meta property="og:url" content="${URL_}${path}">
<meta name="theme-color" content="#fbfaf6">
<meta name="google-adsense-account" content="${SITE.adsenseClient}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%93%8B%3C/text%3E%3C/svg%3E">
<link rel="preload" href="/fonts/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/guides.css">
<script src="/ads.js" defer></script>
${path === "/updates/" ? `<link rel="alternate" type="application/atom+xml" title="${esc(SITE.name)} updates" href="/updates/feed.xml">\n` : ""}${/class="(msg|checks)"/.test(body) ? '<script src="/guides.js" defer></script>\n' : ""}${jsonld ? [].concat(jsonld).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>\n`).join("") : ""}</head>
<body>
<header class="site-head">
  <div class="wrap head-row">
    <a class="wordmark" href="/">${esc(SITE.name)}</a>
    <nav aria-label="Main">
      <a href="/guides/">Guides</a>
      <a href="/faq/">FAQ</a>
      <a class="nav-cta" href="/">Open the tool</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body}
${updated ? `<p class="updated">Last checked ${esc(updated)}. Ticket rules can change from year to year, so always confirm on the official Glastonbury and See Tickets websites.</p>` : ""}
</main>
<footer class="site-foot">
  <div class="wrap">
    <nav aria-label="Footer">
      <a href="/guides/">Guides</a>
      <a href="/faq/">FAQ</a>
      <a href="/about/">About</a>
      <a href="/updates/">Updates</a>
      <a href="/contact/">Contact</a>
      <a href="/privacy/">Privacy and cookies</a>
      <a href="/terms/">Terms</a>
    </nav>
    <p>${esc(SITE.name)} (${esc(URL_.replace(/^https:\/\//, ""))}) is an independent, free project. It is not affiliated with, endorsed by or connected to Glastonbury Festival or See Tickets.</p>
  </div>
</footer>
</body>
</html>
`;
}

function write(rel, html) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// Clean only what this script generates. Never the tool's own index.html.
for (const d of ["guides", "faq", "about", "contact", "privacy", "terms", "updates", "calendar", "downloads"]) if (existsSync(join(OUT, d))) rmSync(join(OUT, d), { recursive: true });
for (const f of ["404.html", "sitemap.xml", "robots.txt"]) if (existsSync(join(OUT, f))) rmSync(join(OUT, f));
for (const p of PAGES) if (p.file === "index.html") throw new Error("index.html is the tool; content pages can't use it");

// [path, last modified date or null]
const urls = [["/", null]];
for (const g of GUIDES) if (!TOPICS.some(([id]) => id === g.topic)) throw new Error(`guide ${g.slug} has unknown topic ${g.topic}`);
for (const p of PAGES) {
  const jsonld = p.faqSchema ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: p.faqSchema.map(([q, a]) => ({ "@type": "Question", name: q.replace(/\*\*|\[|\]\(.*?\)/g, ""), acceptedAnswer: { "@type": "Answer", text: (Array.isArray(a) ? a.join(" ") : a).replace(/\*\*/g, "").replace(/\[(.+?)\]\((.+?)\)/g, "$1") } })),
  } : null;
  const body = `<article class="page">\n<h1>${inline(p.h1 || p.title)}</h1>\n${p.lead ? `<p class="lead">${inline(p.lead)}</p>\n` : ""}${blocks(p.body)}\n</article>`;
  write(p.file, layout({ path: p.path, title: p.title, seoTitle: p.seoTitle, description: p.description, body, updated: p.updated, jsonld }));
  if (p.path !== "/404") urls.push([p.path, LASTMOD]);
}
for (const g of GUIDES) {
  const path = `/guides/${g.slug}/`;
  const [, topicName] = TOPICS.find(([id]) => id === g.topic);
  const jsonld = [
    { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.summary, dateModified: g.isoDate, mainEntityOfPage: `${URL_}${path}`, author: { "@type": "Person", name: "The Glasto Quick Copy maker", url: `${URL_}/about/` }, publisher: { "@type": "Organization", name: SITE.name, url: URL_ } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Guides", item: `${URL_}/guides/` },
      { "@type": "ListItem", position: 2, name: topicName, item: `${URL_}/guides/#${g.topic}` },
      { "@type": "ListItem", position: 3, name: g.title, item: `${URL_}${path}` },
    ] },
  ];
  // related: the other guides on the same topic first, then the next guides in the list
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  // related: the three guides chosen for this one, or else the others on its topic first
  for (const r of g.related || []) if (!GUIDES.some((x) => x.slug === r) || r === g.slug) throw new Error(`guide ${g.slug} lists unknown related guide ${r}`);
  const related = g.related ? g.related.map((r) => GUIDES.find((x) => x.slug === r)) : [...others.filter((x) => x.topic === g.topic), ...others.slice(GUIDES.indexOf(g)), ...others].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  // ads: after the intro, before the heading nearest the middle, and before the related guides
  const heads = g.body.map((b, i) => (b && b.h2 ? i : -1)).filter(i => i > 0);
  const mid = heads.length ? heads.reduce((a, i) => (Math.abs(i - g.body.length / 2) < Math.abs(a - g.body.length / 2) ? i : a)) : -1;
  const withAds = mid > 0 ? [...g.body.slice(0, mid), { ad: "guide-mid" }, ...g.body.slice(mid)] : g.body;
  const body = `<article class="page guide">
<p class="crumbs"><a href="/guides/">Guides</a> <span aria-hidden="true">›</span> <a href="/guides/#${g.topic}">${esc(topicName)}</a></p>
<h1>${inline(g.title)}</h1>
<p class="lead">${inline(g.summary)}</p>
<p class="byline">By the maker of Glasto Quick Copy (<a href="/about/">about us</a>). Facts checked ${esc(g.updated)}.</p>
${blocks([{ ad: "guide-top" }, ...withAds])}
${g.sources ? `<h2 id="sources">Sources</h2><ul class="sources">${g.sources.map(([t, u]) => `<li><a href="${esc(safeUrl(u))}" rel="noopener">${esc(t)}</a></li>`).join("")}</ul>` : ""}
${blocks([{ ad: "guide-end" }])}
<aside class="related"><h2>Related guides</h2>${blocks([{ cards: related }])}</aside>
</article>`;
  write(`guides/${g.slug}/index.html`, layout({ path, title: g.title, seoTitle: g.seoTitle, description: g.summary, body, updated: g.updated, jsonld }));
  urls.push([path, g.isoDate]);
}
for (const e of CALENDAR) write(`calendar/${e.id}.ics`, ics([e]));
write(`calendar/${CALENDAR_FEED.file}`, ics(CALENDAR, CALENDAR_FEED.name));
const updatesPage = PAGES.find((p) => p.path === "/updates/");
write("updates/feed.xml", atom(updatesPage));
for (const d of DOWNLOADS) write(`downloads/${d.file}`, d.content);
urls[0][1] = LASTMOD;
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${URL_}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${URL_}/sitemap.xml\n`);
const drafts = ALL_GUIDES.filter((g) => g.draft).map((g) => g.slug);
console.log(`Built ${PAGES.length} pages and ${GUIDES.length} guides into the site root${drafts.length ? ` (held back as drafts: ${drafts.join(", ")})` : ""}`);
