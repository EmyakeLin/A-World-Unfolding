const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'ws1-0-0.html');
const outPath = path.join(__dirname, 'js', 'ui', 'components', 'modal.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const lines = html.split('\n');

function extractFunction(funcName, isAsync) {
  const prefix = isAsync ? 'async function' : 'function';
  const search = prefix + ' ' + funcName;
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(search + '(') || trimmed.startsWith(search + ' (')) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) {
    console.error('Function not found: ' + funcName);
    return '';
  }

  let braceCount = 0;
  let started = false;
  let endLine = startLine;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '{') { braceCount++; started = true; }
      else if (ch === '}') braceCount--;
    }
    if (started && braceCount === 0) { endLine = i; break; }
  }

  return lines.slice(startLine, endLine + 1).join('\n');
}

function replaceStateVars(body) {
  // Order matters: longer/more specific first
  const replacements = [
    ['isEditingStandalone', 'state.isEditingStandalone'],
    ['editorSessions', 'state.editorSessions'],
    ['editActiveCategory', 'state.editActiveCategory'],
    ['sidebarInputBox', 'state.sidebarInputBox'],
    ['currentLoreSetId', 'state.currentLoreSetId'],
    ['loresetData', 'state.loresetData'],
    ['editViewMode', 'state.editViewMode'],
    ['currentData', 'state.currentData'],
    ['_modalKG', 'state._modalKG'],
    ['inputBox', 'state.inputBox'],
  ];

  for (const [from, to] of replacements) {
    // Split on from, then rejoin with to
    // This avoids regex issues but does a global replace
    const parts = body.split(from);
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      result.push(parts[i]);
      if (i < parts.length - 1) {
        // Check if this occurrence is already prefixed with 'state.' by looking at end of previous part
        const prev = result[result.length - 2] || '';
        if (prev.endsWith('state.') || prev.endsWith('window.')) {
          // Already prefixed, keep original
          result.push(from);
        } else {
          result.push(to);
        }
      }
    }
    body = result.join('');
  }
  return body;
}

const funcs = [
  { name: 'getOptionsForType', async: false },
  { name: 'createIdSelector', async: false },
  { name: 'createTagList', async: false },
  { name: 'createIdList', async: false },
  { name: 'createRelList', async: false },
  { name: 'createCognitionEditor', async: false },
  { name: 'openEditModal', async: false },
  { name: 'loadNodeFullData', async: true },
  { name: 'openKgSubModal', async: false },
  { name: 'renderKgAddContent', async: false },
  { name: 'renderKgArrowRow', async: false },
  { name: 'renderKgRelArea', async: false },
  { name: 'getNodeRelations', async: true },
  { name: 'getNodeShortName', async: false },
  { name: 'renderKgRemoveContent', async: true },
  { name: 'removeRelation', async: true },
  { name: 'renderKgListContent', async: true },
  { name: 'submitKgAdd', async: true },
  { name: 'closeKgSubModal', async: false },
  { name: 'buildGraphData', async: false },
  { name: 'findNodeName', async: false },
  { name: 'findNodeType', async: false },
  { name: 'renderModalGraph', async: true },
  { name: 'renderAttrPanel', async: false },
  { name: 'startAttrEdit', async: false },
  { name: 'renderFieldSidebar', async: false },
  { name: 'selectField', async: false },
  { name: 'getFullFieldValue', async: false },
  { name: 'setFullFieldValue', async: false },
  { name: 'renderFieldEditor', async: false },
  { name: 'startEditModalName', async: false },
  { name: 'closeEditModal', async: false },
  { name: 'submitEditModal', async: true },
  { name: 'editSettingNode', async: true },
  { name: 'showNewSettingDialog', async: false },
  { name: 'closeNewSettingDialog', async: false },
  { name: 'resetEditChatWelcome', async: true },
  { name: 'clearEditChat', async: true },
  { name: 'sendEditChatMessage', async: true },
  { name: 'editHistoryToMessages', async: false },
];

// Extract and transform each function
const extracted = [];
for (const f of funcs) {
  let body = extractFunction(f.name, f.async);
  if (!body) {
    extracted.push('');
    continue;
  }
  body = replaceStateVars(body);

  // Add window. prefix for cross-module calls
  const crossModuleCalls = [
    'loadDataFromDB', 'renderEditCards', 'initEditD3ForceGraph',
    'renderSidebarDialogueArea', 'saveCurrentSidebarSession',
    'createEditWelcomeMsg', 'animateThinkingBtnText',
    'KGEngine'
  ];
  for (const fn of crossModuleCalls) {
    // Replace bare function calls not already prefixed with window. or a dot
    const regex = new RegExp('(?<!window\\.|\\w\\.)' + fn + '(?=\\s*\\()', 'g');
    body = body.replace(regex, 'window.' + fn);
  }

  extracted.push(body);
}

