# Noxus Extensions

Browser extensions for the Noxus platform.

## Extensions

### [`copilot/`](./copilot) — Noxus Copilot

Your Noxus agent as a copilot on **any** website. Docks as a resizable panel,
signs you in to your Noxus instance (PKCE), and sends the agent the **context
of the page you're on** — natively for Salesforce and HubSpot, general page
context everywhere else.

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
    ├── background.js       # Noxus PKCE login + token relay
    ├── popup.* / options.* # control surfaces
    └── icons/
```

## License

Source-available under the [Elastic License 2.0](./LICENSE). You're free to use,
modify, and redistribute it; you may not offer it to third parties as a hosted
or managed service.
