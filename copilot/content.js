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

  let settings = { ...DEFAULTS };
  let root = null;
  let handle = null;
  let iframeReady = false;

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

  // CRM apps (Salesforce, HubSpot) are SPAs: the route changes without a full
  // reload. Content scripts run in an isolated world, so patching
  // history.pushState won't catch the page's own calls — poll the URL instead.
  function watchNavigation() {
    let last = location.href;
    const check = () => {
      if (location.href === last) return;
      last = location.href;
      if (iframeReady) postContext();
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
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
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

    if (src) {
      if (iframe.getAttribute("src") !== src) {
        iframeReady = false;
        iframe.setAttribute("src", src);
      }
      iframe.style.display = "";
      empty.style.display = "none";
    } else {
      iframe.removeAttribute("src");
      iframe.style.display = "none";
      empty.style.display = "flex";
    }

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
        <span class="noxus-title">Noxus</span>
        <button class="noxus-reload" title="Reload">&#x21bb;</button>
        <button class="noxus-collapse" title="Collapse">&times;</button>
      </div>
      <iframe id="noxus-widget-iframe"
        allow="clipboard-read; clipboard-write; microphone; camera"
        referrerpolicy="origin"></iframe>
      <div class="noxus-widget-empty">
        No copilot agent connected.<br>
        Click the Noxus icon in your toolbar &rarr; <b>Options</b> to paste your
        agent's embed URL.
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
    handle.textContent = "Noxus";
    handle.title = "Open Noxus widget";
    document.documentElement.appendChild(handle);

    root.querySelector(".noxus-collapse").addEventListener("click", () =>
      setOpen(false)
    );
    handle.addEventListener("click", () => setOpen(true));
    root.querySelector(".noxus-signin-btn").addEventListener("click", signIn);
    root.querySelector(".noxus-reload").addEventListener("click", () => {
      const iframe = root.querySelector("#noxus-widget-iframe");
      const src = iframe.getAttribute("src");
      if (src) {
        iframeReady = false;
        iframe.removeAttribute("src");
        iframe.setAttribute("src", src);
      }
    });

    const iframe = root.querySelector("#noxus-widget-iframe");
    // The widget app boots, posts SPOT_WIDGET_READY, and waits for us to post
    // SPOT_WIDGET_OPEN before it starts the chat. Complete that handshake.
    window.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;
      const type = event.data && event.data.type;
      if (type === "SPOT_WIDGET_READY") {
        iframeReady = true;
        if (settings.open) sendOpen();
        postContext();
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
