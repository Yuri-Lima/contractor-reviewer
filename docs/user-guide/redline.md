# Redline

## Summary

Redline lets you select text from your document and generate AI-suggested changes. You choose a **playbook** (Balanced, Conservative, or Client-friendly) that guides the style and extent of edits. After the AI generates a proposal, you can **accept** or **reject** each change, edit suggested text, and apply the result to create a new document version.

## When to Use

- You want to revise a clause or section with AI assistance
- You need different revision strategies (e.g., conservative vs client-friendly)
- You want to track changes with version history

## Prerequisites

- You must have a document with at least one **available** file.
- Your role must allow redline (MEMBER or higher; VIEWER cannot create redlines).

## Steps

### Select Text and Generate Redline

1. Open the document and go to the **Redline** tab.
2. Select text in the document viewer (or paste the clause into the "Selected Text" field).
3. Click **Add to selections** to add it to the list of selections for redline.
4. Choose a **Playbook** (Balanced, Conservative, or Client-friendly — see Options below).
5. Optionally add an **Objective** (describe the intent of the change).
6. Optionally add **Custom Instructions** for the AI.
7. Click **Generate Redline**.
8. Wait for the AI to generate the proposal. The proposal appears with Original vs Suggested text for each change.

### Review the Proposal

1. Each change shows:
   - **Original** text (from the document)
   - **Suggested** text (AI proposal)
   - **Explanation** for the change
2. For each block, you can:
   - **Accept** — Use the suggested text
   - **Reject** — Keep the original text
   - **Edit** — Modify the suggested text before accepting
3. If a **fuzzy match** is found (AI could not locate the exact text), you may be asked to confirm the region. Use the suggested region or select manually if available.

### Apply Changes (Create New Version)

1. After accepting or rejecting all changes, click **Apply Changes**.
2. A new version of the document is created (e.g., v2).
3. The version appears in the **Versions** tab with full history.

### Reject the Entire Proposal

1. If you do not want any of the suggested changes, click **Reject Proposal**.
2. Confirm when prompted. All changes are discarded.
3. You can generate a new proposal with different selections or playbook.

## Playbooks

| Playbook | Description |
|----------|-------------|
| **Balanced** | Balances protections for both parties. Good for general revisions. |
| **Conservative** | Minimizes changes, maintains neutral language. Best when you want small, cautious edits. |
| **Client-friendly** | Favors the client, suggests more favorable changes. Use when representing the client side. |

## Options / Variations

- **Multiple selections**: You can add several text selections before generating. The AI will consider all of them.
- **Edit suggested text**: Before applying, you can edit individual blocks to tweak the AI's suggestion.
- **NOT FOUND**: If the AI cannot find sufficient evidence for a suggestion, it may show "NOT FOUND" for that change. Review and decide whether to keep or discard it.

## Related Topics

- [Documents](documents.md) — Create documents and upload files
- [Versions](versions.md) — View version history and side-by-side diff
- [Chat](chat.md) — Ask questions about the contract
