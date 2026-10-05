// Builds the guides site (site/) from site-src/content.mjs.
//   node site-src/build.mjs
// The output is committed, so Netlify serves plain files. At deploy time Netlify only swaps
// __SITE_URL__ for the site's real address (see site/netlify.toml and site/deploy.sh).
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, PAGES, GUIDES } from "./content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inline markup allowed in content: **bold** and [text](url). Everything else is escaped.
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => {
      const external = /^https?:/.test(u);
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
    if (b.faq) return `<div class="faq-list">${b.faq.map(([q, a]) => `<details class="faq"><summary><span>${inline(q)}</span><span class="faq-sign" aria-hidden="true"></span></summary>${(Array.isArray(a) ? a : [a]).map((x) => `<p>${inline(x)}</p>`).join("")}</details>`).join("")}</div>`;
    if (b.cta) return `<p class="cta"><a class="btn btn-primary" href="/start">${inline(b.cta)}</a></p>`;
    if (b.cards) return `<div class="cards">${b.cards.map((g) => `<a class="gcard" href="/guides/${g.slug}/"><span class="gtitle">${inline(g.title)}</span><span class="gsum">${inline(g.summary)}</span></a>`).join("")}</div>`;
    throw new Error("unknown block " + JSON.stringify(b));
  }).join("\n");
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function layout({ path, title, description, body, updated, jsonld }) {
  const full = path === "/" ? `${SITE.name}: ${SITE.tagline}` : `${title} | ${SITE.name}`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="__SITE_URL__${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${path.startsWith("/guides/") && path !== "/guides/" ? "article" : "website"}">
<meta property="og:url" content="__SITE_URL__${path}">
<meta name="theme-color" content="#fbfaf6">
<meta name="google-adsense-account" content="${SITE.adsenseClient}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%93%8B%3C/text%3E%3C/svg%3E">
<link rel="preload" href="/fonts/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsenseClient}" crossorigin="anonymous"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>\n` : ""}</head>
<body>
<header class="site-head">
  <div class="wrap head-row">
    <a class="wordmark" href="/">${esc(SITE.name)}</a>
    <nav aria-label="Main">
      <a href="/guides/">Guides</a>
      <a href="/faq/">FAQ</a>
      <a class="nav-cta" href="/start">Open the tool</a>
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
      <a href="/contact/">Contact</a>
      <a href="/privacy/">Privacy and cookies</a>
      <a href="/terms/">Terms</a>
    </nav>
    <p>${esc(SITE.name)} is an independent, free project. It is not affiliated with, endorsed by or connected to Glastonbury Festival or See Tickets.</p>
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

// clean generated HTML (keep hand-written files: netlify.toml, deploy.sh, site.css, ads.txt, robots.txt)
for (const d of ["guides", "faq", "about", "contact", "privacy", "terms"]) if (existsSync(join(OUT, d))) rmSync(join(OUT, d), { recursive: true });
for (const f of ["index.html", "404.html", "sitemap.xml"]) if (existsSync(join(OUT, f))) rmSync(join(OUT, f));

const urls = [];
for (const p of PAGES) {
  const jsonld = p.faqSchema ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: p.faqSchema.map(([q, a]) => ({ "@type": "Question", name: q.replace(/\*\*|\[|\]\(.*?\)/g, ""), acceptedAnswer: { "@type": "Answer", text: (Array.isArray(a) ? a.join(" ") : a).replace(/\*\*/g, "").replace(/\[(.+?)\]\((.+?)\)/g, "$1") } })),
  } : null;
  const body = `<article class="page">\n<h1>${inline(p.h1 || p.title)}</h1>\n${p.lead ? `<p class="lead">${inline(p.lead)}</p>\n` : ""}${blocks(p.body)}\n</article>`;
  write(p.file, layout({ path: p.path, title: p.title, description: p.description, body, updated: p.updated, jsonld }));
  if (p.path !== "/404") urls.push(p.path);
}
for (const g of GUIDES) {
  const path = `/guides/${g.slug}/`;
  const jsonld = { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.summary, dateModified: g.isoDate, author: { "@type": "Person", name: "The Glasto Quick Copy maker" }, publisher: { "@type": "Organization", name: SITE.name } };
  const related = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  const body = `<article class="page guide">
<p class="crumbs"><a href="/guides/">Guides</a></p>
<h1>${inline(g.title)}</h1>
<p class="lead">${inline(g.summary)}</p>
${blocks(g.body)}
${g.sources ? `<h2 id="sources">Sources</h2><ul class="sources">${g.sources.map(([t, u]) => `<li><a href="${u}" rel="noopener">${esc(t)}</a></li>`).join("")}</ul>` : ""}
<aside class="related"><h2>Related guides</h2>${blocks([{ cards: related }])}</aside>
</article>`;
  write(`guides/${g.slug}/index.html`, layout({ path, title: g.title, description: g.summary, body, updated: g.updated, jsonld }));
  urls.push(path);
}
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>__SITE_URL__${u}</loc></url>`).join("\n")}
</urlset>
`);

// fonts are shared with the tool
mkdirSync(join(OUT, "fonts"), { recursive: true });
for (const f of readdirSync(join(ROOT, "fonts"))) copyFileSync(join(ROOT, "fonts", f), join(OUT, "fonts", f));
console.log(`Built ${PAGES.length} pages and ${GUIDES.length} guides into site/`);
