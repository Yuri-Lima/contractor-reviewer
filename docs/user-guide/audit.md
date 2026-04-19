# Audit Logs

## Summary

The Audit Log records actions performed in the workspace: who did what, when, and on which resource. You can filter by action, target type, user, and date range. Only ADMIN and OWNER can view audit logs. Logs can be exported to CSV.

## When to Use

- You need to check who viewed, downloaded, or modified a document
- You want to trace chat queries or deletions
- You need to export logs for compliance or investigation

## Prerequisites

- You must have ADMIN or OWNER role in the workspace.
- MEMBER and VIEWER cannot access the Audit page.

## Steps

### Open the Audit Log

1. Open the workspace.
2. Go to **Audit** (or "Audit Logs") from the sidebar or workspace menu.
3. The audit table appears with columns: Action, Type, User, Date, Metadata.

### Filter Logs

1. Use the filter controls above or beside the table:
   - **Action**: Select an action (e.g., delete, download, upload, chat_query, view, create) or "All actions."
   - **Target Type**: Filter by type of resource (e.g., document, file).
   - **User**: Filter by user (if a user selector is available).
   - **Start Date** and **End Date**: Limit the date range.
2. Click **Apply** to apply filters.
3. Click **Clear** to reset filters.

### Export Logs

1. Use the **Export CSV** button (or context menu option).
2. A CSV file is downloaded with the current filtered results.

### View Log Details

1. Click a row or use the context menu to view details.
2. **Copy details** copies the selected log entry to the clipboard.

## What Events Are Logged

| Action | Description |
|--------|-------------|
| **delete** | Document or file deletion |
| **download** | File or document download |
| **upload** | File upload |
| **chat_query** | Chat question submitted |
| **view** | Document or file viewed |
| **create** | Document or workspace created |

Additional actions (e.g., export_privacy) may be logged depending on implementation. Metadata may include IP, user agent, and resource IDs. Contract content and full chat messages are not logged in plaintext.

## Related Topics

- [Privacy](privacy.md) — DSAR export, no-logs
- [Workspaces](workspaces.md) — Roles (ADMIN/OWNER required for audit access)
- [Documents](documents.md) — Document actions
