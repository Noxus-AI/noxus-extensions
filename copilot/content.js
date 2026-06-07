(() => {
  // Only the top document hosts the copilot — never inside frames (including
  // our own widget iframe, which would otherwise recurse).
  if (window.top !== window.self) return;

  const DEFAULTS = {
    iframeUrl: "",
    width: 400,
    open: false,
    title: "Noxus",
  };

  // Noxus "O" mark, inherits the header text colour.
  const NOXUS_LOGO = `<svg viewBox="0 0 17 16" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.92002 4.22578C1.65695 4.51301 0.188477 4.84695 0.188477 7.98515C0.188477 12.4879 2.67415 15.9664 7.30998 15.9664C11.9458 15.9664 16.602 11.5026 16.602 6.99986C16.602 2.49712 13.0313 0 8.39544 0C5.19009 0 4.9926 1.21862 4.81168 2.33492C4.73094 2.8331 4.65351 3.3109 4.3135 3.65091C3.97958 3.98483 3.46921 4.10089 2.92002 4.22578ZM10.7691 11.624C13.0563 10.1338 13.8488 7.29625 12.5391 5.28614C11.2295 3.27603 8.31364 2.85455 6.02643 4.34474C3.73923 5.83493 2.94677 8.67248 4.25643 10.6826C5.56608 12.6927 8.48191 13.1142 10.7691 11.624Z" fill="currentColor"/></svg>`;

  const SOURCE_LABELS = {
    salesforce: "Salesforce",
    hubspot: "HubSpot",
    generic: "Page",
  };

  let settings = { ...DEFAULTS };
  let root = null;
  let handle = null;
  let iframeReady = false;
  let loadTimer = null;

  function widgetOrigin() {
    try {
      return new URL(settings.iframeUrl).origin;
    } catch {
      return "*";
    }
  }

  function postToWidget(message) {
    const iframe = root && root.querySelector("#noxus-widget-iframe");
    if (iframe && iframe.contentWindow && settings.iframeUrl) {
      iframe.contentWindow.postMessage(message, widgetOrigin());
    }
  }

  function sendOpen() {
    postToWidget({ type: "SPOT_WIDGET_OPEN" });
  }

  function showSignIn(show, error) {
    const el = root && root.querySelector(".noxus-widget-signin");
    if (!el) return;
    el.classList.toggle("noxus-hidden", !show);
    const errEl = el.querySelector(".noxus-signin-error");
    if (errEl) errEl.textContent = error || "";
  }

  // The widget (in noxus_user auth mode) asks the host for the user's Noxus
  // access token. Relay it from the background worker; if the user isn't
  // signed in yet, surface the sign-in prompt instead.
  function provideAuthToken() {
    chrome.runtime.sendMessage({ type: "AUTH_GET_TOKEN" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.ok && res.token) {
        showSignIn(false);
        postToWidget({ type: "SPOT_AUTH_TOKEN", token: res.token });
      } else {
        showSignIn(true);
      }
    });
  }

  function signIn() {
    showSignIn(true, "");
    const btn = root && root.querySelector(".noxus-signin-btn");
    if (btn) btn.disabled = true;
    chrome.runtime.sendMessage({ type: "AUTH_LOGIN" }, (res) => {
      if (btn) btn.disabled = false;
      if (chrome.runtime.lastError) {
        showSignIn(true, chrome.runtime.lastError.message);
        return;
      }
      if (res && res.ok && res.authenticated) {
        provideAuthToken();
      } else {
        showSignIn(true, (res && res.error) || "Sign-in failed. Try again.");
      }
    });
  }

  // Site adapters (salesforce/hubspot/generic) self-register on this global in
  // load order; the first whose matches() is true wins, generic being last.
  function pickAdapter() {
    const registry = window.__noxusAdapters || [];
    return (
      registry.find((a) => {
        try {
          return a.matches();
        } catch (e) {
          return false;
        }
      }) || null
    );
  }

  function getPageContext() {
    const adapter = pickAdapter();
    if (adapter) {
      try {
        return adapter.getContext();
      } catch (e) {
        // fall through to a minimal context below
      }
    }
    return {
      source: "generic",
      url: location.href,
      host: location.host,
      title: document.title,
      selection: "",
    };
  }

  function postContext() {
    postToWidget({ type: "SPOT_WIDGET_CONTEXT", context: getPageContext() });
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  }

  function contextSummary(ctx) {
    const source = SOURCE_LABELS[ctx.source] || "Page";
    let detail;
    if (ctx.record && ctx.record.object) {
      detail = ctx.record.id
        ? `${ctx.record.object} · ${ctx.record.id}`
        : ctx.record.object;
    } else {
      detail = ctx.title || ctx.host || location.host;
    }
    return { source, detail };
  }

  function renderContextDetail(ctx) {
    const rows = [];
    const add = (k, v) => {
      if (v)
        rows.push(
          `<div class="noxus-ctx-row"><span>${k}</span><b>${escapeHtml(v)}</b></div>`
        );
    };
    add("Source", SOURCE_LABELS[ctx.source] || "Page");
    if (ctx.page && ctx.page.type && ctx.page.type !== "page")
      add("Page", ctx.page.type);
    if (ctx.record) {
      add("Object", ctx.record.object);
      add("Record id", ctx.record.id);
    }
    add("Title", ctx.title);
    if (ctx.selection)
      add(
        "Selection",
        ctx.selection.slice(0, 140) + (ctx.selection.length > 140 ? "…" : "")
      );
    add("URL", ctx.url);
    return (
      rows.join("") +
      `<p class="noxus-ctx-note">This is the page context the agent receives with each message.</p>`
    );
  }

  // The context bar is independent of the iframe — it always reflects what the
  // adapters extract for the current page, so the user can see what the agent
  // is given.
  function renderContextBar() {
    if (!root) return;
    const ctx = getPageContext();
    const { source, detail } = contextSummary(ctx);
    const srcEl = root.querySelector(".noxus-context-source");
    const labelEl = root.querySelector(".noxus-context-label");
    const detailEl = root.querySelector(".noxus-context-detail");
    if (srcEl) {
      srcEl.textContent = source;
      srcEl.dataset.source = ctx.source || "generic";
    }
    if (labelEl) labelEl.textContent = detail;
    if (detailEl) detailEl.innerHTML = renderContextDetail(ctx);
  }

  function updateContext() {
    if (iframeReady) postContext();
    renderContextBar();
  }

  function showError(show) {
    const el = root && root.querySelector(".noxus-widget-error");
    if (el) el.classList.toggle("noxus-hidden", !show);
  }

  // If the widget never posts SPOT_WIDGET_READY after a (re)load, it's almost
  // always blocked by the site's frame-ancestors / X-Frame-Options. Show our
  // own fallback instead of the browser's bare "content is blocked" page.
  function armLoadWatch() {
    clearTimeout(loadTimer);
    showError(false);
    if (!settings.iframeUrl) return;
    loadTimer = setTimeout(() => {
      if (!iframeReady) showError(true);
    }, 7000);
  }

  function reloadIframe() {
    const iframe = root && root.querySelector("#noxus-widget-iframe");
    const src = iframe && iframe.getAttribute("src");
    if (src) {
      iframeReady = false;
      iframe.removeAttribute("src");
      iframe.setAttribute("src", src);
      armLoadWatch();
    }
  }

  function openExternal() {
    if (settings.iframeUrl) window.open(settings.iframeUrl, "_blank", "noopener");
  }

  // CRM apps (Salesforce, HubSpot) are SPAs: the route changes without a full
  // reload. Content scripts run in an isolated world, so patching
  // history.pushState won't catch the page's own calls — poll the URL instead.
  function watchNavigation() {
    let last = location.href;
    const check = () => {
      if (location.href === last) return;
      last = location.href;
      updateContext();
    };
    window.addEventListener("popstate", check);
    setInterval(check, 1000);
  }

  function applyWidth(width) {
    document.documentElement.style.setProperty(
      "--noxus-sidebar-width",
      `${width}px`
    );
  }

  function setOpen(open) {
    settings.open = open;
    document.documentElement.classList.toggle("noxus-widget-open", open);
    if (handle) handle.classList.toggle("noxus-hidden", open);
    if (open && iframeReady) sendOpen();
    nudgeReflow();
    chrome.storage.sync.set({ open });
  }

  let reflowTimer = null;
  function nudgeReflow() {
    // Fire mid- and post-slide so JS-measured host components (Salesforce data
    // tables, etc.) re-layout to the final width after the 320ms animation.
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 360);
  }

  function buildIframeSrc() {
    if (!settings.iframeUrl) return null;
    return settings.iframeUrl;
  }

  function render() {
    if (!root) return;
    applyWidth(settings.width);

    const title = root.querySelector(".noxus-title");
    if (title) title.textContent = settings.title || "Noxus";

    const src = buildIframeSrc();
    const iframe = root.querySelector("#noxus-widget-iframe");
    const empty = root.querySelector(".noxus-widget-empty");
    const body = root.querySelector(".noxus-widget-body");
    const contextBar = root.querySelector(".noxus-context-bar");

    if (src) {
      if (iframe.getAttribute("src") !== src) {
        iframeReady = false;
        iframe.setAttribute("src", src);
        armLoadWatch();
      }
      body.style.display = "";
      empty.style.display = "none";
      if (contextBar) contextBar.style.display = "";
    } else {
      iframe.removeAttribute("src");
      body.style.display = "none";
      empty.style.display = "flex";
      if (contextBar) contextBar.style.display = "none";
    }

    renderContextBar();
    setOpen(settings.open);
  }

  function makeResizer() {
    const resizer = root.querySelector("#noxus-widget-resizer");
    let startX = 0;
    let startW = 0;
    let mask = null;

    const onMove = (e) => {
      const delta = startX - e.clientX;
      const next = Math.min(Math.max(startW + delta, 280), 900);
      settings.width = next;
      applyWidth(next);
    };
    const endDrag = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", endDrag);
      window.removeEventListener("blur", endDrag);
      document.body.style.userSelect = "";
      // Re-enable the slide/reflow transition now the drag is done.
      document.documentElement.classList.remove("noxus-widget-resizing");
      if (mask) {
        mask.remove();
        mask = null;
      }
      nudgeReflow();
      chrome.storage.sync.set({ width: settings.width });
    };
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = settings.width;
      document.body.style.userSelect = "none";
      // The width transition would make the panel lag behind the cursor; turn
      // it off for the duration of the drag.
      document.documentElement.classList.add("noxus-widget-resizing");
      // Full-window mask above the iframe: a cross-origin iframe captures the
      // pointer once a fast drag crosses it, swallowing mousemove/mouseup so the
      // drag never ends. The mask keeps every event in the top document.
      mask = document.createElement("div");
      mask.id = "noxus-widget-dragmask";
      document.documentElement.appendChild(mask);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", endDrag);
      window.addEventListener("blur", endDrag);
    });
  }

  function mount() {
    if (document.getElementById("noxus-widget-root")) return;

    root = document.createElement("div");
    root.id = "noxus-widget-root";
    root.innerHTML = `
      <div id="noxus-widget-resizer"></div>
      <div class="noxus-widget-header">
        <span class="noxus-logo">${NOXUS_LOGO}</span>
        <span class="noxus-title">Noxus</span>
        <button class="noxus-external" title="Open in a new tab">&#x2197;</button>
        <button class="noxus-reload" title="Reload">&#x21bb;</button>
        <button class="noxus-collapse" title="Collapse">&times;</button>
      </div>
      <div class="noxus-context-bar">
        <button class="noxus-context-toggle" type="button" title="Page context the agent sees">
          <span class="noxus-context-source" data-source="generic">Page</span>
          <span class="noxus-context-label"></span>
          <span class="noxus-context-chevron">&#x2304;</span>
        </button>
        <div class="noxus-context-detail noxus-hidden"></div>
      </div>
      <div class="noxus-widget-body">
        <iframe id="noxus-widget-iframe"
          allow="clipboard-read; clipboard-write; microphone; camera"
          referrerpolicy="origin"></iframe>
        <div class="noxus-widget-error noxus-hidden">
          <p class="noxus-error-title">Couldn’t load the agent here</p>
          <p class="noxus-error-text">This site may block embedding. Try reloading, or open it in a new tab.</p>
          <div class="noxus-error-actions">
            <button class="noxus-error-retry" type="button">Reload</button>
            <button class="noxus-error-open" type="button">Open in new tab</button>
          </div>
        </div>
      </div>
      <div class="noxus-widget-empty">
        <span class="noxus-empty-logo">${NOXUS_LOGO}</span>
        <p class="noxus-empty-title">Connect your copilot</p>
        <p class="noxus-empty-text">Add your Noxus agent's embed URL to start using it on any page.</p>
        <button class="noxus-empty-btn" type="button">Open options</button>
      </div>
      <div class="noxus-widget-signin noxus-hidden">
        <p>Sign in with your Noxus account to use this agent.</p>
        <button class="noxus-signin-btn" type="button">Sign in to Noxus</button>
        <p class="noxus-signin-error"></p>
      </div>
    `;
    document.documentElement.appendChild(root);

    handle = document.createElement("button");
    handle.id = "noxus-widget-handle";
    handle.innerHTML = `${NOXUS_LOGO}<span>Noxus</span>`;
    handle.title = "Open Noxus copilot";
    document.documentElement.appendChild(handle);

    root.querySelector(".noxus-collapse").addEventListener("click", () =>
      setOpen(false)
    );
    handle.addEventListener("click", () => setOpen(true));
    root.querySelector(".noxus-signin-btn").addEventListener("click", signIn);
    root.querySelector(".noxus-empty-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });
    root.querySelector(".noxus-external").addEventListener("click", openExternal);
    root.querySelector(".noxus-reload").addEventListener("click", reloadIframe);
    root.querySelector(".noxus-error-retry").addEventListener("click", reloadIframe);
    root.querySelector(".noxus-error-open").addEventListener("click", openExternal);
    root.querySelector(".noxus-context-toggle").addEventListener("click", () => {
      const detail = root.querySelector(".noxus-context-detail");
      const bar = root.querySelector(".noxus-context-bar");
      const open = detail.classList.toggle("noxus-hidden");
      bar.classList.toggle("noxus-context-open", !open);
    });

    const iframe = root.querySelector("#noxus-widget-iframe");
    // The widget app boots, posts SPOT_WIDGET_READY, and waits for us to post
    // SPOT_WIDGET_OPEN before it starts the chat. Complete that handshake.
    window.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;
      const type = event.data && event.data.type;
      if (type === "SPOT_WIDGET_READY") {
        iframeReady = true;
        clearTimeout(loadTimer);
        showError(false);
        if (settings.open) sendOpen();
        updateContext();
      } else if (type === "SPOT_REQUEST_CONTEXT") {
        postContext();
      } else if (type === "SPOT_REQUEST_AUTH_TOKEN") {
        provideAuthToken();
      } else if (type === "SPOT_CLOSE_WIDGET") {
        setOpen(false);
      }
    });
    // Fallback in case READY fired before this listener attached.
    iframe.addEventListener("load", () => {
      if (settings.open) sendOpen();
    });

    makeResizer();
    watchNavigation();
    render();

    // Enable slide transitions only after the initial paint, so the panel
    // appears in its persisted state without animating on every page load.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.documentElement.classList.add("noxus-widget-mounted")
      )
    );
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    mount();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) settings[key] = newValue;
    }
    render();
  });

  // Toolbar command / popup controls.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "TOGGLE_PANEL") {
      setOpen(!settings.open);
    } else if (msg.type === "GET_STATUS") {
      const ctx = getPageContext();
      sendResponse({
        source: ctx.source,
        record: ctx.record || null,
        open: settings.open,
        connected: !!settings.iframeUrl,
      });
    }
  });
})();
