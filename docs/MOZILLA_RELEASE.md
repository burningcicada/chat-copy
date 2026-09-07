# Mozilla Release Plan

## Recommended sequence

1. Keep the GitHub repository public as a beta source repository.
2. Complete the release checklist and large-chat testing.
3. Remove the tester-supplied Google OAuth setup from the normal user experience or clearly document it as beta-only.
4. Prepare a source archive that exactly matches the extension submitted for review.
5. Submit first as an **unlisted** Mozilla-signed extension for controlled testing.
6. Install the signed XPI normally and verify persistence across Firefox restarts.
7. Consider a public AMO listing only after the signed build has passed further testing.

## Data declaration

The manifest currently declares no data collection. Before submission, verify that this declaration still matches the source and Mozilla's current review requirements.

## Source review

Keep the extension dependency-free where practical. This makes the submitted source easier to reproduce and audit.
