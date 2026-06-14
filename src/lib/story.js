// Core story model + markdown serialisation.
// A story is a graph: nodes (passages) + edges (choices).
//
// node.data = { title, body, links: [{label,url}] }   // links only used by 'end' nodes
// edge       = { source, target, label }              // label is the choice text

let counter = 0;
export const uid = (prefix = 'n') =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function slugify(title, fallback = 'passage') {
  const s = (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

/** Stable, collision-free slug per node id. */
export function buildSlugMap(nodes) {
  const map = new Map();
  const used = new Set();
  for (const n of nodes) {
    let base = slugify(n.data.title, n.id);
    let slug = base;
    let i = 2;
    while (used.has(slug)) slug = `${base}-${i++}`;
    used.add(slug);
    map.set(n.id, slug);
  }
  return map;
}

const yamlStr = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Render one node to a markdown file with YAML frontmatter. */
export function nodeToMarkdown(node, outgoing, slugMap, isStart) {
  const lines = ['---', `title: ${yamlStr(node.data.title)}`];
  if (isStart) lines.push('start: true');

  if (node.type === 'end') {
    lines.push('ending: true');
    const links = node.data.links || [];
    if (links.length) {
      lines.push('links:');
      for (const l of links) {
        lines.push(`  - label: ${yamlStr(l.label)}`);
        lines.push(`    url: ${yamlStr(l.url)}`);
      }
    }
  } else if (outgoing.length) {
    lines.push('choices:');
    for (const e of outgoing) {
      lines.push(`  - label: ${yamlStr(e.label || 'Continue')}`);
      lines.push(`    to: ${yamlStr(slugMap.get(e.target))}`);
    }
  }

  lines.push('---', '', (node.data.body || '').trim(), '');
  return lines.join('\n');
}

/** Outgoing edges of a node, in stored order. */
export const outgoingOf = (nodeId, edges) => edges.filter((e) => e.source === nodeId);

/** Build the full export: { 'slug.md': content, ... } plus README. */
export function buildExport(nodes, edges, startId) {
  const slugMap = buildSlugMap(nodes);
  const files = {};
  for (const n of nodes) {
    const out = outgoingOf(n.id, edges).filter((e) => slugMap.has(e.target));
    files[`story/${slugMap.get(n.id)}.md`] = nodeToMarkdown(n, out, slugMap, n.id === startId);
  }
  files['README.md'] = readme(slugMap.get(startId) || 'start');
  return files;
}

/** Graph lint: returns array of { nodeId, message }. */
export function lintStory(nodes, edges, startId) {
  const issues = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const n of nodes) {
    const out = outgoingOf(n.id, edges);
    if (n.type === 'story' && out.length === 0)
      issues.push({ nodeId: n.id, message: `"${n.data.title}" is a dead end — link it onward or make it an ending.` });
    if (n.type === 'end' && out.length > 0)
      issues.push({ nodeId: n.id, message: `"${n.data.title}" is an ending but still has outgoing choices.` });
    for (const e of out)
      if (!e.label?.trim())
        issues.push({ nodeId: n.id, message: `"${n.data.title}" has a choice with no label.` });
  }

  // reachability from start
  if (byId.has(startId)) {
    const seen = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      for (const e of outgoingOf(id, edges))
        if (byId.has(e.target) && !seen.has(e.target)) { seen.add(e.target); queue.push(e.target); }
    }
    for (const n of nodes)
      if (!seen.has(n.id))
        issues.push({ nodeId: n.id, message: `"${n.data.title}" is unreachable from the start.` });
  }
  return issues;
}

function readme(startSlug) {
  return `# Your adventure, exported

Each passage is one markdown file in \`story/\`. Choices live in the frontmatter:

\`\`\`yaml
---
title: "The cave mouth"
choices:
  - label: "Light a torch"
    to: "light-a-torch"
---
\`\`\`

Endings set \`ending: true\` and may list external \`links\` (label + url).
The starting passage is marked \`start: true\` (here: \`${startSlug}.md\`).

## Using it in Astro

1. Copy \`story/\` into \`src/content/story/\` in your Astro project.

2. Define the collection — \`src/content.config.ts\`:

\`\`\`ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const story = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/story' }),
  schema: z.object({
    title: z.string(),
    start: z.boolean().optional(),
    ending: z.boolean().optional(),
    choices: z.array(z.object({ label: z.string(), to: z.string() })).optional(),
    links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  }),
});

export const collections = { story };
\`\`\`

3. One dynamic route renders every passage — \`src/pages/story/[...slug].astro\`:

\`\`\`astro
---
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const passages = await getCollection('story');
  return passages.map((p) => ({ params: { slug: p.id }, props: { passage: p } }));
}

const { passage } = Astro.props;
const { Content } = await render(passage);
---
<article>
  <h1>{passage.data.title}</h1>
  <Content />

  {passage.data.choices && (
    <ul>
      {passage.data.choices.map((c) => (
        <li><a href={\`/story/\${c.to}/\`}>{c.label}</a></li>
      ))}
    </ul>
  )}

  {passage.data.ending && passage.data.links && (
    <ul>
      {passage.data.links.map((l) => (
        <li><a href={l.url}>{l.label}</a></li>
      ))}
    </ul>
  )}
</article>
\`\`\`

4. Link to the start passage from anywhere: \`/story/${startSlug}/\`.
`;
}

/** A small seed story so the canvas is never empty on first load. */
export function seedStory() {
  const a = { id: uid(), type: 'story', position: { x: 0, y: 120 },
    data: { title: 'The cave mouth', body: 'Cold air spills from the dark. Somewhere below, water drips in slow time.', links: [] } };
  const b = { id: uid(), type: 'story', position: { x: 360, y: 0 },
    data: { title: 'Light a torch', body: 'The flame catches. Shadows leap back to reveal a painted wall — a spiral of red ochre hands.', links: [] } };
  const c = { id: uid(), type: 'end', position: { x: 360, y: 240 },
    data: { title: 'Turn back', body: 'Some doors are better left shut. You walk home under a thin moon.', links: [{ label: 'Start your own adventure', url: 'https://example.com' }] } };
  const d = { id: uid(), type: 'end', position: { x: 720, y: 0 },
    data: { title: 'Follow the hands', body: 'The spiral leads inward, and inward, and in.', links: [{ label: 'Read about cave art', url: 'https://en.wikipedia.org/wiki/Cave_painting' }] } };
  return {
    nodes: [a, b, c, d],
    edges: [
      { id: uid('e'), source: a.id, target: b.id, label: 'Light a torch' },
      { id: uid('e'), source: a.id, target: c.id, label: 'Turn back' },
      { id: uid('e'), source: b.id, target: d.id, label: 'Follow the hands' },
    ],
    startId: a.id,
  };
}
