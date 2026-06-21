const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlPath = path.join(root, 'ws1-0-0.html');
const outPath = path.join(root, 'js', 'ui', 'views', 'dialogue.js');

console.log('Reading ws1-0-0.html...');
const html = fs.readFileSync(htmlPath, 'utf8');
const allLines = html.split('\n');

// Line ranges to extract (1-indexed, inclusive)
// Excludes: copyText helper (8928-8934, imported from dom-helpers),
//           positionPopupSmart (9833-9886, imported from dom-helpers),
//           and variable declarations now in state module
const ranges = [
    [8487, 8554],   // loadStoryDialogue
    [8557, 8566],   // handleDialogueCollectionPillClick
    [8568, 8612],   // renderDeductionStepsHTML
    [8615, 8803],   // renderDialogueArea
    [8806, 8838],   // toggleBubbleDetail
    [8841, 8898],   // toggleBubbleFoldLocal
    [8901, 8925],   // toggleDeductionLocal
    [8937, 8947],   // editMessage
    [8950, 8957],   // copyMainMessage
    [8960, 8965],   // triggerMainMessageEdit
    [8968, 8976],   // copySidebarMessage
    [8979, 8985],   // triggerSidebarMessageEdit
    [8988, 8990],   // branchFromMessage
    [8992, 8999],   // renderSingleDeductionStepHTML (window.xxx = function)
    [9001, 9026],   // animateButtonHeader (window.xxx = function)
    [9029, 9151],   // sendDialogueMessageFromComponent
    [9161, 9169],   // switchSidebarCategory
    [9173, 9187],   // toggleRightSidebar
    [9193, 9193],   // filterSidebarItems
    [9195, 9290],   // renderSidebarItems
    [9293, 9322],   // showEventDetail
    [9329, 9333],   // getSidebarDialogueHistory
    [9342, 9355],   // createEditWelcomeMsg
    [9358, 9372],   // saveCurrentSidebarSession
    [9375, 9399],   // loadOrCreateSidebarSession
    [9402, 9579],   // renderSidebarDialogueArea
    [9582, 9638],   // toggleSidebarBubbleFoldLocal
    [9641, 9665],   // toggleSidebarThinkingLocal
    [9668, 9679],   // editSidebarMessage
    [9682, 9709],   // parseStreamingMessage
    [9712, 9734],   // animateThinkingBtnText
    [9737, 9830],   // sendSidebarMessageFromComponent
    [9889, 9903],   // openSettingRefPopup
    [9906, 9945],   // openCollectionMountPopup
    [9947, 9981],   // renderSettingRefList
    [9983, 9986],   // filterSettingRefItems
    [9989, 10006],  // document click listener for popup closing
    [10009, 10020], // toggleQuickActionsPopup
    [10024, 10078], // handleQAImport
    [10081, 10084], // handleQAExport
    [10087, 10157], // buildNodeBar
];

// Extract blocks
const blocks = ranges.map(([s, e]) => allLines.slice(s - 1, e).join('\n'));
let code = blocks.join('\n\n');

// Strip 8-space base indentation (HTML script block indentation)
code = code.split('\n').map(line => {
    if (line.startsWith('        ')) return line.substring(8);
    return line;
}).join('\n');

