# Privacy

Chat Copy is designed to work without a Chat Copy-operated server.

## Data Chat Copy can access

When you explicitly run Chat Copy on a supported ChatGPT conversation, the extension can access the conversation necessary to create the requested export. It also stores local extension settings needed for operation, such as Google OAuth configuration, OAuth tokens, selected Chat Copy-managed Drive folders, and the last created Google Doc for a conversation.

## Where conversation data goes

Conversation content can remain local when you export Markdown, HTML, or JSON. When you choose **Export directly to Google Docs**, the generated document content is sent directly from the extension to Google's OAuth/Drive services using the Google account you authorized.

Chat Copy does not send conversation content to a Chat Copy analytics service or application server.

## Google authorization

The beta uses the narrow Google Drive scope:

`https://www.googleapis.com/auth/drive.file`

The beta stores the tester-provided Desktop OAuth Client ID, Desktop OAuth Client Secret, Google access token, and refresh token in Firefox extension storage. These values must never be committed to source control or pasted into public bug reports.

A Desktop OAuth client secret is distributed-client material rather than a confidential server secret, but it should still be treated as sensitive configuration and not unnecessarily published.

## Link sharing

**Anyone with the link can view** is OFF by default. If a user enables it, Chat Copy asks Google Drive to create an `anyone` / `reader` permission for that document. Anyone who obtains the resulting URL may then read the document. The user is responsible for choosing whether this is appropriate for the exported conversation.

## Telemetry

Chat Copy does not include analytics or telemetry in this beta. The Firefox manifest declares no data collection.

## Deleting local extension state

Removing the extension or clearing its extension storage removes the locally stored Chat Copy configuration/tokens from that Firefox profile. Removing the extension does not delete Google Docs already created in Drive.
