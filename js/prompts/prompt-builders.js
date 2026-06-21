import { DB } from '../core/db.js';
import { UnderstandingJSON } from '../engine/ujson.js';
import { USER_CONFIGURABLE_PROMPTS, refreshUserConfigurablePrompts } from './tool-descriptions.js';
import { LORESET_SYSTEM_PROMPT, PLANNER_SYSTEM_PROMPT, MTIP_GENERATOR_SYSTEM_PROMPT, INTERPRETER_SYSTEM_PROMPT, INTERPRET_FIX_SYSTEM_PROMPT, WRITER_SYSTEM_PROMPT, REVIEWER_SYSTEM_PROMPT } from './system-prompts.js';
import { getCurrentSetting, parseMTIP } from '../engine/pipeline-helpers.js';

// --------------------- 提示词构建器 ---------------------

export async function buildPlannerPrompt(story, userMessage) {
  const setting = await getCurrentSetting(story);
  if (!setting) return null;

  // 刷新用户配置
  refreshUserConfigurablePrompts();

  const sections = [];

  // 添加通用系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.system_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.system_prefix);
  }

  // 添加Planner系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.planner_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.planner_prefix);
  }

  // 添加固定的系统提示词
  sections.push(PLANNER_SYSTEM_PROMPT);

  // 1. 激活的世界观设定
  const worldviewMd = (setting.worldview?.nodes || []).map(n =>
    UnderstandingJSON({ type: 'node', source: 'full_load', content: n }).markdown
  ).join('\n\n');
  if (worldviewMd) sections.push('# 世界观设定\n\n' + worldviewMd);

  // 2. 历史事件四元组
  const eventsMd = (story.eventQuadruples || []).map(e =>
    UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
  ).join('\n\n');
  if (eventsMd) sections.push('# 历史事件\n\n' + eventsMd);

  // 3. 场景设定
  const scenesMd = Object.values(setting.scenes || {}).map(s =>
    UnderstandingJSON({ type: 'scene', source: 'full_load', content: s }).markdown
  ).join('\n\n');
  if (scenesMd) sections.push('# 场景设定\n\n' + scenesMd);

  // 4. 道具设定
  const itemsMd = Object.values(setting.items || {}).map(i =>
    UnderstandingJSON({ type: 'item', source: 'full_load', content: i }).markdown
  ).join('\n\n');
  if (itemsMd) sections.push('# 道具设定\n\n' + itemsMd);

  // 5. 角色设定
  const charsMd = Object.values(setting.characters || {}).map(c =>
    UnderstandingJSON({ type: 'char', source: 'full_load', content: c }).markdown
  ).join('\n\n');
  if (charsMd) sections.push('# 角色设定\n\n' + charsMd);

  // 6. 增量内容（最近几轮的事件）
  const recentEvents = (story.eventQuadruples || []).slice(-10);
  if (recentEvents.length > 0) {
    const incrMd = recentEvents.map(e =>
      UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
    ).join('\n\n');
    sections.push('# 最近事件\n\n' + incrMd);
  }

  // 添加Planner系统提示词后缀
  if (USER_CONFIGURABLE_PROMPTS.planner_suffix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.planner_suffix);
  }

  return [
    { role: 'system', content: sections.join('\n\n') },
    { role: 'user', content: userMessage }
  ];
}

