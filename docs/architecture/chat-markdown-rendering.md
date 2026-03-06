# Chat Markdown Rendering

Reference for how assistant responses are rendered as Markdown in the chat UI.

## Overview

Chat answers are displayed as **formatted Markdown** (headings, lists, bold, code blocks, links) as they stream. Once the full response has finished, users can switch to **raw Markdown** view to see the underlying syntax.

## Stack

| Component | Technology |
|-----------|------------|
| Parser | [Incremark](https://www.incremark.com/) (`@incremark/react`) — incremental parsing, O(n) complexity |
| Integration | `IncremarkWrapperComponent` — Angular component hosting React root |
| Theme | `@incremark/theme` — base markdown styles |

## Flow

1. **Streaming**: `answerText` grows chunk-by-chunk from the chat stream API.
2. **Rendered view**: `IncremarkContent` receives `content` and `isFinished`; parses incrementally as chunks arrive.
3. **Raw toggle**: After `streaming === false`, a code/eye icon appears. Click to switch between formatted and raw Markdown.
4. **Raw view**: Plain `<pre>` with `whitespace-pre-wrap` showing the raw `answerText`.

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/documents/chat/incremark-wrapper/` | Angular wrapper that mounts Incremark React component |
| `apps/web/src/app/documents/chat/chat-message/chat-message.component.ts` | Uses wrapper, toggle logic, `canShowRawToggle` when `!streaming` |
| `apps/web/angular.json` | `@incremark/theme/dist/incremark.css` in styles |

## Toggle Visibility

The raw/rendered toggle is **only shown when the full response has finished** (`!message().streaming`). While streaming, only the formatted view is displayed.

## Related

- [Chat (user guide)](../user-guide/chat.md) — Rendered Markdown and Raw Toggle
- [RAG Pipeline](rag-pipeline.md) — Chat API and streaming
