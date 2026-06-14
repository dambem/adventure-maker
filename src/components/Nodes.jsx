import React from 'react';
import { Handle, Position } from '@xyflow/react';

const preview = (body, n = 90) => {
  const t = (body || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

export function StoryNode({ data, selected }) {
  return (
    <div className={`node story ${selected ? 'selected' : ''} ${data.isStart ? 'start' : ''}`}>
      <Handle type="target" position={Position.Left} />
      {data.isStart && <span className="badge">START</span>}
      <header>{data.title || 'Untitled'}</header>
      <p>{preview(data.body) || <em>Empty passage</em>}</p>
      <Handle type="source" position={Position.Right} />
      <span className="hint">drag →</span>
    </div>
  );
}

export function EndNode({ data, selected }) {
  const links = data.links || [];
  return (
    <div className={`node end ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <span className="badge end-badge">ENDING</span>
      <header>{data.title || 'Untitled'}</header>
      <p>{preview(data.body) || <em>Empty passage</em>}</p>
      {links.length > 0 && (
        <ul className="links">
          {links.map((l, i) => <li key={i}>↗ {l.label || l.url}</li>)}
        </ul>
      )}
    </div>
  );
}

export const nodeTypes = { story: StoryNode, end: EndNode };
