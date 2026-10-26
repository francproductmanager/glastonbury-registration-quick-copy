// Small extras for the guides pages: a Copy button on each ready-made message, and a Print
// button above tickable checklists. It runs only on those pages and makes no network requests.
(function () {
  for (const q of document.querySelectorAll("blockquote.msg")) {
    const text = q.querySelector("p");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "msg-copy";
    btn.textContent = "Copy message";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text.textContent);
        btn.textContent = "Copied";
      } catch {
        // no clipboard access: select the words so they can be copied by hand
        const range = document.createRange();
        range.selectNodeContents(text);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        btn.textContent = "Selected: now copy it";
      }
      setTimeout(() => { btn.textContent = "Copy message"; }, 2500);
    });
    q.append(btn);
  }
  const list = document.querySelector("ul.checks");
  if (list && window.print) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "print-btn";
    btn.textContent = "Print this checklist";
    btn.addEventListener("click", () => window.print());
    const p = document.createElement("p");
    p.append(btn);
    list.closest("article").querySelector(".byline").after(p);
  }
})();
