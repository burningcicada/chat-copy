# Architecture

## Capture path

Chat Copy prefers the authenticated ChatGPT conversation-history response for the conversation currently open in the browser. It reconstructs the current conversation branch from the returned message mapping and stable message identifiers.

The DOM scanner remains a fallback for diagnostics/compatibility. DOM reconstruction is treated cautiously because ChatGPT can virtualize long conversations and recycle rendered windows.

## Integrity checks

A capture records:

- capture method;
- total/user/assistant message counts;
- stable-ID coverage;
- repeated message-block diagnostics;
- chronology/break diagnostics;
- first/last message previews.

Normal exports are blocked when the integrity layer reports a critical warning; JSON diagnostic export remains available.

## Export formats

- JSON: structured truth layer including stable IDs and integrity metadata.
- Markdown: readable archival representation.
- HTML: standalone readable archive.
- Google Docs: Markdown is uploaded to Google Drive while requesting the native Google Docs MIME type.

Small uploads use Drive multipart upload; larger ones use resumable upload.

## Google Drive permissions

The beta requests only `drive.file`.

Folder support therefore focuses on folders Chat Copy creates/manages itself. Arbitrary browsing of the user's entire Drive is intentionally not enabled. A future Google Picker integration is preferred over broadening the scope.

## Sharing

When the user enables **Anyone with the link can view**, Chat Copy creates a Drive permission with:

- type: `anyone`
- role: `reader`
- file discovery: disabled

This behavior is opt-in.

## Local state

Firefox extension storage holds Google OAuth configuration/tokens, Chat Copy-managed folder records, per-conversation folder choices, and the last generated Google Doc metadata.
