import { DB } from '../core/db.js';

// ==================== UJSON-ENs Prompt Management ====================

const UJSON_cache = {
  entries: {},
  cached_versions: {},

  match(id, version, source) {
    if (this.cached_versions[id] == null) return null;
    if (this.cached_versions[id] !== version) return null;
    const entry = this.entries[id];
    if (!entry) return null;
    if (source === 'full_load' && entry.status === 'complete') return entry;
    if (source === 'brief_load' && entry.status === 'brief') return entry;
    return null;
  },

  register(id, source) {
    if (!this.entries[id]) {
      this.entries[id] = { status: 'unload', translated: '', repetition: 0 };
    }
  },

  update(id, status, translated, version) {
    if (!this.entries[id]) {
      this.entries[id] = { status, translated, repetition: 0 };
    } else {
      this.entries[id].status = status;
      this.entries[id].translated = translated;
    }
    if (version != null) {
      this.entries[id].version = version;
      this.cached_versions[id] = version;
    }
  },

  addRepetition(ids) {
    const counts = {};
    for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    for (const [id, count] of Object.entries(counts)) {
      if (!this.entries[id]) {
        this.entries[id] = { status: 'unload', translated: '', repetition: count };
      } else {
        this.entries[id].repetition += count;
      }
    }
  },

  getBriefIds() {
    return Object.entries(this.entries)
      .filter(([_, e]) => e.status === 'brief')
      .map(([id]) => id);
  }
};

// --------------------- 通用转译引擎 ---------------------

const UJSON_ID_LABELS = {
  node: '世界观', char: '角色', scene: '场景', item: '道具',
  history: '历史事件', geography: '地理', edge: '关系', evt: '事件'
};

function UJSON_extractIdPrefix(id) {
  if (!id) return '';
  if (id.startsWith('node_')) return 'node';
  if (id.startsWith('char_')) return 'char';
  if (id.startsWith('scene_')) return 'scene';
  if (id.startsWith('item_')) return 'item';
  if (id.startsWith('history_')) return 'history';
  if (id.startsWith('edge_')) return 'edge';
  if (id.startsWith('evt_')) return 'evt';
  return '';
}

function UJSON_formatRef(id, name) {
  const label = UJSON_ID_LABELS[UJSON_extractIdPrefix(id)] || '';
  const display = name || label || id;
  return display + '[' + id + ']';
}

