# Noxus Copilot (browser extension)

Turn a Noxus agent into a copilot that works in your browser and understands the
platforms you're working in. It docks as a resizable panel, signs you in to
Noxus, and sends the agent the **context of the page you're on**. It appears
only on the sites you whitelist (prefilled with the CRMs it understands
natively); add more in Options.

## Features

- **Works everywhere** — enable it on any site; toggle from the toolbar popup or
  with `Ctrl/Cmd+Shift+K`.
- **Native context adapters**
  - **Salesforce** — object type + record id from Lightning (cases, records, list views).
  - **HubSpot** — object type + record id from the CRM (contacts, companies, deals, tickets).
  - **Generic** — URL, title, page heading, meta description, current text selection.
- **Real Noxus identity** — Auth0 (Authorization Code + PKCE) login in the
  extension; the agent runs as the real you (used by the deployment's
  `noxus_user` auth mode).

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.
2. Click the Noxus icon → **Options…**, paste your agent's embed URL (and, for
   authenticated agents, your Auth0 domain / client id / audience), Save.
3. Click the Noxus icon → **Sign in to Noxus** (only needed for `noxus_user` agents).
4. Open any page → use the toolbar toggle or `Ctrl/Cmd+Shift+K` to open the panel.

## How context flows

```
content script (per-site adapter) ──SPOT_WIDGET_CONTEXT──▶ widget iframe
                                                              │
                                          (only if the agent opts in via
                                           accept_external_context)
                                                              ▼
                                            injected as <page_context> for the turn
```

The context payload is arbitrary JSON, e.g. on a HubSpot deal:

```json
{
  "source": "hubspot",
  "url": "https://app.hubspot.com/contacts/123/record/0-3/456",
  "title": "Acme renewal — HubSpot",
  "page": { "type": "record" },
  "record": { "object": "deal", "id": "456" },
  "selection": ""
}
```

## Adding a new native integration

Drop a file in `adapters/`, register it on `window.__noxusAdapters`, and list it
in `manifest.json` **before** `adapters/generic.js` (first match wins; generic is
the fallback):

```js
window.__noxusAdapters.push({
  name: "zendesk",
  matches: () => location.hostname.endsWith(".zendesk.com"),
  getContext: () => ({ source: "zendesk", url: location.href, /* … */ }),
});
```

## Files

- `manifest.json` — MV3, `<all_urls>` content script, Auth0 host permission, toggle command
- `content.js` — panel injection, adapter dispatch, postMessage handshake, SPA nav watch
- `adapters/{salesforce,hubspot,generic}.js` — per-site context extraction
- `background.js` — Auth0 PKCE login + token storage/refresh, toggle command
- `popup.html/js` — sign-in, detected-context indicator, panel toggle
- `options.html/js` — agent embed URL, panel title/width, Auth0 config
- `icons/` — Noxus "O" mark

## Notes

- The agent only *uses* the page context if its deployment has
  `accept_external_context` enabled; otherwise the context is dropped server-side.
- For authenticated (`noxus_user`) agents the deployment must domain-lock to the
  sites you embed on (Salesforce/HubSpot domains).
