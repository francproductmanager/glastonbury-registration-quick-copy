// Ad slots. Every page marks the places an ad may appear with <div class="ad-slot" data-slot="NAME">.
// Google never places ads anywhere else (keep Auto ads switched off in AdSense for this site).
// A slot with no ad unit ID ("") stays hidden. To give a slot its own unit: in AdSense go to
// Ads > By ad unit, create a unit, and paste its data-ad-slot number here. 2945530362 is the
// "Standard" responsive display unit. A slot whose ad doesn't load (ad blocker, no ad to show)
// takes up no space; it's only drawn, labelled, once Google fills it (see .ad-slot in the CSS).
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
  window.GQCAds = { fill };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
