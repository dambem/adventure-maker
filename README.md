# Adventure builder

A node-based editor for markdown choose-your-own-adventures. Built with Astro + a single React island (React Flow / `@xyflow/react`).

```bash
npm install
npm run dev      # http://localhost:4321
```

## How it works

- Drag from a passage's right handle into empty space making a new passage appear there, already connected and selected for editing. Drop onto an existing node to connect instead.
- **Two node types.** A *story* passage links onward via choices. An *ending* terminates the story and can list external options — currently URL links (label + url).
- **Export .zip** produces `story/*.md` (one file per passage, choices in YAML frontmatter) plus a `README.md` with a copy-paste Astro content-collection integration (schema + dynamic route).
- Work autosaves to `localStorage`.

## Layout

```
src/
  lib/story.js            graph model, slugs, YAML serialisation, lint, export, seed
  components/
    Editor.jsx            canvas, toolbar, autosave, export
    Nodes.jsx             custom story/end node renderers
    SidePanel.jsx         passage editing + generated-markdown view
    Preview.jsx           play-through overlay (marked)
  pages/index.astro       static shell; editor loads client:only
  styles/app.css          plain functional CSS
```

The exported markdown format is the contract: everything else is just an editor for it. `story.js` has no React in it, so the serialisation/lint logic is trivially testable from node.
# adventure-maker
