import React, { useState } from 'react';
import { nodeToMarkdown, buildSlugMap, outgoingOf } from '../lib/story.js';

export default function SidePanel({
  node, nodes, edges, startId,
  onChangeData, onChangeType, onSetStart, onDeleteNode,
  onChangeEdgeLabel, onMoveEdge, onDeleteEdge,
}) {
  const [tab, setTab] = useState('edit');

  if (!node) {
    return (
      <aside className="panel">
        <div className="empty">
          <p><strong>Nothing selected.</strong></p>
          <p>Click a passage to edit it. Drag from a passage's right handle into empty space to grow the story.</p>
        </div>
      </aside>
    );
  }

  const outgoing = outgoingOf(node.id, edges);
  const slugMap = buildSlugMap(nodes);
  const titleOf = (id) => nodes.find((n) => n.id === id)?.data.title || '?';
  const md = nodeToMarkdown(node, outgoing, slugMap, node.id === startId);

  return (
    <aside className="panel">
      <div className="tabs">
        <button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>Edit</button>
        <button className={tab === 'md' ? 'active' : ''} onClick={() => setTab('md')}>Markdown</button>
      </div>

      {tab === 'md' ? (
        <div className="md-view">
          <div className="filename">story/{slugMap.get(node.id)}.md</div>
          <pre>{md}</pre>
        </div>
      ) : (
        <div className="edit-view">
          <label>Title
            <input
              value={node.data.title}
              onChange={(e) => onChangeData(node.id, { title: e.target.value })}
              placeholder="Passage title"
            />
          </label>

          <label>Passage (markdown)
            <textarea
              value={node.data.body}
              onChange={(e) => onChangeData(node.id, { body: e.target.value })}
              placeholder={'Write the scene…\n\nPlain markdown: **bold**, *italic*, lists, links.'}
              rows={10}
            />
          </label>

          <div className="row">
            <label className="inline">
              <input
                type="checkbox"
                checked={node.type === 'end'}
                onChange={(e) => onChangeType(node.id, e.target.checked ? 'end' : 'story')}
              /> This is an ending
            </label>
            {node.id !== startId && node.type !== 'end' && (
              <button className="small" onClick={() => onSetStart(node.id)}>Make start</button>
            )}
          </div>

          {node.type === 'end' ? (
            <EndLinks node={node} onChangeData={onChangeData} />
          ) : (
            <section>
              <h3>Choices</h3>
              {outgoing.length === 0 && (
                <p className="muted">No choices yet. Drag from this node's right handle to create one.</p>
              )}
              {outgoing.map((e, i) => (
                <div className="choice" key={e.id}>
                  <input
                    value={e.label || ''}
                    placeholder="Choice text…"
                    onChange={(ev) => onChangeEdgeLabel(e.id, ev.target.value)}
                  />
                  <span className="target">→ {titleOf(e.target)}</span>
                  <span className="choice-actions">
                    <button className="icon" disabled={i === 0} onClick={() => onMoveEdge(e.id, -1)} title="Move up">↑</button>
                    <button className="icon" disabled={i === outgoing.length - 1} onClick={() => onMoveEdge(e.id, 1)} title="Move down">↓</button>
                    <button className="icon danger" onClick={() => onDeleteEdge(e.id)} title="Remove choice">✕</button>
                  </span>
                </div>
              ))}
            </section>
          )}

          <button className="danger wide" onClick={() => onDeleteNode(node.id)}>Delete passage</button>
        </div>
      )}
    </aside>
  );
}

function EndLinks({ node, onChangeData }) {
  const links = node.data.links || [];
  const set = (next) => onChangeData(node.id, { links: next });

  return (
    <section>
      <h3>Where to next? <span className="muted">(external links)</span></h3>
      {links.map((l, i) => (
        <div className="link-row" key={i}>
          <input
            value={l.label}
            placeholder="Label"
            onChange={(e) => set(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
          />
          <input
            value={l.url}
            placeholder="https://…"
            onChange={(e) => set(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
          />
          <button className="icon danger" onClick={() => set(links.filter((_, j) => j !== i))} title="Remove link">✕</button>
        </div>
      ))}
      <button className="small" onClick={() => set([...links, { label: '', url: '' }])}>+ Add link</button>
    </section>
  );
}
