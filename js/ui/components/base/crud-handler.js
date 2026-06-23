export class CrudHandler {
  constructor(entityType, collectionPath) {
    this.entityType = entityType;
    this.collectionPath = collectionPath;
  }

  getCollection(setting) {
    const parts = this.collectionPath.split('.');
    let obj = setting;
    for (const part of parts) {
      if (obj === undefined) return undefined;
      obj = obj[part];
    }
    return obj;
  }

  add(setting, args, genId) {
    const id = args.id || genId(this.entityType, args.name);
    const entity = this.createEntity(id, args);
    const collection = this.getCollection(setting);
    if (Array.isArray(collection)) {
      collection.push(entity);
    } else if (typeof collection === 'object') {
      collection[id] = entity;
    }
    return entity;
  }

  edit(setting, args) {
    const entity = this.find(setting, args);
    if (!entity) return { error: `${this.entityType}不存在: ${this.getEntityId(args)}` };
    this.applyChanges(entity, args);
    return entity;
  }

  remove(setting, args) {
    const collection = this.getCollection(setting);
    const id = this.getEntityId(args);
    if (Array.isArray(collection)) {
      const idx = collection.findIndex(e => e.id === id);
      if (idx === -1) return { error: `${this.entityType}不存在: ${id}` };
      const deleted = collection.splice(idx, 1)[0];
      this.cascadeDelete(setting, id);
      return deleted;
    } else if (typeof collection === 'object') {
      if (!collection[id]) return { error: `${this.entityType}不存在: ${id}` };
      const deleted = collection[id];
      delete collection[id];
      this.cascadeDelete(setting, id);
      return deleted;
    }
    return { error: `${this.entityType}不存在: ${id}` };
  }

  createEntity(id, args) { return { id }; }
  applyChanges(entity, args) {}
  getEntityId(args) { return args.id; }
  cascadeDelete(setting, entityId) {}

  find(setting, args) {
    const collection = this.getCollection(setting);
    const id = this.getEntityId(args);
    if (Array.isArray(collection)) return collection.find(e => e.id === id);
    if (typeof collection === 'object') return collection[id];
    return null;
  }
}

export class WorldviewCrud extends CrudHandler {
  constructor() { super('node', 'worldview.nodes'); }
  createEntity(id, args) {
    return { id, priority: args.priority || 99, name: args.name, tags: args.tags, content: { description: args.content?.description || '', detail: args.content?.detail || '' } };
  }
  applyChanges(entity, args) {
    if (args.name) entity.name = args.name;
    if (args.priority !== undefined) entity.priority = args.priority;
    if (args.tags) entity.tags = args.tags;
    if (args.content?.description) entity.content.description = args.content.description;
    if (args.content?.detail) entity.content.detail = args.content.detail;
  }
  cascadeDelete(setting, entityId) {
    setting.worldview.edges = setting.worldview.edges.filter(e => e.subject !== entityId && e.object !== entityId);
  }
  getEntityId(args) { return args.node_id; }
}

export class EdgeCrud extends CrudHandler {
  constructor() { super('edge', 'worldview.edges'); }
  add(setting, args, genId) {
    const id = args.id || genId('edge', args.subject + '_' + args.object);
    const entity = this.createEntity(id, args);
    const collection = this.getCollection(setting);
    if (Array.isArray(collection)) collection.push(entity);
    else if (typeof collection === 'object') collection[id] = entity;
    return entity;
  }
  createEntity(id, args) {
    return { id, subject: args.subject, relation: args.relation, object: args.object };
  }
  applyChanges(entity, args) {
    if (args.relation) entity.relation = args.relation;
  }
  getEntityId(args) { return args.edge_id; }
}

export class SceneCrud extends CrudHandler {
  constructor() { super('scene', 'scenes'); }
  createEntity(id, args) {
    return { id, name: args.name, default: { position: args.position || [], content: { description: args.content?.description || '', detail: args.content?.detail || '' }, items: args.items || [] } };
  }
  applyChanges(entity, args) {
    if (args.name) entity.name = args.name;
    if (args.position) entity.default.position = args.position;
    if (args.content?.description) entity.default.content.description = args.content.description;
    if (args.content?.detail) entity.default.content.detail = args.content.detail;
    if (args.items) entity.default.items = args.items;
  }
  getEntityId(args) { return args.scene_id; }
}

