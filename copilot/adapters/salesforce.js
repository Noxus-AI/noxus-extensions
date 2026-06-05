// Salesforce Lightning context adapter. Extracts the object type + record id
// from the Lightning URL (list views, record pages). Registered before the
// generic fallback so it wins on *.force.com / *.salesforce.com.
(() => {
  const registry = (window.__noxusAdapters = window.__noxusAdapters || []);

  const isSalesforce = (host) =>
    /\.lightning\.force\.com$/.test(host) ||
    /\.salesforce\.com$/.test(host) ||
    /\.force\.com$/.test(host);

  registry.push({
    name: "salesforce",
    matches: () => isSalesforce(location.hostname),
    getContext: () => {
      const path = location.pathname;
      let object = null;
      let recordId = null;
      let pageType = "other";

      let m = path.match(/\/lightning\/r\/([^/]+)\/([A-Za-z0-9]{15,18})(?:\/|$)/);
      if (m) {
        object = m[1];
        recordId = m[2];
        pageType = "record";
      } else if ((m = path.match(/\/lightning\/o\/([^/]+)\/(\w+)/))) {
        object = m[1];
        pageType = m[2] === "list" ? "list" : m[2];
      }

      const selection =
        (window.getSelection && window.getSelection().toString()) || "";

      return {
        source: "salesforce",
        url: location.href,
        host: location.host,
        title: document.title,
        page: { type: pageType },
        record: object ? { object, id: recordId } : null,
        selection: selection.trim().slice(0, 2000),
      };
    },
  });
})();
