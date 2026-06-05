// HubSpot CRM context adapter. Extracts object type + record id from the
// HubSpot app URL, e.g. /contacts/<portal>/record/0-1/<id> (contact) or
// /contacts/<portal>/objects/0-3/views/... (deals list).
(() => {
  const registry = (window.__noxusAdapters = window.__noxusAdapters || []);

  // HubSpot object type ids → friendly names. Unknown ids pass through raw.
  const OBJECT_TYPES = {
    "0-1": "contact",
    "0-2": "company",
    "0-3": "deal",
    "0-5": "ticket",
    "0-421": "appointment",
    "0-49": "email",
    "0-48": "call",
  };

  const named = (typeId) => OBJECT_TYPES[typeId] || typeId;

  registry.push({
    name: "hubspot",
    matches: () => /(^|\.)hubspot\.com$/.test(location.hostname),
    getContext: () => {
      const path = location.pathname;
      let object = null;
      let recordId = null;
      let pageType = "other";

      let m = path.match(/\/record\/(\d+-\d+)\/(\d+)/);
      if (m) {
        object = named(m[1]);
        recordId = m[2];
        pageType = "record";
      } else if ((m = path.match(/\/objects\/(\d+-\d+)\/views/))) {
        object = named(m[1]);
        pageType = "list";
      }

      const selection =
        (window.getSelection && window.getSelection().toString()) || "";

      return {
        source: "hubspot",
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
