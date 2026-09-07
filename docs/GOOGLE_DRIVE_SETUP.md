# Google Drive Setup — Beta Test Build

The public beta does not contain a shared production OAuth client. Each tester currently supplies a Google Desktop OAuth client locally.

This is development scaffolding, not the intended final user experience.

## One-time setup

1. Open Google Cloud Console and create/select a project for Chat Copy.
2. Enable **Google Drive API**.
3. Configure **Google Auth Platform**.
4. Use an **External** audience for a personal Google account and keep the app in **Testing** while developing.
5. Add the Google account you will use as a test user.
6. Under Data Access, add only:

   `https://www.googleapis.com/auth/drive.file`

7. Create an OAuth client with application type **Desktop app**.
8. Copy the Desktop OAuth **Client ID** and **Client Secret**.
9. In Chat Copy, open **Google setup**, enter both values, and save them.
10. Click **Connect Google** and approve the consent screen.

## Billing

The development setup does not require linking a Google Cloud billing account for the ordinary Drive API usage used by Chat Copy. Do not start a paid/free-trial billing flow merely to test this extension.

## Never commit credentials

Do not place Client IDs/Secrets or OAuth tokens in repository files, screenshots, issues, logs, or sample configuration.

## Release direction

The intended production experience is:

**Install Chat Copy → Connect Google Drive → choose account → approve limited access → export**

No end user should need to create their own Google Cloud project once Chat Copy has its production OAuth configuration and release process.