function UJSON_parseGeneric(raw, opts) {
  const name = raw.name || raw.title || '';
  const id = raw.id || '';
  const type = opts.type || UJSON_extractIdPrefix(id);
  const collected_ids = [];
  const fields = [];

  const src = raw.default || raw;

  if (type === 'char') {
    if (src.persona) fields.push(['人设', src.persona]);
    if (src.mbti) fields.push(['MBTI', src.mbti]);
    if (src.value) fields.push(['价值观', src.value]);
    if (src.pursuit) fields.push(['追求', src.pursuit]);
    if (src.ability) fields.push(['能力', src.ability]);
    if (src.goal) fields.push(['目标', src.goal]);
    if (src.relationship?.length) {
      const lines = src.relationship.map(r => {
        if (r.subject) collected_ids.push(r.subject);
        if (r.object) collected_ids.push(r.object);
        const ref = '`' + r.subject + '` —[' + r.relation + ']-> `' + r.object + '`';
        return r.impression ? ref + '：' + r.impression : ref;
      });
      fields.push(['关系', lines]);
    }
    if (src.memory) {
      const memLabels = { vital: '关键记忆', longTerm: '长期记忆', daily: '日常记忆' };
      for (const [k, label] of Object.entries(memLabels)) {
        if (src.memory[k]?.length) fields.push([label, src.memory[k]]);
      }
    }
    if (src.inventory?.length) {
      src.inventory.forEach(id => collected_ids.push(id));
      fields.push(['持有道具', src.inventory.map(id => '`' + id + '`').join(', ')]);
    }
    if (src.cognition) {
      const cog = src.cognition;
      if (cog.worldview_blacklist?.length) {
        cog.worldview_blacklist.forEach(id => collected_ids.push(id));
        fields.push(['已知世界观', cog.worldview_blacklist.map(id => '`' + id + '`').join(', ')]);
      }
      if (cog.events?.length) {
        cog.events.forEach(id => collected_ids.push(id));
        fields.push(['已知事件', cog.events.map(id => '`' + id + '`').join(', ')]);
      }
      if (cog.items?.length) {
        cog.items.forEach(id => collected_ids.push(id));
        fields.push(['已知道具', cog.items.map(id => '`' + id + '`').join(', ')]);
      }
      if (cog.characters && Object.keys(cog.characters).length) {
        Object.keys(cog.characters).forEach(id => collected_ids.push(id));
        const lines = Object.entries(cog.characters).map(([cid, imp]) => '`' + cid + '`: ' + imp);
        fields.push(['对其他角色的认知', lines]);
      }
    }
  }
  else if (type === 'scene') {
    if (src.position?.length) {
      src.position.forEach(pid => collected_ids.push(pid));
      fields.push(['位置', src.position.map(pid => '`' + pid + '`').join(', ')]);
    }
    const ct = src.content || {};
    if (ct.description) fields.push(['描述', ct.description]);
    if (ct.detail) fields.push(['细节', ct.detail]);
    if (src.items?.length) {
      src.items.forEach(iid => collected_ids.push(iid));
      fields.push(['场景内道具', src.items.map(iid => '`' + iid + '`').join(', ')]);
    }
  }
  else if (type === 'item') {
    if (raw.tags?.length) fields.push(['标签', raw.tags.join(', ')]);
    const ct = src.content || {};
    if (ct.description) fields.push(['描述', ct.description]);
    if (ct.detail) fields.push(['细节', ct.detail]);
    if (src.ability) fields.push(['能力', src.ability]);
  }
  else if (type === 'node') {
    if (raw.priority != null) fields.push(['优先级', String(raw.priority)]);
    if (raw.tags?.length) fields.push(['标签', raw.tags.join(', ')]);
    const ct = src.content || raw.content || {};
    if (ct.description) fields.push(['描述', ct.description]);
    if (ct.detail) fields.push(['细节', ct.detail]);
  }
  else if (type === 'history') {
    if (raw.time) fields.push(['时间', raw.time]);
    const ct = src.content || raw.content || {};
    if (ct.description) fields.push(['描述', ct.description]);
    if (ct.detail) fields.push(['细节', ct.detail]);
    if (raw.connection?.length) {
      raw.connection.forEach(cid => collected_ids.push(cid));
      fields.push(['关联节点', raw.connection.map(cid => '`' + cid + '`').join(', ')]);
    }
  }
  else if (type === 'geography') {
    if (raw.layer != null) fields.push(['层级', String(raw.layer)]);
    const ct = src.content || raw.content || {};
    if (ct.description) fields.push(['描述', ct.description]);
    if (raw.neighbors?.length) {
      raw.neighbors.forEach(nid => collected_ids.push(nid));
      fields.push(['相邻区域', raw.neighbors.map(nid => '`' + nid + '`').join(', ')]);
    }
  }
  else if (type === 'evt') {
    if (raw.state?.time) fields.push(['时间', raw.state.time]);
    if (raw.state?.scene?.length) {
      raw.state.scene.forEach(sid => collected_ids.push(sid));
      fields.push(['场景', raw.state.scene.map(sid => '`' + sid + '`').join(', ')]);
    }
    if (raw.char?.length) {
      raw.char.forEach(cid => collected_ids.push(cid));
      fields.push(['参与角色', raw.char.map(cid => '`' + cid + '`').join(', ')]);
    }
    if (raw.content) fields.push(['内容', raw.content]);
    if (raw.intent && Object.keys(raw.intent).length) {
      Object.keys(raw.intent).forEach(cid => collected_ids.push(cid));
      const lines = Object.entries(raw.intent).map(([cid, intent]) => '`' + cid + '`: ' + intent);
      fields.push(['意图', lines]);
    }
  }
  else if (type === 'edge') {
    if (raw.subject) collected_ids.push(raw.subject);
    if (raw.object) collected_ids.push(raw.object);
  }
  else {
    const ct = src.content || raw.content || {};
    if (ct.description) fields.push(['描述', ct.description]);
    if (ct.detail) fields.push(['细节', ct.detail]);
  }

  if (raw.latestVersion) {
    fields.push(['当前版本', 'v' + raw.latestVersion]);
  }
  if (raw.events?.length) {
    raw.events.forEach(eid => collected_ids.push(eid));
    fields.push(['关联事件', raw.events.map(eid => '`' + eid + '`').join(', ')]);
  }
  if (raw.state != null && raw.state !== '') {
    fields.push(['当前状态', raw.state || '（无）']);
  }
  if (src.ownerId) {
    collected_ids.push(src.ownerId);
    fields.push(['当前持有者', '`' + src.ownerId + '`']);
  }

  const typeLabels = {
    char: '角色', scene: '场景', item: '道具', node: '世界观',
    history: '历史事件', geography: '地理', evt: '事件', edge: '关系'
  };
  const typeLabel = typeLabels[type] || type;
  const header = '## ' + typeLabel + '：' + (name || id) + ' (`' + id + '`)';
  const body = fields.map(f => {
    if (Array.isArray(f[1])) {
      return '- **' + f[0] + ':**\n' + f[1].map(item => '  - ' + item).join('\n');
    }
    return '- **' + f[0] + ':** ' + f[1];
  }).join('\n');

  return { markdown: header + '\n' + body, collected_ids };
}

