const DEFAULTS = {
  iframeUrl: "",
  width: 400,
  title: "Noxus",
  noxusBaseUrl: "",
};

const els = {
  iframeUrl: document.getElementById("iframeUrl"),
  title: document.getElementById("title"),
  width: document.getElementById("width"),
  noxusBaseUrl: document.getElementById("noxusBaseUrl"),
  status: document.getElementById("status"),
};

chrome.storage.sync.get(DEFAULTS, (s) => {
  els.iframeUrl.value = s.iframeUrl || "";
  els.title.value = s.title || "Noxus";
  els.width.value = s.width || 400;
  els.noxusBaseUrl.value = s.noxusBaseUrl || "";
});

document.getElementById("save").addEventListener("click", () => {
  const width = Math.min(Math.max(parseInt(els.width.value, 10) || 400, 280), 900);
  chrome.storage.sync.set(
    {
      iframeUrl: els.iframeUrl.value.trim(),
      title: els.title.value.trim() || "Noxus",
      width,
      noxusBaseUrl: els.noxusBaseUrl.value.trim().replace(/\/+$/, ""),
    },
    () => {
      els.status.textContent = "Saved ✓";
      setTimeout(() => (els.status.textContent = ""), 1500);
    }
  );
});
