import { callLLM } from '../core/api.js';
import { LORESET_TOOLS } from '../core/tools.js';
import { executeTool } from './tool-executor.js';
import { createWrappedExecuteTool, UnderstandingJSON } from './ujson.js';
import { buildPlannerPrompt, buildMTIPGeneratorPrompt, buildInterpreterPrompt, buildInterpretFixPrompt, buildWriterPrompt, buildReviewerPrompt } from '../prompts/prompt-builders.js';
import { getCurrentSetting, parseJSONFromLLM, parseMTIP, parseMTIPFields, parseRoutingString } from './pipeline-helpers.js';
import { createTick, createDeduction, addInstanceVersion } from '../core/models.js';
import { MTIP_GENERATOR_SYSTEM_PROMPT, INTERPRETER_SYSTEM_PROMPT } from '../prompts/system-prompts.js';
import { DB } from '../core/db.js';

const wrappedExecuteTool = createWrappedExecuteTool(executeTool);

// Planner 工具调用 → Deduction Steps 人类可读格式
function formatPlannerToolStep(toolName, args) {
  const desc = args?.content?.description || '';
  switch (toolName) {
    case 'read_settings':
      return ['Reading Setting', 'read ' + (args.ids || []).join(', ')];
    case 'trace_graph':
      return ['Tracing Node Path', (args.source_id || '') + ' to ' + (args.target_id || '')];
    case 'list_settings':
      return ['Listing Settings', (args.category || 'all')];
    case 'read_history':
      return ['Reading History', (args.time_range || args.connection || 'all')];
    case 'trace_versions':
      return ['Tracing Versions', (args.target_id || '')];
    case 'add_character':
      return ['Creating Character', (args.id || args.name || '') + (desc ? ' ' + desc : '')];
    case 'add_scene':
      return ['Creating Scene', (args.id || args.name || '') + (desc ? ' ' + desc : '')];
    case 'add_item':
      return ['Creating Item', (args.id || args.name || '') + (desc ? ' ' + desc : '')];
    case 'add_worldview_node':
      return ['Creating Worldview', (args.id || args.name || '') + (desc ? ' ' + desc : '')];
    case 'add_edge':
      return ['Creating Edge', (args.subject || '') + ' → ' + (args.object || '')];
    case 'add_history':
      return ['Creating History', (args.id || args.name || '')];
    case 'add_geography':
      return ['Creating Geography', (args.id || args.name || '')];
    case 'edit_character': return ['Editing Character', (args.char_id || '')];
    case 'edit_scene': return ['Editing Scene', (args.scene_id || '')];
    case 'edit_item': return ['Editing Item', (args.item_id || '')];
    case 'edit_worldview_node': return ['Editing Worldview', (args.node_id || '')];
    case 'edit_edge': return ['Editing Edge', (args.edge_id || '')];
    case 'edit_history': return ['Editing History', (args.history_id || '')];
    case 'edit_geography': return ['Editing Geography', (args.geo_id || '')];
    case 'delete_character': return ['Deleting Character', (args.char_id || '')];
    case 'delete_scene': return ['Deleting Scene', (args.scene_id || '')];
    case 'delete_item': return ['Deleting Item', (args.item_id || '')];
    case 'delete_worldview_node': return ['Deleting Worldview', (args.node_id || '')];
    case 'delete_edge': return ['Deleting Edge', (args.edge_id || '')];
    case 'delete_history': return ['Deleting History', (args.history_id || '')];
    case 'delete_geography': return ['Deleting Geography', (args.geo_id || '')];
    default: return [toolName, JSON.stringify(args || {}).substring(0, 50)];
  }
}

