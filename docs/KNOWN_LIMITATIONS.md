# Known Limitations

- Canonical ChatGPT history access is based on the current web application and is not a documented general-purpose history API.
- A future ChatGPT web change may require adapting the capture code.
- DOM fallback is less authoritative and can be affected by virtualized rendering.
- Existing arbitrary Google Drive folders are not broadly browsable under the current beta UX; Chat Copy-managed folders are supported.
- Actual attachment binaries are not embedded in exports; attachment/image placeholders are preserved.
- Google OAuth setup is still developer-oriented in this beta.
- Temporary Firefox development installs must be reloaded after a full browser restart until the extension is Mozilla-signed.
