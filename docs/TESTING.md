# Testing Guide

## Capture smoke test

1. Open a known ChatGPT conversation.
2. Press **Alt+Shift+C**.
3. Run **Scan entire chat**.
4. Confirm `CANONICAL HISTORY OK` when available.
5. Export JSON.
6. Verify the first and last messages against the live conversation.
7. Check `stableIdCoverage`, `repeatedBlocks`, and `breaks` in JSON.

## Freshness test

1. Scan a conversation.
2. Add several new messages.
3. Export without manually scanning again.
4. Confirm the new export includes the new messages.

## Drive test

1. Export to My Drive.
2. Confirm Google Doc title matches the ChatGPT title.
3. Create a Chat Copy Drive folder.
4. Export into that folder.
5. Reload ChatGPT and verify the destination is remembered for that conversation.

## Sharing test

1. Export with link sharing OFF; confirm the Doc remains private.
2. Export a non-sensitive test conversation with link sharing ON.
3. Open the copied URL in a logged-out/private browser window and confirm view-only access.
4. Revoke sharing in Drive after the test if the content should not remain link-readable.

## Large conversation test

Use a long conversation and compare:

- first message;
- last message;
- total message count;
- several landmarks in the middle;
- stable-ID uniqueness;
- repeated-block diagnostics.
