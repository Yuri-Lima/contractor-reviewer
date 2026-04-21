# Developer Mode

## Summary

Developer Mode is a feature for workspace owners that lets you inspect the full LLM payload before it is sent to the AI. When enabled, chat uses a two-step flow: **Prepare** → **Approve** → **Execute**. You see the system prompt, user prompt, document chunks, legal chunks, and model parameters in a preview dialog, then approve to send or cancel to discard.

## When to Use

- You want to verify RAG context and retrieval quality during development
- You need to debug why the AI gave a particular answer
- You want to understand what document and legal chunks are being sent
- You are building or tuning AI prompts

## Prerequisites

- You must be **OWNER** in at least one workspace (Developer Mode is only shown to owners).
- **Developer Mode** must be enabled in Account Settings → Profile.
- The backend must have `CHAT_PREPARE_ENABLED` set (default: enabled). If disabled, the prepare/execute endpoints return 404.

## Steps

### Enable Developer Mode

1. Go to **Account Settings** → **Profile** tab.
2. Find the **Developer Mode** card (only visible if you are OWNER in at least one workspace).
3. Toggle **Developer Mode** on.
4. The setting is saved immediately.

### Use Chat with Prepare/Execute Flow

1. Open a document with available files.
2. Go to the **Chat** tab.
3. Type your question and click **Send**.
4. Instead of sending directly to the AI, the app calls **Prepare** first. A dialog titled **LLM Payload Preview (Dev Mode)** appears.
5. Review the tabs:
   - **Question**: Your question
   - **System Prompt**: Instructions sent to the model
   - **User Prompt**: Formatted user message including context
   - **Document Chunks**: Retrieved contract passages (text, page, paragraph, similarity)
   - **Legal Chunks**: Retrieved legal sources (text, source name, section, URL, similarity)
   - **Model Params**: Model name, temperature, max tokens
6. Click **Approve and Send** to execute. The request is sent to the LLM and you receive the response.
7. Click **Cancel** (or close) to discard. No request is sent.

### Payload Lifecycle

- The prepared payload is cached for **15 minutes** by default (configurable via `CHAT_PREPARE_TTL_SECONDS`).
- **One-time use**: After you click **Approve and Send**, the payload is consumed and deleted.
- If you wait too long or navigate away, the preparation may expire. Submit your question again to get a fresh payload.

## Options / Variations

- **Other developer elements**: When Developer Mode is on, IDs and debug info may appear elsewhere in the app (e.g., in document or workspace views).
- **Backend configuration**: `CHAT_PREPARE_ENABLED=false` disables the prepare/execute flow. The app falls back to direct chat (or shows an error) when prepare is not available.

## Related Topics

- [Chat](chat.md) — Normal chat flow and citations
- [Account Settings](account-settings.md) — Enable Developer Mode
- [Workspace Settings](workspace-settings.md) — Prompts that affect the system/user prompts
