# Versions

## Summary

Versions track the history of changes to a document. Each time you apply a redline or make edits, a new version is created (v1, v2, v3, …). You can view each version, see a side-by-side diff of changes, and understand who made the change and when.

## When to Use

- You want to see what changed between versions
- You need to know who applied a redline and when
- You want to review the evolution of the document

## Prerequisites

- The document must have at least one version (created when you first upload files or apply a redline).
- Your role must allow viewing (MEMBER or higher; VIEWER can view and download).

## Steps

### View Version History

1. Open the document.
2. Click the **Versions** tab.
3. A list of versions appears, ordered by version number (newest first).
4. Each version shows:
   - Version number (e.g., v1, v2)
   - Created by (user email)
   - Creation date
   - Playbook used (if from a redline)

### View Version Details and Diff

1. In the Versions list, click **View** (or the eye icon) next to a version.
2. The version expands to show:
   - An **Explanation** for each change
   - **Diff blocks**: Original vs suggested text, with color coding:
     - **Remove** (red): Text to be removed
     - **Add** (green): Text to be added
     - **Equal**: Unchanged text
3. Use the side-by-side or inline diff to compare original and new content.
4. Click **Hide** (or the eye-slash icon) to collapse the version details.

### Download or Export (if available)

1. Some setups allow downloading a specific version as PDF or DOCX.
2. Use the version context menu or buttons if the option is available.

## How Versions Are Created

- **Initial version (v1)**: Created when the document is first processed (files uploaded, parsed, chunked).
- **New versions (v2, v3, …)**: Created when you **Apply Changes** from a redline. Each applied redline creates a new version.

## Options / Variations

- **Playbook tag**: Versions created from redlines show the playbook (Balanced, Conservative, Client-friendly) used.
- **Context menu**: Right-click a version for options such as view, download, or compare (depending on implementation).

## Related Topics

- [Redline](redline.md) — Generate and apply redline changes
- [Documents](documents.md) — Document structure and files
