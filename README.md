# Noxus Extensions

Browser extensions for the Noxus platform.

## Extensions

### [`copilot/`](./copilot) — Noxus Copilot

Your Noxus agent as a copilot on **any** website. Docks as a resizable panel,
signs you in to Noxus (Auth0 PKCE), and sends the agent the **context of the
page you're on** — natively for Salesforce and HubSpot, general page context
everywhere else.

Load it unpacked from `copilot/` (`chrome://extensions` → Developer mode →
Load unpacked). See [`copilot/README.md`](./copilot/README.md) for setup and
how to add a new native site integration.

## Layout

```
noxus-extensions/
└── copilot/        # Noxus Copilot (MV3 Chrome extension)
    ├── manifest.json
    ├── content.js          # panel injection + adapter dispatch
    ├── adapters/           # per-site context extraction (salesforce, hubspot, generic)
    ├── background.js       # Auth0 login + token relay
    ├── popup.* / options.* # control surfaces
    └── icons/
```
