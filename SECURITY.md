# Security Policy

## Beta status

Chat Copy is currently beta software. Do not use it as the sole archive for irreplaceable material until you have verified the produced document and JSON truth layer.

## Reporting a vulnerability

Please use a private GitHub Security Advisory for vulnerabilities that could expose conversation content, OAuth credentials/tokens, or Google Drive files. Do not post secrets or private chat content in a public issue.

## Secrets and credentials

Never commit or publish:

- Google OAuth Client Secret
- OAuth access or refresh tokens
- private Google Doc links if link sharing is enabled
- exported private chats
- screenshots containing credentials

The repository intentionally contains no personal OAuth credentials.

## Trust boundaries

Chat Copy interacts with:

- the authenticated ChatGPT web application in the browser;
- Google's OAuth service;
- Google Drive API endpoints;
- local Firefox extension storage;
- local browser downloads/clipboard when the user requests them.

It does not require a Chat Copy-operated backend server.

## Sharing warning

Enabling **Anyone with the link can view** changes the Google Drive permission on the exported document. Use this only when the conversation is appropriate to share by URL.
