import { DB } from '../core/db.js';
import { buildGraph, findShortestPath, findAllPaths, findPathsVia } from '../core/graph.js';

// ==================== 工具执行函数 ====================
export async function executeTool(toolName, args) {
  // 通过 lore_path 获取目标设定集或独立故事设定
  let setting = null;
  if (args.lore_path) {
    setting = await DB.loresets.getById(args.lore_path);
    if (!setting) {
      const story = await DB.stories.getById(args.lore_path);
      if (story?.associatedLoreSetId) setting = await DB.loresets.getById(story.associatedLoreSetId);
    }
  }
  if (!setting) return { error: '无法定位目标设定集或独立故事设定' };

  let result = { success: false };

  switch (toolName) {
    // === 世界观节点 ===
    case 'add_worldview_node': {
      const nodeId = args.id || DB.genId('node', args.name);
      const node = { id: nodeId, priority: args.priority || 99, name: args.name, tags: args.tags, content: { description: args.content?.description || '', detail: args.content?.detail || '' } };
      setting.worldview.nodes.push(node);
      await DB.loresets.put(setting);
      result = { success: true, data: node };
      break;
    }
    case 'edit_worldview_node': {
      const node = setting.worldview.nodes.find(n => n.id === args.node_id);
      if (!node) { result = { error: '节点不存在: ' + args.node_id }; break; }
      if (args.name) node.name = args.name;
      if (args.priority !== undefined) node.priority = args.priority;
      if (args.tags) node.tags = args.tags;
      if (args.content?.description) node.content.description = args.content.description;
      if (args.content?.detail) node.content.detail = args.content.detail;
      await DB.loresets.put(setting);
      result = { success: true, data: node };
      break;
    }
    case 'delete_worldview_node': {
      const idx = setting.worldview.nodes.findIndex(n => n.id === args.node_id);
      if (idx === -1) { result = { error: '节点不存在: ' + args.node_id }; break; }
      const deleted = setting.worldview.nodes.splice(idx, 1)[0];
      setting.worldview.edges = setting.worldview.edges.filter(e => e.subject !== args.node_id && e.object !== args.node_id);
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 关系边 ===
    case 'add_edge': {
      const edgeId = args.id || DB.genId('edge', args.subject + '_' + args.object);
      const edge = { id: edgeId, subject: args.subject, relation: args.relation, object: args.object };
      setting.worldview.edges.push(edge);
      await DB.loresets.put(setting);
      result = { success: true, data: edge };
      break;
    }
    case 'edit_edge': {
      const edge = setting.worldview.edges.find(e => e.id === args.edge_id);
      if (!edge) { result = { error: '边不存在: ' + args.edge_id }; break; }
      if (args.relation) edge.relation = args.relation;
      await DB.loresets.put(setting);
      result = { success: true, data: edge };
      break;
    }
    case 'delete_edge': {
      const idx = setting.worldview.edges.findIndex(e => e.id === args.edge_id);
      if (idx === -1) { result = { error: '边不存在: ' + args.edge_id }; break; }
      const deleted = setting.worldview.edges.splice(idx, 1)[0];
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 场景 ===
    case 'add_scene': {
      const sceneId = args.id || DB.genId('scene', args.name);
      const scene = { id: sceneId, name: args.name, default: { position: args.position || [], content: { description: args.content?.description || '', detail: args.content?.detail || '' }, items: args.items || [] } };
      setting.scenes[sceneId] = scene;
      await DB.loresets.put(setting);
      result = { success: true, data: scene };
      break;
    }
    case 'edit_scene': {
      const scene = setting.scenes[args.scene_id];
      if (!scene) { result = { error: '场景不存在: ' + args.scene_id }; break; }
      if (args.name) scene.name = args.name;
      if (args.position) scene.default.position = args.position;
      if (args.content?.description) scene.default.content.description = args.content.description;
      if (args.content?.detail) scene.default.content.detail = args.content.detail;
      if (args.items) scene.default.items = args.items;
      await DB.loresets.put(setting);
      result = { success: true, data: scene };
      break;
    }
    case 'delete_scene': {
      if (!setting.scenes[args.scene_id]) { result = { error: '场景不存在: ' + args.scene_id }; break; }
      const deleted = setting.scenes[args.scene_id];
      delete setting.scenes[args.scene_id];
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 角色 ===
    case 'add_character': {
      const charId = args.id || DB.genId('char', args.name);
      const char = {
        id: charId,
        name: args.name,
        default: {
          persona: args.persona || '',
          mbti: args.mbti || '',
          value: args.value || '',
          pursuit: args.pursuit || '',
          ability: args.ability || '',
          relationship: args.relationship || [],
          goal: args.goal || '',
          memory: {
            vital: args.memory?.vital || [],
            longTerm: args.memory?.longTerm || [],
            daily: args.memory?.daily || []
          },
          inventory: args.inventory || [],
          cognition: {
            worldview_blacklist: args.cognition?.worldview_blacklist || [],
            events: args.cognition?.events || [],
            items: args.cognition?.items || [],
            characters: args.cognition?.characters || {}
          }
        }
      };
      setting.characters[charId] = char;
      await DB.loresets.put(setting);
      result = { success: true, data: char };
      break;
    }
    case 'edit_character': {
      const char = setting.characters[args.char_id];
      if (!char) { result = { error: '角色不存在: ' + args.char_id }; break; }
      if (args.name) char.name = args.name;
      if (args.persona) char.default.persona = args.persona;
      if (args.mbti) char.default.mbti = args.mbti;
      if (args.value) char.default.value = args.value;
      if (args.pursuit) char.default.pursuit = args.pursuit;
      if (args.ability) char.default.ability = args.ability;
      if (args.goal) char.default.goal = args.goal;
      if (args.relationship) char.default.relationship = args.relationship;
      if (args.cognition) {
        if (!char.default.cognition) char.default.cognition = {};
        if (args.cognition.worldview_blacklist) char.default.cognition.worldview_blacklist = args.cognition.worldview_blacklist;
        if (args.cognition.events) char.default.cognition.events = args.cognition.events;
        if (args.cognition.items) char.default.cognition.items = args.cognition.items;
        if (args.cognition.characters) char.default.cognition.characters = { ...char.default.cognition.characters, ...args.cognition.characters };
      }
      if (args.memory) {
        if (!char.default.memory) char.default.memory = { vital: [], longTerm: [], daily: [] };
        if (args.memory.vital) char.default.memory.vital = args.memory.vital;
        if (args.memory.longTerm) char.default.memory.longTerm = args.memory.longTerm;
        if (args.memory.daily) char.default.memory.daily = args.memory.daily;
      }
      if (args.inventory) char.default.inventory = args.inventory;
      await DB.loresets.put(setting);
      result = { success: true, data: char };
      break;
    }
    case 'delete_character': {
      if (!setting.characters[args.char_id]) { result = { error: '角色不存在: ' + args.char_id }; break; }
      const deleted = setting.characters[args.char_id];
      delete setting.characters[args.char_id];
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 道具 ===
    case 'add_item': {
      const itemId = args.id || DB.genId('item', args.name);
      const item = { id: itemId, name: args.name, tags: args.tags || ['自定义'], default: { content: { description: args.content?.description || '', detail: args.content?.detail || '' }, ability: args.ability || '' } };
      setting.items[itemId] = item;
      await DB.loresets.put(setting);
      result = { success: true, data: item };
      break;
    }
    case 'edit_item': {
      const item = setting.items[args.item_id];
      if (!item) { result = { error: '道具不存在: ' + args.item_id }; break; }
      if (args.name) item.name = args.name;
      if (args.tags) item.tags = args.tags;
      if (args.content?.description) item.default.content.description = args.content.description;
      if (args.content?.detail) item.default.content.detail = args.content.detail;
      if (args.ability) item.default.ability = args.ability;
      await DB.loresets.put(setting);
      result = { success: true, data: item };
      break;
    }
    case 'delete_item': {
      if (!setting.items[args.item_id]) { result = { error: '道具不存在: ' + args.item_id }; break; }
      const deleted = setting.items[args.item_id];
      delete setting.items[args.item_id];
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 历史事件 ===
    case 'add_history': {
      const histId = args.id || DB.genId('history', args.name);
      const h = { id: histId, time: args.time, content: { description: args.content?.description || '', detail: args.content?.detail || '' }, connection: args.connection || [] };
      setting.worldview.history.push(h);
      await DB.loresets.put(setting);
      result = { success: true, data: h };
      break;
    }
    case 'edit_history': {
      const h = setting.worldview.history.find(x => x.id === args.history_id);
      if (!h) { result = { error: '历史事件不存在: ' + args.history_id }; break; }
      if (args.time) h.time = args.time;
      if (args.content?.description) h.content.description = args.content.description;
      if (args.content?.detail) h.content.detail = args.content.detail;
      if (args.connection) h.connection = args.connection;
      await DB.loresets.put(setting);
      result = { success: true, data: h };
      break;
    }
    case 'delete_history': {
      const idx = setting.worldview.history.findIndex(x => x.id === args.history_id);
      if (idx === -1) { result = { error: '历史事件不存在: ' + args.history_id }; break; }
      const deleted = setting.worldview.history.splice(idx, 1)[0];
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 地理结构 ===
    case 'add_geography': {
      const geoId = args.id || DB.genId('node', args.name);
      const g = { id: geoId, name: args.name, content: { description: args.content?.description || '' }, neighbors: args.neighbors || [], layer: args.layer || 1, father: args.father || null };
      setting.worldview.geography.push(g);
      await DB.loresets.put(setting);
      result = { success: true, data: g };
      break;
    }
    case 'edit_geography': {
      const g = setting.worldview.geography.find(x => x.id === args.geo_id);
      if (!g) { result = { error: '地理节点不存在: ' + args.geo_id }; break; }
      if (args.name) g.name = args.name;
      if (args.content?.description) g.content.description = args.content.description;
      if (args.neighbors) g.neighbors = args.neighbors;
      if (args.layer !== undefined) g.layer = args.layer;
      if (args.father) g.father = args.father;
      await DB.loresets.put(setting);
      result = { success: true, data: g };
      break;
    }
    case 'delete_geography': {
      const idx = setting.worldview.geography.findIndex(x => x.id === args.geo_id);
      if (idx === -1) { result = { error: '地理节点不存在: ' + args.geo_id }; break; }
      const deleted = setting.worldview.geography.splice(idx, 1)[0];
      await DB.loresets.put(setting);
      result = { success: true, data: deleted };
      break;
    }

    // === 查询类 ===
    case 'list_settings': {
      const cat = args.category || 'all';
      const out = {};
      if (cat === 'all' || cat === 'worldview') out.worldview = setting.worldview.nodes.map(n => ({ id: n.id, desc: n.content.description }));
      if (cat === 'all' || cat === 'scene') out.scenes = Object.values(setting.scenes).map(s => ({ id: s.id, desc: s.default.content.description }));
      if (cat === 'all' || cat === 'character') out.characters = Object.values(setting.characters).map(c => ({ id: c.id, desc: c.default.persona }));
      if (cat === 'all' || cat === 'item') out.items = Object.values(setting.items).map(i => ({ id: i.id, desc: i.default.content.description }));
      if (cat === 'all' || cat === 'history') out.history = setting.worldview.history.map(h => ({ id: h.id, desc: h.content.description }));
      if (cat === 'all' || cat === 'geography') out.geography = setting.worldview.geography.map(g => ({ id: g.id, desc: g.content.description }));
      result = { success: true, data: out };
      break;
    }
    case 'read_settings': {
      const graph = buildGraph(setting);
      const out = [];
      for (const id of (args.ids || [])) {
        let entry = null;
        const wn = setting.worldview.nodes.find(n => n.id === id);
        if (wn) entry = { id, type: 'worldview', version: 0, data: wn };
        const sc = setting.scenes[id];
        if (sc) entry = { id, type: 'scene', version: 0, data: sc };
        const ch = setting.characters[id];
        if (ch) entry = { id, type: 'character', version: 0, data: ch };
        const it = setting.items[id];
        if (it) entry = { id, type: 'item', version: 0, data: it };
        const hi = setting.worldview.history.find(h => h.id === id);
        if (hi) entry = { id, type: 'history', version: 0, data: hi };
        const ge = setting.worldview.geography.find(g => g.id === id);
        if (ge) entry = { id, type: 'geography', version: 0, data: ge };
        if (entry) {
          const neighbors = [];
          for (const e of graph.edges) {
            if (e.source === id && graph.nodes.has(e.target)) {
              const n = graph.nodes.get(e.target);
              neighbors.push({ id: n.id, desc: n.desc, relation: e.label });
            }
          }
          entry.neighbors = neighbors;
          out.push(entry);
        }
      }
      result = { success: true, data: out };
      break;
    }
    case 'trace_versions': {
      result = { success: true, message: '当前编辑的是设定集模板，无版本历史。版本查询仅在故事实例中可用。' };
      break;
    }
    case 'trace_graph': {
      const graph = buildGraph(setting);
      if (!graph.nodes.has(args.source_id)) { result = { error: '源节点不存在: ' + args.source_id }; break; }
      if (!graph.nodes.has(args.target_id)) { result = { error: '目标节点不存在: ' + args.target_id }; break; }
      let paths;
      if (args.via) {
        let viaNodes;
        try { viaNodes = JSON.parse(args.via); } catch (e) { viaNodes = args.via.split(',').map(s => s.trim()); }
        paths = findPathsVia(graph, args.source_id, args.target_id, viaNodes, args.count || 3);
      } else if (args.type === 'shortest') {
        const p = findShortestPath(graph, args.source_id, args.target_id);
        paths = p ? [p] : [];
      } else {
        paths = findAllPaths(graph, args.source_id, args.target_id, args.count || 5);
      }
      if (paths.length === 0) {
        result = { success: true, message: 'no such path' };
      } else {
        const detailedPaths = paths.map(p => p.map(id => {
          const n = graph.nodes.get(id);
          return n ? { id, name: n.name, type: n.type } : { id };
        }));
        result = { success: true, paths: detailedPaths };
      }
      break;
    }
    case 'read_history': {
      let events = setting.worldview.history || [];
      if (args.connection) events = events.filter(h => h.connection?.includes(args.connection));
      result = { success: true, data: events.map(h => ({ id: h.id, time: h.time, desc: h.content.description, connection: h.connection })) };
      break;
    }

    default:
      result = { error: '未知工具: ' + toolName };
  }

  // UI refresh handled by caller

  return result;
}
