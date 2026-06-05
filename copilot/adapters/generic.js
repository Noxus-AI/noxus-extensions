// Generic context adapter — the fallback for any site without a native
// integration. Provides the URL, title, page heading, meta description, and
// the user's current text selection. Registered LAST so site-specific
// adapters take precedence.
(() => {
  const registry = (window.__noxusAdapters = window.__noxusAdapters || []);

  const text = (el) => (el && el.textContent ? el.textContent.trim() : null);

  registry.push({
    name: "generic",
    matches: () => true,
    getContext: () => {
      const selection =
        (window.getSelection && window.getSelection().toString()) || "";
      const description = document.querySelector('meta[name="description"]');
      const ogTitle = document.querySelector('meta[property="og:title"]');

      return {
        source: "generic",
        url: location.href,
        host: location.host,
        title: document.title,
        page: {
          type: "page",
          heading: text(document.querySelector("h1"))?.slice(0, 200) || null,
          og_title: ogTitle ? ogTitle.getAttribute("content") : null,
        },
        description: description
          ? (description.getAttribute("content") || "").slice(0, 500)
          : null,
        selection: selection.trim().slice(0, 2000),
      };
    },
  });
})();
