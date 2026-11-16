// Helpers for scripts/search-data-export.mjs, kept apart so the tests can check them without a Google token.

// One address per page: https, no www, no "?query" or "#section"
export const norm = (u) => u.replace(/^https?:\/\/(www\.)?/, "https://").replace(/[?#].*$/, "");

// Google lists a guide's jump links ("#section" addresses) as rows of their own, next to the guide's main row.
// This adds up every row that shares the same address (and the same values for the other keys, such as the
// search), so a guide's totals include its jump links instead of one small row replacing the rest.
// Clicks and impressions are summed, position is averaged weighted by impressions, and click rate is recalculated.
export function combine(rows, keys = ["page"]) {
  const groups = new Map();
  for (const r of rows) {
    const k = keys.map((key) => (key === "page" ? norm(r.page) : r[key])).join("\n");
    const g = groups.get(k) || { ...Object.fromEntries(keys.map((key) => [key, key === "page" ? norm(r.page) : r[key]])), clicks: 0, impressions: 0, weighted: 0 };
    g.clicks += r.clicks; g.impressions += r.impressions; g.weighted += r.position * r.impressions;
    groups.set(k, g);
  }
  return [...groups.values()].map(({ weighted, ...g }) => ({ ...g, ctr: g.impressions ? g.clicks / g.impressions : 0, position: g.impressions ? weighted / g.impressions : 0 }));
}
