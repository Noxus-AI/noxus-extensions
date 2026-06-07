// Noxus-authorizer login. The user configures only their Noxus base URL; the
// extension sends them to `{base}/extension/authorize` to consent, exchanges
// the returned one-time code (PKCE) for a Noxus-issued access + refresh JWT at
// `{base}/api/public/extension/token`, and relays the access token to the
// widget — which sends it as `Authorization: Bearer` so the agent runs as the
// real Noxus user. No Auth0 config in the extension.

const CONFIG_DEFAULTS = { noxusBaseUrl: "" };

const REDIRECT_URI = chrome.identity.getRedirectURL();
// Refresh a little early so a token handed to the widget isn't about to expire.
const EXPIRY_SKEW_MS = 60_000;

function base64UrlEncode(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return new Uint8Array(digest);
}

function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

function getConfig() {
  return new Promise((resolve) => chrome.storage.sync.get(CONFIG_DEFAULTS, resolve));
}

function baseUrl(cfg) {
  return (cfg.noxusBaseUrl || "").trim().replace(/\/+$/, "");
}

function getStoredAuth() {
  return new Promise((resolve) =>
    chrome.storage.local.get({ auth: null }, (v) => resolve(v.auth))
  );
}

async function tokenRequest(base, body) {
  const res = await fetch(`${base}/api/public/extension/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail || "";
    } catch (e) {
      // non-JSON body
    }
    throw new Error(`Token endpoint ${res.status} ${detail}`.trim());
  }
  return res.json();
}

async function storeTokens(tokens) {
  const prev = (await getStoredAuth()) || {};
  const auth = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || prev.refreshToken || null,
    expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
  };
  await chrome.storage.local.set({ auth });
  return auth;
}

async function login() {
  const cfg = await getConfig();
  const base = baseUrl(cfg);
  if (!base) {
    throw new Error("Set your Noxus base URL in the extension Options first.");
  }

  const verifier = randomToken();
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomToken();

  const authUrl = new URL(`${base}/extension/authorize`);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("state", state);

  const redirect = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  const returned = new URL(redirect);
  if (returned.searchParams.get("state") !== state) {
    throw new Error("Auth state mismatch — aborting.");
  }
  const code = returned.searchParams.get("code");
  if (!code) {
    throw new Error(
      returned.searchParams.get("error") || "Authorization was cancelled."
    );
  }

  const tokens = await tokenRequest(base, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
  });
  await storeTokens(tokens);
  return status();
}

async function logout() {
  await chrome.storage.local.remove("auth");
  return { authenticated: false };
}

async function status() {
  const auth = await getStoredAuth();
  return { authenticated: !!(auth && auth.accessToken) };
}

async function getAccessToken() {
  const auth = await getStoredAuth();
  if (!auth || !auth.accessToken) return null;
  if (Date.now() < auth.expiresAt - EXPIRY_SKEW_MS) return auth.accessToken;
  if (!auth.refreshToken) return null;
  try {
    const cfg = await getConfig();
    const tokens = await tokenRequest(baseUrl(cfg), {
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
    });
    return (await storeTokens(tokens)).accessToken;
  } catch (e) {
    // Refresh failed (revoked / expired) — drop the stale session.
    await chrome.storage.local.remove("auth");
    return null;
  }
}

const HANDLERS = {
  AUTH_LOGIN: login,
  AUTH_LOGOUT: logout,
  AUTH_STATUS: status,
  AUTH_GET_TOKEN: async () => ({ token: await getAccessToken() }),
  OPEN_OPTIONS: async () => {
    await chrome.runtime.openOptionsPage();
    return {};
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = msg && HANDLERS[msg.type];
  if (!handler) return false;
  handler()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
  return true; // keep the message channel open for the async response
});

// Keyboard shortcut → toggle the copilot panel on the active tab.
chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle_panel") return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0] && tabs[0].id;
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PANEL" }, () => {
        void chrome.runtime.lastError; // ignore tabs without the content script
      });
    }
  });
});
