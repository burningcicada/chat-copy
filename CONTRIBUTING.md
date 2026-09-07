# Contributing

Thank you for helping test Chat Copy.

## Before opening an issue

Run the latest beta and note:

- Firefox version
- Chat Copy version
- whether the result says `CANONICAL HISTORY OK` or `DOM FALLBACK`
- exact non-sensitive error text
- approximate conversation size

Do **not** attach private conversation exports, Google credentials, OAuth tokens, or confidential document links.

## Development

1. Load `extension/manifest.json` as a temporary Firefox add-on from `about:debugging`.
2. Make changes in `extension/`.
3. Run `./scripts/validate.sh`.
4. Exercise capture, local JSON export, Google Docs export, folder routing, and sharing behavior as relevant.

## Pull requests

Keep changes focused. If a change touches capture chronology or integrity logic, include a description of the regression scenario it protects against.