// Build the file
const imports = `import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { callLLM } from '../../core/api.js';
import { LORESET_TOOLS } from '../../core/tools.js';
import { executeTool } from '../../engine/tool-executor.js';
import { createWrappedExecuteTool, UnderstandingJSON } from '../../engine/ujson.js';
import { LORESET_SYSTEM_PROMPT } from '../../prompts/system-prompts.js';
import { refreshUserConfigurablePrompts } from '../../prompts/tool-descriptions.js';
import { showToast, autoResizeTextarea, bindAutoResize } from '../utils/dom-helpers.js';

const wrappedExecuteTool = createWrappedExecuteTool(executeTool);
`;

const constants = `
// ===== 常量 =====
const modalColorMap = { worldview: '#2dd4bf', character: '#fb7185', scene: '#fb923c', prop: '#818cf8' };
const modalTypeLabels = { worldview: '世界观', character: '角色', scene: '场景', prop: '道具' };
const modalTypeLabelColors = {
  worldview: 'text-teal-600 bg-teal-50 border-teal-200',
  character: 'text-rose-600 bg-rose-50 border-rose-200',
  scene: 'text-orange-600 bg-orange-50 border-orange-200',
  prop: 'text-indigo-600 bg-indigo-50 border-indigo-200'
};
const ATTR_FIELDS = {
  worldview:  [['id','id'], ['tags','tags'], ['priority','priority']],
  history:    [['id','id'], ['time','time']],
  geography:  [['id','id'], ['layer','layer']],
  scene:      [['id','id'], ['items','items']],
  character:  [['id','id'], ['mbti','mbti'], ['value','value']],
  item:       [['id','id'], ['tags','tags']]
};
const EDIT_FIELDS = {
  worldview:  [{ key: 'content', label: 'Content' }],
  history:    [{ key: 'content', label: 'Content' }],
  geography:  [{ key: 'content', label: 'Content' }],
  scene:      [{ key: 'content', label: 'Content' }, { key: 'items', label: 'Items' }],
  character:  [{ key: 'persona', label: 'Persona' }, { key: 'pursuit', label: 'Pursuit' }, { key: 'ability', label: 'Ability' }, { key: 'goal', label: 'Goal' }, { key: 'memory', label: 'Memory' }, { key: 'inventory', label: 'Inventory' }, { key: 'cognition', label: 'Cognition' }],
  item:       [{ key: 'content', label: 'Content' }, { key: 'ability', label: 'Ability' }]
};

// ===== 图谱子模态变量 =====
let _kgSubDir = 'forward';
window._kgSubTargetId = null;
`;

const windowAssignments = funcs.map(f => 'window.' + f.name + ' = ' + f.name + ';').join('\n');

const output = [
  imports,
  constants,
  '// ===== 下拉选择器组件 =====',
  extracted[0],
  '',
  extracted[1],
  '',
  `// 点击外部关闭所有下拉
document.addEventListener('click', () => {
  document.querySelectorAll('.id-selector-dropdown.open').forEach(d => d.classList.remove('open'));
});`,
  '',
  '// ===== 标签列表组件 =====',
  extracted[2],
  '',
  '// ===== ID 列表组件 =====',
  extracted[3],
  '',
  '// ===== 关系列表组件 =====',
  extracted[4],
  '',
  '// ===== cognition 子字段组件 =====',
  extracted[5],
  '',
  '// ===== 编辑模态框 =====',
  extracted[6],
  '',
  extracted[7],
  '',
  '// ===== 图谱子模态窗口 =====',
  extracted[8],
  '',
  extracted[9],
  '',
  extracted[10],
  '',
  extracted[11],
  '',
  extracted[12],
  '',
  extracted[13],
  '',
  extracted[14],
  '',
  extracted[15],
  '',
  extracted[16],
  '',
  extracted[17],
  '',
  extracted[18],
  '',
  `// ESC 关闭子模态窗和编辑模态框
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sub = document.getElementById('kg-sub-modal-overlay');
    if (sub && sub.classList.contains('open')) { closeKgSubModal(); return; }
    const editModal = document.getElementById('edit-modal-overlay');
    if (editModal && editModal.classList.contains('open')) { closeEditModal(); return; }
  }
});`,
  '',
  '// ===== 图谱渲染 =====',
  extracted[19],
  '',
  extracted[20],
  '',
  extracted[21],
  '',
  extracted[22],
  '',
  extracted[23],
  '',
  extracted[24],
  '',
  extracted[25],
  '',
  extracted[26],
  '',
  extracted[27],
  '',
  extracted[28],
  '',
  extracted[29],
  '',
  extracted[30],
  '',
  extracted[31],
  '',
  extracted[32],
  '',
  extracted[33],
  '',
  extracted[34],
  '',
  extracted[35],
  '',
  extracted[36],
  '',
  extracted[37],
  '',
  extracted[38],
  '',
  extracted[39],
  '',
  '// ===== 暴露到 window =====',
  windowAssignments,
  ''
].join('\n');

fs.writeFileSync(outPath, output, 'utf8');
console.log('Wrote ' + outPath + ' successfully');
console.log('Total functions extracted: ' + extracted.filter(e => e).length);
