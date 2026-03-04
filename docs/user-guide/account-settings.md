# Account Settings

## Summary

Account Settings let you manage your profile (name, email, avatar), chat preferences (cache similarity, response mode), global AI prompts, and storage. You can also restart the onboarding tour, enable Developer Mode (when you are a workspace owner), and delete your account permanently.

## When to Use

- You want to update your profile or avatar
- You need to change how chat responses are displayed or cached
- You want to add global AI prompts that apply across workspaces
- You need to enable Developer Mode for LLM payload preview
- You want to delete your account

## Prerequisites

- You must be logged in.
- Developer Mode is only available if you are OWNER in at least one workspace.

## Steps

### Open Account Settings

1. Click **Settings** in the sidebar or user menu.
2. You are taken to Account Settings with tabs: Profile, AI Prompts, Chat, Storage.

### Update Profile

1. Go to the **Profile** tab.
2. **Avatar**: Upload a custom avatar (PNG or JPEG, max 2MB) or use Gravatar. Use **Remove** to switch back to Gravatar.
3. **Name** and **Email**: Displayed read-only (managed by your identity provider in most setups).

### Configure Chat Preferences

1. Go to the **Chat** tab.
2. **Cache similarity threshold**: Lower = more cache hits (faster, may be less precise); higher = stricter match (fewer cache hits). Default is 0.95.
3. Check **Use default** to use the system default.
4. **Response mode** (if shown here): Text only, Audio only, or Audio and text. Alternatively, this may be in Workspace Settings → Voice.
5. Save.

### Configure Global AI Prompts

1. Go to the **AI Prompts** tab.
2. Edit the **global system prompt** (`global.system`). This prompt is merged into the AI context for chat and redline across all workspaces and documents. Workspace and document prompts supplement or override it.
3. Save.

### Enable Developer Mode

1. Go to the **Profile** tab.
2. Find the **Developer Mode** (or "Developer Visualizations") card (visible only if you are OWNER in at least one workspace).
3. Toggle **Developer Mode** on.
4. When enabled:
   - Chat uses a **Prepare → Approve → Execute** flow. Before sending a question to the AI, an LLM Payload Preview dialog appears with tabs for Question, System Prompt, User Prompt, Contract Chunks, Legal Chunks, and Model Params.
   - You can review the payload and click **Approve and Send** to proceed, or cancel to discard.
   - Developer-only elements (IDs, debug info) may appear elsewhere in the app.

See [Developer Mode](developer-mode.md) for details.

### Help & Onboarding

1. In the **Profile** tab, find **Help & Onboarding**.
2. **Reset Onboarding**: Restart the guided tour and checklist.
3. **Start Tour**: Launch the product tour immediately.

### Delete Account

1. Scroll to the **Danger Zone** in the Profile tab.
2. Read the list of what will be permanently removed (user account, owned workspaces, documents, chat history, audit logs).
3. Type **DELETE** in the confirmation field.
4. Check the "I understand" checkbox.
5. Click **Delete My Account Permanently**.
6. Confirm in the final dialog. This action is irreversible.

## Related Topics

- [Workspaces](workspaces.md) — Workspace roles (OWNER required for Developer Mode)
- [Chat](chat.md) — Chat behavior and citations
- [Developer Mode](developer-mode.md) — LLM payload preview
- [Workspace Settings](workspace-settings.md) — Retention, parsers, prompts per workspace
