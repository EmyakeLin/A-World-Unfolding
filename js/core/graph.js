export function buildGraph(setting) {
  const nodes = new Map();
  const edges = [];

  // 汇总所有实体为节点
  for (const n of (setting.worldview?.nodes || [])) {
    nodes.set(n.id, { id: n.id, name: n.name, desc: n.content?.description || '', type: (n.tags && n.tags[0]) || 'worldview' });
  }
  for (const [id, s] of Object.entries(setting.scenes || {})) {
    nodes.set(id, { id, name: s.name, desc: s.default?.content?.description || '', type: 'scene' });
  }
  for (const [id, c] of Object.entries(setting.characters || {})) {
    nodes.set(id, { id, name: c.name, desc: c.default?.persona || '', type: 'character' });
  }
  for (const [id, i] of Object.entries(setting.items || {})) {
    nodes.set(id, { id, name: i.name, desc: i.default?.content?.description || '', type: 'item' });
  }
  for (const h of (setting.worldview?.history || [])) {
    nodes.set(h.id, { id: h.id, name: h.id, desc: h.content?.description || '', type: 'history' });
  }
  for (const g of (setting.worldview?.geography || [])) {
    nodes.set(g.id, { id: g.id, name: g.name || g.id, desc: g.content?.description || '', type: 'geography' });
  }

  // worldview edges
  for (const e of (setting.worldview?.edges || [])) {
    edges.push({ source: e.subject, target: e.object, label: e.relation });
  }

  // character relationship edges
  for (const c of Object.values(setting.characters || {})) {
    for (const r of (c.default?.relationship || [])) {
      edges.push({ source: r.subject, target: r.object, label: r.relation });
    }
  }

  // character inventory edges
  for (const [cid, c] of Object.entries(setting.characters || {})) {
    for (const itemId of (c.default?.inventory || [])) {
      edges.push({ source: cid, target: itemId, label: '持有' });
    }
  }

  // history connection edges
  for (const h of (setting.worldview?.history || [])) {
    for (const cid of (h.connection || [])) {
      edges.push({ source: h.id, target: cid, label: '关联' });
    }
  }

  // geography neighbor / father edges
  for (const g of (setting.worldview?.geography || [])) {
    for (const nid of (g.neighbors || [])) {
      edges.push({ source: g.id, target: nid, label: '相邻' });
    }
    if (g.father) {
      edges.push({ source: g.id, target: g.father, label: '归属' });
    }
  }

  return { nodes, edges };
}

export function findShortestPath(graph, sourceId, targetId) {
  const visited = new Set();
  const queue = [[sourceId]];
  visited.add(sourceId);
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (current === targetId) return path;
    for (const e of graph.edges) {
      if (e.source === current && !visited.has(e.target)) {
        visited.add(e.target);
        queue.push([...path, e.target]);
      }
    }
  }
  return null;
}

export function findAllPaths(graph, sourceId, targetId, maxPaths = 5) {
  const results = [];
  const visited = new Set();
  function dfs(current, path) {
    if (results.length >= maxPaths) return;
    if (current === targetId) { results.push([...path]); return; }
    visited.add(current);
    for (const e of graph.edges) {
      if (e.source === current && !visited.has(e.target)) {
        path.push(e.target);
        dfs(e.target, path);
        path.pop();
      }
    }
    visited.delete(current);
  }
  dfs(sourceId, [sourceId]);
  return results;
}

export function findPathsVia(graph, sourceId, targetId, viaNodes, maxPaths = 3) {
  const via = Array.isArray(viaNodes) ? viaNodes : [viaNodes];
  let currentSources = [sourceId];
  const allSegments = [];
  for (const v of via) {
    const segs = [];
    for (const src of currentSources) {
      const found = findAllPaths(graph, src, v, maxPaths);
      segs.push(...found);
    }
    if (segs.length === 0) return [];
    allSegments.push(segs);
    currentSources = [v];
  }
  const finalSegs = [];
  for (const src of currentSources) {
    finalSegs.push(...findAllPaths(graph, src, targetId, maxPaths));
  }
  if (finalSegs.length === 0) return [];
  allSegments.push(finalSegs);

  function mergeSegments(segLists, idx, currentPath) {
    if (idx >= segLists.length) return [currentPath];
    const results = [];
    for (const seg of segLists[idx]) {
      const merged = [...currentPath, ...seg.slice(1)];
      results.push(...mergeSegments(segLists, idx + 1, merged));
      if (results.length >= maxPaths) break;
    }
    return results;
  }

  return mergeSegments(allSegments, 0, []).slice(0, maxPaths);
}