export async function buildMTIPGeneratorPrompt(story, charId, routingLayout) {
  const setting = await getCurrentSetting(story);
  if (!setting) return null;

  const charTemplate = setting.characters?.[charId];
  const charInstance = story.instances?.characters?.[charId];
  const charData = charInstance?.versions?.[charInstance.versions.length - 1] || charTemplate?.default || {};
  const charName = charTemplate?.name || charId;

  const sections = [];

  // 添加通用系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.system_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.system_prefix);
  }

  // 添加MTIP系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.mtip_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.mtip_prefix);
  }

  // 添加固定的系统提示词
  sections.push(MTIP_GENERATOR_SYSTEM_PROMPT);

  // 角色设定（最新版本实例）
  const charMd = UnderstandingJSON({
    type: 'char', source: 'full_load',
    content: { id: charId, name: charName, default: charData }
  }).markdown;
  sections.push('# 你的角色设定\n\n' + charMd);

  // 角色经历的事件
  const charEvents = (charInstance?.events || []).map(eid =>
    story.eventQuadruples?.find(e => e.id === eid)
  ).filter(Boolean);
  if (charEvents.length) {
    const evtsMd = charEvents.map(e =>
      UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
    ).join('\n\n');
    sections.push('# 你经历的事件\n\n' + evtsMd);
  }

  // 角色已知的设定（通过 cognition）
  const cog = charData.cognition || {};
  const knownItems = (cog.items || []).map(iid => setting.items?.[iid]).filter(Boolean);
  const knownChars = cog.characters || {};
  if (knownItems.length || Object.keys(knownChars).length) {
    let knownMd = '# 你已知的设定\n\n';
    for (const item of knownItems) {
      knownMd += UnderstandingJSON({ type: 'item', source: 'brief_load', content: item }).markdown + '\n\n';
    }
    for (const [cid, impression] of Object.entries(knownChars)) {
      const c = setting.characters?.[cid];
      if (c) knownMd += `- **${c.name}** [${cid}]: ${impression}\n`;
    }
    sections.push(knownMd);
  }

  // Planner 指令
  const charConfig = routingLayout?.characters?.[charId];
  if (charConfig?.instruction) {
    sections.push('# Planner 指令\n\n' + charConfig.instruction);
  }
  if (routingLayout?.mtipInstructions) {
    sections.push('# 全局指令\n\n' + routingLayout.mtipInstructions);
  }

  // 添加MTIP系统提示词后缀
  if (USER_CONFIGURABLE_PROMPTS.mtip_suffix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.mtip_suffix);
  }

  return [
    { role: 'system', content: sections.join('\n\n') },
    { role: 'user', content: '请以角色「' + charName + '」的身份，生成当前情境下的 MTIP-C。' }
  ];
}

export async function buildInterpreterPrompt(story, sceneId, mtips, routingLayout) {
  const setting = await getCurrentSetting(story);
  if (!setting) return null;

  const sceneData = setting.scenes?.[sceneId];
  if (!sceneData) return null;

  const sections = [];

  // 添加通用系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.system_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.system_prefix);
  }

  // 添加Interpreter系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.interpreter_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.interpreter_prefix);
  }

  // 添加固定的系统提示词
  sections.push(INTERPRETER_SYSTEM_PROMPT);

  // 场景设定
  sections.push('# 当前场景\n\n' + UnderstandingJSON({
    type: 'scene', source: 'full_load', content: sceneData
  }).markdown);

  // 场景内的角色 MTIP
  let mtipsMd = '# 场景内角色的 MTIP-C\n\n';
  for (const [charId, mtip] of Object.entries(mtips)) {
    const charName = setting.characters?.[charId]?.name || charId;
    mtipsMd += `## ${charName} [${charId}]\n\n${parseMTIP(mtip)}\n\n`;
  }
  sections.push(mtipsMd);

  // 场景内的道具
  const sceneItems = (sceneData.default?.items || []).map(iid => setting.items?.[iid]).filter(Boolean);
  if (sceneItems.length) {
    const itemsMd = sceneItems.map(i =>
      UnderstandingJSON({ type: 'item', source: 'brief_load', content: i }).markdown
    ).join('\n\n');
    sections.push('# 场景内道具\n\n' + itemsMd);
  }

  // Planner 指令
  if (routingLayout?.interpreterInstructions) {
    sections.push('# Planner 指令\n\n' + routingLayout.interpreterInstructions);
  }

  // 添加Interpreter系统提示词后缀
  if (USER_CONFIGURABLE_PROMPTS.interpreter_suffix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.interpreter_suffix);
  }

  return [
    { role: 'system', content: sections.join('\n\n') },
    { role: 'user', content: '请将以上角色的 MTIP-C 转化为事件四元组。输出 JSON 数组格式。' }
  ];
}

export async function buildInterpretFixPrompt(story, interpreterOutputs, routingLayout) {
  const setting = await getCurrentSetting(story);
  if (!setting) return null;

  const sections = [];

  // 添加通用系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.system_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.system_prefix);
  }

  // 添加固定的系统提示词
  sections.push(INTERPRET_FIX_SYSTEM_PROMPT);

  // 所有 Interpreter 输出
  let outputsMd = '# 各场景 Interpreter 输出\n\n';
  for (const [sceneId, events] of Object.entries(interpreterOutputs)) {
    const sceneName = setting.scenes?.[sceneId]?.name || sceneId;
    outputsMd += `## 场景：${sceneName} [${sceneId}]\n\n`;
    outputsMd += '```json\n' + JSON.stringify(events, null, 2) + '\n```\n\n';
  }
  sections.push(outputsMd);

  // 历史事件（供参考时间线）
  const recentEvents = (story.eventQuadruples || []).slice(-5);
  if (recentEvents.length) {
    const evtsMd = recentEvents.map(e =>
      UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
    ).join('\n\n');
    sections.push('# 最近历史事件（参考时间线）\n\n' + evtsMd);
  }

  // Planner 指令
  if (routingLayout?.interpretFixInstructions) {
    sections.push('# Planner 指令\n\n' + routingLayout.interpretFixInstructions);
  }

  return [
    { role: 'system', content: sections.join('\n\n') },
    { role: 'user', content: '请检查所有事件四元组的冲突并修正。输出修正后的 JSON 数组。' }
  ];
}

