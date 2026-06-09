(() => {
  // Only the top document hosts the copilot — never inside frames (including
  // our own widget iframe, which would otherwise recurse).
  if (window.top !== window.self) return;

  const DEFAULTS = {
    iframeUrl: "",
    width: 400,
    open: false,
    title: "Noxus",
    // Show the page-context bar (source + record) above the chat.
    showPageInfo: true,
    // Whitelist of host patterns where the copilot appears. Prefilled with the
    // CRMs we understand natively; users add more in Options.
    allowedSites: ["*.salesforce.com", "*.force.com", "*.hubspot.com"],
  };

  function hostMatches(host, pattern) {
    let p = String(pattern || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!p) return false;
    const h = host.toLowerCase();
    if (p.startsWith("*.")) {
      const base = p.slice(2);
      return h === base || h.endsWith("." + base);
    }
    return h === p;
  }

  function siteAllowed() {
    const list = Array.isArray(settings.allowedSites) ? settings.allowedSites : [];
    return list.some((p) => hostMatches(location.hostname, p));
  }

  // Noxus "O" mark, inherits the header text colour.
  const NOXUS_LOGO = `<svg viewBox="0 0 17 16" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.92002 4.22578C1.65695 4.51301 0.188477 4.84695 0.188477 7.98515C0.188477 12.4879 2.67415 15.9664 7.30998 15.9664C11.9458 15.9664 16.602 11.5026 16.602 6.99986C16.602 2.49712 13.0313 0 8.39544 0C5.19009 0 4.9926 1.21862 4.81168 2.33492C4.73094 2.8331 4.65351 3.3109 4.3135 3.65091C3.97958 3.98483 3.46921 4.10089 2.92002 4.22578ZM10.7691 11.624C13.0563 10.1338 13.8488 7.29625 12.5391 5.28614C11.2295 3.27603 8.31364 2.85455 6.02643 4.34474C3.73923 5.83493 2.94677 8.67248 4.25643 10.6826C5.56608 12.6927 8.48191 13.1142 10.7691 11.624Z" fill="currentColor"/></svg>`;

  // Full "Noxus" wordmark (the "O" is the brand mark); inherits header colour.
  const NOXUS_WORDMARK = `<svg viewBox="0 0 75 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 15.6596V0.340426H3.14894L10.8936 10.4468V0.340426H14.2979V15.6596H11.1064L3.40425 5.6383V15.6596H0Z" fill="currentColor"/><path d="M31.8692 15.6596L37.6777 7.6383L32.6564 0.340426H36.4436L39.5713 5.10638L42.699 0.340426H46.4862L41.4649 7.6383L47.2734 15.6596H43.1883L39.5713 10.3191L35.9543 15.6596H31.8692Z" fill="currentColor"/><path d="M51.6273 0.340426V9.53191C51.6273 10 51.7053 10.4397 51.8614 10.8511C52.0174 11.2624 52.2372 11.6241 52.5209 11.9362C52.8046 12.2482 53.138 12.4965 53.5209 12.6809C53.9039 12.8511 54.3294 12.9362 54.7975 12.9362C55.2656 12.9362 55.6912 12.8511 56.0741 12.6809C56.4571 12.4965 56.7904 12.2482 57.0741 11.9362C57.3578 11.6241 57.5777 11.2624 57.7337 10.8511C57.8897 10.4397 57.9677 10 57.9677 9.53191V0.340426H61.372V9.74468C61.372 10.6383 61.2018 11.4681 60.8614 12.234C60.5351 13 60.0741 13.6596 59.4784 14.2128C58.8968 14.766 58.2018 15.2057 57.3933 15.5319C56.599 15.844 55.7337 16 54.7975 16C53.8614 16 52.989 15.844 52.1805 15.5319C51.3862 15.2057 50.6912 14.766 50.0954 14.2128C49.5138 13.6596 49.0528 13 48.7124 12.234C48.3862 11.4681 48.2231 10.6383 48.2231 9.74468V0.340426H51.6273Z" fill="currentColor"/><path d="M70.5211 6.68085C71.0459 6.78014 71.5495 6.94326 72.0317 7.17021C72.5282 7.38298 72.9679 7.66667 73.3509 8.02128C73.7339 8.37589 74.0388 8.79433 74.2658 9.2766C74.5069 9.74468 74.6275 10.2837 74.6275 10.8936C74.6275 11.6312 74.4856 12.3121 74.202 12.9362C73.9324 13.5603 73.5424 14.0993 73.0317 14.5532C72.5211 15.0071 71.897 15.3617 71.1594 15.617C70.436 15.8723 69.6204 16 68.7126 16C67.8899 16 67.1239 15.8582 66.4147 15.5745C65.7055 15.2766 65.0885 14.8794 64.5637 14.383C64.053 13.8865 63.6488 13.3121 63.3509 12.6596C63.0672 12.0071 62.9254 11.3191 62.9254 10.5957H66.2445C66.3154 11.2624 66.5707 11.8227 67.0105 12.2766C67.4644 12.7163 68.0317 12.9362 68.7126 12.9362C69.5069 12.9362 70.1381 12.7589 70.6062 12.4043C71.0885 12.0496 71.3296 11.5461 71.3296 10.8936C71.3296 10.5674 71.2445 10.305 71.0743 10.1064C70.9183 9.89362 70.6842 9.70922 70.3722 9.55319C70.0601 9.39716 69.6771 9.26241 69.2232 9.14894C68.7835 9.02128 68.28 8.89362 67.7126 8.76596C67.0885 8.62411 66.4998 8.43972 65.9466 8.21277C65.3934 7.98582 64.9041 7.70922 64.4785 7.38298C64.0672 7.05674 63.741 6.68085 63.4998 6.25532C63.2587 5.82979 63.1381 5.34043 63.1381 4.78723C63.1381 4.07801 63.2658 3.43262 63.5211 2.85106C63.7906 2.2695 64.1665 1.76596 64.6488 1.34043C65.131 0.914894 65.7126 0.588653 66.3934 0.361703C67.0885 0.120568 67.8615 0 68.7126 0C69.4785 0 70.202 0.120568 70.8828 0.361703C71.5637 0.602838 72.1594 0.936171 72.67 1.3617C73.1949 1.78723 73.6062 2.29078 73.9041 2.87234C74.202 3.43972 74.3509 4.06383 74.3509 4.74468H70.9679C70.8261 4.26241 70.5424 3.86525 70.1168 3.55319C69.7055 3.22695 69.2374 3.06383 68.7126 3.06383C68.0743 3.06383 67.5353 3.21986 67.0956 3.53191C66.6559 3.82979 66.436 4.20567 66.436 4.65957C66.436 4.92908 66.5495 5.17021 66.7764 5.38298C67.0176 5.59575 67.3296 5.78723 67.7126 5.95745C68.0956 6.11348 68.5282 6.25532 69.0105 6.38298C69.5069 6.49645 70.0105 6.59575 70.5211 6.68085Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M18.92 4.22578C17.657 4.51301 16.1885 4.84695 16.1885 7.98515C16.1885 12.4879 18.6742 15.9664 23.31 15.9664C27.9458 15.9664 32.602 11.5026 32.602 6.99986C32.602 2.49712 29.0313 0 24.3954 0C21.1901 0 20.9926 1.21862 20.8117 2.33492C20.7309 2.8331 20.6535 3.3109 20.3135 3.65091C19.9796 3.98483 19.4692 4.10089 18.92 4.22578ZM26.7691 11.624C29.0563 10.1338 29.8488 7.29625 28.5391 5.28614C27.2295 3.27603 24.3136 2.85455 22.0264 4.34474C19.7392 5.83493 18.9468 8.67248 20.2564 10.6826C21.5661 12.6927 24.4819 13.1142 26.7691 11.624Z" fill="currentColor"/></svg>`;

  // Header / context icons — uniform 16px stroke set so they all line up.
  const svgIcon = (inner, size = 16) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    gear: svgIcon(
      `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`
    ),
    external: svgIcon(
      `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`
    ),
    reload: svgIcon(
      `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>`
    ),
    close: svgIcon(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`),
    chevron: svgIcon(`<path d="m6 9 6 6 6-6"/>`, 14),
  };

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

    // The wordmark is the brand; show a separate title only when the user has
    // set a custom one (anything other than the default "Noxus").
    const title = root.querySelector(".noxus-title");
    if (title) {
      const custom = settings.title && settings.title !== "Noxus";
      title.textContent = custom ? settings.title : "";
      title.style.display = custom ? "" : "none";
    }

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
      if (contextBar)
        contextBar.style.display = settings.showPageInfo ? "" : "none";
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
        <div class="noxus-brand">
          <span class="noxus-logo">${NOXUS_WORDMARK}</span>
          <span class="noxus-title"></span>
        </div>
        <button class="noxus-options" data-tip="Options" aria-label="Options">${ICONS.gear}</button>
        <button class="noxus-external" data-tip="Open in a new tab" aria-label="Open in a new tab">${ICONS.external}</button>
        <button class="noxus-reload" data-tip="Reload" aria-label="Reload">${ICONS.reload}</button>
        <button class="noxus-collapse" data-tip="Collapse" aria-label="Collapse">${ICONS.close}</button>
      </div>
      <div class="noxus-context-bar">
        <button class="noxus-context-toggle" type="button" title="Page context the agent sees">
          <span class="noxus-context-source" data-source="generic">Page</span>
          <span class="noxus-context-label"></span>
          <span class="noxus-context-chevron">${ICONS.chevron}</span>
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
    root.querySelector(".noxus-options").addEventListener("click", () => {
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

  function unmount() {
    if (root) {
      root.remove();
      root = null;
    }
    if (handle) {
      handle.remove();
      handle = null;
    }
    iframeReady = false;
    document.documentElement.classList.remove(
      "noxus-widget-open",
      "noxus-widget-mounted",
      "noxus-widget-resizing"
    );
  }

  // Mount only on whitelisted sites; react to the whitelist changing.
  function maybeMount() {
    if (siteAllowed()) {
      if (!root) mount();
    } else if (root) {
      unmount();
    }
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    maybeMount();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) settings[key] = newValue;
    }
    maybeMount();
    if (root) render();
  });

  // Toolbar command / popup controls.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "TOGGLE_PANEL") {
      if (root) setOpen(!settings.open);
    } else if (msg.type === "GET_STATUS") {
      const ctx = getPageContext();
      sendResponse({
        source: ctx.source,
        record: ctx.record || null,
        open: settings.open,
        connected: !!settings.iframeUrl,
        allowed: siteAllowed(),
      });
    }
  });
})();
