# Release Checklist

Before a Mozilla release candidate:

- [ ] Fresh install in a clean Firefox profile.
- [ ] Firefox restart behavior checked with a signed/unlisted build.
- [ ] Canonical-history capture verified on several ordinary chats.
- [ ] WARBL-scale / very large chat export verified.
- [ ] First and last message boundaries verified.
- [ ] Stable-ID coverage reviewed.
- [ ] No duplicate blocks or chronology breaks.
- [ ] Export immediately after new messages are added.
- [ ] Markdown archive verified.
- [ ] JSON truth layer verified.
- [ ] Native Google Doc created with the same title as the chat.
- [ ] My Drive export verified.
- [ ] New folder creation verified.
- [ ] Nested folder creation verified.
- [ ] Per-conversation folder memory verified.
- [ ] Anyone-with-link OFF by default verified.
- [ ] Anyone-with-link ON behavior verified.
- [ ] Copy link behavior verified.
- [ ] Google disconnect/reconnect verified.
- [ ] OAuth token refresh after expiration verified.
- [ ] Expired/revoked OAuth error handled gracefully.
- [ ] Network-offline error handled gracefully.
- [ ] No personal credentials in source tree.
- [ ] `./scripts/validate.sh` passes.
- [ ] Privacy/security documents match actual behavior.
- [ ] Mozilla data-collection declaration reviewed.