function UJSON_translateTick(raw) {
  const fields = [];
  if (raw.routingLayout?.narrativeIntent) fields.push(['叙事意图', raw.routingLayout.narrativeIntent]);
  if (raw.reviewStatus) fields.push(['审核状态', raw.reviewStatus]);
  if (raw.routingLayout?.scenes) {
    const lines = Object.entries(raw.routingLayout.scenes).map(([sid, cfg]) => '`' + sid + '`: ' + (cfg.load || ''));
    fields.push(['场景分配', lines]);
  }
  if (raw.routingLayout?.characters) {
    const lines = Object.entries(raw.routingLayout.characters).map(([cid, cfg]) => {
      let s = '`' + cid + '`: ' + (cfg.load || '');
      if (cfg.currentScene) s += ', 当前场景 `' + cfg.currentScene + '`';
      return s;
    });
    fields.push(['角色分配', lines]);
  }
  const header = '## Tick #' + (raw.tickIndex ?? '?');
  const body = fields.map(f => {
    if (Array.isArray(f[1])) return '- **' + f[0] + ':**\n' + f[1].map(item => '  - ' + item).join('\n');
    return '- **' + f[0] + ':** ' + f[1];
  }).join('\n');
  return { markdown: header + '\n' + body, collected_ids: [] };
}

function UJSON_translateDeduction(raw) {
  const collected_ids = [];
  const sections = [];
  const header = '## Deduction #' + (raw.deductionIndex ?? '?') + ' (scope: `' + (raw.scope || '') + '`)';
  if (raw.mtipSnapshots) {
    for (const [cid, mtip] of Object.entries(raw.mtipSnapshots)) {
      collected_ids.push(cid);
      const fields = [];
      if (mtip.mindset) fields.push(['心态', mtip.mindset]);
      if (mtip.intent) fields.push(['意图', mtip.intent]);
      if (mtip.plan) fields.push(['计划', mtip.plan]);
      if (mtip.thought) fields.push(['想法', mtip.thought]);
      if (mtip.clarification) fields.push(['澄清', mtip.clarification]);
      const sub = '### MTIP: `' + cid + '`\n' + fields.map(f => '- **' + f[0] + ':** ' + f[1]).join('\n');
      sections.push(sub);
    }
  }
  return { markdown: header + '\n' + sections.join('\n'), collected_ids };
}

function UJSON_translateInstance(raw, name, id, entityType) {
  const collected_ids = [];
  const typeLabels = { character: '角色实例', scene: '场景实例', item: '道具实例' };
  const typeLabel = typeLabels[entityType] || entityType;
  const ver = raw.latestVersion || (raw.versions?.length || 1);
  const header = '## ' + typeLabel + '：' + (name || id) + ' (`' + id + '`) [当前版本: v' + ver + ']';

  if (raw.events?.length) {
    raw.events.forEach(eid => collected_ids.push(eid));
  }

  const versionSections = [];
  const versions = raw.versions || [];
  versions.forEach((v, i) => {
    const isLatest = (i === versions.length - 1);
    const isInitial = (i === 0);
    const label = '版本 v' + v.ver + (isLatest ? '（最新）' : isInitial && versions.length > 1 ? '（初始）' : '');
    const result = UJSON_parseGeneric({ ...raw, name, id, default: v }, { type: entityType === 'character' ? 'char' : entityType });
    collected_ids.push(...result.collected_ids);
    versionSections.push('### ' + label + '\n' + result.markdown.split('\n').slice(1).join('\n'));
  });

  let extra = '';
  if (raw.events?.length) {
    extra = '- **关联事件:** ' + raw.events.map(eid => '`' + eid + '`').join(', ') + '\n';
  }

  return { markdown: header + '\n' + extra + versionSections.join('\n'), collected_ids };
}

// --------------------- 主入口 ---------------------

function UnderstandingJSON(params) {
  const { type, source, content, translate_json = true } = params;

  if (!translate_json || !content) return { markdown: '', collected_ids: [] };

  const id = content.id || '';
  const version = content.latestVersion || content.version || 0;

  if (source !== 'tool_call') {
    const hit = UJSON_cache.match(id, version, source);
    if (hit) return { markdown: hit.translated, collected_ids: [], skipped: true };
  }

  UJSON_cache.register(id, source);

  let result;
  const effectiveType = type || UJSON_extractIdPrefix(id);

  if (effectiveType === 'tick') {
    result = UJSON_translateTick(content);
  } else if (effectiveType === 'deduction') {
    result = UJSON_translateDeduction(content);
  } else if (effectiveType === 'character' && content.versions) {
    result = UJSON_translateInstance(content, content.name, id, 'character');
  } else if (effectiveType === 'scene' && content.versions) {
    result = UJSON_translateInstance(content, content.name, id, 'scene');
  } else if (effectiveType === 'item' && content.versions) {
    result = UJSON_translateInstance(content, content.name, id, 'item');
  } else {
    result = UJSON_parseGeneric(content, { type: effectiveType });
  }

  const status = source === 'brief_load' ? 'brief' : 'complete';
  UJSON_cache.update(id, status, result.markdown, version);
  UJSON_cache.addRepetition(result.collected_ids);

  return result;
}

