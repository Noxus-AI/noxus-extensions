// Auth0 PKCE login for the extension. The extension never holds a signing
// secret — it logs the user into Noxus via Auth0 (Authorization Code + PKCE)
// and relays the resulting access token to the widget iframe, which sends it
// as `Authorization: Bearer` so the agent runs as the real Noxus user.

const AUTH_CONFIG_DEFAULTS = {
  auth0Domain: "",
  auth0ClientId: "",
  auth0Audience: "",
};

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
  return new Promise((resolve) =>
    chrome.storage.sync.get(AUTH_CONFIG_DEFAULTS, resolve)
  );
}

function getStoredAuth() {
  return new Promise((resolve) =>
    chrome.storage.local.get({ auth: null }, (v) => resolve(v.auth))
  );
}

async function tokenRequest(cfg, params) {
  const res = await fetch(`https://${cfg.auth0Domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.auth0ClientId, ...params }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error_description || "";
    } catch (e) {
      // non-JSON body — fall back to status text
    }
    throw new Error(`Token endpoint ${res.status} ${detail}`.trim());
  }
  return res.json();
}

async function storeTokens(tokens) {
  const prev = (await getStoredAuth()) || {};
  const auth = {
    accessToken: tokens.access_token,
    // Auth0 omits refresh_token on refresh-grant responses; keep the old one.
    refreshToken: tokens.refresh_token || prev.refreshToken || null,
    idToken: tokens.id_token || prev.idToken || null,
    expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
  };
  await chrome.storage.local.set({ auth });
  return auth;
}

function decodeEmail(idToken) {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).email || null;
  } catch (e) {
    return null;
  }
}

async function login() {
  const cfg = await getConfig();
  if (!cfg.auth0Domain || !cfg.auth0ClientId) {
    throw new Error("Auth0 is not configured — set it in the extension Options.");
  }

  const verifier = randomToken();
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomToken();

  const authUrl = new URL(`https://${cfg.auth0Domain}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", cfg.auth0ClientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", "openid profile email offline_access");
  if (cfg.auth0Audience) authUrl.searchParams.set("audience", cfg.auth0Audience);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
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
      returned.searchParams.get("error_description") || "Login was cancelled."
    );
  }

  const tokens = await tokenRequest(cfg, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
  });
  await storeTokens(tokens);
  return status();
}

async function logout() {
  await chrome.storage.local.remove("auth");
  return { authenticated: false, email: null };
}

async function status() {
  const auth = await getStoredAuth();
  return {
    authenticated: !!(auth && auth.accessToken),
    email: auth ? decodeEmail(auth.idToken) : null,
    expiresAt: auth ? auth.expiresAt : null,
  };
}

async function getAccessToken() {
  const auth = await getStoredAuth();
  if (!auth || !auth.accessToken) return null;
  if (Date.now() < auth.expiresAt - EXPIRY_SKEW_MS) return auth.accessToken;
  if (!auth.refreshToken) return null;
  try {
    const cfg = await getConfig();
    const tokens = await tokenRequest(cfg, {
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
    });
    return (await storeTokens(tokens)).accessToken;
  } catch (e) {
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
