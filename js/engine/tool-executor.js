import { DB } from '../core/db.js';
import { buildGraph, findShortestPath, findAllPaths, findPathsVia } from '../core/graph.js';
import { WorldviewCrud, EdgeCrud, SceneCrud, CharacterCrud, ItemCrud, HistoryCrud, GeographyCrud } from '../ui/components/base/crud-handler.js';

const crudHandlers = {
  add_worldview_node:    { handler: new WorldviewCrud(),  action: 'add' },
  edit_worldview_node:   { handler: new WorldviewCrud(),  action: 'edit' },
  delete_worldview_node: { handler: new WorldviewCrud(),  action: 'remove' },
  add_edge:              { handler: new EdgeCrud(),       action: 'add' },
  edit_edge:             { handler: new EdgeCrud(),       action: 'edit' },
  delete_edge:           { handler: new EdgeCrud(),       action: 'remove' },
  add_scene:             { handler: new SceneCrud(),      action: 'add' },
  edit_scene:            { handler: new SceneCrud(),      action: 'edit' },
  delete_scene:          { handler: new SceneCrud(),      action: 'remove' },
  add_character:         { handler: new CharacterCrud(),  action: 'add' },
  edit_character:        { handler: new CharacterCrud(),  action: 'edit' },
  delete_character:      { handler: new CharacterCrud(),  action: 'remove' },
  add_item:              { handler: new ItemCrud(),       action: 'add' },
  edit_item:             { handler: new ItemCrud(),       action: 'edit' },
  delete_item:           { handler: new ItemCrud(),       action: 'remove' },
  add_history:           { handler: new HistoryCrud(),    action: 'add' },
  edit_history:          { handler: new HistoryCrud(),    action: 'edit' },
  delete_history:        { handler: new HistoryCrud(),    action: 'remove' },
  add_geography:         { handler: new GeographyCrud(),  action: 'add' },
  edit_geography:        { handler: new GeographyCrud(),  action: 'edit' },
  delete_geography:      { handler: new GeographyCrud(),  action: 'remove' },
};

export async function executeTool(toolName, args) {
  let setting = null;
  if (args.lore_path) {
    setting = await DB.loresets.getById(args.lore_path);
    if (!setting) {
      const story = await DB.stories.getById(args.lore_path);
      if (story?.associatedLoreSetId) setting = await DB.loresets.getById(story.associatedLoreSetId);
    }
  }
  if (!setting) return { error: '无法定位目标设定集或独立故事设定' };

  const entry = crudHandlers[toolName];
  if (entry) {
    const { handler, action } = entry;
    let data;
    if (action === 'add') {
      data = handler.add(setting, args, DB.genId);
    } else if (action === 'edit') {
      data = handler.edit(setting, args);
    } else if (action === 'remove') {
      data = handler.remove(setting, args);
    }
    if (data?.error) return { error: data.error };
    await DB.loresets.put(setting);
    return { success: true, data };
  }

  let result = { success: false };

  switch (toolName) {
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
