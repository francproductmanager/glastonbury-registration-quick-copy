// Ad slots. Every page marks the places an ad may appear with <div class="ad-slot" data-slot="NAME">.
// Google never places ads anywhere else (keep Auto ads switched off in AdSense for this site).
// A slot stays hidden until it has an AdSense ad unit ID below. To add one: in AdSense go to
// Ads > By ad unit > Display ads, create a unit, and paste its data-ad-slot number here.
(() => {
  const CLIENT = "ca-pub-2229524942259780";
  const SLOTS = {
    // the tool
    "home-mid": "",      // home: after "How it works"
    "home-end": "",      // home: after the questions
    "create-end": "",    // paste screen: below the Create button
    "editor-end": "",    // add or edit people: below the Save button
    "group-end": "",     // ticket day: at the very bottom, below sharing and Edit/Delete, away from the copy boxes
    "shared-end": "",    // opening a shared link: below Save / Not now
    "data-end": "",      // how your data is handled: at the bottom
    // the guides and info pages
    "guide-top": "",     // each guide: after the intro
    "guide-mid": "",     // each guide: halfway through
    "guide-end": "",     // each guide: before "Related guides"
    "guides-end": "",    // guides list: below the list
    "faq-mid": "",       // FAQ: halfway down the questions
    "faq-end": "",       // FAQ: at the bottom
    "about-end": "",     // About: at the bottom
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
    }
  }
  window.GQCAds = { fill };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => fill());
  else fill();
})();
