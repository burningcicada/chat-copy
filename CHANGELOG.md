# Changelog

## 0.2.3-beta — 2026-09-06

### Added

- Google Drive destination routing to My Drive or Chat Copy-managed folders.
- Creation of Drive folders from the Chat Copy panel.
- Per-conversation remembered destination folder.
- Google Doc title matching the ChatGPT conversation title.
- Optional `anyone` / `reader` link sharing, OFF by default.
- Copy resulting Google Doc link after export.
- Share/copy link controls for the last document created for the conversation.

### Preserved

- Canonical-history capture baseline established in 0.1.10.
- Fresh canonical read immediately before export.
- Direct native Google Docs creation established in 0.2.2.
- Markdown, HTML, and JSON archives.
- JSON truth-layer option.

### Beta note

Folder routing and link-sharing require additional large-chat and multi-folder testing before Mozilla public release.

## 0.2.2 — 2026-09-06

- Completed working Google OAuth token exchange for Desktop OAuth clients.
- Direct Google Docs export verified end-to-end.

## 0.1.10 — 2026-09-06

- Established accepted canonical-history capture baseline.
- Replaced virtualized-DOM chronology reconstruction as the primary capture path.
- Added stable IDs and integrity diagnostics.
