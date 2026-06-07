const DEFAULT_ALLOWED_SITES = ["*.salesforce.com", "*.force.com", "*.hubspot.com"];

const DEFAULTS = {
  iframeUrl: "",
  width: 400,
  title: "Noxus",
  noxusBaseUrl: "",
  allowedSites: DEFAULT_ALLOWED_SITES,
};

const els = {
  iframeUrl: document.getElementById("iframeUrl"),
  title: document.getElementById("title"),
  width: document.getElementById("width"),
  noxusBaseUrl: document.getElementById("noxusBaseUrl"),
  allowedSites: document.getElementById("allowedSites"),
  status: document.getElementById("status"),
};

chrome.storage.sync.get(DEFAULTS, (s) => {
  els.iframeUrl.value = s.iframeUrl || "";
  els.title.value = s.title || "Noxus";
  els.width.value = s.width || 400;
  els.noxusBaseUrl.value = s.noxusBaseUrl || "";
  els.allowedSites.value = (
    Array.isArray(s.allowedSites) ? s.allowedSites : DEFAULT_ALLOWED_SITES
  ).join("\n");
});

document.getElementById("save").addEventListener("click", () => {
  saveSettings(() => {
    els.status.textContent = "Saved ✓";
    setTimeout(() => (els.status.textContent = ""), 1500);
  });
});

function saveSettings(done) {
  const width = Math.min(Math.max(parseInt(els.width.value, 10) || 400, 280), 900);
  const allowedSites = els.allowedSites.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  chrome.storage.sync.set(
    {
      iframeUrl: els.iframeUrl.value.trim(),
      title: els.title.value.trim() || "Noxus",
      width,
      noxusBaseUrl: els.noxusBaseUrl.value.trim().replace(/\/+$/, ""),
      allowedSites: allowedSites.length ? allowedSites : DEFAULT_ALLOWED_SITES,
    },
    done
  );
}

// --- Sign in to Noxus -----------------------------------------------------
const signinBtn = document.getElementById("signin");
const signoutBtn = document.getElementById("signout");
const authStatus = document.getElementById("authStatus");

function renderAuth(res) {
  const authed = res && res.ok && res.authenticated;
  authStatus.textContent = authed ? "Connected ✓" : "Not connected";
  signinBtn.style.display = authed ? "none" : "inline-block";
  signoutBtn.style.display = authed ? "inline-block" : "none";
  signinBtn.disabled = false;
}

chrome.runtime.sendMessage({ type: "AUTH_STATUS" }, renderAuth);

signinBtn.addEventListener("click", () => {
  if (!els.noxusBaseUrl.value.trim()) {
    authStatus.textContent = "Enter your Noxus base URL first.";
    return;
  }
  signinBtn.disabled = true;
  authStatus.textContent = "Opening Noxus…";
  // Save first so login uses the URL currently in the field.
  saveSettings(() => {
    chrome.runtime.sendMessage({ type: "AUTH_LOGIN" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        authStatus.textContent =
          (res && res.error) ||
          (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
          "Sign-in failed.";
        signinBtn.disabled = false;
        return;
      }
      renderAuth(res);
    });
  });
});

signoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "AUTH_LOGOUT" }, renderAuth);
});
