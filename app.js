// Glasto Quick Copy: everything runs in the browser.
// Pages are stored in this browser's localStorage only. This code never sends them anywhere:
// it makes no network requests (a test checks this). The site shows Google ads in fixed
// slots (see ads.js). All user data is rendered with textContent, never innerHTML.
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
        { name: "Priya Shah", reg: "1618033988", postcode: "SE1 7PB" },
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
    catch { toast("Couldn't save. Is private browsing on?", true); return false; }
  }
  function newId() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  }

  // ---------- share links ----------
  // Compact binary format, base64url-encoded into the link after "#/s/":
  //   byte 0: format version (2; version 1 links still decode)
  //   then per person:
  //     1 byte name length + UTF-8 first name (a repeated first name gets a number: "Alex 1", "Alex 2")
  //     1 byte: high nibble = reg number digit count, low nibble = postcode character count
  //     5 bytes: reg number as an integer, little-endian (digit count restores leading zeros)
  //     postcode: 0 to 9, A to Z, space, "-" at 6 bits per character, padded to whole bytes;
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
  // First names only. When a first name repeats, a number tells them apart ("Alex 1", "Alex 2"),
  // so nothing from a surname ever goes into the link.
  function shareNames(people) {
    const firsts = people.map(p => p.name.trim().split(/\s+/)[0] || "");
    const total = Object.create(null), seen = Object.create(null);
    for (const f of firsts) if (f) total[f.toLowerCase()] = (total[f.toLowerCase()] || 0) + 1;
    return firsts.map(f => {
      const k = f.toLowerCase();
      if (!f || total[k] < 2) return f;
      seen[k] = (seen[k] || 0) + 1;
      return `${f} ${seen[k]}`;
    });
  }
  // Page title is always "Glasto group, <first names>", never user-typed.
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
    toastEl.classList.toggle("bad", !!bad);
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = h("textarea", { readonly: true });
      ta.value = text;
      ta.className = "offscreen";
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

  // ---------- links and footer ----------
  // The deployed commit is stamped into <meta name="source-commit"> by Netlify (see netlify.toml),
  // so anyone can see exactly which version of the public source code is running.
  const SOURCE_REPO = "https://github.com/francproductmanager/glastonbury-registration-quick-copy";
  // An ad may appear here (ads.js fills it once the slot has an AdSense ad unit ID)
  const ad = (name) => h("div", { class: "ad-slot", "data-slot": name });
  function deployedCommit() {
    const meta = document.querySelector('meta[name="source-commit"]');
    const sha = meta ? meta.content : "";
    return /^[0-9a-f]{7,40}$/.test(sha) ? sha : "";
  }
  const ext = (href, text, cls) => h("a", { href, rel: "noopener", class: cls || null }, text);

  function footer() {
    const sha = deployedCommit();
    return h("footer", null,
      h("p", null, "No account needed. ", h("a", { href: "#/data" }, "How your data is handled")),
      sha
        ? h("p", null, h("span", { class: "dot", "aria-hidden": "true" }), "Open source. Running version ",
            ext(`${SOURCE_REPO}/commit/${sha}`, sha.slice(0, 7), "mono"), ", ", ext(`${SOURCE_REPO}/actions/workflows/verify-live.yml`, "checked every 6 hours"), ".")
        : h("p", null, "Open source. ", ext(SOURCE_REPO, "View the code"), "."),
      h("nav", { class: "foot-links", "aria-label": "Site" },
        [["/guides/", "Guides"], ["/faq/", "FAQ"], ["/about/", "About"], ["/privacy/", "Privacy and cookies"], ["/terms/", "Terms"], ["/contact/", "Contact"]]
          .map(([href, t]) => h("a", { href }, t))),
      h("p", null, "Not affiliated with Glastonbury Festival or See Tickets."));
  }
  const back = (href, text) => h("a", { class: "back", href }, "‹ " + text);

  // ---------- copy boxes ----------
  // A copy box has four states: idle, up next, copied and failed. Callers decide the state;
  // this only draws it and reports taps.
  function copyBox(kind, value, onTap, extraClass) {
    const lbl = h("span", { class: "lbl" });
    const b = h("button", { type: "button", class: "copy" + (extraClass ? " " + extraClass : "") },
      lbl, h("span", { class: "val" }, value));
    b.setState = (state) => {
      b.classList.toggle("is-next", state === "next");
      b.classList.toggle("is-used", state === "used");
      b.classList.toggle("is-fail", state === "fail");
      const hint = { next: "up next", used: "copied ✓", fail: "hold to select" }[state] || "tap to copy";
      lbl.textContent = `${kind}, ${hint}`;
      b.setAttribute("aria-label", `Copy ${kind.toLowerCase()} ${value}${state === "used" ? ", copied" : ""}`);
    };
    b.setState("idle");
    b.addEventListener("click", () => onTap(b));
    return b;
  }
  async function copyValue(value) {
    const ok = await copyText(value);
    if (ok) {
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch {} }
      toast(`Copied ${value}`);
    } else {
      toast("Couldn't copy. Long-press to select it.", true);
    }
    return ok;
  }

  // ---------- home: try it ----------
  // A hands-on demo with made-up data: tap a box to copy, then tap the matching field to paste.
  function tryIt() {
    const P = { reg: "1029384756", postcode: "BS1 4DJ" };
    let step = 0; // 0 copy reg, 1 paste reg, 2 copy postcode, 3 paste postcode, 4 done
    const msg = h("p", { class: "try-msg", role: "status", "aria-live": "polite" });
    // How to paste on this device: press and hold on touch screens, a shortcut with a keyboard
    const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const howToPaste = touch ? "press and hold inside it, then tap Paste" : "click inside it and press Ctrl+V (\u2318V on a Mac)";
    // Real text boxes, like the ticket site's: people paste into them themselves
    const field = (label) => h("input", { type: "text", class: "mock-field", "aria-label": `${label} (practice box)`, autocomplete: "off", spellcheck: "false", autocapitalize: "characters" });
    const regField = field("Registration no."), pcField = field("Postcode");
    const regBox = copyBox("Reg number", P.reg, () => tapBox("reg"), "hero");
    const pcBox = copyBox("Postcode", P.postcode, () => tapBox("pc"), "hero");
    const done = h("div", { class: "try-done" });

    const setMsg = (text, good) => { msg.textContent = text; msg.classList.toggle("good", !!good); };
    function draw() {
      regBox.setState(step >= 1 ? "used" : step === 0 ? "next" : "idle");
      pcBox.setState(step >= 3 ? "used" : step === 2 ? "next" : "idle");
      for (const [f, filledAt, targetAt] of [[regField, 2, 1], [pcField, 4, 3]]) {
        f.classList.toggle("is-filled", step >= filledAt);
        f.classList.toggle("is-target", step === targetAt);
        f.readOnly = step >= filledAt;
        f.placeholder = step === targetAt ? "Paste here" : "";
      }
      done.replaceChildren(...(step === 4 ? [h("p", { class: "try-msg good" }, "Done. That's the whole trick: tap to copy, paste into the ticket site, move on. It works the same for everyone in your group.")] : []));
      msg.hidden = step === 4;
    }
    async function tapBox(which) {
      if (which === "reg" && step === 0) {
        await copyText(P.reg);
        step = 1;
        setMsg(`Copied, the whole number in one tap. Now paste it into the Registration no. box below: ${howToPaste}.`, true);
      } else if (which === "pc" && step === 2) {
        await copyText(P.postcode);
        step = 3;
        setMsg(`Copied. Now paste it into the Postcode box: ${howToPaste}.`, true);
      } else if (step === 1 || step === 3) {
        setMsg(`Now paste it into the highlighted box below: ${howToPaste}.`);
      } else if (step === 2) {
        setMsg("Next, tap the postcode to copy it.");
      }
      draw();
    }
    function onType(which) {
      const f = which === "reg" ? regField : pcField;
      const v = f.value.trim();
      if (!v) return;
      const right = which === "reg" ? digits(v) === P.reg : normPostcode(v) === P.postcode;
      if (which === "reg" && step <= 1 && right) { step = 2; f.value = P.reg; setMsg("Pasted. Now tap the postcode above to copy it."); }
      else if (which === "pc" && step === 3 && right) { step = 4; f.value = P.postcode; }
      else if (which === "pc" && step < 2) { f.value = ""; setMsg("Start with the reg number: tap it above to copy it."); }
      else if (!right && v.length >= (which === "reg" ? 10 : 6)) setMsg("That doesn't match. Copy it from the box above, then paste it here.");
      draw();
    }
    regField.addEventListener("input", () => onType("reg"));
    pcField.addEventListener("input", () => onType("pc"));
    for (const [f, at] of [[regField, 0], [pcField, 2]]) f.addEventListener("focus", () => { if (step === at) setMsg("Copy it first: tap the highlighted box above."); });
    const reset = h("button", { type: "button", class: "textbtn", onclick: () => { step = 0; regField.value = pcField.value = ""; setMsg("Tap the reg number to copy it. Example data."); draw(); } }, "Reset");
    setMsg("Tap the reg number to copy it. Example data.");
    draw();
    return h("section", { class: "card", "aria-label": "Try it" },
      h("div", { class: "card-head" }, h("span", { class: "card-title" }, "Try it"), reset),
      h("div", { class: "copy-grid" }, regBox, pcBox),
      h("div", { class: "mock" },
        h("div", { class: "mock-cap" }, "Practice ticket form"),
        h("label", { class: "mock-row" }, h("span", null, "Registration no."), regField),
        h("label", { class: "mock-row" }, h("span", null, "Postcode"), pcField)),
      msg, done);
  }

  // ---------- home ----------
  const FAQ = [
    ["Does it get me tickets faster?", "It saves you the scramble for numbers once you're through. The queue is still the queue."],
    ["Where are our numbers kept?", "In this browser, on this phone. There's no account and no server copy, so clearing your browser clears them."],
    ["Is this the official site?", "No. It's a free helper. You still buy tickets on the official ticket site."],
    ["Who made this?", "A product manager who got fed up scrolling the group chat for six numbers every ticket day."],
  ];
  function faqList(items) {
    return h("div", { class: "faq-list" }, items.map(([q, a]) =>
      h("details", { class: "faq" }, h("summary", null, h("span", null, q), h("span", { class: "faq-sign", "aria-hidden": "true" })), h("p", null, a))));
  }
  const GUIDE_LINKS = [
    ["/guides/how-glastonbury-registration-works/", "How Glastonbury registration works"],
    ["/guides/how-the-ticket-queue-works/", "How the ticket queue works"],
    ["/guides/ticket-day-checklist/", "Ticket day checklist"],
    ["/guides/buying-tickets-for-a-group/", "Buying tickets for a group"],
  ];
  function viewHome() {
    const all = loadAll();
    const ids = Object.keys(all).sort((a, b) => (all[b].created || 0) - (all[a].created || 0));
    return h("div", { class: "view v-home" },
      h("div", { class: "topbar" }, h("span", { class: "wordmark" }, "Glasto Quick Copy"), h("span", null, "Free and unofficial")),
      h("h1", { class: "display" }, "Through the Glasto queue? Fill in your whole group in seconds."),
      h("p", { class: "lead" }, "When you reach the booking page, the clock is running and you need up to six registration numbers and postcodes. Get them all on one page before ticket day, then tap to copy and paste each one. No hunting through the group chat."),
      tryIt(),
      h("a", { class: "btn btn-primary", href: "#/new" }, "Make your group's page"),
      ids.length ? h("div", { class: "saved-list" }, ids.map(id => h("a", { class: "saved", href: "#/p/" + id },
        h("span", null, h("span", { class: "meta" }, "Saved on this phone"), h("span", { class: "names" }, firstNames(all[id].people))),
        h("span", { class: "open" }, "Open ›")))) : null,
      h("section", { class: "section" },
        h("h2", null, "How it works"),
        h("ol", { class: "steps" },
          [["Add your group.", " Everyone's reg numbers and postcodes, together on one page."],
           ["Send everyone the link.", " It opens the same page on their phones."],
           ["Tap, paste, next.", " Each box goes blue once it's used, so you know who's done."]]
            .map(([b, rest], i) => h("li", null, h("span", { class: "num" }, String(i + 1)), h("span", null, h("strong", null, b), rest))))),
      h("section", { class: "section" }, h("h2", null, "Questions"), faqList(FAQ)),
      h("section", { class: "section guides-links" },
        h("h2", null, "Ticket day guides"),
        h("ul", null, GUIDE_LINKS.map(([href, t]) => h("li", null, h("a", { href }, t)))),
        h("p", null, h("a", { href: "/guides/" }, "All guides"), " or ", h("a", { href: "/faq/" }, "read the FAQ"))),
      ad("home-end"),
      footer());
  }
  const firstNames = (people) => shareNames(people).filter(Boolean).join(", ");

  // ---------- import parser ----------
  // Runs locally on what's pasted; the raw text is never stored.
  const STOPWORDS = new Set(["reg", "registration", "here", "is", "my", "number", "no", "num", "postcode", "pc", "and", "the", "its", "mine", "it's", "im", "i'm", "hi", "hey",
    "name", "post", "code", "ref", "it", "this", "that", "for", "me", "you", "your", "our", "his", "her", "their", "of", "to", "at", "on", "in", "a", "an",
    "thanks", "thank", "cheers", "ok", "okay", "yes", "yeah", "lol", "great", "sure", "nice", "done", "same", "as", "too", "also", "please", "pls", "booked", "ticket", "tickets"]);
  const TITLES = new Set(["mr", "mrs", "ms", "miss", "mx", "dr"]);
  // WhatsApp copy/export prefixes: "[03/10, 18:07] Richard: " (iPhone) and "03/10/2026, 18:07 - Richard: " (Android).
  // The sender is dropped; the person is whoever the message names.
  const CHAT_PREFIX = /^\s*(?:\[[^\]]{1,40}\]|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?m\.?)?\s*[-\u2013\u2014])\s*(?:[^:]{1,40}:\s)?/i;
  const NAME_LABEL = /^\s*(?:full\s+)?names?\s*[:=-]\s*/i;
  const tidyWord = (w) => (w === w.toLowerCase() || w === w.toUpperCase()) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
  const nameWords = (s) => (s.match(/[\p{L}][\p{L}'’-]*/gu) || []).filter(w => !TITLES.has(w.toLowerCase().replace(/\.$/, "")));
  // Finds people in pasted chat text. A person can be on one line ("Alex 1029384756 BS1 4DJ")
  // or spread over several (name, then reg number, then postcode), as when friends message
  // their details one per line. Every reg number is one person; names and postcodes attach to
  // the reg number they sit next to.
  function parseImport(text) {
    const people = [];
    let cur = {};
    const push = () => {
      if (cur.reg && people.length < MAX_PEOPLE) people.push({ name: (cur.name || `Person ${people.length + 1}`).slice(0, 60), reg: cur.reg, postcode: cur.postcode || "" });
      cur = {};
    };
    for (const rawLine of String(text).split(/\r?\n/)) {
      if (people.length >= MAX_PEOPLE) break;
      let line = rawLine.slice(0, 300).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").replace(CHAT_PREFIX, "").replace(NAME_LABEL, "");
      let reg = "";
      const m = line.match(/\d[\d\s-]{6,20}\d/);
      if (m) {
        const d = digits(m[0]);
        if (d.length >= 8 && d.length <= MAX_REG_DIGITS) reg = d;
        line = line.slice(0, m.index) + " " + line.slice(m.index + m[0].length);
      }
      let postcode = "";
      const pm = line.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i);
      if (pm) { postcode = normPostcode(pm[1] + pm[2]); line = line.slice(0, pm.index) + " " + line.slice(pm.index + pm[0].length); }
      let name = "";
      if (reg) {
        // name on the same line as the details: the words that aren't filler ("sam here! reg ...")
        name = nameWords(line).filter(w => !STOPWORDS.has(w.toLowerCase())).slice(0, 3).map(tidyWord).join(" ");
      } else if (!m && !postcode && line.trim().length <= 40 && !/[?!@#\d]/.test(line)) {
        // a line on its own counts as a name only if it looks like one: 1 to 4 words, no filler
        const words = nameWords(line);
        if (words.length && words.length <= 4 && !words.some(w => STOPWORDS.has(w.toLowerCase()))) name = words.map(tidyWord).join(" ");
      }
      if (name) {
        if (cur.reg) push(); else if (cur.postcode) cur = {};
        cur.name = name;
      }
      if (reg) { if (cur.reg) push(); cur.reg = reg; }
      if (postcode) { if (cur.postcode && cur.reg) push(); cur.postcode = postcode; }
    }
    push();
    return people;
  }

  // ---------- create (paste from chat) ----------
  let pendingRows = null; // hand-off from the import screen to the manual form (memory only)
  function viewCreate() {
    let found = [];
    const results = h("div", { class: "results", "aria-live": "polite" });
    const submit = h("button", { type: "button", class: "btn btn-primary" });
    const ta = h("textarea", { class: "import", rows: "6", placeholder: "e.g. Alex 1029384756 BS1 4DJ", spellcheck: "false", autocomplete: "off", maxlength: "6000" });
    function draw() {
      const head = found.length ? `Found ${found.length} ${found.length === 1 ? "person" : "people"}` : "No reg numbers found yet";
      results.replaceChildren(...[
        h("div", { class: "res-head" }, h("span", null, head), h("span", { class: "max" }, `${MAX_PEOPLE} max`)),
        found.map(p => {
          const row = h("div", { class: "res-row" },
            h("span", { class: "avatar", "aria-hidden": "true" }, p.name.charAt(0).toUpperCase()),
            h("span", null, h("div", { class: "res-name" }, p.name),
              h("div", { class: "res-sub" }, h("span", null, p.reg), h("span", null, p.postcode || "no postcode"))));
          if (p.postcode) { row.append(h("span", { class: "status ready" }, "Ready")); return row; }
          // Missing details can only be added on the next screen, so explain rather than ask here
          const note = h("p", { class: "res-note", hidden: true }, "We couldn't pick out a postcode here, but don't worry: you can add it in the next step.");
          const toggle = h("button", { type: "button", class: "status missing", "aria-expanded": "false", onclick: () => {
            note.hidden = !note.hidden;
            toggle.setAttribute("aria-expanded", String(!note.hidden));
          } }, "Almost ready");
          row.append(toggle, note);
          return row;
        }),
        h("button", { type: "button", class: "res-foot", onclick: () => { pendingRows = { rows: found.map(p => ({ ...p })), showErrors: false }; go("add"); } }, "+ Add someone by hand")].flat());
      submit.textContent = !found.length ? "Create group"
        : found.some(p => !p.postcode) ? "Next step: Confirm your details"
        : `Create group (${found.length} ${found.length === 1 ? "person" : "people"})`;
      submit.disabled = !found.length;
    }
    ta.addEventListener("input", () => { found = parseImport(ta.value); draw(); });
    submit.addEventListener("click", () => {
      if (!found.length) return;
      if (found.some(p => !p.postcode)) {
        pendingRows = { rows: found.map(p => ({ ...p })), showErrors: true };
        go("add");
        return;
      }
      const pid = savePage(null, found);
      if (pid) { toast("Saved on this phone"); go("p/" + pid); }
    });
    draw();
    return h("div", { class: "view v-create" },
      back("#/", "Back"),
      h("h1", null, "Who's in your group?"),
      h("label", { class: "import-label" }, "Paste the messages from your group chat", ta),
      h("p", { class: "help" }, "We pick out names, reg numbers and postcodes as you paste."),
      results,
      submit,
      h("p", { class: "cta-note" }, "Saves on this phone. You can edit anything after."),
      ad("create-end"));
  }

  function savePage(id, people) {
    const all = loadAll();
    if (id && !all[id]) { toast("This group was deleted in another tab", true); go(""); return null; }
    const pid = id || newId();
    all[pid] = { created: id ? all[id].created : Date.now(), people: people.map(p => ({ name: p.name, reg: p.reg, postcode: p.postcode })) };
    return saveAll(all) ? pid : null;
  }

  // ---------- edit / add by hand ----------
  function viewEditor(id) {
    const all = loadAll();
    const existing = id ? all[id] : null;
    if (id && !existing) return viewMissing();
    const handoff = !id && pendingRows ? pendingRows : null;
    pendingRows = null;
    const src = existing ? existing.people : handoff ? handoff.rows : [];
    const rows = [];
    const wrap = h("div", { class: "view v-edit" });
    const list = h("div", { class: "section" });
    const banner = h("div", { class: "banner-ok", role: "status", hidden: true });
    const addBtn = h("button", { type: "button", class: "add-person", onclick: () => addRow({}) });

    function renumber() {
      rows.forEach((r, i) => { r.title.textContent = `Person ${i + 1}`; });
      addBtn.disabled = rows.length >= MAX_PEOPLE;
      addBtn.textContent = rows.length >= MAX_PEOPLE ? `${MAX_PEOPLE} people max per booking` : "+ Add person";
    }
    function addRow(p) {
      if (rows.length >= MAX_PEOPLE) return;
      const r = {
        title: h("span"),
        name: h("input", { class: "input", type: "text", maxlength: "60", placeholder: "First name is enough", value: p.name || "", autocomplete: "off" }),
        reg: h("input", { class: "input mono", type: "text", inputmode: "numeric", maxlength: "16", placeholder: "Digits only", value: p.reg || "", autocomplete: "off" }),
        postcode: h("input", { class: "input mono", type: "text", maxlength: "12", placeholder: "e.g. BS1 4DJ", autocapitalize: "characters", value: p.postcode || "", autocomplete: "off" }),
        err: h("p", { class: "err", role: "alert" }),
      };
      r.card = h("div", { class: "card ecard" },
        h("div", { class: "ehead" }, r.title, h("button", { type: "button", class: "textbtn", onclick: () => { rows.splice(rows.indexOf(r), 1); r.card.remove(); renumber(); } }, "Remove")),
        h("label", { class: "field" }, "Name", r.name),
        h("div", { class: "egrid" }, h("label", { class: "field" }, "Reg number", r.reg), h("label", { class: "field" }, "Postcode", r.postcode)),
        r.err);
      rows.push(r);
      list.append(r.card);
      renumber();
    }
    function validate(r) {
      const name = r.name.value.trim(), reg = digits(r.reg.value), postcode = normPostcode(r.postcode.value);
      const blank = !name && !reg && !postcode;
      const msgs = [];
      let regBad = false, pcBad = false;
      if (!blank) {
        if (!reg) { msgs.push("Add a reg number (digits only)."); regBad = true; }
        else if (reg.length > MAX_REG_DIGITS) { msgs.push(`Reg numbers are at most ${MAX_REG_DIGITS} digits.`); regBad = true; }
        if (!postcode) { msgs.push("Add a postcode."); pcBad = true; }
      }
      r.err.textContent = msgs.join(" ");
      r.reg.classList.toggle("bad", regBad);
      r.postcode.classList.toggle("bad", pcBad);
      r.card.classList.toggle("has-error", msgs.length > 0);
      return { blank, ok: !msgs.length, person: { name: name || "Unnamed", reg, postcode } };
    }
    (src.length ? src : [{}]).forEach(addRow);
    if (handoff && handoff.showErrors) rows.forEach(validate);

    const save = h("button", { type: "button", class: "btn btn-primary" }, id ? "Save changes" : "Details correct, Create group");
    save.addEventListener("click", () => {
      const results = rows.map(validate);
      const people = results.filter(x => !x.blank).map(x => x.person);
      if (results.some(x => !x.ok)) { toast("Check the highlighted boxes", true); return; }
      if (!people.length) { toast("Add at least one person", true); return; }
      const pid = savePage(id, people);
      if (!pid) return;
      banner.textContent = "Saved on this phone ✓";
      banner.hidden = false;
      toast("Saved on this phone");
      go("p/" + pid);
    });
    wrap.append(
      back(id ? "#/p/" + id : "#/new", "Back"),
      h("h1", null, id ? "Edit group" : handoff ? "Confirm your details" : "Add people"),
      list, addBtn, banner, save, ad("editor-end"));
    return wrap;
  }

  // ---------- ticket day ----------
  const usedKey = (id) => "tdqc:used:" + id;
  function loadUsed(id) {
    if (DEMO) return new Set();
    try { const a = JSON.parse(sessionStorage.getItem(usedKey(id))); return new Set(Array.isArray(a) ? a.filter(x => /^[rp][0-5]$/.test(x)) : []); } catch { return new Set(); }
  }
  function saveUsed(id, set) {
    if (DEMO) return;
    try { sessionStorage.setItem(usedKey(id), JSON.stringify([...set])); } catch {}
  }

  // Keep-screen-on. The browser drops the lock when the tab is hidden, so re-request on return.
  let wake = { on: false, sentinel: null, onVis: null };
  async function wakeRequest() {
    try { wake.sentinel = await navigator.wakeLock.request("screen"); return true; } catch { return false; }
  }
  function wakeStop() {
    wake.on = false;
    if (wake.sentinel) { try { wake.sentinel.release(); } catch {} wake.sentinel = null; }
    if (wake.onVis) { document.removeEventListener("visibilitychange", wake.onVis); wake.onVis = null; }
  }

  function viewPage(id) {
    const all = loadAll();
    const page = all[id];
    if (!page) return viewMissing();
    const people = page.people;
    const total = people.length * 2;
    const used = loadUsed(id);
    const failed = new Set();
    const order = people.flatMap((_, i) => ["r" + i, "p" + i]);
    const boxes = new Map();
    const pstatus = [];
    const names = page.people.map(p => p.name.trim() || "Unnamed");

    const progressV = h("span", { class: "v" });
    const fill = h("div", { class: "bar-fill" });
    const progress = h("div", { class: "stat", role: "status", "aria-live": "polite" }, h("span", { class: "lbl" }, "Progress"), progressV, h("div", { class: "bar" }, fill));
    const finish = h("div", { class: "card finish", hidden: true },
      h("p", null, "That's ticket day: every box copied in a few taps. Ready to set up your own group?"),
      h("a", { class: "btn btn-primary btn-sm", href: "./#/new" }, "Start the tool for real"));

    function update() {
      const next = order.find(k => !used.has(k));
      for (const [k, b] of boxes) b.setState(used.has(k) ? "used" : failed.has(k) ? "fail" : k === next ? "next" : "idle");
      people.forEach((_, i) => {
        const n = (used.has("r" + i) ? 1 : 0) + (used.has("p" + i) ? 1 : 0);
        pstatus[i].textContent = n === 2 ? "Done ✓" : n === 1 ? "1 of 2" : "";
      });
      const count = order.filter(k => used.has(k)).length;
      progressV.textContent = count === total ? "All done ✓" : `${count} of ${total} copied`;
      fill.style.width = `${Math.round((count / total) * 100)}%`;
      finish.hidden = !(DEMO && count === total);
    }
    async function tap(k, value) {
      const ok = await copyValue(value);
      if (ok) { used.add(k); failed.delete(k); saveUsed(id, used); }
      else failed.add(k);
      update();
    }

    const cards = people.map((p, i) => {
      const r = copyBox("Reg number", p.reg, () => tap("r" + i, p.reg));
      const c = copyBox("Postcode", p.postcode, () => tap("p" + i, p.postcode));
      boxes.set("r" + i, r); boxes.set("p" + i, c);
      pstatus[i] = h("span", { class: "pstatus" });
      return h("section", { class: "card person", "aria-label": names[i] },
        h("div", { class: "person-head" }, h("span", { class: "name" }, names[i]), pstatus[i]),
        h("div", { class: "copy-grid" }, r, c));
    });

    // Keep screen on (hidden when the browser doesn't support it)
    let wakeCard = null;
    if ("wakeLock" in navigator) {
      const v = h("span", { class: "v" }, "Off");
      wakeCard = h("button", { type: "button", class: "stat", role: "switch", "aria-checked": "false" },
        h("span", { class: "lbl" }, "Keep screen on"),
        h("span", { class: "switch-row" }, v, h("span", { class: "switch", "aria-hidden": "true" }, h("span", { class: "knob" }))));
      const set = (on) => { wake.on = on; wakeCard.setAttribute("aria-checked", String(on)); v.textContent = on ? "On" : "Off"; };
      wakeCard.addEventListener("click", async () => {
        if (wake.on) { wakeStop(); set(false); return; }
        if (await wakeRequest()) {
          set(true);
          wake.onVis = async () => { if (wake.on && document.visibilityState === "visible" && !(wake.sentinel && !wake.sentinel.released)) await wakeRequest(); };
          document.addEventListener("visibilitychange", wake.onVis);
        } else {
          set(false);
          toast("Couldn't keep the screen on in this browser", true);
        }
      });
    }

    const clear = h("button", { type: "button", class: "linkbtn clear-ticks", onclick: () => { used.clear(); failed.clear(); saveUsed(id, used); update(); } }, "Clear ticks");
    update();
    return h("div", { class: "view v-day" },
      DEMO ? h("div", { class: "demo-banner" }, "Demo with made-up people. Nothing is saved.") : null,
      back(DEMO ? "./" : "#/", DEMO ? "Make your own" : "All groups"),
      h("div", null, h("h1", { class: "day" }, firstNames(people)), h("p", { class: "subtitle" }, "Tap a box, then paste it into the ticket site.")),
      h("div", { class: "stats" + (wakeCard ? "" : " single") }, progress, wakeCard),
      // an ad between one person and the next (never inside a card), drawn as its own marked panel
      cards.flatMap((c, i) => (i ? [ad("group-between"), c] : [c])),
      finish,
      clear,
      shareCard(page),
      DEMO ? null : h("div", { class: "bottom-row" },
        h("span", null, "Saved on this phone"),
        h("span", { class: "acts" },
          h("a", { class: "linkbtn", href: "#/edit/" + id }, "Edit"),
          h("button", { type: "button", class: "linkbtn danger", onclick: () => {
            if (!confirm(`Delete ${firstNames(people)} from this phone?`)) return;
            const a = loadAll(); delete a[id]; saveAll(a);
            try { sessionStorage.removeItem(usedKey(id)); } catch {}
            toast("Group deleted"); go("");
          } }, "Delete"))),
      ad("group-end"));
  }

  function shareUrl(page) {
    // The demo lives at demo.html; its links should open in the real app
    const path = location.pathname.replace(/demo\.html$/, "");
    return `${location.origin}${path}#/s/${encodeShare(page)}`;
  }
  function shareCard(page) {
    const url = shareUrl(page);
    const canShare = typeof navigator.share === "function";
    const label = canShare ? "Share link" : "Copy link";
    const btn = h("button", { type: "button", class: "btn btn-primary" }, label);
    btn.addEventListener("click", async () => {
      if (canShare) {
        try { await navigator.share({ title: "Glasto Quick Copy", text: `Our group: ${firstNames(page.people)}`, url }); return; }
        catch (e) { if (e && e.name === "AbortError") return; }
      }
      if (await copyText(url)) {
        btn.textContent = "Link copied ✓";
        setTimeout(() => { btn.textContent = label; }, 1500);
      } else toast("Couldn't copy the link", true);
    });
    const decoded = decodeShare(encodeShare(page));
    const rows = decoded ? decoded.people : [];
    return h("section", { class: "card share" },
      h("h2", null, "Send to your group"),
      h("p", null, "Opens this same page on their phones, ready to tap."),
      btn,
      h("details", { class: "inlink" },
        h("summary", null, "What's in the link?"),
        h("div", { class: "link-box" },
          rows.map(p => h("div", { class: "lrow" }, h("span", null, p.name), h("span", { class: "vals" }, h("span", null, p.reg), h("span", null, p.postcode)))),
          h("p", { class: "link-foot" }, "Just these: first names, registration numbers and postcodes. No surnames; two people with the same first name are numbered. Anyone with the group link can read the names, registration numbers and postcodes. Share it only with your group."))));
  }

  // ---------- share link opened ----------
  function viewShared(enc) {
    const page = decodeShare(enc);
    if (!page) return viewBroken();
    const all = loadAll();
    const key = JSON.stringify(page.people);
    const existing = Object.keys(all).find(id => JSON.stringify(all[id].people) === key);
    if (existing) { location.replace("#/p/" + existing); return null; }
    const save = h("button", { type: "button", class: "btn btn-primary" }, "Save to this phone");
    save.addEventListener("click", () => {
      const a = loadAll();
      const again = Object.keys(a).find(id => JSON.stringify(a[id].people) === key);
      const pid = again || newId();
      if (!again) { a[pid] = { created: Date.now(), people: page.people }; if (!saveAll(a)) return; }
      toast("Saved on this phone");
      location.replace("#/p/" + pid);
    });
    const notNow = h("button", { type: "button", class: "btn btn-secondary", onclick: () => location.replace("#/") }, "Not now");
    return h("div", { class: "view v-inter" },
      h("h1", null, "Your group's ready"),
      h("p", { class: "lead" }, "Check everyone's here, then save it for ticket day."),
      h("div", { class: "card ilist" },
        page.people.map(p => h("div", { class: "irow" }, h("span", null, p.name), h("span", { class: "vals" }, h("span", null, p.reg), h("span", null, p.postcode)))),
        h("p", { class: "note" }, "From the link you were sent")),
      h("div", { class: "btn-row" }, save, notNow));
  }

  function viewMissing() {
    return h("div", { class: "view v-inter" },
      h("h1", { class: "small" }, "This group isn't on this phone"),
      h("p", { class: "lead" }, "Groups are saved on the phone that made them. Open it there, or ask whoever made it to send you the link."),
      h("a", { class: "btn btn-secondary", href: "#/" }, "Back to home"));
  }
  function viewBroken() {
    return h("div", { class: "view v-inter" },
      h("h1", { class: "small" }, "This link doesn't open"),
      h("p", { class: "lead" }, "It may have been cut off when it was copied. Ask whoever sent it for a fresh one."),
      h("a", { class: "btn btn-secondary", href: "#/" }, "Back to home"));
  }

  // ---------- how your data is handled ----------
  function viewData() {
    const sha = deployedCommit();
    const hasData = !DEMO && Object.keys(loadAll()).length > 0;
    const block = (title, ...body) => h("section", { class: "dblock" }, h("h2", { class: "plain" }, title), h("p", null, ...body));
    return h("div", { class: "view v-data" },
      back("#/", "Home"),
      h("h1", null, "How your data is handled"),
      block("Where it's saved", "In this browser's storage, on this phone only. No accounts and no database."),
      block("Is it sent anywhere?", "Not by this tool. Its code makes no network requests and there's no server copy of your group."),
      block("Ads", "The site is free because it shows Google ads. As on any site with ads, Google's ad code runs on these pages and Google uses cookies to show and measure ads. ", h("a", { href: "/privacy/" }, "Privacy and cookies")),
      block("Share links", "First names, reg numbers and postcodes are packed into the part of the link after the #, which browsers never send to a server. Surnames are left out: two people with the same first name are numbered instead (Alex 1, Alex 2). It's encoded, not encrypted, so anyone with the link can read it."),
      block("Your clipboard", "Some keyboards, like Gboard, keep a clipboard history. You can clear it from the keyboard's clipboard menu after ticket day."),
      h("section", { class: "card check" },
        h("h2", { class: "plain" }, "Check it yourself"),
        h("p", null, "The code is public. Every 6 hours a public check compares the live site with it, file by file."),
        sha ? h("p", null, h("span", { class: "dot big", "aria-hidden": "true" }), "Running version ", ext(`${SOURCE_REPO}/commit/${sha}`, sha.slice(0, 7), "mono")) : null,
        h("div", { class: "links" }, ext(SOURCE_REPO, "View the code"), ext(`${SOURCE_REPO}/actions/workflows/verify-live.yml`, "See every check"))),
      hasData ? h("button", { type: "button", class: "btn btn-danger", onclick: () => {
        if (!confirm("Delete all your groups from this phone?")) return;
        try { localStorage.removeItem(KEY); } catch {}
        toast("Everything deleted");
        render();
      } }, "Delete everything on this phone") : null,
      ad("data-end"));
  }

  // ---------- router ----------
  function render() {
    wakeStop();
    let route = location.hash.replace(/^#\/?/, "");
    if (DEMO && !route) route = "p/demo";
    const [view, ...rest] = route.split("/");
    const arg = rest.join("/");
    let node;
    if (view === "new") node = viewCreate();
    else if (view === "add") node = viewEditor(null);
    else if (view === "edit") node = viewEditor(arg);
    else if (view === "p") node = viewPage(arg);
    else if (view === "s") node = viewShared(arg);
    else if (view === "data") node = viewData();
    else node = viewHome();
    if (!node) return; // the view redirected
    app.replaceChildren(node);
    if (window.GQCAds) window.GQCAds.fill(app);
    document.title = view === "p" && loadAll()[arg] ? `${pageTitle(loadAll()[arg].people)} | Glasto Quick Copy` : "Glasto Quick Copy";
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  // Keep other open tabs in sync, but never wipe a form someone is typing in
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && !/^#\/(new|add|edit\/)/.test(location.hash)) render();
  });
  render();
})();
