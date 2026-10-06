// Home page visit counter: the only server code on this site.
//   POST /api/visits  adds one visit and returns the new total
//   GET  /api/visits  returns the total
// It stores one number and nothing else: no IP addresses, no cookies, no browser details,
// and never anything about anyone's group (the tool never sends that anywhere).
// The total lives in Netlify Blobs. Writes are conditional (only if nobody else wrote in
// between), so two visits at the same moment can't overwrite each other.
import { getStore } from "@netlify/blobs";

const KEY = "home";

const reply = (count, status = 200) => new Response(JSON.stringify({ count }), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

// Separate from the Netlify wiring below so the tests can run it against a stand-in store
export async function handle(req, store) {
  if (req.method !== "GET" && req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  if (req.method === "GET") {
    const cur = await store.get(KEY, { type: "json" });
    return reply(Number(cur?.count) || 0);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const cur = await store.getWithMetadata(KEY, { type: "json" });
    const next = (Number(cur?.data?.count) || 0) + 1;
    const res = cur
      ? await store.setJSON(KEY, { count: next }, { onlyIfMatch: cur.etag })
      : await store.setJSON(KEY, { count: next }, { onlyIfNew: true });
    if (res.modified) return reply(next);
  }
  return reply(null, 503); // very busy: the page simply shows no number this time
}

export default (req) => handle(req, getStore({ name: "visits", consistency: "strong" }));

export const config = { path: "/api/visits" };
