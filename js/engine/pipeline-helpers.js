import { DB } from '../core/db.js';

// --------------------- 辅助函数 ---------------------

async function getCurrentSetting(story) {
  if (!story) return null;

  if (!story.associatedLoreSetId) {
    if (!story.instances) return null;
    return {
      worldview: { nodes: [], edges: [], history: [], geography: [] },
      scenes: story.instances.scenes || {},
      characters: story.instances.characters || {},
      items: story.instances.items || {}
    };
  }

  const ls = await DB.loresets.getById(story.associatedLoreSetId);
  if (!ls) return null;
  if (!story.instances) return ls;

  const merged = structuredClone(ls);
  for (const [cid, inst] of Object.entries(story.instances.characters || {})) {
    if (merged.characters?.[cid] && inst.versions?.length) {
      const latest = inst.versions[inst.versions.length - 1];
      merged.characters[cid] = { ...merged.characters[cid], default: { ...merged.characters[cid].default, ...latest } };
    }
  }
  for (const [sid, inst] of Object.entries(story.instances.scenes || {})) {
    if (merged.scenes?.[sid] && inst.versions?.length) {
      const latest = inst.versions[inst.versions.length - 1];
      merged.scenes[sid] = { ...merged.scenes[sid], default: { ...merged.scenes[sid].default, ...latest } };
    }
  }
  for (const [iid, inst] of Object.entries(story.instances.items || {})) {
    if (merged.items?.[iid] && inst.versions?.length) {
      const latest = inst.versions[inst.versions.length - 1];
      merged.items[iid] = { ...merged.items[iid], default: { ...merged.items[iid].default, ...latest } };
    }
  }
  return merged;
}

function parseJSONFromLLM(text) {
  // 从 LLM 输出中提取 JSON
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch (e) { /* ignore */ }
  }
  try { return JSON.parse(text); } catch (e) { return null; }
}

// MTIP 紧凑格式 → markdown 解析器
// 输入: "[心态|||思想|||意图|||计划|||澄清]"
// 输出: markdown 格式的标题+列表
function parseMTIP(raw) {
  if (!raw) return '';
  let text = raw.trim();
  // 去除外层中括号
  if (text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1);
  }
  const parts = text.split('|||');
  const labels = ['心态 (Mindset)', '思想 (Thought)', '意图 (Intent)', '计划 (Plan)', '澄清 (Clarification)'];
  const lines = [];
  for (let i = 0; i < parts.length && i < labels.length; i++) {
    const val = parts[i].trim();
    if (val) {
      lines.push('- **' + labels[i] + ':** ' + val);
    }
  }
  return lines.join('\n');
}

// MTIP 紧凑格式 → 各字段对象（供 Show Deduction Steps 使用）
function parseMTIPFields(raw) {
  if (!raw) return {};
  let text = raw.trim();
  if (text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1);
  }
  const parts = text.split('|||');
  return {
    mindset: parts[0]?.trim() || '',
    thought: parts[1]?.trim() || '',
    intent: parts[2]?.trim() || '',
    plan: parts[3]?.trim() || '',
    clarification: parts[4]?.trim() || ''
  };
}

// --------------------- Routing 解析 ---------------------

function parseRoutingString(routingStr) {
  const result = { scenes: {}, characters: {} };
  const lines = routingStr.trim().split('\n').filter(line => line.trim());
  for (const line of lines) {
    const match = line.match(/^([+-])\[(.+)\]$/);
    if (!match) continue;
    const sceneLoad = match[1] === '+' ? 'STRONG' : 'WEAK';
    const scenesStr = match[2];
    const scenes = splitByPipe(scenesStr);
    for (const sceneExpr of scenes) {
      const sceneMatch = sceneExpr.match(/^(scene_\w+)\[(.+)\]$/);
      if (!sceneMatch) continue;
      const sceneId = sceneMatch[1];
      const charsStr = sceneMatch[2];
      result.scenes[sceneId] = { load: sceneLoad };
      const chars = splitByPipe(charsStr);
      for (const charExpr of chars) {
        const charMatch = charExpr.match(/^([+-])(char_\w+)$/);
        if (!charMatch) continue;
        const charLoad = charMatch[1] === '+' ? 'STRONG' : 'WEAK';
        const charId = charMatch[2];
        result.characters[charId] = { load: charLoad, currentScene: sceneId };
      }
    }
  }
  return result;
}

function splitByPipe(str) {
  const result = [];
  let depth = 0;
  let current = '';
  for (const char of str) {
    if (char === '[') depth++;
    if (char === ']') depth--;
    if (char === '|' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

export {
  getCurrentSetting,
  parseJSONFromLLM,
  parseMTIP,
  parseMTIPFields,
  parseRoutingString,
  splitByPipe
};
