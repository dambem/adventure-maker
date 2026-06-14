# Adventure builder

A node-based editor for markdown choose-your-own-adventures. Built with Astro + a single React island (React Flow / `@xyflow/react`).

```bash
npm install
npm run dev      # http://localhost:4321
```

## How it works

- **Carve out the story by dragging.** Drag from a passage's right handle into empty space — a new passage appears there, already connected and selected for editing. Drop onto an existing node to connect instead.
- **Edges are choices.** The edge label is the choice text the reader sees; edit it (and reorder choices) in the side panel.
- **Two node types.** A *story* passage links onward via choices. An *ending* terminates the story and can list external options — currently URL links (label + url).
- **Side panel** shows the selected passage: title, markdown body, choices/links — plus a **Markdown** tab showing the exact file that will be exported, frontmatter included.
- **Preview** plays the adventure from the start node with rendered markdown, back/restart controls.
- **Story checks** lint the graph live: dead ends, unreachable passages, unlabelled choices. Click an issue to jump to the node.
- **Export .zip** produces `story/*.md` (one file per passage, choices in YAML frontmatter) plus a `README.md` with a copy-paste Astro content-collection integration (schema + dynamic route).
- Work autosaves to `localStorage`.

## Layout

```
src/
  lib/story.js            graph model, slugs, YAML serialisation, lint, export, seed
  components/
    Editor.jsx            the island: canvas, toolbar, autosave, export
    Nodes.jsx             custom story/end node renderers
    SidePanel.jsx         passage editing + generated-markdown view
    Preview.jsx           play-through overlay (marked)
  pages/index.astro       static shell; editor loads client:only
  styles/app.css          plain functional CSS
```

The exported markdown format is the contract: everything else is just an editor for it. `story.js` has no React in it, so the serialisation/lint logic is trivially testable from node.
# adventure-maker
