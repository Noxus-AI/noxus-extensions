const statusEl = document.getElementById("authStatus");
const emailEl = document.getElementById("authEmail");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");

function renderAuth(res) {
  const authed = res && res.ok && res.authenticated;
  statusEl.textContent = authed ? "Signed in" : "Not signed in";
  emailEl.textContent = authed && res.email ? res.email : "";
  loginBtn.style.display = authed ? "none" : "block";
  logoutBtn.style.display = authed ? "block" : "none";
  loginBtn.disabled = false;
}

chrome.runtime.sendMessage({ type: "AUTH_STATUS" }, renderAuth);

loginBtn.addEventListener("click", () => {
  loginBtn.disabled = true;
  statusEl.textContent = "Opening Noxus sign-in…";
  chrome.runtime.sendMessage({ type: "AUTH_LOGIN" }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) {
      statusEl.textContent =
        (res && res.error) ||
        (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
        "Sign-in failed.";
      loginBtn.disabled = false;
      return;
    }
    renderAuth(res);
  });
});

logoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "AUTH_LOGOUT" }, renderAuth);
});

// Show what context the copilot would send for the current tab.
const SOURCE_LABELS = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  generic: "General page",
};
const contextEl = document.getElementById("contextStatus");
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tabId = tabs[0] && tabs[0].id;
  if (tabId == null) {
    contextEl.textContent = "Not available here";
    return;
  }
  chrome.tabs.sendMessage(tabId, { type: "GET_STATUS" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      contextEl.textContent = "Not available here";
      return;
    }
    const label = SOURCE_LABELS[res.source] || "General page";
    const record = res.record
      ? ` · ${res.record.object}${res.record.id ? ` ${res.record.id}` : ""}`
      : "";
    contextEl.innerHTML = `<span class="chip">${label}</span>${record}`;
  });
});

document.getElementById("toggle").addEventListener("click", () => {
  chrome.storage.sync.get({ open: false }, ({ open }) => {
    chrome.storage.sync.set({ open: !open }, () => window.close());
  });
});

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
