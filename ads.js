// Ad slots. Every page marks the places an ad may appear with <div class="ad-slot" data-slot="NAME">.
// Google never places ads anywhere else (keep Auto ads switched off in AdSense for this site).
// A slot with no ad unit ID ("") stays hidden. To give a slot its own unit: in AdSense go to
// Ads > By ad unit, create a unit, and paste its data-ad-slot number here. 2945530362 is the
// "Standard" responsive display unit. A slot whose ad doesn't load (ad blocker, no ad to show)
// takes up no space; it's only drawn, labelled, once Google fills it (see .ad-slot in the CSS).
// Google's ad script (LOADER) is added by this file once the page has loaded and been drawn, so
// the ads never slow down the page itself. Ads queued before it arrives are filled when it does.
(() => {
  const CLIENT = "ca-pub-2229524942259780";
  const SLOTS = {
    // the tool: only the home screen, which has real content. The screens you use to set up,
    // edit and copy your group carry no ads: they're working screens, not content, and ads
    // there would sit next to buttons people tap in a hurry.
    "home-end": "2945530362",      // home: after the questions and the explanation of the tool
    // the guides and info pages
    "guide-top": "2945530362",     // each guide: after the intro
    "guide-mid": "2945530362",     // each guide: halfway through
    "guide-end": "2945530362",     // each guide: before "Related guides"
    "guides-end": "2945530362",    // guides list: below the list
    "faq-mid": "2945530362",       // FAQ: halfway down the questions
    "faq-end": "2945530362",       // FAQ: at the bottom
    "about-end": "2945530362",     // About: at the bottom
  };
  function fill(root) {
    for (const el of (root || document).querySelectorAll(".ad-slot:not([data-filled])")) {
      const id = SLOTS[el.getAttribute("data-slot")];
      if (!/^\d{6,12}$/.test(id || "")) continue;
      el.setAttribute("data-filled", "");
      const label = document.createElement("p");
      label.className = "ad-label";
      label.textContent = "Advertisement";
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.setAttribute("data-ad-client", CLIENT);
      ins.setAttribute("data-ad-slot", id);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      el.append(label, ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
      watch(el, ins);
    }
  }
  // A slot only shows once Google has really put an ad in it. Until then (and if it never does:
  // ad blocker, nothing to show, site awaiting approval) it collapses to zero height but keeps
  // its width, so Google can still measure it and fill it later.
  function watch(el, ins) {
    const check = () => {
      const filled = ins.getAttribute("data-ad-status") === "filled";
      el.classList.toggle("is-live", filled);
      el.classList.toggle("is-empty", !filled);
    };
    check();
    if (typeof MutationObserver === "function") new MutationObserver(check).observe(ins, { attributes: true, attributeFilter: ["data-ad-status", "data-adsbygoogle-status"] });
  }
  const LOADER = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT;
  function loadGoogle() {
    if (document.querySelector('script[src^="https://pagead2.googlesyndication.com/"]')) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = LOADER;
    s.crossOrigin = "anonymous";
    document.head.append(s);
  }
  // Google's script is large and busy when it starts, so it waits until the page has loaded and
  // been painted, and then until the visitor first scrolls, taps, moves the mouse or presses a
  // key, or 5 seconds have passed. Until then the page responds to them at full speed.
  function afterPaint(cb) {
    let done = false;
    const go = () => { if (!done) { done = true; setTimeout(cb, 0); } };
    const types = (typeof PerformanceObserver === "function" && PerformanceObserver.supportedEntryTypes) || [];
    if (!types.includes("largest-contentful-paint")) return go();
    try { new PerformanceObserver((list, obs) => { obs.disconnect(); go(); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { go(); }
    setTimeout(go, 3000); // never wait longer than this
  }
  function whenActiveOrSoon(cb) {
    const events = ["scroll", "pointerdown", "pointermove", "keydown", "touchstart", "wheel"];
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      for (const e of events) removeEventListener(e, go, { passive: true });
      cb();
    };
    for (const e of events) addEventListener(e, go, { passive: true });
    setTimeout(go, 5000);
  }
  const start = () => afterPaint(() => whenActiveOrSoon(loadGoogle));
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
  window.GQCAds = { fill };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
