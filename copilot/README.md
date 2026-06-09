# Noxus Copilot (browser extension)

Turn a Noxus agent into a copilot that rides along in your browser and
understands the page you're on. It docks as a resizable side panel, signs you in
to your own Noxus instance, and gives the agent the **context of the current
page** — with native understanding of Salesforce and HubSpot, and a generic
fallback everywhere else.

It's a Manifest V3 Chrome extension. The panel appears only on the sites you
whitelist (prefilled with the CRMs it understands natively); add or remove sites
in Options.

## Features

- **Works on any site** — whitelist where the panel should appear; toggle it
  from the toolbar popup or with `Ctrl/Cmd+Shift+K`.
- **Resizable, persistent panel** — drag the left edge to resize; the page
  reflows so the panel sits like a real column. The open/closed state and width
  are remembered.
- **Page-context awareness**
  - **Salesforce** — object type + record id parsed from Lightning URLs
    (records, list views).
  - **HubSpot** — object type + record id parsed from the CRM URL (contacts,
    companies, deals, tickets, …).
  - **Generic** — URL, title, page heading, meta description, and your current
    text selection.
  - A context bar shows exactly what the agent will receive; hide it from
    Options if you'd rather not.
- **Signs in as you** — sign in against your own Noxus instance (OAuth
  Authorization Code + PKCE) from inside the extension, so the agent can run as
  the signed-in Noxus user.

## Requirements

- Google Chrome (or another Chromium-based browser) with Manifest V3 support.
- Access to a Noxus instance and an agent that has a web-widget deployment.

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   select the `copilot/` folder.
2. Click the Noxus toolbar icon → **Options…**:
   - Set your **Noxus base URL** (e.g. `https://app.noxus.ai`).
   - Click **Sign in to Noxus** and authorize the extension.
   - Pick a **workspace** and **agent** (or paste an embed URL under
     **Advanced**), then **Save**.
3. Choose the sites where the panel should appear (defaults to the CRMs above).
4. Open one of those sites and use the toolbar toggle or `Ctrl/Cmd+Shift+K`.

Signing in is only needed for agents configured to run as the signed-in Noxus
user; it's also available from the toolbar popup and the in-panel prompt.

## Privacy & data

The extension is built to keep your data between your browser and your own Noxus
instance:

- **What it reads** — only on sites you whitelist: the current tab's URL and
  title, the page's main heading and meta description, your active text
  selection, and (on Salesforce/HubSpot) the object type and record id parsed
  from the URL.
- **Where it goes** — that context is sent only to the Noxus agent widget you
  configured (your Noxus base URL). The agent uses it only if its deployment is
  configured to accept external page context; otherwise it's ignored.
- **Credentials** — sign-in tokens are stored locally in the browser
  (`chrome.storage.local`) and sent only to your Noxus instance to authenticate
  the agent. Your settings live in `chrome.storage.sync`.
- **No third parties** — nothing is sent anywhere else, and the panel never
  loads on sites you haven't whitelisted.

## Permissions

- `storage` — remember your settings and session.
- `identity` — provide the OAuth redirect URL used during sign-in.
- `tabs` — toggle the panel on the active tab and read the active tab so the
  popup can show the detected page context.
- `webRequest` — catch the sign-in redirect back to the extension.
- host access (`https://*/*`) — so the panel can appear on whichever sites you
  whitelist. It only activates on the whitelist.

## How page context flows

```
content script (per-site adapter) ──▶ embedded Noxus widget ──▶ agent
        reads the page                 (your Noxus instance)    receives it as
                                                                 page context
```

The adapter for the current site extracts a small JSON payload describing the
page and hands it to the embedded widget; the agent receives it as context for
the turn (when its deployment is configured to accept it). Example payload on a
HubSpot deal:

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
in `manifest.json` **before** `adapters/generic.js` (first match wins; generic
is the fallback):

```js
window.__noxusAdapters.push({
  name: "zendesk",
  matches: () => location.hostname.endsWith(".zendesk.com"),
  getContext: () => ({ source: "zendesk", url: location.href, /* … */ }),
});
```

## Files

- `manifest.json` — MV3 config: `<all_urls>` content script, `https://*/*` host
  access, toolbar popup, options page, toggle command.
- `content.js` — injects and controls the panel, dispatches to the right
  adapter, runs the widget handshake, and watches SPA navigation.
- `adapters/{salesforce,hubspot,generic}.js` — per-site page-context extraction.
- `background.js` — sign-in (PKCE) and token storage/refresh; the toggle command.
- `popup.html/js` — sign-in, detected-context indicator, panel toggle.
- `options.html/js` — Noxus base URL, workspace/agent picker, site whitelist,
  panel title/width, and the page-context toggle.
- `icons/` — Noxus brand marks.

## License

Source-available under the [Elastic License 2.0](../LICENSE). See the repository
root for the full text.
