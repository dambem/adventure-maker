import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, useReactFlow, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './Nodes.jsx';
import SidePanel from './SidePanel.jsx';
import Preview from './Preview.jsx';
import { uid, seedStory, buildExport, lintStory } from '../lib/story.js';

const STORAGE_KEY = 'cyoa-editor-v1';
const edgeDefaults = {
  type: 'default',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.nodes) && s.nodes.length) return s;
    }
  } catch { /* fall through to seed */ }
  return seedStory();
}

function Flow() {
  const initial = useMemo(load, []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initial.edges.map((e) => ({ ...edgeDefaults, ...e }))
  );
  const [startId, setStartId] = useState(initial.startId);
  const [selectedId, setSelectedId] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const saveTimer = useRef();

  // -- autosave (debounced) ------------------------------------------------
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const slim = {
        nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: edges.map(({ id, source, target, label }) => ({ id, source, target, label })),
        startId,
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slim)); } catch { /* quota */ }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, startId]);

  // -- guard: keep startId valid -------------------------------------------
  useEffect(() => {
    if (nodes.length && !nodes.some((n) => n.id === startId)) setStartId(nodes[0].id);
  }, [nodes, startId]);

  // -- connections -----------------------------------------------------------
  const onConnect = useCallback(
    (conn) => setEdges((eds) => addEdge({ ...edgeDefaults, ...conn, id: uid('e'), label: '' }, eds)),
    [setEdges]
  );

  // Drag from a handle into empty space → carve out a new passage there.
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid) return; // dropped on a real node; onConnect handled it
      const from = connectionState.fromNode;
      if (!from || connectionState.fromHandle?.type !== 'source') return;

      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const id = uid();
      const newNode = {
        id, type: 'story',
        position: { x: position.x, y: position.y - 40 },
        data: { title: 'New passage', body: '', links: [] },
        selected: true,
      };
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(newNode));
      setEdges((eds) => addEdge({ ...edgeDefaults, id: uid('e'), source: from.id, target: id, label: '' }, eds));
      setSelectedId(id);
    },
    [screenToFlowPosition, setNodes, setEdges]
  );

  // -- node/edge mutations used by the side panel ----------------------------
  const changeData = useCallback((id, patch) =>
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))), [setNodes]);

  const changeType = useCallback((id, type) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, type } : n)));
    if (type === 'end') setEdges((eds) => eds.filter((e) => e.source !== id)); // endings have no choices
  }, [setNodes, setEdges]);

  const deleteNode = useCallback((id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }, [setNodes, setEdges]);

  const changeEdgeLabel = useCallback((id, label) =>
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label } : e))), [setEdges]);

  const deleteEdge = useCallback((id) =>
    setEdges((eds) => eds.filter((e) => e.id !== id)), [setEdges]);

  // Reorder a choice among its siblings (same source), preserving global order otherwise.
  const moveEdge = useCallback((id, dir) => setEdges((eds) => {
    const edge = eds.find((e) => e.id === id);
    if (!edge) return eds;
    const siblings = eds.filter((e) => e.source === edge.source);
    const i = siblings.findIndex((e) => e.id === id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return eds;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    let k = 0;
    return eds.map((e) => (e.source === edge.source ? siblings[k++] : e));
  }), [setEdges]);

  const addPassage = useCallback(() => {
    const id = uid();
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + (Math.random() * 80 - 40),
      y: window.innerHeight / 2 + (Math.random() * 80 - 40),
    });
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))
      .concat({ id, type: 'story', position, data: { title: 'New passage', body: '', links: [] }, selected: true }));
    setSelectedId(id);
  }, [screenToFlowPosition, setNodes]);

  const resetToSample = useCallback(() => {
    if (!confirm('Replace the current story with the sample? This cannot be undone.')) return;
    const s = seedStory();
    setNodes(s.nodes);
    setEdges(s.edges.map((e) => ({ ...edgeDefaults, ...e })));
    setStartId(s.startId);
    setSelectedId(null);
  }, [setNodes, setEdges]);

  // -- export -----------------------------------------------------------------
  const exportZip = useCallback(async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const files = buildExport(
      nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
      edges.map(({ id, source, target, label }) => ({ id, source, target, label })),
      startId
    );
    for (const [name, content] of Object.entries(files)) zip.file(name, content);
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'adventure.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [nodes, edges, startId]);

  // -- derived ------------------------------------------------------------------
  const issues = useMemo(() => lintStory(nodes, edges, startId), [nodes, edges, startId]);
  const selected = nodes.find((n) => n.id === selectedId) || null;
  const renderNodes = useMemo(
    () => nodes.map((n) => (n.id === startId ? { ...n, data: { ...n.data, isStart: true } } : n)),
    [nodes, startId]
  );

  return (
    <div className="app">
      <header className="toolbar">
        <strong>Adventure builder</strong>
        <button onClick={addPassage}>+ Passage</button>
        <button onClick={() => setPreviewing(true)}>▶ Preview</button>
        <button onClick={exportZip}>⤓ Export .zip</button>
        <span className="spacer" />
        <button
          className={`issues ${issues.length ? 'warn' : 'ok'}`}
          onClick={() => setShowIssues((v) => !v)}
          title="Story checks"
        >
          {issues.length ? `⚠ ${issues.length} issue${issues.length > 1 ? 's' : ''}` : '✓ Story is sound'}
        </button>
        <button className="small" onClick={resetToSample}>Reset to sample</button>
      </header>

      {showIssues && issues.length > 0 && (
        <ul className="issue-list">
          {issues.map((iss, i) => (
            <li key={i}>
              <button className="link" onClick={() => { setSelectedId(iss.nodeId); setShowIssues(false); }}>
                {iss.message}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="main">
        <div className="canvas">
          <ReactFlow
            nodes={renderNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onSelectionChange={({ nodes: sel }) => setSelectedId(sel[0]?.id ?? null)}
            fitView
            proOptions={{ hideAttribution: false }}
            defaultEdgeOptions={edgeDefaults}
          >
            <Background gap={20} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <SidePanel
          node={selected}
          nodes={nodes}
          edges={edges}
          startId={startId}
          onChangeData={changeData}
          onChangeType={changeType}
          onSetStart={setStartId}
          onDeleteNode={deleteNode}
          onChangeEdgeLabel={changeEdgeLabel}
          onMoveEdge={moveEdge}
          onDeleteEdge={deleteEdge}
        />
      </div>

      {previewing && (
        <Preview nodes={nodes} edges={edges} startId={startId} onClose={() => setPreviewing(false)} />
      )}
    </div>
  );
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
