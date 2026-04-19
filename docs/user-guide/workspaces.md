# Workspaces

## Summary

A workspace is a container for documents and team members. Everything in ContractAI Review (documents, files, chat) lives inside a workspace. You can create multiple workspaces, add members with different roles, and switch between them from the sidebar.

## When to Use

- You want to organize contracts by client, project, or team
- You need to add colleagues or collaborators to a workspace
- You want to understand roles (OWNER, ADMIN, MEMBER, VIEWER) and permissions

## Prerequisites

- You must be logged in.
- To create a workspace: no additional prerequisites.
- To add members: you must have OWNER or ADMIN role in the workspace.

## Steps

### Create a Workspace

1. From the sidebar or navigation, go to **Workspaces** (or the workspaces list).
2. Click **Create workspace** (or the plus icon).
3. Enter a name for the workspace.
4. Click **Create**.
5. The new workspace appears in the list. Click it to open it.

### Add Members to a Workspace

1. Open the workspace you want to add members to.
2. Go to **Workspace Settings** → **Members** (or the members tab).
3. Click **Add member** or **Invite member**.
4. Enter the invitee's email and choose a role (see Roles below).
5. Confirm the invite. The member receives an invitation (depending on your setup).

### Switch Workspace

1. In the sidebar, find the **Current Workspace** or workspace switcher.
2. Click it to see a list of workspaces you belong to.
3. Select the workspace you want to switch to.
4. The app loads that workspace's documents and context.

## Roles and Permissions

| Role | Description |
|------|-------------|
| **OWNER** | Full control. Can manage billing (future), delete the workspace, change retention settings, and perform all ADMIN actions. |
| **ADMIN** | Can add/remove members, manage documents, delete files, and view everything. Cannot delete the workspace or change certain billing/retention settings. |
| **MEMBER** | Can upload files, use chat, and download documents. Can work with shared documents. |
| **VIEWER** | Can view and download documents only. Cannot edit or chat. |

## Options / Variations

- **Edit workspace name**: Use the workspace context menu or settings to rename the workspace.
- **Workspace logo**: Some setups allow uploading a logo for the workspace card.
- **Leave workspace**: If you are not the owner, you may be able to leave a workspace from its settings.

## Related Topics

- [Getting Started](getting-started.md) — First workspace, document, and file
- [Documents](documents.md) — Create documents inside a workspace
- [Workspace Settings](workspace-settings.md) — Retention, parsers, prompts