// --------------------- ExpandNodes ---------------------

function ExpandNodes(UJSON_outputs, settingLookup) {
  let allCollected = [];
  for (const out of UJSON_outputs) {
    if (out.collected_ids) allCollected.push(...out.collected_ids);
  }
  UJSON_cache.addRepetition(allCollected);

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    const candidates = Object.entries(UJSON_cache.entries)
      .filter(([_, e]) => e.status === 'brief' && e.repetition > 3);

    for (const [cid, entry] of candidates) {
      if (!settingLookup) { entry.status = 'complete'; changed = true; continue; }
      const fullData = settingLookup(cid);
      if (fullData) {
        const type = UJSON_extractIdPrefix(cid);
        const out = UnderstandingJSON({ type, source: 'full_load', content: fullData });
        entry.status = 'complete';
        entry.translated = out.markdown;
        if (out.collected_ids?.length) UJSON_cache.addRepetition(out.collected_ids);
        changed = true;
      } else {
        entry.status = 'complete';
        changed = true;
      }
    }
  }

  const brief_ids = UJSON_cache.getBriefIds();

  const results = UJSON_outputs.map(out => {
    let md = out.markdown;
    for (const id of (out.collected_ids || [])) {
      if (brief_ids.includes(id)) {
        const entry = UJSON_cache.entries[id];
        const descMatch = entry?.translated?.match(/- \*\*描述:\*\*\s*(.+)/);
        const desc = descMatch ? descMatch[1] : '';
        if (desc) {
          md = md.split('[' + id + ']').join('[' + id + ', ' + desc + ']');
        }
      }
    }
    return md;
  });

  return results.join('\n\n');
}

// --------------------- executeTool wrapper ---------------------

function createWrappedExecuteTool(executeTool) {
  return async function(toolName, args) {
    const result = await executeTool(toolName, args);

    if (!result.success || !result.data) return result;

    let settingLookup = null;
    if (args.lore_path) {
      let setting = await DB.loresets.getById(args.lore_path);
      if (!setting) {
        const story = await DB.stories.getById(args.lore_path);
        if (story?.associatedLoreSetId) setting = await DB.loresets.getById(story.associatedLoreSetId);
      }
      if (setting) {
        settingLookup = (id) => {
          const wn = setting.worldview?.nodes?.find(n => n.id === id);
          if (wn) return wn;
          const hi = setting.worldview?.history?.find(h => h.id === id);
          if (hi) return hi;
          const ge = setting.worldview?.geography?.find(g => g.id === id);
          if (ge) return ge;
          if (setting.scenes?.[id]) return setting.scenes[id];
          if (setting.characters?.[id]) return setting.characters[id];
          if (setting.items?.[id]) return setting.items[id];
          return null;
        };
      }
    }

    if (toolName === 'read_settings' && Array.isArray(result.data)) {
      const outputs = [];
      for (const entry of result.data) {
        if (entry.data) {
          const typeMap = { worldview: 'node', scene: 'scene', character: 'char', item: 'item', history: 'history', geography: 'geography' };
          const out = UnderstandingJSON({
            type: typeMap[entry.type] || entry.type,
            source: 'tool_call',
            content: entry.data
          });
          outputs.push(out);
        }
      }
      if (outputs.length) result._ujson_markdown = ExpandNodes(outputs, settingLookup);
    }

    if (toolName === 'list_settings' && typeof result.data === 'object') {
      for (const [cat, items] of Object.entries(result.data)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            UJSON_cache.register(item.id, 'tool_call');
          }
        }
      }
    }

    if (toolName === 'read_history' && Array.isArray(result.data)) {
      const outputs = [];
      for (const evt of result.data) {
        const out = UnderstandingJSON({ type: 'evt', source: 'tool_call', content: evt });
        outputs.push(out);
      }
      if (outputs.length) result._ujson_markdown = ExpandNodes(outputs, settingLookup);
    }

    return result;
  };
}

export {
  UJSON_cache,
  UJSON_ID_LABELS,
  UJSON_extractIdPrefix,
  UJSON_formatRef,
  UJSON_parseGeneric,
  UJSON_translateTick,
  UJSON_translateDeduction,
  UJSON_translateInstance,
  UnderstandingJSON,
  ExpandNodes,
  createWrappedExecuteTool
};