// Normalize window.xxx = function xxx to regular function declarations
code = code.replace(/window\.(\w+)\s*=\s*function\s+(\w+)\s*\(/g, 'function $2(');

// --- State replacements (word-boundary: not preceded by . or word char, not followed by word char) ---
const stateVars = [
    'activeStoryDialogue', 'activeStoryName', 'storyDialogues',
    'sidebarDialogueHistories', 'currentSidebarStoryName',
    'sidebarCategoryIndex', 'isSidebarCollapsed', 'editDialogueHistory',
    '_currentSidebarSessionSource', '_currentSidebarSessionId',
    'inputBox', 'sidebarInputBox', 'collectionsData',
    'allStories', 'currentCollectionId',
];
for (const v of stateVars) {
    code = code.replace(new RegExp(`(?<![.\\w])${v}(?!\\w)`, 'g'), `state.${v}`);
}

// isUserLoggedIn: replace with state.isUserLoggedIn first
code = code.replace(/(?<![.\w])isUserLoggedIn(?!\w)/g, 'state.isUserLoggedIn');

// handleQAImport: add window.isUserLoggedIn dual-write
code = code.replace(
    /state\.isUserLoggedIn = false;/g,
    'window.isUserLoggedIn = false;\n        state.isUserLoggedIn = false;'
);
code = code.replace(
    /state\.isUserLoggedIn = true;/g,
    'window.isUserLoggedIn = true;\n        state.isUserLoggedIn = true;'
);
// handleQAExport: check via window.isUserLoggedIn
code = code.replace(
    /if \(!state\.isUserLoggedIn\)/g,
    'if (!window.isUserLoggedIn)'
);

// Cross-module globals -> window.xxx
const windowVars = [
    'isEditingIndependentStory', 'initInputBoxForPage', 'editSettingNode',
    'setInterfaceState', 'viewMode',
];
for (const v of windowVars) {
    code = code.replace(new RegExp(`(?<![.\\w])${v}(?!\\w)`, 'g'), `window.${v}`);
}

// currentData and kg (order: currentData first, then kg to avoid partial match inside currentData.kg)
code = code.replace(/(?<![.\w])currentData(?!\w)/g, 'window.currentData');
code = code.replace(/(?<![.\w])kg(?!\w)/g, 'window.kg');

// Inline onclick handlers: add window. prefix
const onclickFns = [
    'copyMainMessage', 'triggerMainMessageEdit', 'branchFromMessage',
    'toggleBubbleDetail', 'toggleBubbleFoldLocal', 'toggleDeductionLocal',
    'copySidebarMessage', 'triggerSidebarMessageEdit',
    'toggleSidebarBubbleFoldLocal', 'toggleSidebarThinkingLocal',
];
for (const fn of onclickFns) {
    code = code.replace(new RegExp(`onclick="${fn}\\(`, 'g'), `onclick="window.${fn}(`);
}

// Clean up extra blank lines
code = code.replace(/\n{3,}/g, '\n\n');

// Assemble final output
const output = `import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { callLLM } from '../../core/api.js';
import { LORESET_TOOLS } from '../../core/tools.js';
import { createWrappedExecuteTool, UnderstandingJSON } from '../../engine/ujson.js';
import { LORESET_SYSTEM_PROMPT } from '../../prompts/system-prompts.js';
import { refreshUserConfigurablePrompts } from '../../prompts/tool-descriptions.js';
import { copyText, positionPopupSmart } from '../utils/dom-helpers.js';

// ===== Variables local to this module =====
const sidebarCategories = ['事件', '角色', '世界观', '道具', '场景'];
const categoryToType = { '事件': 'event', '角色': 'character', '世界观': 'worldview', '道具': 'prop', '场景': 'scene' };

${code.trim()}

// ===== Expose all functions to window =====
window.loadStoryDialogue = loadStoryDialogue;
window.handleDialogueCollectionPillClick = handleDialogueCollectionPillClick;
window.renderDeductionStepsHTML = renderDeductionStepsHTML;
window.renderDialogueArea = renderDialogueArea;
window.toggleBubbleDetail = toggleBubbleDetail;
window.toggleBubbleFoldLocal = toggleBubbleFoldLocal;
window.toggleDeductionLocal = toggleDeductionLocal;
window.copyMainMessage = copyMainMessage;
window.triggerMainMessageEdit = triggerMainMessageEdit;
window.copySidebarMessage = copySidebarMessage;
window.triggerSidebarMessageEdit = triggerSidebarMessageEdit;
window.branchFromMessage = branchFromMessage;
window.renderSingleDeductionStepHTML = renderSingleDeductionStepHTML;
window.animateButtonHeader = animateButtonHeader;
window.sendDialogueMessageFromComponent = sendDialogueMessageFromComponent;
window.switchSidebarCategory = switchSidebarCategory;
window.toggleRightSidebar = toggleRightSidebar;
window.filterSidebarItems = filterSidebarItems;
window.renderSidebarItems = renderSidebarItems;
window.showEventDetail = showEventDetail;
window.createEditWelcomeMsg = createEditWelcomeMsg;
window.getSidebarDialogueHistory = getSidebarDialogueHistory;
window.saveCurrentSidebarSession = saveCurrentSidebarSession;
window.loadOrCreateSidebarSession = loadOrCreateSidebarSession;
window.renderSidebarDialogueArea = renderSidebarDialogueArea;
window.toggleSidebarBubbleFoldLocal = toggleSidebarBubbleFoldLocal;
window.toggleSidebarThinkingLocal = toggleSidebarThinkingLocal;
window.editSidebarMessage = editSidebarMessage;
window.parseStreamingMessage = parseStreamingMessage;
window.animateThinkingBtnText = animateThinkingBtnText;
window.sendSidebarMessageFromComponent = sendSidebarMessageFromComponent;
window.openSettingRefPopup = openSettingRefPopup;
window.openCollectionMountPopup = openCollectionMountPopup;
window.renderSettingRefList = renderSettingRefList;
window.filterSettingRefItems = filterSettingRefItems;
window.toggleQuickActionsPopup = toggleQuickActionsPopup;
window.handleQAImport = handleQAImport;
window.handleQAExport = handleQAExport;
window.buildNodeBar = buildNodeBar;
window.editMessage = editMessage;
`;

fs.writeFileSync(outPath, output, 'utf8');
console.log('Done! Written to', outPath);
console.log('Total lines:', output.split('\n').length);
