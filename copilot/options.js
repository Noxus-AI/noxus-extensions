const DEFAULT_ALLOWED_SITES = ["*.salesforce.com", "*.force.com", "*.hubspot.com"];

const DEFAULTS = {
  iframeUrl: "",
  width: 400,
  title: "Noxus",
  showPageInfo: true,
  noxusBaseUrl: "",
  allowedSites: DEFAULT_ALLOWED_SITES,
  workspaceId: "",
  agentId: "",
};

const els = {
  iframeUrl: document.getElementById("iframeUrl"),
  title: document.getElementById("title"),
  width: document.getElementById("width"),
  showPageInfo: document.getElementById("showPageInfo"),
  noxusBaseUrl: document.getElementById("noxusBaseUrl"),
  allowedSites: document.getElementById("allowedSites"),
  workspace: document.getElementById("workspace"),
  agent: document.getElementById("agent"),
  pickerHint: document.getElementById("pickerHint"),
  status: document.getElementById("status"),
};

const baseUrlRow = document.getElementById("baseUrlRow");
const toggleBaseUrlBtn = document.getElementById("toggleBaseUrl");

// Remembered selection, used to re-select the saved workspace/agent on load.
const selection = { workspaceId: "", agentId: "" };

chrome.storage.sync.get(DEFAULTS, (s) => {
  els.iframeUrl.value = s.iframeUrl || "";
  els.title.value = s.title || "Noxus";
  els.width.value = s.width || 400;
  els.showPageInfo.checked = s.showPageInfo !== false;
  els.noxusBaseUrl.value = s.noxusBaseUrl || "";
  els.allowedSites.value = (
    Array.isArray(s.allowedSites) ? s.allowedSites : DEFAULT_ALLOWED_SITES
  ).join("\n");
  selection.workspaceId = s.workspaceId || "";
  selection.agentId = s.agentId || "";
  // Reveal the base-URL field automatically until it's been configured.
  if (!s.noxusBaseUrl) baseUrlRow.hidden = false;
  chrome.runtime.sendMessage({ type: "AUTH_STATUS" }, renderAuth);
});

toggleBaseUrlBtn.addEventListener("click", () => {
  baseUrlRow.hidden = !baseUrlRow.hidden;
  if (!baseUrlRow.hidden) els.noxusBaseUrl.focus();
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
      showPageInfo: els.showPageInfo.checked,
      noxusBaseUrl: els.noxusBaseUrl.value.trim().replace(/\/+$/, ""),
      allowedSites: allowedSites.length ? allowedSites : DEFAULT_ALLOWED_SITES,
      workspaceId: selection.workspaceId,
      agentId: selection.agentId,
    },
    done
  );
}

// --- Workspace / agent picker --------------------------------------------
// Calls the authenticated Noxus API with the extension's access token. The
// public proxy forwards the bearer, and get_user accepts the extension JWT.

function getToken() {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "AUTH_GET_TOKEN" }, (r) =>
      resolve(r && r.token)
    )
  );
}

function apiBase() {
  return (els.noxusBaseUrl.value || "").trim().replace(/\/+$/, "");
}

async function apiGet(path) {
  const token = await getToken();
  if (!token) throw new Error("not signed in");
  const res = await fetch(`${apiBase()}/api/public${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// Endpoints return either a bare array or a paginated { items: [...] }.
function listOf(data) {
  return Array.isArray(data) ? data : (data && data.items) || [];
}

function fillSelect(sel, opts, selectedId, placeholder) {
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  sel.appendChild(ph);
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.name || o.id;
    if (o.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  }
}

async function loadWorkspaces() {
  els.workspace.disabled = true;
  els.pickerHint.textContent = "Loading workspaces…";
  try {
    const groups = listOf(await apiGet("/groups/me?size=100"));
    fillSelect(els.workspace, groups, selection.workspaceId, "Select a workspace…");
    els.workspace.disabled = false;
    els.pickerHint.textContent = "";
    if (selection.workspaceId) await loadAgents(selection.workspaceId);
  } catch (e) {
    els.pickerHint.textContent = "Couldn't load workspaces. Try signing in again.";
  }
}

async function loadAgents(groupId) {
  els.agent.disabled = true;
  els.pickerHint.textContent = "Loading agents…";
  try {
    const agents = listOf(await apiGet(`/groups/${groupId}/assistants?size=100`));
    fillSelect(els.agent, agents, selection.agentId, "Select an agent…");
    els.agent.disabled = false;
    els.pickerHint.textContent = "";
  } catch (e) {
    els.pickerHint.textContent = "Couldn't load agents for this workspace.";
  }
}

async function selectAgent(groupId, assistantId) {
  els.pickerHint.textContent = "Finding web widget…";
  try {
    const deployments = listOf(
      await apiGet(`/groups/${groupId}/assistants/${assistantId}/deployments`)
    );
    const widget = deployments.find((d) => d.channel_type === "embed_widget");
    if (!widget) {
      els.iframeUrl.value = "";
      els.pickerHint.textContent =
        "This agent has no web-widget deployment — create one in Noxus, or paste a URL below.";
      return;
    }
    els.iframeUrl.value = `${apiBase()}/public/chat_widget?deployment_id=${widget.id}`;
    els.pickerHint.textContent = "Widget selected ✓ — remember to Save.";
  } catch (e) {
    els.pickerHint.textContent = "Couldn't load this agent's deployments.";
  }
}

els.workspace.addEventListener("change", () => {
  selection.workspaceId = els.workspace.value;
  selection.agentId = "";
  fillSelect(els.agent, [], "", "Select an agent…");
  els.agent.disabled = true;
  if (els.workspace.value) loadAgents(els.workspace.value);
});

els.agent.addEventListener("change", () => {
  selection.agentId = els.agent.value;
  if (els.workspace.value && els.agent.value) {
    selectAgent(els.workspace.value, els.agent.value);
  }
});

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
  if (authed) {
    loadWorkspaces();
  } else {
    els.workspace.disabled = true;
    els.agent.disabled = true;
    fillSelect(els.workspace, [], "", "Sign in to choose…");
    fillSelect(els.agent, [], "", "Select a workspace first…");
    els.pickerHint.textContent = "Sign in to choose a workspace and agent.";
  }
}

signinBtn.addEventListener("click", () => {
  if (!els.noxusBaseUrl.value.trim()) {
    baseUrlRow.hidden = false;
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
