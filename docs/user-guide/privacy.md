# Privacy

## Summary

The Privacy page lets you control how your data is stored and for how long. You can enable **No-Logs Mode** to minimize persistence of sensitive content (document text, chat messages, versions) and use **DSAR-lite Export** to download all your data related to the workspace. These settings apply per workspace.

## When to Use

- You want to reduce what is stored for compliance or privacy
- You need to export your data (e.g., for a data subject access request)
- You want to understand what is stored and for how long

## Prerequisites

- You must be in a workspace with access to the Privacy page.
- Export and no-logs settings may require OWNER or ADMIN role depending on configuration.

## Steps

### Open the Privacy Page

1. Open the workspace.
2. Go to **Privacy** (from the sidebar or workspace menu). The page shows privacy settings and export options.

### Enable No-Logs Mode

1. Find the **No-Logs Mode** section.
2. Toggle **Enable No-Logs** on.
3. Configure which data to skip persisting:
   - **Do not persist document content**: After processing, document content is not stored long-term.
   - **Do not persist chat messages**: Questions and answers from chat are not stored.
   - **Do not persist versions**: Version history and redlines are not stored.
4. Optionally set **Accelerated Purge**: When enabled, data is deleted after a short period (1–30 days).
5. Click **Save Settings**.

*Note*: When no-logs is enabled, some features may work with a temporary session only. Data may be purged more aggressively.

### Export Your Data (DSAR-lite)

1. Find the **Export Data (DSAR-lite)** section.
2. Read what will be exported:
   - Chat messages (according to no-logs configuration)
   - Document version metadata
   - Audit logs related to your user
   - Privacy settings
3. Click **Export Data**.
4. Wait for the export to complete. A JSON file (or ZIP) is downloaded.
5. If the process is in progress, you may see a **Cancel** option to abort.

## What Is Stored (and for how long)

- **Files**: Kept according to **File Retention** in Workspace Settings (e.g., 1–365 days). A daily purge deletes expired files.
- **Text and embeddings**: Kept according to **Text and Embeddings Retention** (e.g., 1–730 days).
- **Chat messages**: Stored unless no-logs is enabled with "Do not persist chat messages."
- **Versions**: Stored unless no-logs is enabled with "Do not persist versions."
- **Audit logs**: Action, user, target, metadata. Retention depends on workspace and system configuration.

## Related Topics

- [Workspace Settings](workspace-settings.md) — Retention policies
- [Audit](audit.md) — What events are logged
- [Account Settings](account-settings.md) — Delete account
