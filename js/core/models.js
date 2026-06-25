import { DB } from './db.js';

export function createLoreSet(name) {
  return { id: DB.genId('loreset', name), name, worldview: { nodes: [], edges: [], history: [], geography: [] }, scenes: {}, characters: {}, items: {} };
}

export function createWorldviewNode(name, opts = {}) {
  return { id: DB.genId('node', name), priority: opts.priority || 99, name, tags: opts.tags || ['自定义'], content: { description: opts.description || '', detail: opts.detail || '' } };
}

export function createWorldviewEdge(subject, relation, object) {
  return { id: 'edge_' + subject + '_' + object, subject, relation, object };
}

export function createHistoryEvent(name, time, description, detail, connections) {
  return { id: DB.genId('node', name), type: 'history', time, content: { description, detail }, connection: connections || [] };
}

export function createGeographyNode(name, description, opts = {}) {
  return { id: DB.genId('node', name), type: 'geography', content: { description }, neighbors: opts.neighbors || [], layer: opts.layer || 1, father: opts.father || null };
}

export function createSceneTemplate(name, position, description, detail, items) {
  return { id: DB.genId('scene', name), name, default: { position: Array.isArray(position) ? position : [position], content: { description, detail }, items: items || [] } };
}

export function createCharacterTemplate(name, opts = {}) {
  return {
    id: DB.genId('char', name), name,
    default: {
      persona: opts.persona || '', mbti: opts.mbti || '', value: opts.value || '', pursuit: opts.pursuit || '', ability: opts.ability || '',
      relationship: opts.relationship || [],
      goal: opts.goal || '',
      memory: { vital: opts.memory?.vital || [], longTerm: opts.memory?.longTerm || [], daily: opts.memory?.daily || [] },
      inventory: opts.inventory || [],
      cognition: {
        worldview_blacklist: opts.cognition?.worldview_blacklist || [],
        events: opts.cognition?.events || [],
        items: opts.cognition?.items || [],
        characters: opts.cognition?.characters || {}
      }
    }
  };
}

export function createItemTemplate(name, tags, description, detail, ability) {
  return { id: DB.genId('item', name), name, tags: tags || ['自定义'], default: { content: { description, detail }, ability: ability || '' } };
}

export function createStory(title, loreSetId) {
  return { id: DB.genId('story', title), associatedLoreSetId: loreSetId || null, title, eventQuadruples: [], instances: { characters: {}, scenes: {}, items: {} }, ticks: [] };
}

export function createInstanceFromTemplate(template, type, ownerId) {
  if (type === 'character') {
    return {
      events: [],
      latestVersion: 1,
      versions: [{ ver: 1, ...structuredClone(template.default), state: '' }]
    };
  }
  const ver = { ver: 1, state: '', ...structuredClone(template.default) };
  if (type === 'item' && ownerId) ver.ownerId = ownerId;
  return { latestVersion: 1, versions: [ver] };
}

export function addInstanceVersion(instance, changes) {
  const prevVer = instance.versions[instance.versions.length - 1];
  const newVer = { ...structuredClone(prevVer), ver: instance.latestVersion + 1, ...changes };
  instance.versions.push(newVer);
  instance.latestVersion = newVer.ver;
  return newVer;
}

export function createEventQuadruple(time, scene, content, char, intent) {
  const evt = { id: 'evt_' + Date.now().toString(36), state: { time, scene: Array.isArray(scene) ? scene : [scene] }, content };
  if (char && char.length > 0) evt.char = char;
  if (intent && Object.keys(intent).length > 0) evt.intent = intent;
  return evt;
}

export function createTick(tickIndex, routingLayout) {
  return {
    tickIndex,
    routingLayout: routingLayout || { scenes: {}, characters: {}, narrativeIntent: '', timeSections: [] },
    deductions: [],
    reviewerActions: { addedEvents: [], instanceMutations: [], reason: '' },
    reviewStatus: 'pending',
    humanFeedback: null
  };
}

export function createDeduction(deductionIndex, scope) {
  return { deductionIndex, scope, mtipSnapshots: {}, interpreterOutput: [], interpreterInstructions: [], fixedEvents: [] };
}

export function createChatSession(title, loreSetId, storyId, participants) {
  return { id: DB.genId('chat', title), title, associatedLoreSetId: loreSetId || null, associatedStoryId: storyId || null, participants: participants || [], messages: [] };
}

export function createChatMessage(role, content, opts = {}) {
  const msg = { role, content, timestamp: new Date().toISOString() };
  if (role === 'character') { msg.charId = opts.charId || ''; msg.toolCalls = opts.toolCalls || []; }
  if (role === 'tool') { msg.toolCallId = opts.toolCallId || ''; }
  return msg;
}