export class CharacterCrud extends CrudHandler {
  constructor() { super('char', 'characters'); }
  createEntity(id, args) {
    return {
      id, name: args.name,
      default: {
        persona: args.persona || '', mbti: args.mbti || '', value: args.value || '', pursuit: args.pursuit || '', ability: args.ability || '',
        relationship: args.relationship || [], goal: args.goal || '',
        memory: { vital: args.memory?.vital || [], longTerm: args.memory?.longTerm || [], daily: args.memory?.daily || [] },
        inventory: args.inventory || [],
        cognition: { worldview_blacklist: args.cognition?.worldview_blacklist || [], events: args.cognition?.events || [], items: args.cognition?.items || [], characters: args.cognition?.characters || {} }
      }
    };
  }
  applyChanges(entity, args) {
    if (args.name) entity.name = args.name;
    if (args.persona) entity.default.persona = args.persona;
    if (args.mbti) entity.default.mbti = args.mbti;
    if (args.value) entity.default.value = args.value;
    if (args.pursuit) entity.default.pursuit = args.pursuit;
    if (args.ability) entity.default.ability = args.ability;
    if (args.goal) entity.default.goal = args.goal;
    if (args.relationship) entity.default.relationship = args.relationship;
    if (args.cognition) {
      if (!entity.default.cognition) entity.default.cognition = {};
      if (args.cognition.worldview_blacklist) entity.default.cognition.worldview_blacklist = args.cognition.worldview_blacklist;
      if (args.cognition.events) entity.default.cognition.events = args.cognition.events;
      if (args.cognition.items) entity.default.cognition.items = args.cognition.items;
      if (args.cognition.characters) entity.default.cognition.characters = { ...entity.default.cognition.characters, ...args.cognition.characters };
    }
    if (args.memory) {
      if (!entity.default.memory) entity.default.memory = { vital: [], longTerm: [], daily: [] };
      if (args.memory.vital) entity.default.memory.vital = args.memory.vital;
      if (args.memory.longTerm) entity.default.memory.longTerm = args.memory.longTerm;
      if (args.memory.daily) entity.default.memory.daily = args.memory.daily;
    }
    if (args.inventory) entity.default.inventory = args.inventory;
  }
  getEntityId(args) { return args.char_id; }
}

export class ItemCrud extends CrudHandler {
  constructor() { super('item', 'items'); }
  createEntity(id, args) {
    return { id, name: args.name, tags: args.tags || ['自定义'], default: { content: { description: args.content?.description || '', detail: args.content?.detail || '' }, ability: args.ability || '' } };
  }
  applyChanges(entity, args) {
    if (args.name) entity.name = args.name;
    if (args.tags) entity.tags = args.tags;
    if (args.content?.description) entity.default.content.description = args.content.description;
    if (args.content?.detail) entity.default.content.detail = args.content.detail;
    if (args.ability) entity.default.ability = args.ability;
  }
  getEntityId(args) { return args.item_id; }
}

export class HistoryCrud extends CrudHandler {
  constructor() { super('history', 'worldview.history'); }
  createEntity(id, args) {
    return { id, time: args.time, content: { description: args.content?.description || '', detail: args.content?.detail || '' }, connection: args.connection || [] };
  }
  applyChanges(entity, args) {
    if (args.time) entity.time = args.time;
    if (args.content?.description) entity.content.description = args.content.description;
    if (args.content?.detail) entity.content.detail = args.content.detail;
    if (args.connection) entity.connection = args.connection;
  }
  getEntityId(args) { return args.history_id; }
}

export class GeographyCrud extends CrudHandler {
  constructor() { super('geography', 'worldview.geography'); }
  add(setting, args, genId) {
    const id = args.id || genId('node', args.name);
    const entity = this.createEntity(id, args);
    const collection = this.getCollection(setting);
    if (Array.isArray(collection)) collection.push(entity);
    else if (typeof collection === 'object') collection[id] = entity;
    return entity;
  }
  createEntity(id, args) {
    return { id, name: args.name, content: { description: args.content?.description || '' }, neighbors: args.neighbors || [], layer: args.layer || 1, father: args.father || null };
  }
  applyChanges(entity, args) {
    if (args.name) entity.name = args.name;
    if (args.content?.description) entity.content.description = args.content.description;
    if (args.neighbors) entity.neighbors = args.neighbors;
    if (args.layer !== undefined) entity.layer = args.layer;
    if (args.father) entity.father = args.father;
  }
  getEntityId(args) { return args.geo_id; }
}
