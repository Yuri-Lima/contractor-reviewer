# Chat

## Summary

Chat lets you ask questions about your contract in natural language. The AI assistant answers using the document content and, when available, legal sources. Each answer includes **citations** (references to specific pages, paragraphs, or legal sources) so you can verify the evidence behind the response. Answers are displayed as **rendered Markdown** (headings, lists, bold, code blocks, etc.) as they stream. Once the response is complete, you can switch to **raw Markdown** to view the underlying syntax. You can use **conversations** (threads) to keep related questions together, **export** a conversation as markdown, use voice input, choose how responses are displayed (text, audio, or both), and optionally request a fresh response instead of a cached one. The assistant uses **memory** (summaries of prior exchanges) to provide better context across turns.

## When to Use

- You want to understand a clause or term in your contract
- You need to find where a topic is discussed
- You want legal context for a governing law or jurisdiction
- You prefer to speak your question instead of typing

## Prerequisites

- You must have a document with at least one **available** file (processing complete).
- Your role in the workspace must allow chat (MEMBER or higher).

## Steps

### Ask a Question

1. Open a document with available files (see [Documents](documents.md)).
2. Click the **Chat** tab in the document view.
3. (Optional) Select an existing **conversation** from the list, or click **New conversation** to start fresh.
4. Type your question in the input field (e.g., "What is the termination notice period?").
5. Click **Send** or press Enter.
6. The assistant responds with an answer and citations.

### Manage Conversations

- **New conversation**: Click **New conversation** to start a new thread. Each thread keeps its own history.
- **Switch conversation**: Click a conversation in the list to load its messages.
- **Delete conversation**: Click the trash icon next to a conversation to remove it and all its messages.
- **Export conversation**: Click the download icon next to a conversation to export it as a markdown file (`.md`).

### Use Voice Input (Optional)

1. In the chat input area, click the **Voice input** (microphone) button.
2. Allow microphone access if prompted.
3. Speak your question. The app transcribes your speech to text.
4. Review the transcribed text and edit if needed.
5. Click **Send** to submit.

*Note:* Voice input requires a modern browser that supports the Web Speech API. If unsupported, the option is disabled.

### Rendered Markdown and Raw Toggle

1. Assistant responses are shown as **formatted Markdown** (headings, lists, bold, code blocks, links) as they stream.
2. After the full response has finished, a **code/eye icon** appears next to "Assistant:" in the message header.
3. Click the icon to switch between **formatted** view (default) and **raw Markdown** view.
4. Raw view shows the underlying Markdown syntax (e.g. `**bold**`, `# heading`) for copying or inspection.
5. The toggle is only available when the response is complete; while streaming, only the formatted view is shown.

### View Citations

1. After the assistant responds, look for the **Citations** section below the answer.
2. Citations show:
   - **Contract citations**: File name, page number, paragraph ID, and a quote snippet.
   - **Legal citations**: Source name, section/article, and URL (when legal sources are used).
3. Use **View Source** or the link to jump to the relevant part of the document or legal source.
4. The answer may include a **Confidence** level (High, Medium, Low) indicating how strongly the evidence supports the response.

### Get a Fresh Response (Skip Cache)

1. If you see a "Cached response" label on an answer, it means the response was reused from a previous similar question.
2. To force a new answer from the AI, click **Get fresh response**.
3. A new request is sent and a new answer is generated (subject to rate limits and token budgets).

## Response Modes

You can choose how assistant responses are displayed:

| Mode | Description |
|------|-------------|
| **Text only** | Standard text reply. |
| **Audio only** | Response is spoken aloud via text-to-speech. No text shown. |
| **Audio and text** | Both spoken and displayed. |

To change the mode: go to **Account Settings** (or Workspace Settings → Voice) and select the **Chat response mode** you prefer. The setting is saved per account or workspace.

## Confidence and "NOT FOUND"

- **High confidence**: Multiple clear citations from the contract or legal sources.
- **Medium confidence**: Partial evidence or ambiguous wording.
- **Low confidence**: Inference, missing jurisdiction, or weak contractual/legal support.

When the AI cannot find sufficient evidence, it may respond with **NOT FOUND** and suggest where to look or what to ask instead.

## Developer Mode

When **Developer Mode** is enabled in Account Settings, chat uses a two-step flow: **Prepare** → **Approve** → **Execute**. Before the question is sent to the AI, an LLM Payload Preview dialog appears with tabs for Question, System Prompt, User Prompt, Contract Chunks, Legal Chunks, and Model Params. You can review the payload and click **Approve and Send** to proceed. See [Developer Mode](developer-mode.md) for details.

## Memory and Context

The assistant maintains **memory** (summaries of prior questions and answers) for each conversation. This memory is injected into the context when you ask follow-up questions, so the assistant can refer to earlier findings. Memory is stored per conversation and per document. It is purged according to the same retention policy as chat messages. When no-logs mode skips chat persistence, memory is not updated.

## Related Topics

- [Documents](documents.md) — Upload files before using Chat
- [Redline](redline.md) — Generate suggested edits based on AI analysis
- [Account Settings](account-settings.md) — Chat preferences, response mode, Developer Mode
- [Developer Mode](developer-mode.md) — LLM payload preview