export async function buildWriterPrompt(story, events, routingLayout) {
  const setting = await getCurrentSetting(story);
  if (!setting) return null;

  const sections = [];

  // 添加通用系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.system_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.system_prefix);
  }

  // 添加Writer系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.writer_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.writer_prefix);
  }

  // 添加固定的系统提示词
  sections.push(WRITER_SYSTEM_PROMPT);

  // 事件四元组
  const eventsMd = events.map(e =>
    UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
  ).join('\n\n');
  sections.push('# 本轮事件四元组\n\n' + eventsMd);

  // 相关角色设定
  const charIds = new Set();
  events.forEach(e => (e.char || []).forEach(cid => charIds.add(cid)));
  for (const cid of charIds) {
    const c = setting.characters?.[cid];
    if (c) {
      sections.push(`# 角色：${c.name}\n\n` + UnderstandingJSON({
        type: 'char', source: 'brief_load', content: c
      }).markdown);
    }
  }

  // 之前的小说内容（最近 2 章）
  const chapters = story.chapters || [];
  const recentChapters = chapters.slice(-2);
  if (recentChapters.length) {
    let prevMd = '# 之前的小说内容\n\n';
    for (const ch of recentChapters) {
      prevMd += `## 第${ch.chapterIndex}章：${ch.title}\n\n${ch.content}\n\n`;
    }
    sections.push(prevMd);
  }

  // Planner 写作指令
  if (routingLayout?.writerInstruction) {
    sections.push('# 写作指令\n\n' + routingLayout.writerInstruction);
  }

  // 添加Writer系统提示词后缀
  if (USER_CONFIGURABLE_PROMPTS.writer_suffix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.writer_suffix);
  }

  return [
    { role: 'system', content: sections.join('\n\n') },
    { role: 'user', content: '请根据以上事件四元组，撰写本轮的小说正文。' }
  ];
}

export async function buildReviewerPrompt(story, events, novel, mtips, routingLayout) {
  const setting = await getCurrentSetting(story);
  if (!setting) return null;

  const sections = [];

  // 添加通用系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.system_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.system_prefix);
  }

  // 添加Reviewer系统提示词前缀
  if (USER_CONFIGURABLE_PROMPTS.reviewer_prefix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.reviewer_prefix);
  }

  // 添加固定的系统提示词
  sections.push(REVIEWER_SYSTEM_PROMPT);

  // 事件四元组
  const eventsMd = events.map(e =>
    UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
  ).join('\n\n');
  sections.push('# 本轮事件四元组\n\n' + eventsMd);

  // 小说内容
  sections.push('# 本轮小说内容\n\n' + novel);

  // MTIP
  let mtipsMd = '# 角色 MTIP-C\n\n';
  for (const [charId, mtip] of Object.entries(mtips)) {
    const charName = setting.characters?.[charId]?.name || charId;
    mtipsMd += `## ${charName} [${charId}]\n\n${parseMTIP(mtip)}\n\n`;
  }
  sections.push(mtipsMd);

  // 当前实例状态
  let instancesMd = '# 当前实例状态\n\n';
  for (const [cid, inst] of Object.entries(story.instances?.characters || {})) {
    const latest = inst.versions?.[inst.versions.length - 1];
    if (latest) {
      instancesMd += `## ${setting.characters?.[cid]?.name || cid} [v${latest.ver}]\n`;
      instancesMd += `- 状态: ${latest.state || '正常'}\n`;
      instancesMd += `- 目标: ${latest.goal || '无'}\n\n`;
    }
  }
  sections.push(instancesMd);

  // Planner 指令
  if (routingLayout?.reviewerInstructions) {
    sections.push('# Planner 指令\n\n' + routingLayout.reviewerInstructions);
  }

  // 添加Reviewer系统提示词后缀
  if (USER_CONFIGURABLE_PROMPTS.reviewer_suffix) {
    sections.push(USER_CONFIGURABLE_PROMPTS.reviewer_suffix);
  }

  return [
    { role: 'system', content: sections.join('\n\n') },
    { role: 'user', content: '请审查本轮推演结果，输出即兴事件和实例变更。' }
  ];
}


