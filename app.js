// Glastonbury Registration Quick Copy — everything runs in the browser.
// Pages are stored in this browser's localStorage only; nothing is ever sent anywhere
// (the Content-Security-Policy blocks all network requests). All user data is rendered
// with textContent, never innerHTML.
(() => {
  "use strict";

  const DEMO = document.body.hasAttribute("data-demo");
  const KEY = "tdqc:pages:v1";
  const MAX_PEOPLE = 6;
  const MAX_REG_DIGITS = 12;
  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  // ---------- storage ----------
  let demoStore = Object.assign(Object.create(null), {
    demo: {
      created: Date.now(),
      people: [
        { name: "Alex Morgan", reg: "1029384756", postcode: "BS1 4DJ" },
        { name: "Sam Patel", reg: "5647382910", postcode: "BS1 4DJ" },
        { name: "Jo Clarke", reg: "3141592653", postcode: "M4 1HN" },
        { name: "Chris Evans", reg: "2718281828", postcode: "CF10 1EP" },
        { name: "Priya Shah", reg: "1618033988", postcode: "SE1 7PB" },
        { name: "Tom Hughes", reg: "1414213562", postcode: "LS1 5DL" },
      ],
    },
  });

  // Everything read from storage is re-validated: unknown shapes are dropped instead of
  // crashing the page, and maps have no prototype so ids like "__proto__" can't resolve.
  function cleanPages(raw) {
    const out = Object.create(null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const id of Object.keys(raw)) {
      const pg = raw[id];
      if (!/^[a-z0-9]{1,32}$/i.test(id) || !pg || typeof pg !== "object" || !Array.isArray(pg.people)) continue;
      const people = pg.people
        .filter(x => x && typeof x === "object")
        .map(x => ({
          name: String(x.name ?? "").slice(0, 60),
          reg: String(x.reg ?? "").replace(/\D/g, "").slice(0, MAX_REG_DIGITS),
          postcode: String(x.postcode ?? "").slice(0, 24),
        }))
        .filter(x => x.reg)
        .slice(0, MAX_PEOPLE);
      if (people.length) out[id] = { created: Number(pg.created) || 0, people };
    }
    return out;
  }
  function loadAll() {
    if (DEMO) return demoStore;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch {}
    const all = cleanPages(raw);
    // Earlier versions could store a payment card; cleanPages drops it, so rewrite if one was there.
    if (raw && typeof raw === "object" && Object.values(raw).some(pg => pg && typeof pg === "object" && "card" in pg)) {
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
    }
    return all;
  }
  function saveAll(all) {
    if (DEMO) { demoStore = all; return true; }
    try { localStorage.setItem(KEY, JSON.stringify(all)); return true; }
    catch { toast("Couldn't save — is private browsing on?", true); return false; }
  }
  function newId() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  }

  // ---------- share links ----------
  // Compact binary format, base64url-encoded into the link after "#/s/":
  //   byte 0: format version (2; version 1 links still decode)
  //   then per person:
  //     1 byte name length + UTF-8 first name (surname initial added only to tell duplicates apart)
  //     1 byte: high nibble = reg number digit count, low nibble = postcode character count
  //     5 bytes: reg number as an integer, little-endian (digit count restores leading zeros)
  //     postcode: 0–9, A–Z, space, "-" at 6 bits per character, padded to whole bytes;
  //       anything else (e.g. accented letters) is stored as raw UTF-8 instead (nibble = 15)
  // No page title, no surnames, never anything else. This is encoding, not encryption.
  // Links made before v1 (base64 JSON, start with "eyJ") still decode.
  const SHARE_V1 = 1;
  const SHARE_V2 = 2;
  const PC_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const PC_ALPHABET_V2 = PC_ALPHABET + " -";
  const PC_RAW = 15; // v2: postcode length nibble 15 = 1 length byte + raw UTF-8 follows
  const MAX_NAME_BYTES = 40;

  function toB64u(bytes) {
    let bin = "";
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64u(s) {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  }
  function shareNames(people) {
    const words = people.map(p => p.name.trim().split(/\s+/).filter(Boolean));
    const firsts = words.map(w => w[0] || "");
    return firsts.map((f, i) => {
      const dup = firsts.some((g, j) => j !== i && g.toLowerCase() === f.toLowerCase());
      return dup && words[i].length > 1 ? `${f} ${words[i][words[i].length - 1][0]}.` : f;
    });
  }
  // Page title is always "Glasto group, <first names>" — never user-typed.
  function pageTitle(people) {
    return ["Glasto group", ...shareNames(people).filter(Boolean)].join(", ");
  }
  function nameBytes(name, max = MAX_NAME_BYTES) {
    let chars = Array.from(name), bytes = new TextEncoder().encode(name);
    while (bytes.length > max) { chars.pop(); bytes = new TextEncoder().encode(chars.join("")); }
    return bytes;
  }

  function packChars(out, chars, alphabet) {
    let acc = 0, bits = 0;
    for (const ch of chars) {
      acc |= alphabet.indexOf(ch) << bits; bits += 6;
      while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
    }
    if (bits > 0) out.push(acc & 255);
  }

  function encodeShare(page) {
    const out = [SHARE_V2];
    const names = shareNames(page.people);
    page.people.slice(0, MAX_PEOPLE).forEach((p, i) => {
      const nb = nameBytes(names[i]);
      out.push(nb.length, ...nb);
      const reg = digits(p.reg).slice(0, MAX_REG_DIGITS);
      const pc = Array.from(p.postcode.trim().toUpperCase());
      const packable = pc.length < PC_RAW && pc.every(ch => PC_ALPHABET_V2.includes(ch));
      out.push((reg.length << 4) | (packable ? pc.length : PC_RAW));
      let n = reg ? Number(reg) : 0;
      for (let k = 0; k < 5; k++) { out.push(n % 256); n = Math.floor(n / 256); }
      if (packable) packChars(out, pc, PC_ALPHABET_V2);
      else { const raw = nameBytes(pc.join(""), 24); out.push(raw.length, ...raw); }
    });
    return toB64u(out);
  }

  function decodeShareBinary(bytes, version) {
    const alphabet = version === SHARE_V2 ? PC_ALPHABET_V2 : PC_ALPHABET;
    const people = [];
    let i = 1;
    const need = (n) => { if (i + n > bytes.length) throw new Error("truncated"); };
    while (i < bytes.length && people.length < MAX_PEOPLE) {
      need(1); const nl = bytes[i++];
      if (nl > MAX_NAME_BYTES) throw new Error("bad name");
      need(nl); const name = new TextDecoder().decode(bytes.subarray(i, i + nl)); i += nl;
      need(6); const lens = bytes[i++];
      const regLen = lens >> 4, pcLen = lens & 15;
      if (regLen > MAX_REG_DIGITS) throw new Error("bad reg");
      let n = 0;
      for (let k = 4; k >= 0; k--) n = n * 256 + bytes[i + k];
      i += 5;
      const reg = regLen ? String(n).padStart(regLen, "0").slice(-regLen) : "";
      let pc = "";
      if (version === SHARE_V2 && pcLen === PC_RAW) {
        need(1); const rl = bytes[i++];
        if (rl > 24) throw new Error("bad postcode");
        need(rl); pc = new TextDecoder().decode(bytes.subarray(i, i + rl)); i += rl;
      } else {
      const pcBytes = Math.ceil(pcLen * 6 / 8);
      need(pcBytes);
      let acc = 0, bits = 0;
      for (let k = 0; k < pcBytes; k++) {
        acc |= bytes[i + k] << bits; bits += 8;
        while (bits >= 6 && pc.length < pcLen) {
          const v = acc & 63;
          if (v >= alphabet.length) throw new Error("bad postcode");
          pc += alphabet[v]; acc >>>= 6; bits -= 6;
        }
      }
      i += pcBytes;
      }
      if (!reg) throw new Error("missing reg");
      // v1 dropped spaces, so re-insert them; v2 keeps the postcode exactly as saved
      people.push({ name: name || "Unnamed", reg, postcode: version === SHARE_V1 ? normPostcode(pc) : pc });
    }
    return people.length ? { people } : null;
  }

  function decodeShareLegacy(bytes) {
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || !Array.isArray(obj.p)) return null;
    return {
      people: obj.p.slice(0, MAX_PEOPLE).map(a => ({
        name: String(a[0] || "").slice(0, 60),
        reg: String(a[1] || "").replace(/\D/g, "").slice(0, 12),
        postcode: String(a[2] || "").slice(0, 12),
      })),
    };
  }

  function decodeShare(s) {
    try {
      // Tolerate junk picked up when copying (trailing ".", ")", spaces, encoded chars)
      if (s.length > 4000) return null; // a full group is ~200 chars; refuse absurd input fast
      const m = decodeURIComponent(s).match(/^[A-Za-z0-9_-]+/);
      if (!m) return null;
      const bytes = fromB64u(m[0]);
      if (!bytes.length) return null;
      if (bytes[0] === SHARE_V1 || bytes[0] === SHARE_V2) return decodeShareBinary(bytes, bytes[0]);
      return decodeShareLegacy(bytes);
    } catch { return null; }
  }

  // ---------- helpers ----------
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "class") e.className = v;
      else if (k in e && typeof v !== "string") e[k] = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
    return e;
  }
  let toastTimer;
  function toast(msg, bad) {
    toastEl.textContent = msg;
    toastEl.style.background = bad ? "var(--danger)" : "";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = h("textarea", { readonly: true });
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      let ok = false;
      try { ok = document.execCommand("copy"); } catch {}
      ta.remove();
      return ok;
    }
  }
  const go = (route) => { location.hash = "#/" + route; };
  const normPostcode = (s) => {
    const c = s.toUpperCase().replace(/\s+/g, "");
    // Standard UK format puts a space before the last 3 characters
    return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(c) ? c.slice(0, -3) + " " + c.slice(-3) : s.trim().toUpperCase();
  };
  const digits = (s) => s.replace(/\D/g, "");

  function copyButton(label, display, value, opts = {}) {
    const valEl = h("span", { class: "value" }, display);
    const b = h("button", { type: "button", class: "copy" + (opts.wide ? " wide" : ""), "aria-label": `Copy ${label}` },
      h("span", { class: "label" }, label), valEl);
    b.addEventListener("click", async () => {
      const ok = await copyText(value);
      if (!ok) { toast("Couldn't copy — long-press to select", true); return; }
      if (navigator.vibrate) navigator.vibrate(30);
      b.classList.add("used", "flash");
      setTimeout(() => b.classList.remove("flash"), 400);
      toast(`Copied ${display}`);
    });
    return b;
  }

  function demoBanner() {
    return DEMO ? h("div", { class: "banner" }, "DEMO — example data only. Nothing here is real and nothing is saved.") : null;
  }
  // The deployed commit is stamped into <meta name="source-commit"> by Netlify (see netlify.toml),
  // so anyone can see exactly which version of the public source code is running.
  const SOURCE_REPO = "https://github.com/francproductmanager/glastonbury-registration-quick-copy";
  function deployedCommit() {
    const meta = document.querySelector('meta[name="source-commit"]');
    const sha = meta ? meta.content : "";
    return /^[0-9a-f]{7,40}$/.test(sha) ? sha : "";
  }
  // Simple line icons (24×24, stroke = currentColor) drawn inline, so no images are loaded
  const ICONS = {
    device: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    code: "M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14",
    cloudOff: "M3 3l18 18M8 7.5A5 5 0 0 1 17 9a4 4 0 0 1 3 6.5M17 18H7a4 4 0 0 1-1.5-7.7",
    eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.4 3.3M6.5 7.6C4.5 9 3.1 10.8 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
    check: "M5 12l4 4 10-10",
    scale: "M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z",
  };
  function icon(name) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "icon");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", ICONS[name]);
    svg.append(path);
    return svg;
  }
  function sourceLine() {
    const sha = deployedCommit();
    const stamped = !!sha;
    return h("p", null,
      "Open source: ", h("a", { href: SOURCE_REPO, rel: "noopener" }, "view the code on GitHub"),
      stamped ? [" · running version ", h("a", { href: `${SOURCE_REPO}/commit/${sha}`, rel: "noopener", class: "mono" }, sha.slice(0, 7))] : null);
  }
  function footer(extra, { home = false } = {}) {
    return h("footer", null,
      home ? null : h("p", null, "Your data stays in this browser. No accounts, no server, no tracking."),
      sourceLine(),
      h("p", null, "Not affiliated with Glastonbury Festival or See Tickets."),
      extra || null);
  }

  // ---------- views ----------
  // ---------- animated "how it works" on the home page ----------
  // Shows: tap a number here -> it's copied -> tap the field on the ticket site -> it's pasted.
  // Uses made-up demo data and a generic form (no festival branding). Purely decorative:
  // hidden from screen readers (the caption says the same thing) and static if the
  // visitor prefers reduced motion.
  let howtoTimers = [];
  function stopHowto() { howtoTimers.forEach(clearTimeout); howtoTimers = []; }

  function howtoDemo() {
    const P = { name: "Alex", reg: "1029384756", postcode: "BS1 4DJ" };
    const btn = (label, value) => h("div", { class: "copy hd-copy" }, h("span", { class: "label" }, label), h("span", { class: "value" }, value));
    const field = (label) => h("div", { class: "hd-field" }, h("span", { class: "hd-label" }, label), h("span", { class: "hd-input" }));
    const regBtn = btn("Reg number", P.reg), pcBtn = btn("Postcode", P.postcode);
    const regField = field("Registration Number:"), pcField = field("Postcode:");
    const toast = h("span", { class: "hd-toast" });
    const done = h("span", { class: "hd-done" }, "✓ Pasted in 4 taps");

    const root = h("figure", { class: "howto" },
      h("div", { class: "hd-stage", "aria-hidden": "true" },
        h("div", { class: "hd-panel" },
          h("div", { class: "hd-panel-title" }, "This site"),
          h("div", { class: "hd-person" }, h("span", { class: "num" }, "1"), P.name),
          h("div", { class: "row" }, regBtn, pcBtn),
          toast),
        h("div", { class: "hd-arrow" }, "↓"),
        h("div", { class: "hd-panel hd-ticket" },
          h("div", { class: "hd-panel-title" }, "Ticket site"),
          h("div", { class: "hd-section" }, "Your details"),
          regField, pcField, done)),
      h("figcaption", { class: "muted small" }, "Tap a number to copy it, then paste it into the ticket site. Example data."));

    const reset = () => {
      [regBtn, pcBtn].forEach(b => b.classList.remove("used", "hd-tap"));
      [regField, pcField].forEach(f => { f.classList.remove("hd-focus", "hd-tap"); f.lastChild.textContent = ""; });
      toast.classList.remove("show"); done.classList.remove("show");
    };
    const tap = (el) => { el.classList.remove("hd-tap"); void el.offsetWidth; el.classList.add("hd-tap"); };
    const copy = (b, value) => { tap(b); b.classList.add("used"); toast.textContent = `Copied ${value}`; toast.classList.add("show"); };
    const paste = (f, value) => { tap(f); toast.classList.remove("show"); [regField, pcField].forEach(x => x.classList.remove("hd-focus")); f.classList.add("hd-focus"); f.lastChild.textContent = value; };
    const finalState = () => {
      reset(); regBtn.classList.add("used"); pcBtn.classList.add("used");
      regField.lastChild.textContent = P.reg; pcField.lastChild.textContent = P.postcode; done.classList.add("show");
    };

    let reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}
    if (reduced) { finalState(); return root; }

    const steps = [
      [700, () => copy(regBtn, P.reg)],
      [1700, () => paste(regField, P.reg)],
      [2900, () => copy(pcBtn, P.postcode)],
      [3900, () => paste(pcField, P.postcode)],
      [4700, () => { pcField.classList.remove("hd-focus"); done.classList.add("show"); }],
      [7600, () => run()],
    ];
    const run = () => {
      stopHowto(); reset();
      howtoTimers = steps.map(([t, fn]) => setTimeout(fn, t));
    };
    setTimeout(run, 0);
    return root;
  }

  function viewHome() {
    const all = loadAll();
    const ids = Object.keys(all).sort((a, b) => (all[b].created || 0) - (all[a].created || 0));
    const sha = deployedCommit();
    const point = (ic, title, text, extra) => h("li", { class: "trust-point" },
      h("span", { class: "trust-icon" }, icon(ic)),
      h("div", null, h("strong", null, title), h("p", { class: "muted small" }, text, extra || null)));
    const badge = (ic, label, href) => href
      ? h("a", { class: "badge", href, rel: "noopener" }, icon(ic), label)
      : h("span", { class: "badge" }, icon(ic), label);
    return [
      demoBanner(),
      h("h1", null, "Glastonbury Registration Quick Copy"),
      h("p", { class: "muted" }, "Your group's registration numbers and postcodes on one page. On ticket day, tap to copy each one straight into the ticket site."),
      h("div", { class: "actions" },
        h("a", { class: "btn primary block", href: "#/new" }, "Start")),
      howtoDemo(),
      h("p", { class: "small", style: "text-align:center;margin:-2px 0 14px" }, h("a", { href: "demo.html" }, "Try the full demo")),
      ids.length ? h("section", { class: "card" },
        h("h2", null, "Your groups on this device"),
        ids.map(id => h("a", { class: "saved-item", href: "#/p/" + id },
          h("div", null,
            h("strong", null, pageTitle(all[id].people)),
            h("span", { class: "muted small" }, `${all[id].people.length} ${all[id].people.length === 1 ? "person" : "people"}`)),
          h("span", { class: "btn sm" }, "Open")))) : null,
      h("section", { class: "card trust" },
        h("h2", null, "Private by design"),
        h("ul", { class: "trust-points" },
          point("device", "Stays on your device",
            "Your group is saved in this browser only. No sign-up, no cloud storage, no database, and the site is blocked from connecting to any other server. No analytics, ads or trackers."),
          point("code", "Open source and checked",
            "Anyone can read the code. The live site is automatically compared with the published code, so what you see is what's on GitHub. ",
            h("a", { href: SOURCE_REPO, rel: "noopener" }, "View the code"))),
        h("div", { class: "badges", "aria-label": "Project facts" },
          badge("scale", "MIT licence", `${SOURCE_REPO}/blob/main/LICENSE`),
          badge("check", sha ? `Checked build · ${sha.slice(0, 7)}` : "Checked build", `${SOURCE_REPO}/actions/workflows/verify-live.yml`),
          badge("cloudOff", "No cloud storage"),
          badge("eyeOff", "No tracking or cookies"))),
      footer(!DEMO && ids.length ? h("p", null, h("button", { type: "button", onclick: wipeAll }, "Delete everything on this device")) : null, { home: true }),
    ];
  }

  function wipeAll() {
    if (!confirm("Delete all your groups from this device?")) return;
    try { localStorage.removeItem(KEY); } catch {}
    toast("Everything deleted");
    render();
  }

  function viewEditor(id, prefill) {
    const all = loadAll();
    const existing = id ? all[id] : null;
    if (id && !existing) return viewMissing();
    const src = existing || prefill || { people: [{ name: "", reg: "", postcode: "" }] };

    const peopleWrap = h("div");
    const rows = [];
    const addBtn = h("button", { type: "button", class: "btn block", onclick: () => { addRow({}); } }, "+ Add person");

    function renumber() {
      rows.forEach((r, i) => { r.numEl.textContent = `Person ${i + 1}`; });
      addBtn.disabled = rows.length >= MAX_PEOPLE;
      addBtn.textContent = rows.length >= MAX_PEOPLE ? "6 people max per booking" : "+ Add person";
    }
    function addRow(p) {
      if (rows.length >= MAX_PEOPLE) return;
      const r = {
        name: h("input", { type: "text", maxlength: "60", placeholder: "Name", value: p.name || "", autocomplete: "off" }),
        reg: h("input", { type: "text", class: "mono", inputmode: "numeric", maxlength: "16", placeholder: "Registration no.", value: p.reg || "", autocomplete: "off" }),
        postcode: h("input", { type: "text", class: "mono", maxlength: "12", placeholder: "Postcode", autocapitalize: "characters", value: p.postcode || "", autocomplete: "off" }),
        numEl: h("span"),
        errEl: h("div", { class: "err" }),
      };
      r.el = h("div", { class: "card" },
        h("div", { class: "person-edit-head" }, r.numEl,
          h("button", { type: "button", class: "linkish", onclick: () => {
            rows.splice(rows.indexOf(r), 1); r.el.remove(); renumber();
          } }, "Remove")),
        h("div", { class: "person-edit" },
          h("label", { class: "field full" }, h("span", null, "Name"), r.name),
          h("label", { class: "field" }, h("span", null, "Registration number"), r.reg),
          h("label", { class: "field" }, h("span", null, "Postcode"), r.postcode)),
        r.errEl);
      rows.push(r);
      peopleWrap.append(r.el);
      renumber();
    }
    (src.people.length ? src.people : [{}]).forEach(addRow);

    const formErr = h("div", { class: "err" });

    function save() {
      let ok = true;
      formErr.textContent = "";
      const people = [];
      rows.forEach(r => {
        r.errEl.textContent = "";
        const name = r.name.value.trim(), reg = digits(r.reg.value), postcode = normPostcode(r.postcode.value);
        if (!name && !reg && !postcode) return;
        if (!reg) { r.errEl.textContent = "Add a registration number (digits only)."; ok = false; }
        else if (reg.length > MAX_REG_DIGITS) { r.errEl.textContent = `Registration numbers are at most ${MAX_REG_DIGITS} digits.`; ok = false; }
        if (!postcode) { r.errEl.textContent += " Add a postcode."; ok = false; }
        people.push({ name: name || "Unnamed", reg, postcode });
      });
      if (!people.length) { formErr.textContent = "Add at least one person."; ok = false; }

      if (!ok) { toast("Check the highlighted fields", true); return; }

      const all2 = loadAll();
      if (id && !all2[id]) {
        // Deleted in another tab while this editor was open: don't bring it back
        toast("This page was deleted in another tab", true);
        go("");
        return;
      }
      const pid = id || newId();
      all2[pid] = { created: existing ? existing.created : Date.now(), people };
      if (!saveAll(all2)) return;
      toast("Saved on this device");
      go("p/" + pid);
    }

    return [
      demoBanner(),
      h("div", { class: "topbar" },
        h("div", null, h("a", { class: "home-link", href: id ? "#/p/" + id : "#/" }, "‹ Back"), h("h1", null, id ? "Edit group" : "Create your group"))),
      h("h2", { style: "margin:4px 2px 8px" }, "People"),
      peopleWrap,
      addBtn,
      formErr,
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn primary block", onclick: save }, id ? "Save changes" : "Create my group")),
      footer(),
    ];
  }

  function viewPage(id) {
    const all = loadAll();
    const page = all[id];
    if (!page) return viewMissing();
    return renderCopyPage(page, {
      id,
      share: shareSection(page),
      actions: [
        h("a", { class: "btn sm", href: "#/edit/" + id }, "Edit"),
        h("button", { type: "button", class: "btn sm danger", onclick: () => {
          if (!confirm(`Delete "${pageTitle(page.people)}" from this device?`)) return;
          const a = loadAll(); delete a[id]; saveAll(a); toast("Page deleted"); go("");
        } }, "Delete"),
      ],
    });
  }

  // Opening a share link saves the page straight away (reusing an identical saved copy)
  // and swaps the URL for the saved page, so the share code doesn't linger in history.
  function viewShared(enc) {
    const page = decodeShare(enc);
    if (!page) return viewMissing("This share link looks broken. Ask whoever sent it for a new one.");
    const all = loadAll();
    const key = JSON.stringify(page.people);
    let pid = Object.keys(all).find(id => JSON.stringify(all[id].people) === key);
    if (!pid) {
      pid = newId();
      all[pid] = { created: Date.now(), people: page.people };
      if (!saveAll(all)) return renderCopyPage(page, { actions: [] });
      toast("Saved on this device");
    }
    location.replace("#/p/" + pid);
    return [];
  }

  function renderCopyPage(page, opts) {
    const list = page.people.map((p, i) => h("section", { class: "card person" },
      h("div", { class: "name" }, h("span", { class: "num" }, String(i + 1)), h("span", null, p.name)),
      h("div", { class: "row" },
        copyButton("Reg number", p.reg, p.reg),
        copyButton("Postcode", p.postcode, p.postcode))));

    return [
      demoBanner(),
      h("div", { class: "topbar" },
        h("div", null,
          h("a", { class: "home-link", href: DEMO ? "./" : "#/" }, DEMO ? "‹ Make your own" : "‹ All groups"),
          h("h1", null, pageTitle(page.people)),
          h("p", { class: "muted small", style: "margin:2px 0 0" }, "Tap any box to copy it"))),
      list,
      opts.share || null,
      h("div", { class: "actions" }, opts.actions),
      footer(),
    ];
  }

  function shareUrl(page) {
    // The demo lives at demo.html; its links should open in the real app
    const path = location.pathname.replace(/demo\.html$/, "");
    return `${location.origin}${path}#/s/${encodeShare(page)}`;
  }

  function shareSection(page) {
    const url = shareUrl(page);
    const copyBtn = h("button", { type: "button", class: "btn primary block" }, "Copy link");
    copyBtn.addEventListener("click", async () => {
      if (await copyText(url)) {
        copyBtn.textContent = "Copied ✓";
        toast("Link copied");
        setTimeout(() => { copyBtn.textContent = "Copy link"; }, 1500);
      } else toast("Couldn't copy. Press and hold the link to select it", true);
    });
    return h("section", { class: "card share" },
      h("h2", null, "Share this group with your friends"),
      h("p", { class: "muted small" }, "Send this link to your friends. It opens this group on their phone, ready to use. Anyone with the link can see these first names, numbers and postcodes."),
      h("div", { class: "share-url mono" }, url),
      copyBtn);
  }

  function viewMissing(msg) {
    return [
      demoBanner(),
      h("h1", null, "Page not found"),
      h("p", { class: "muted" }, msg || "This page isn't saved in this browser. Pages only live on the device that made them, so open it there, or ask for a share link."),
      h("div", { class: "actions" }, h("a", { class: "btn primary", href: "#/" }, "Go home")),
    ];
  }

  // ---------- router ----------
  function render() {
    stopHowto();
    let route = location.hash.replace(/^#\/?/, "");
    if (DEMO && !route) route = "p/demo";
    const [view, ...rest] = route.split("/");
    const arg = rest.join("/");
    let nodes;
    if (view === "new") nodes = viewEditor(null);
    else if (view === "edit") nodes = viewEditor(arg);
    else if (view === "p") nodes = viewPage(arg);
    else if (view === "s") nodes = viewShared(arg);
    else nodes = viewHome();
    app.replaceChildren(...[nodes].flat(Infinity).filter(Boolean));
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  // Keep other open tabs in sync, but never wipe an editor someone is typing in
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && !/^#\/(new|edit\/)/.test(location.hash)) render();
  });
  render();
})();
