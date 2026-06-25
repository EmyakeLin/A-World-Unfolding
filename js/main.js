import { DB, _allLoreSets, _allStories, _allChats } from './core/db.js';
import { seedDatabase } from './core/models.js';
import { callLLM } from './core/api.js';
import { LORESET_TOOLS } from './core/tools.js';
import { executeTool } from './engine/tool-executor.js';
import { createWrappedExecuteTool, UnderstandingJSON, ExpandNodes, UJSON_cache } from './engine/ujson.js';
import { deductionBridge } from './engine/deduction-bridge.js';
import { runTick } from './engine/tick-runner.js';
import { state } from './ui/state.js';
import { InputBox } from './ui/components/input-box.js';
import './ui/app.js';

async function init() {
  await DB.open();
  await seedDatabase();

  const loresets = await DB.loresets.getAll();
  const stories = await DB.stories.getAll();
  const chats = await DB.chatSessions.getAll();

  _allLoreSets.length = 0;
  _allLoreSets.push(...loresets);
  _allStories.length = 0;
  _allStories.push(...stories);
  _allChats.length = 0;
  _allChats.push(...chats);

  window.DB = DB;
  window.callLLM = callLLM;
  window.LORESET_TOOLS = LORESET_TOOLS;
  window.executeTool = executeTool;
  window.wrappedExecuteTool = createWrappedExecuteTool(executeTool);
  window.UnderstandingJSON = UnderstandingJSON;
  window.ExpandNodes = ExpandNodes;
  window.UJSON_cache = UJSON_cache;
  window._deductionBridge = deductionBridge;
  window.runTick = runTick;

  if (typeof window.loadDataFromDB === 'function') {
    await window.loadDataFromDB();
  }

  const { state: initState, name: initName } = (typeof window.parseHash === 'function')
    ? window.parseHash()
    : { state: 'home', name: '' };

  if (typeof window.sendSidebarMessageFromComponent === 'function') {
    state.sidebarInputBox = new InputBox({
      containerId: 'sidebar-input-container',
      type: 'sidebar',
      placeholder: '输入文本...',
      isCompact: true,
      onSubmit: (val) => { window.sendSidebarMessageFromComponent(val); }
    });
  }

  if (typeof window.renderSidebarCollections === 'function') window.renderSidebarCollections();
  if (typeof window.renderSidebarStandaloneStories === 'function') window.renderSidebarStandaloneStories();

  if (typeof window.setGlobalTheme === 'function') {
    window.setGlobalTheme(localStorage.getItem('global-theme') || 'blue-gradient');
  }
  if (typeof window.applyFontSizeStyle === 'function') {
    window.applyFontSizeStyle(parseInt(localStorage.getItem('font-size') || '12'));
  }
  if (typeof window.setDeductionLevel === 'function') {
    window.setDeductionLevel(localStorage.getItem('deduction-level') || 'Standard');
  }

  if (typeof window.setInterfaceState === 'function') {
    await window.setInterfaceState(initState, initName);
  }

  console.log('[WorldStory] 应用初始化完成');
}

init().catch(err => {
  console.error('[WorldStory] 初始化失败:', err);
});