export async function seedDatabase() {
  const existing = await DB.loresets.getAll();
  if (existing.length > 0) { console.log('[WorldStory] 数据库已有数据，跳过初始化'); return; }
  console.log('[WorldStory] 首次运行，初始化种子数据...');

  const ls = createLoreSet('示例设定集');
  ls.worldview.nodes.push(
    createWorldviewNode('核心组织', { priority: 1, tags: ['组织/势力', '核心'], description: '掌控世界命脉的神秘组织。', detail: '内部等级森严，对外实行信息封锁。' }),
    createWorldviewNode('核心资源', { priority: 2, tags: ['资源/核心'], description: '维持世界运转的关键能源。', detail: '一旦枯竭，所有依赖它的系统将在48小时内瘫痪。' })
  );
  ls.worldview.edges.push(createWorldviewEdge('node_核心组织', '绝对控制', 'node_核心资源'));
  ls.worldview.history.push(createHistoryEvent('大动荡', '2040-00-00', '底层势力因不满资源分配发动暴动。', '此事件导致大量试验物资流落民间。', ['node_核心组织']));
  ls.worldview.geography.push(createGeographyNode('中心区域', '世界的核心地带，高楼林立。', { layer: 1, neighbors: ['node_外围废墟'] }));
  ls.scenes['scene_议事大厅'] = createSceneTemplate('议事大厅', ['node_中心区域'], '组织核心成员集会的大厅。', '大厅中央悬挂着巨大的全息投影屏，四周是环形座位。', ['item_数据终端']);
  ls.characters['char_主角'] = createCharacterTemplate('主角', {
    persona: '冷静果断，内心深处隐藏着不为人知的过去。',
    mbti: 'INTJ', value: '追求真相，不惜代价。', pursuit: '揭开组织的秘密。', ability: '高超的黑客技术与格斗能力。',
    relationship: [{ subject: 'char_主角', relation: '对立', object: 'char_反派', impression: '曾经的搭档，如今的死敌。' }],
    goal: '找到组织的核心数据库。', memory: { vital: ['亲眼目睹同伴被组织处决。'], longTerm: [], daily: [] }, inventory: ['item_数据终端'],
    cognition: { worldview_blacklist: [], events: [], items: [], characters: { 'char_反派': '曾经的搭档，如今的死敌。实力强大，不可小觑。' } }
  });
  ls.items['item_数据终端'] = createItemTemplate('数据终端', ['电子设备', '核心'], '便携式高性能数据终端。', '外壳有轻微磨损，屏幕显示正常。', '可入侵并解密大多数电子系统。');
  await DB.loresets.put(ls);

  const story = createStory('第一章：潜入', ls.id);
  const charInst = createInstanceFromTemplate(ls.characters['char_主角'], 'character');
  story.instances.characters['char_主角'] = charInst;
  const sceneInst = createInstanceFromTemplate(ls.scenes['scene_议事大厅'], 'scene');
  story.instances.scenes['scene_议事大厅'] = sceneInst;
  const itemInst = createInstanceFromTemplate(ls.items['item_数据终端'], 'item', 'char_主角');
  story.instances.items['item_数据终端'] = itemInst;
  const evt = createEventQuadruple('2026-01-01-00:00', ['scene_议事大厅'], '主角潜入议事大厅，成功获取了核心数据。', ['char_主角'], { 'char_主角': '获取组织的核心数据。' });
  story.eventQuadruples.push(evt);
  charInst.events.push(evt.id);
  const tick = createTick(1, { scenes: { 'scene_议事大厅': { load: 'STRONG' } }, characters: { 'char_主角': { load: 'STRONG', currentScene: 'scene_议事大厅', instruction: '' } }, narrativeIntent: '主角深夜潜入议事大厅。', timeSections: [] });
  const ded = createDeduction(1, 'scene_议事大厅');
  ded.mtipSnapshots['char_主角'] = { charId: 'char_主角', mindset: '高度警觉，冷静分析环境。', intent: '获取核心数据后迅速撤离。', plan: '利用黑客技术绕过安保系统。', thought: '时间不多了，必须在巡逻队到来前完成。', clarification: '如果被发现，启动备用逃脱路线。' };
  ded.interpreterOutput.push(evt);
  ded.fixedEvents.push(evt.id);
  tick.deductions.push(ded);
  story.ticks.push(tick);
  await DB.stories.put(story);
  console.log('[WorldStory] 种子数据初始化完成');
}
