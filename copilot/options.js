const DEFAULTS = {
  iframeUrl: "",
  width: 400,
  title: "Noxus",
  auth0Domain: "",
  auth0ClientId: "",
  auth0Audience: "",
};

const els = {
  iframeUrl: document.getElementById("iframeUrl"),
  title: document.getElementById("title"),
  width: document.getElementById("width"),
  auth0Domain: document.getElementById("auth0Domain"),
  auth0ClientId: document.getElementById("auth0ClientId"),
  auth0Audience: document.getElementById("auth0Audience"),
  redirectUri: document.getElementById("redirectUri"),
  status: document.getElementById("status"),
};

els.redirectUri.value = chrome.identity.getRedirectURL();

chrome.storage.sync.get(DEFAULTS, (s) => {
  els.iframeUrl.value = s.iframeUrl || "";
  els.title.value = s.title || "Noxus";
  els.width.value = s.width || 400;
  els.auth0Domain.value = s.auth0Domain || "";
  els.auth0ClientId.value = s.auth0ClientId || "";
  els.auth0Audience.value = s.auth0Audience || "";
});

document.getElementById("save").addEventListener("click", () => {
  const width = Math.min(Math.max(parseInt(els.width.value, 10) || 400, 280), 900);
  chrome.storage.sync.set(
    {
      iframeUrl: els.iframeUrl.value.trim(),
      title: els.title.value.trim() || "Noxus",
      width,
      auth0Domain: els.auth0Domain.value.trim().replace(/^https?:\/\//, ""),
      auth0ClientId: els.auth0ClientId.value.trim(),
      auth0Audience: els.auth0Audience.value.trim(),
    },
    () => {
      els.status.textContent = "Saved ✓";
      setTimeout(() => (els.status.textContent = ""), 1500);
    }
  );
});
