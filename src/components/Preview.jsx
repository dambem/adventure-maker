import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import { outgoingOf } from '../lib/story.js';

export default function Preview({ nodes, edges, startId, onClose }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [path, setPath] = useState([startId]);
  const currentId = path[path.length - 1];
  const node = byId.get(currentId);
  const html = useMemo(() => marked.parse(node?.data.body || ''), [node]);

  if (!node) {
    return (
      <div className="preview-backdrop" onClick={onClose}>
        <div className="preview" onClick={(e) => e.stopPropagation()}>
          <p>No start passage. Close the preview and pick one.</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const choices = outgoingOf(node.id, edges).filter((e) => byId.has(e.target));

  return (
    <div className="preview-backdrop" onClick={onClose}>
      <div className="preview" onClick={(e) => e.stopPropagation()}>
        <div className="preview-bar">
          <span className="muted">Preview · step {path.length}</span>
          <span>
            {path.length > 1 && (
              <button className="small" onClick={() => setPath(path.slice(0, -1))}>← Back</button>
            )}{' '}
            <button className="small" onClick={() => setPath([startId])}>Restart</button>{' '}
            <button className="small" onClick={onClose}>Close ✕</button>
          </span>
        </div>

        <article>
          <h1>{node.data.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        {node.type === 'end' ? (
          <footer>
            <p className="the-end">— The End —</p>
            {(node.data.links || []).filter((l) => l.url).map((l, i) => (
              <a className="choice-btn external" key={i} href={l.url} target="_blank" rel="noreferrer">
                {l.label || l.url} ↗
              </a>
            ))}
          </footer>
        ) : choices.length ? (
          <footer>
            {choices.map((e) => (
              <button className="choice-btn" key={e.id} onClick={() => setPath([...path, e.target])}>
                {e.label || 'Continue'}
              </button>
            ))}
          </footer>
        ) : (
          <footer><p className="muted">Dead end — this passage has no choices and isn't an ending.</p></footer>
        )}
      </div>
    </div>
  );
}
