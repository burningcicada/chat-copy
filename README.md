# Chat Copy

**Chat Copy** is a Firefox extension for exporting a ChatGPT conversation into a native Google Doc while also preserving local Markdown, HTML, and JSON archives.

> **Status:** public beta / development build (`v0.2.3-beta`).
>
> This project is unofficial and is not affiliated with or endorsed by OpenAI, Google, or Mozilla.

## Why it exists

Long ChatGPT conversations are awkward to archive reliably with normal copy/paste. Chat Copy is designed around a stricter archival goal:

**ChatGPT conversation → canonical-history capture → integrity checks → Google Docs / Markdown / JSON**

The extension first attempts to read the current conversation's canonical history from the authenticated ChatGPT web session. It uses a DOM-based reconstruction only as a fallback and surfaces integrity warnings rather than silently treating a suspicious capture as valid.

## Current features

- Fresh canonical-history read immediately before export.
- Integrity checks for breaks, repeated message blocks, and stable-ID coverage.
- Native Google Docs creation through Google Drive.
- Google Doc title automatically matches the ChatGPT conversation title.
- Export to My Drive or a Chat Copy-managed Drive folder.
- Create and remember Drive folders per conversation.
- Optional **Anyone with the link can view** sharing, OFF by default.
- Copy the resulting Google Doc link.
- Markdown, HTML, and JSON local archives.
- Optional JSON truth-layer download when creating a Google Doc.
- No telemetry and no Chat Copy server.

## Privacy model

Chat Copy does not operate a backend service. Conversation content is handled in your browser and is sent only to destinations you explicitly choose, such as your Google Drive. See [PRIVACY.md](PRIVACY.md) for details.

## Development installation

Firefox temporary add-ons are removed after Firefox restarts.

1. Download or clone this repository.
2. Open `about:debugging` in Firefox.
3. Choose **This Firefox**.
4. Click **Load Temporary Add-on…**.
5. Select `extension/manifest.json`.
6. On `chatgpt.com`, allow the extension to run if Firefox asks.
7. Open Chat Copy with **Alt+Shift+C**.

For permanent normal installation, the extension must be signed by Mozilla. See [docs/MOZILLA_RELEASE.md](docs/MOZILLA_RELEASE.md).

## Google Drive setup for this beta

The current beta intentionally does **not** ship a shared production OAuth client. Each tester creates a Google Desktop OAuth client and enters the Client ID and Client Secret locally in Chat Copy.

See [docs/GOOGLE_DRIVE_SETUP.md](docs/GOOGLE_DRIVE_SETUP.md).

**Never commit your Client ID/Client Secret pair, access tokens, refresh tokens, exported private chats, or Google Drive data to this repository.**

## Known limitations

- The canonical-history path depends on the current ChatGPT web application and is not an official public ChatGPT history API. It can break if the web application changes.
- The narrow `drive.file` scope does not provide general browsing of every pre-existing Drive folder. This beta manages folders created through Chat Copy; Google Picker support is planned.
- Uploaded images/attachments are represented in archives as attachment/image placeholders rather than embedded binary copies.
- Current Google OAuth setup is developer-oriented. A release build should reduce this to **Connect Google Drive → consent → done**.
- `v0.2.3` folder routing and link-sharing features are still beta features and should be tested further before a Mozilla public listing.

## Build and validate

No package manager dependencies are required.

```bash
./scripts/validate.sh
./scripts/build.sh
```

The build script creates a Firefox source ZIP in `dist/`.

## Repository layout

```text
extension/              Firefox extension source
scripts/                build and validation helpers
docs/                   architecture, Google setup, testing, release notes
.github/workflows/      CI validation
PRIVACY.md              privacy behavior
SECURITY.md             security guidance
CHANGELOG.md            version history
RELEASE_CHECKLIST.md    pre-release checklist
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports should include the Chat Copy version and the exact status/error text, but **must not include private conversation content, OAuth credentials, or tokens**.

## License

Chat Copy is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. See [LICENSE](LICENSE).

MPL-2.0 allows use, modification, and distribution, including as part of larger works, while requiring distributed modifications to MPL-covered source files to remain available under MPL-2.0.