async function runTick(story, userMessage, onProgress) {
  const tick = createTick((story.ticks?.length || 0) + 1);
  const mtipTexts = {};  // charId → MTIP-C 文本
  const interpreterOutputs = {};  // sceneId → 事件数组

  // 确保数组已初始化
  if (!story.eventQuadruples) story.eventQuadruples = [];
  if (!story.ticks) story.ticks = [];
  if (!story.chapters) story.chapters = [];
  if (!story.instances) story.instances = { characters: {}, scenes: {}, items: {} };

  try {

  // === 1. Planner ===
  // TODO: 赋予 Planner 编辑实例设定的能力（Planner 输出 instanceEdits 字段，在 MTIP 生成前应用到实例）
  onProgress?.('planner', 'Planner 正在规划推演参数...');
  const plannerMsgs = await buildPlannerPrompt(story, userMessage);
  if (!plannerMsgs) { onProgress?.('error', '无法构建 Planner 提示词'); return; }

  // Planner 带工具调用循环
  const plannerMessages = [...plannerMsgs];
  let plannerResp = await callLLM(plannerMessages, LORESET_TOOLS, null);

  while (plannerResp.tool_calls?.length) {
    const validToolCalls = plannerResp.tool_calls.filter(tc => tc.id);
    if (!validToolCalls.length) break;

    plannerMessages.push({
      role: 'assistant',
      content: plannerResp.content || '',
      tool_calls: validToolCalls
    });

    if (validToolCalls.length === 1) {
      // 单个工具：逐个显示
      const tc = validToolCalls[0];
      const fn = tc.function;
      let args;
      try { args = JSON.parse(fn.arguments); } catch (e) { args = {}; }
      if (!args.lore_path && story.associatedLoreSetId) args.lore_path = story.associatedLoreSetId;

      const [title, detail] = formatPlannerToolStep(fn.name, args);
      onProgress?.('planner-tool', title + '：' + detail);

      let toolResult;
      try { toolResult = await wrappedExecuteTool(fn.name, args); }
      catch (e) { toolResult = { error: e.message }; }

      const toolContent = toolResult._ujson_markdown || JSON.stringify(toolResult);
      plannerMessages.push({ role: 'tool', tool_call_id: tc.id, content: toolContent });
      onProgress?.('planner-tool-done', toolResult.success ? 'success' : 'failed');

    } else {
      // 多个工具：并发，合并为一个步骤
      onProgress?.('planner-tools-batch', validToolCalls.length);

      const toolPromises = validToolCalls.map(async tc => {
        const fn = tc.function;
        let args;
        try { args = JSON.parse(fn.arguments); } catch (e) { args = {}; }
        if (!args.lore_path && story.associatedLoreSetId) args.lore_path = story.associatedLoreSetId;

        let toolResult;
        try { toolResult = await wrappedExecuteTool(fn.name, args); }
        catch (e) { toolResult = { error: e.message }; }

        const toolContent = toolResult._ujson_markdown || JSON.stringify(toolResult);
        return { id: tc.id, name: fn.name, success: !!toolResult.success, content: toolContent };
      });

      const results = await Promise.all(toolPromises);
      for (const r of results) {
        plannerMessages.push({ role: 'tool', tool_call_id: r.id, content: r.content });
      }

      const summary = results.map(r => r.name + ': ' + (r.success ? 'success' : 'failed')).join(', ');
      onProgress?.('planner-tools-batch-done', summary);
    }

    plannerResp = await callLLM(plannerMessages, LORESET_TOOLS, null);
  }

  console.log('[Planner] raw response:', plannerResp.content);
  const plannerOutput = parseJSONFromLLM(plannerResp.content);
  if (!plannerOutput) { onProgress?.('error', 'Planner 输出解析失败'); return; }
  const routing = parseRoutingString(plannerOutput.routing || '');
  tick.routingLayout = {
    scenes: routing.scenes,
    characters: routing.characters,
    thinkingSummary: plannerOutput.thinkingSummary || '',
    narrativeIntent: plannerOutput.narrativeIntent || '',
    timeSections: [],
    mtipInstructions: plannerOutput.mtipInstructions || '',
    interpreterInstructions: plannerOutput.interpreterInstructions || '',
    interpretFixInstructions: plannerOutput.interpretFixInstructions || '',
    writerInstruction: plannerOutput.writerInstruction || '',
    reviewerInstructions: plannerOutput.reviewerInstructions || ''
  };
  onProgress?.('planner-done', tick.routingLayout.thinkingSummary || '路由规划完成');

  // === 2. MTIP Generator（并发调用）===
  const strongChars = [];
  const weakChars = [];
  for (const [cid, config] of Object.entries(tick.routingLayout.characters)) {
    if (config.load === 'STRONG') strongChars.push(cid);
    else if (config.load === 'WEAK') weakChars.push(cid);
  }

  // MTIP 角色动态标签
  const mtipLabels = [
    (n) => `Deciding ${n}`,
    (n) => `Examining ${n}`,
    (n) => `${n} Acting`,
    (n) => `${n} Moving`,
    (n) => `Forming ${n}'s Action`,
    (n) => `${n} Thinking`
  ];
  const _setting = await getCurrentSetting(story);
  const getCharName = (cid) => _setting?.characters?.[cid]?.name || cid;

  // 构建所有调用任务
  const mtipTasks = [];

  // 强加载：每个角色独立任务
  for (const cid of strongChars) {
    const charName = getCharName(cid);
    onProgress?.('mtip', mtipLabels[Math.floor(Math.random() * mtipLabels.length)](charName));
    mtipTasks.push(
      buildMTIPGeneratorPrompt(story, cid, tick.routingLayout).then(msgs => {
        if (!msgs) return { cid, type: 'strong', content: null };
        return callLLM(msgs, null, null).then(resp => ({
          cid, type: 'strong', content: resp.content
        }));
      })
    );
  }

  // 弱加载：合并为单个批量任务
  if (weakChars.length > 0) {
    const setting = _setting;
    const weakPromptParts = [];
    for (const cid of weakChars) {
      const charTemplate = setting?.characters?.[cid];
      const charInstance = story.instances?.characters?.[cid];
      const charData = charInstance?.versions?.[charInstance.versions.length - 1] || charTemplate?.default || {};
      const charName = charTemplate?.name || cid;
      const charMd = UnderstandingJSON({
        type: 'char', source: 'full_load',
        content: { id: cid, name: charName, default: charData }
      }).markdown;

      // 该角色经历的事件
      const charEvents = (charInstance?.events || []).map(eid =>
        story.eventQuadruples?.find(e => e.id === eid)
      ).filter(Boolean).slice(-3); // 最近3条
      const evtsMd = charEvents.map(e =>
        UnderstandingJSON({ type: 'evt', source: 'full_load', content: e }).markdown
      ).join('\n\n');

      weakPromptParts.push(`## 角色：${charName} [${cid}]\n\n${charMd}\n\n### 该角色最近经历的事件\n\n${evtsMd || '（无）'}`);
    }

    const weakUserMsg = weakPromptParts.join('\n\n---\n\n') +
      '\n\n---\n\n请为以上每个角色分别生成 MTIP-C。' +
      '\n\n**输出格式要求：** 每个角色的 MTIP-C 必须以 `### [角色ID]` 作为标题开头，例如：\n' +
      weakChars.map(cid => `### [${cid}]`).join('\n') +
      '\n\n每个角色的 MTIP-C 之间用 `---` 分隔。';

    const weakMsgs = [
      { role: 'system', content: MTIP_GENERATOR_SYSTEM_PROMPT },
      { role: 'user', content: weakUserMsg }
    ];

    for (const cid of weakChars) {
      const charName = getCharName(cid);
      onProgress?.('mtip', mtipLabels[Math.floor(Math.random() * mtipLabels.length)](charName));
    }
    mtipTasks.push(
      callLLM(weakMsgs, null, null).then(resp => ({
        cid: '__weak_batch__', type: 'weak', content: resp.content, charIds: weakChars
      }))
    );
  }

  // 并发执行所有任务
  const mtipResults = await Promise.all(mtipTasks);

  // 收集结果
  for (const result of mtipResults) {
    if (!result?.content) continue;

    if (result.type === 'strong') {
      mtipTexts[result.cid] = result.content;
      const fields = parseMTIPFields(result.content);
      const charName = getCharName(result.cid);
      onProgress?.('mtip-done', charName + ': ' + (fields.intent || result.content.substring(0, 80)));
    }

    if (result.type === 'weak') {
      // 按 ### [角色ID] 标题拆分
      const sections = result.content.split(/(?=### \[)/);
      for (const section of sections) {
        const idMatch = section.match(/^### \[(.+?)\]/);
        if (idMatch) {
          const cid = idMatch[1].trim();
          const body = section.replace(/^### \[.+?\]\s*/, '').trim();
          if (result.charIds.includes(cid)) {
            mtipTexts[cid] = body;
          }
        }
      }
      // 未被拆分到的角色，使用整体响应
      for (const cid of result.charIds) {
        if (!mtipTexts[cid]) {
          mtipTexts[cid] = result.content;
          console.warn('[MTIP] 弱加载角色拆分失败，使用整体响应:', cid);
        }
      }
      for (const cid of result.charIds) {
        const charName = getCharName(cid);
        const fields = parseMTIPFields(mtipTexts[cid] || '');
        onProgress?.('mtip-done', charName + ': ' + (fields.intent || '处理完成'));
      }
    }
  }

  // 记录 MTIP 快照
  tick.mtipSnapshots = {};
  for (const [cid, text] of Object.entries(mtipTexts)) {
    tick.mtipSnapshots[cid] = { charId: cid, raw: text };
  }

  // === 3. Interpreter（并发调用）===
  const strongScenes = [];
  const weakScenes = [];
  for (const [sid, config] of Object.entries(tick.routingLayout.scenes)) {
    if (config.load === 'STRONG') strongScenes.push(sid);
    else if (config.load === 'WEAK') weakScenes.push(sid);
  }

  // 收集每个场景的 MTIP
  function getSceneMtips(sceneId) {
    const result = {};
    for (const [cid, config] of Object.entries(tick.routingLayout.characters)) {
      if (config.currentScene === sceneId && mtipTexts[cid]) {
        result[cid] = mtipTexts[cid];
      }
    }
    return result;
  }

  onProgress?.('interpreter', `Interpreter: ${strongScenes.length} 强加载 + ${weakScenes.length} 弱加载，并发调用...`);

  const interpTasks = [];

  // 强加载场景：每个场景独立任务
  for (const sid of strongScenes) {
    const sceneMtips = getSceneMtips(sid);
    if (Object.keys(sceneMtips).length === 0) continue;
    interpTasks.push(
      buildInterpreterPrompt(story, sid, sceneMtips, tick.routingLayout).then(msgs => {
        if (!msgs) return { sid, type: 'strong', events: [] };
        return callLLM(msgs, null, null).then(resp => ({
          sid, type: 'strong', events: parseJSONFromLLM(resp.content) || []
        }));
      })
    );
  }

  // 弱加载场景：合并为单个批量任务
  if (weakScenes.length > 0) {
    const setting = await getCurrentSetting(story);
    const weakParts = [];

    for (const sid of weakScenes) {
      const sceneData = setting?.scenes?.[sid];
      const sceneName = sceneData?.name || sid;
      const sceneMtips = getSceneMtips(sid);
      if (Object.keys(sceneMtips).length === 0) continue;

      let partMd = `## 场景：${sceneName} [${sid}]\n\n`;
      partMd += UnderstandingJSON({ type: 'scene', source: 'full_load', content: sceneData }).markdown + '\n\n';
      partMd += '### 场景内角色 MTIP-C\n\n';
      for (const [cid, mtip] of Object.entries(sceneMtips)) {
        const charName = setting?.characters?.[cid]?.name || cid;
        partMd += `#### ${charName} [${cid}]\n\n${parseMTIP(mtip)}\n\n`;
      }

      const sceneItems = (sceneData?.default?.items || []).map(iid => setting?.items?.[iid]).filter(Boolean);
      if (sceneItems.length) {
        partMd += '### 场景内道具\n\n';
        for (const item of sceneItems) {
          partMd += UnderstandingJSON({ type: 'item', source: 'brief_load', content: item }).markdown + '\n\n';
        }
      }
      weakParts.push(partMd);
    }

    if (weakParts.length > 0) {
      const weakUserMsg = weakParts.join('\n---\n\n') +
        '\n\n---\n\n请为以上每个场景分别生成事件四元组。' +
        '\n\n**输出格式要求：** 每个场景的事件必须以 `### [场景ID]` 作为标题开头，例如：\n' +
        weakScenes.map(sid => `### [${sid}]`).join('\n') +
        '\n\n每个场景的事件之间用 `---` 分隔。每个场景内输出 JSON 数组。';

      const weakMsgs = [
        { role: 'system', content: INTERPRETER_SYSTEM_PROMPT },
        { role: 'user', content: weakUserMsg }
      ];

      interpTasks.push(
        callLLM(weakMsgs, null, null).then(resp => ({
          sid: '__weak_batch__', type: 'weak', content: resp.content, sceneIds: weakScenes
        }))
      );
    }
  }

  // 并发执行所有任务
  const interpResults = await Promise.all(interpTasks);

  // 收集结果
  for (const result of interpResults) {
    if (result.type === 'strong') {
      interpreterOutputs[result.sid] = Array.isArray(result.events) ? result.events : [];
      onProgress?.('interpreter-done', result.sid + ': ' + (interpreterOutputs[result.sid]?.length || 0) + ' 个事件');
    }
    if (result.type === 'weak' && result.content) {
      const sections = result.content.split(/(?=### \[)/);
      for (const section of sections) {
        const idMatch = section.match(/^### \[(.+?)\]/);
        if (idMatch) {
          const sid = idMatch[1].trim();
          const body = section.replace(/^### \[.+?\]\s*/, '').trim();
          const events = parseJSONFromLLM(body);
          if (result.sceneIds.includes(sid)) {
            interpreterOutputs[sid] = Array.isArray(events) ? events : [];
          }
        }
      }
      for (const sid of result.sceneIds) {
        if (!interpreterOutputs[sid]) {
          interpreterOutputs[sid] = [];
          console.warn('[Interpreter] 弱加载场景拆分失败:', sid);
        }
      }
      onProgress?.('interpreter-done', `弱加载批量完成 (${result.sceneIds.length} 个场景)`);
    }
  }

  // 记录 Deductions
  tick.deductions = [];
  for (const [sid, events] of Object.entries(interpreterOutputs)) {
    const ded = createDeduction(tick.deductions.length + 1, sid);
    ded.mtipSnapshots = {};
    for (const [cid, config] of Object.entries(tick.routingLayout.characters)) {
      if (config.currentScene === sid && mtipTexts[cid]) {
        ded.mtipSnapshots[cid] = { charId: cid, raw: mtipTexts[cid] };
      }
    }
    ded.interpreterOutput = events;
    tick.deductions.push(ded);
  }

  // === 4. Interpret-Fix ===
  onProgress?.('fix', 'Interpret-Fix: 检测冲突...');
  let fixedEvents = [];
  const allRawEvents = Object.values(interpreterOutputs).flat();
  if (Object.keys(interpreterOutputs).length > 1) {
    const msgs = await buildInterpretFixPrompt(story, interpreterOutputs, tick.routingLayout);
    if (msgs) {
      const resp = await callLLM(msgs, null, null);
      const parsed = parseJSONFromLLM(resp.content);
      fixedEvents = Array.isArray(parsed) ? parsed : allRawEvents;
    }
  } else {
    fixedEvents = allRawEvents;
  }

  // 为事件分配 ID
  for (let i = 0; i < fixedEvents.length; i++) {
    if (!fixedEvents[i].id) {
      fixedEvents[i].id = 'evt_' + Date.now().toString(36) + '_' + i;
    }
  }
  onProgress?.('fix-done', `修正后 ${fixedEvents.length} 个事件`);

  // === 5. Writer ===
  onProgress?.('writer', 'Writer: 撰写小说...');
  const writerMsgs = await buildWriterPrompt(story, fixedEvents, tick.routingLayout);
  let novelText = '';
  if (writerMsgs) {
    const writerResp = await callLLM(writerMsgs, null, (chunk) => {
      if (chunk.type === 'content') {
        novelText += chunk.text;
        onProgress?.('writer-stream', chunk.text);
      }
    });
    if (!novelText) novelText = writerResp.content;
  }
  onProgress?.('writer-done', novelText.substring(0, 100) + '...');

  // 保存小说章节
  if (!story.chapters) story.chapters = [];
  story.chapters.push({
    chapterIndex: story.chapters.length + 1,
    title: '第' + (story.chapters.length + 1) + '章',
    content: novelText,
    drivenByEvents: fixedEvents.map(e => e.id)
  });

  // === 6. Reviewer ===
  // TODO: 赋予 Reviewer 编辑实例设定的能力（通过 instanceMutations 修改角色/场景/道具实例的字段）
  // TODO: 赋予 Planner 在路由阶段预编辑实例设定的能力（如 Planner 在规划时直接修改角色状态）
  onProgress?.('reviewer', 'Reviewer: 审查...');
  const reviewerMsgs = await buildReviewerPrompt(story, fixedEvents, novelText, mtipTexts, tick.routingLayout);
  if (reviewerMsgs) {
    const reviewerResp = await callLLM(reviewerMsgs, null, null);
    const reviewerOutput = parseJSONFromLLM(reviewerResp.content);
    if (reviewerOutput) {
      // 追加即兴事件
      for (const evt of (reviewerOutput.addedEvents || [])) {
        if (!evt.id) evt.id = 'evt_' + Date.now().toString(36) + '_improv';
        fixedEvents.push(evt);
      }
      tick.reviewerActions = {
        addedEvents: reviewerOutput.addedEvents || [],
        instanceMutations: reviewerOutput.instanceMutations || [],
        reason: reviewerOutput.reason || ''
      };

      // 应用实例变更
      for (const mutation of (reviewerOutput.instanceMutations || [])) {
        const instances = story.instances?.[mutation.targetType];
        if (instances?.[mutation.id]) {
          addInstanceVersion(instances[mutation.id], mutation.changes);
        }
      }
    }
    onProgress?.('reviewer-done', reviewerOutput?.reason || '审查完成');
  }

  // === 7. 写入历史 ===

  // 更新角色事件列表
  for (const evt of fixedEvents) {
    for (const cid of (evt.char || [])) {
      if (story.instances?.characters?.[cid]?.events) {
        story.instances.characters[cid].events.push(evt.id);
      }
    }
  }

  // 写入 tick
  story.ticks.push(tick);
  story.eventQuadruples.push(...fixedEvents);
  console.log('[Deduction] saving story:', story.id, {
    ticks: story.ticks.length,
    events: story.eventQuadruples.length,
    chapters: story.chapters?.length
  });
  await DB.stories.put(story);
  console.log('[Deduction] story saved successfully');

  onProgress?.('complete', '推演完成');
  return tick;

  } catch (e) {
    console.error('[Deduction] runTick error:', e);
    onProgress?.('error', '推演出错: ' + e.message);
    return null;
  }
}

export { formatPlannerToolStep, runTick };
