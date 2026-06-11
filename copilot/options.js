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

async function fetchAllPages(path) {
  const items = [];
  let page = 1;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await apiGet(`${path}${sep}size=100&page=${page}`);
    items.push(...listOf(data));
    if (!data || !data.pages || page >= data.pages) return items;
    page += 1;
  }
}

// A <select> replacement that scrolls: button + popup list with a filter box.
function createDropdown(id, { placeholder, onChange }) {
  const root = document.getElementById(id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dd-btn";
  btn.disabled = true;
  const label = document.createElement("span");
  label.className = "dd-label";
  btn.appendChild(label);
  btn.insertAdjacentHTML(
    "beforeend",
    '<svg class="dd-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  );
  const panel = document.createElement("div");
  panel.className = "dd-panel";
  panel.hidden = true;
  const search = document.createElement("div");
  search.className = "dd-search";
  const filter = document.createElement("input");
  filter.type = "text";
  filter.placeholder = "Filter…";
  search.appendChild(filter);
  const list = document.createElement("div");
  list.className = "dd-list";
  panel.append(search, list);
  root.append(btn, panel);

  const state = { options: [], value: "", placeholder };

  function renderLabel() {
    const current = state.options.find((o) => o.id === state.value);
    label.textContent = current ? current.name : state.placeholder;
    label.classList.toggle("is-placeholder", !current);
  }

  function renderList() {
    const q = filter.value.trim().toLowerCase();
    list.innerHTML = "";
    const visible = state.options.filter(
      (o) => !q || o.name.toLowerCase().includes(q)
    );
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "dd-empty";
      empty.textContent = "No matches";
      list.appendChild(empty);
      return;
    }
    for (const o of visible) {
      const row = document.createElement("div");
      row.className = "dd-option" + (o.id === state.value ? " selected" : "");
      row.textContent = o.name;
      row.title = o.name;
      row.addEventListener("click", () => {
        const changed = state.value !== o.id;
        state.value = o.id;
        renderLabel();
        close();
        if (changed) onChange(o.id);
      });
      list.appendChild(row);
    }
  }

  function open() {
    panel.hidden = false;
    filter.value = "";
    renderList();
    search.hidden = state.options.length <= 8;
    if (!search.hidden) filter.focus();
  }

  function close() {
    panel.hidden = true;
  }

  btn.addEventListener("click", () => (panel.hidden ? open() : close()));
  filter.addEventListener("input", renderList);
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) close();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  renderLabel();
  return {
    get value() {
      return state.value;
    },
    setOptions(opts, selectedId) {
      state.options = opts;
      state.value = opts.some((o) => o.id === selectedId) ? selectedId : "";
      renderLabel();
      renderList();
    },
    setPlaceholder(text) {
      state.placeholder = text;
      renderLabel();
    },
    setDisabled(disabled) {
      btn.disabled = disabled;
      if (disabled) close();
    },
  };
}

const workspaceDD = createDropdown("workspace", {
  placeholder: "Sign in to choose…",
  onChange: (id) => {
    selection.workspaceId = id;
    selection.agentId = "";
    agentDD.setOptions([], "");
    agentDD.setPlaceholder("Select an agent…");
    agentDD.setDisabled(true);
    if (id) loadAgents(id);
  },
});

const agentDD = createDropdown("agent", {
  placeholder: "Select a workspace first…",
  onChange: (id) => {
    selection.agentId = id;
    if (workspaceDD.value && id) selectAgent(workspaceDD.value, id);
  },
});

function toOptions(items) {
  return items
    .filter((o) => o && o.id)
    .map((o) => ({ id: o.id, name: o.name || o.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadWorkspaces() {
  workspaceDD.setDisabled(true);
  els.pickerHint.textContent = "Loading workspaces…";
  try {
    // /groups/me wraps each item as { group, users }.
    const groups = (await fetchAllPages("/groups/me")).map(
      (it) => (it && it.group) || it
    );
    workspaceDD.setPlaceholder("Select a workspace…");
    workspaceDD.setOptions(toOptions(groups), selection.workspaceId);
    workspaceDD.setDisabled(false);
    els.pickerHint.textContent = "";
    if (workspaceDD.value) await loadAgents(workspaceDD.value);
  } catch (e) {
    els.pickerHint.textContent = "Couldn't load workspaces. Try signing in again.";
  }
}

async function loadAgents(groupId) {
  agentDD.setDisabled(true);
  els.pickerHint.textContent = "Loading agents…";
  try {
    const agents = await fetchAllPages(`/groups/${groupId}/assistants`);
    agentDD.setPlaceholder("Select an agent…");
    agentDD.setOptions(toOptions(agents), selection.agentId);
    agentDD.setDisabled(false);
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
    workspaceDD.setOptions([], "");
    workspaceDD.setPlaceholder("Sign in to choose…");
    workspaceDD.setDisabled(true);
    agentDD.setOptions([], "");
    agentDD.setPlaceholder("Select a workspace first…");
    agentDD.setDisabled(true);
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
