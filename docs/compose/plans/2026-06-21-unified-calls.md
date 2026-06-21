# 统一化调用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除前端 15+ 处功能重复代码，通过基类继承模式统一 Popup、ChatArea、CrudHandler、SettingsSaver、ModelSelector。

**Architecture:** 创建 5 个基类（PopupBase、ChatAreaBase、CrudHandler、SettingsSaver、ModelSelector），各实例通过继承+覆写实现差异化。基类放在 `js/ui/components/base/` 目录。

**Tech Stack:** ES Modules, Vanilla JS, IndexedDB

---

## File Structure

```
js/ui/components/base/
├── popup-base.js        # Popup 基类
├── chat-area-base.js    # 对话区域基类
├── crud-handler.js      # CRUD 工具执行统一
├── settings-saver.js    # Settings save 统一
└── model-selector.js    # 模型选择器统一
```

---

### Task 1: Create PopupBase

**Covers:** S3

**Files:**
- Create: `js/ui/components/base/popup-base.js`

- [ ] **Step 1: Create PopupBase class**

```js
// js/ui/components/base/popup-base.js
export class PopupBase {
  constructor(popupId, options = {}) {
    this.el = document.getElementById(popupId);
    this.popupId = popupId;
    this.margin = options.margin || 8;
    this.onShow = options.onShow || null;
    this.onHide = options.onHide || null;
  }

  show(triggerEl) {
    if (!this.el || !triggerEl) return;
    this.el.classList.remove('hidden');
    this.position(triggerEl);
    this.onShow?.();
  }

  hide() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.onHide?.();
  }

  toggle(triggerEl) {
    if (!this.el) return;
    if (this.el.classList.contains('hidden')) {
      this.show(triggerEl);
    } else {
      this.hide();
    }
  }

  position(triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const popupWidth = this.el.offsetWidth || 192;
    const popupHeight = this.el.offsetHeight || 132;

    let left = rect.right + this.margin;
    let top = rect.bottom;

    if (left + popupWidth > window.innerWidth) {
      left = rect.left - popupWidth - this.margin;
    }
    if (top + popupHeight > window.innerHeight) {
      top = window.innerHeight - popupHeight - this.margin;
    }
    if (top < this.margin) {
      top = this.margin;
    }

    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  }

  // 注册全局 click-outside 监听（只需调用一次）
  static registerGlobalCloser() {
    if (PopupBase._globalCloserRegistered) return;
    PopupBase._globalCloserRegistered = true;
    PopupBase._instances = PopupBase._instances || [];

    document.addEventListener('click', (e) => {
      for (const instance of PopupBase._instances) {
        if (!instance.el || instance.el.classList.contains('hidden')) continue;
        if (!instance.el.contains(e.target) && !e.target.closest(instance.triggerSelector)) {
          instance.hide();
        }
      }
    });
  }

  // 注册实例到全局关闭器
  register(triggerSelector) {
    this.triggerSelector = triggerSelector;
    PopupBase._instances = PopupBase._instances || [];
    PopupBase._instances.push(this);
    PopupBase.registerGlobalCloser();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui/components/base/popup-base.js
git commit -m "v1.0.0u01 feat: PopupBase 基类"
```

---

### Task 2: Refactor Popups to use PopupBase

**Covers:** S3

**Files:**
- Modify: `js/ui/views/home.js` (deduction-level-popup)
- Modify: `js/ui/views/chat.js` (chat-at-popup)
- Modify: `js/ui/views/collection.js` (collection-mount-popup)
- Modify: `js/ui/app.js` (quick-actions-popup, setting-ref-popup)

- [ ] **Step 1: Refactor deduction-level-popup in home.js**

Replace the manual popup logic in home.js with PopupBase:
```js
import { PopupBase } from '../components/base/popup-base.js';

// 在模块顶层创建实例
const deductionLevelPopup = new PopupBase('deduction-level-popup', {
  margin: 12,
  onShow: () => {
    // 同步当前选中状态
    const currentLevel = localStorage.getItem('deduction-level') || 'Standard';
    deductionLevelPopup.el.querySelectorAll('.dl-popup-option').forEach(opt => {
      const optLevel = opt.getAttribute('data-level');
      const checkIcon = opt.querySelector('.dl-check-icon');
      if (optLevel === currentLevel) {
        opt.classList.add('active', 'bg-blue-50/40');
        if (checkIcon) checkIcon.classList.remove('hidden');
      } else {
        opt.classList.remove('active', 'bg-blue-50/40');
        if (checkIcon) checkIcon.classList.add('hidden');
      }
    });
  }
});
deductionLevelPopup.register('.thinking-level-option');

// 替换 window.openDeductionLevelPopup
window.openDeductionLevelPopup = (triggerEl) => deductionLevelPopup.show(triggerEl);
window.showDlPopup = (triggerEl) => deductionLevelPopup.show(triggerEl);
window.hideDlPopup = () => deductionLevelPopup.hide();
```

- [ ] **Step 2: Refactor chat-at-popup in chat.js**

```js
import { PopupBase } from '../components/base/popup-base.js';

const chatAtPopup = new PopupBase('chat-at-popup');
chatAtPopup.register('[onclick*="openChatAtPopup"]');

window.openChatAtPopup = (e) => {
  chatAtPopup.toggle(e.currentTarget || e.target.closest('button'));
  if (!chatAtPopup.el.classList.contains('hidden')) {
    renderChatAtList();
    const searchInput = document.getElementById('chat-at-search');
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  }
  e.stopPropagation();
};
```

- [ ] **Step 3: Refactor quick-actions-popup in app.js**

```js
import { PopupBase } from './components/base/popup-base.js';

const quickActionsPopup = new PopupBase('quick-actions-popup');
quickActionsPopup.register('[onclick*="toggleQuickActionsPopup"]');

window.toggleQuickActionsPopup = (e) => {
  quickActionsPopup.toggle(e.currentTarget || e.target.closest('button'));
  e.stopPropagation();
};
```

- [ ] **Step 4: Refactor setting-ref-popup in app.js**

```js
const settingRefPopup = new PopupBase('setting-ref-popup');
settingRefPopup.register('[onclick*="openSettingRefPopup"]');

window.openSettingRefPopup = (e) => {
  settingRefPopup.show(e.currentTarget);
  renderSettingRefList();
  e.stopPropagation();
};
```

- [ ] **Step 5: Refactor collection-mount-popup in collection.js**

```js
import { PopupBase } from '../components/base/popup-base.js';

const collectionMountPopup = new PopupBase('collection-mount-popup');
collectionMountPopup.register('[onclick*="openCollectionMountPopup"]');

window.openCollectionMountPopup = (e) => {
  collectionMountPopup.show(e.currentTarget);
  e.stopPropagation();
};
```

- [ ] **Step 6: Remove old click-outside handlers from app.js**

Remove the `document.addEventListener('click', ...)` block in app.js that manually closes all popups (around line 190-222). The PopupBase global closer handles this now.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "v1.0.0u02 refactor: 5个Popup统一使用PopupBase"
```

---

### Task 3: Create ChatAreaBase

**Covers:** S4

**Files:**
- Create: `js/ui/components/base/chat-area-base.js`

- [ ] **Step 1: Create ChatAreaBase class**

```js
// js/ui/components/base/chat-area-base.js
export class ChatAreaBase {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.messages = [];
    this.bubbleRadius = options.bubbleRadius || '36px';
    this.bubblePadding = options.bubblePadding || '24px';
    this.fontSize = options.fontSize || '12px';
  }

  getContainer() {
    return document.getElementById(this.containerId);
  }

  getMessages() { return this.messages; }
  setMessages(msgs) { this.messages = msgs; }
  addMessage(msg) { this.messages.push(msg); }

  // 渲染全部消息
  render() {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML = '';
    this.messages.forEach((msg, idx) => {
      container.appendChild(this.createBubble(msg, idx));
    });
    container.scrollTop = container.scrollHeight;
  }

  // 创建气泡外壳
  createBubble(msg, index) {
    const isUser = msg.sender === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `flex items-start gap-2 ${isUser ? 'justify-end' : ''} w-full`;

    const avatar = document.createElement('div');
    avatar.className = `w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm select-none text-[9px] font-bold ${isUser ? 'bg-slate-200 text-slate-600 border border-slate-300' : 'bg-blue-50 text-blue-500 border border-blue-200'}`;
    avatar.textContent = isUser ? 'U' : 'A';

    const bubble = document.createElement('div');
    bubble.className = 'flex flex-col max-w-[85%]';
    bubble.style.borderRadius = this.bubbleRadius;

    // 可覆写的气泡内容
    this.renderBubbleContent(msg, bubble, index);

    // 操作按钮
    const actions = this.renderActions(msg, index);
    if (actions) bubble.appendChild(actions);

    if (isUser) {
      wrapper.appendChild(bubble);
      wrapper.appendChild(avatar);
    } else {
      wrapper.appendChild(avatar);
      wrapper.appendChild(bubble);
    }
    return wrapper;
  }

  // 可覆写：气泡内容
  renderBubbleContent(msg, bubbleEl, index) {
    const content = document.createElement('div');
    content.className = 'p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed shadow-sm';
    content.style.borderRadius = this.bubbleRadius;
    content.textContent = msg.text || '';
    bubbleEl.appendChild(content);
  }

  // 可覆写：操作按钮
  renderActions(msg, index) {
    return null;
  }

  // 流式追加
  appendStream(text) {
    const container = this.getContainer();
    if (!container) return;
    const lastBubble = container.querySelector('.flex-col:last-child .p-2\\.5, .flex-col:last-child [class*="bg-white"]');
    if (lastBubble) {
      lastBubble.textContent += text;
      container.scrollTop = container.scrollHeight;
    }
  }

  // 发送消息（通用流程）
  async send(text, callLLM, tools = null) {
    if (!text.trim()) return;
    this.addMessage({ sender: 'user', text });
    this.render();

    const aiMsg = { sender: 'ai', text: '' };
    this.addMessage(aiMsg);
    this.render();

    const messages = this.buildLLMMessages();
    const response = await callLLM(messages, tools, (chunk) => {
      if (chunk.type === 'content') {
        aiMsg.text += chunk.text;
        this.appendStream(chunk.text);
      }
    });
    if (!aiMsg.text) aiMsg.text = response.content;
    this.render();
    return response;
  }

  // 可覆写：构建 LLM 消息格式
  buildLLMMessages() {
    return this.messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui/components/base/chat-area-base.js
git commit -m "v1.0.0u03 feat: ChatAreaBase 基类"
```

---

### Task 4: Create ChatArea Subclasses

**Covers:** S4

**Files:**
- Create: `js/ui/components/main-dialogue.js`
- Create: `js/ui/components/sidebar-chat.js`
- Create: `js/ui/components/edit-chat.js`

- [ ] **Step 1: Create MainDialogue**

```js
// js/ui/components/main-dialogue.js
import { ChatAreaBase } from './base/chat-area-base.js';

export class MainDialogue extends ChatAreaBase {
  constructor() {
    super('dialogue-chat-area', { bubbleRadius: '36px', bubblePadding: '24px', fontSize: '12px' });
    this.deduction = [];
    this.isDeductionOpen = false;
  }

  renderBubbleContent(msg, bubbleEl, index) {
    if (msg.sender === 'user') {
      const content = document.createElement('div');
      content.className = 'p-6 bg-slate-100/70 border border-slate-200 text-sm font-medium text-slate-600 leading-relaxed shadow-sm';
      content.style.borderRadius = this.bubbleRadius;
      content.textContent = msg.text;
      bubbleEl.appendChild(content);
    } else {
      // AI 消息：推演步骤 + 小说文本
      if (msg.deduction?.length) {
        const stepsEl = this.createDeductionSteps(msg.deduction, index);
        bubbleEl.appendChild(stepsEl);
      }
      const content = document.createElement('div');
      content.className = 'p-6 bg-white border border-slate-200 text-sm font-medium text-slate-600 leading-relaxed shadow-sm';
      content.style.borderRadius = this.bubbleRadius;
      content.textContent = msg.text;
      bubbleEl.appendChild(content);
    }
  }

  createDeductionSteps(steps, index) {
    // 折叠式推演步骤渲染
    const wrapper = document.createElement('div');
    wrapper.className = 'collapsible-wrapper' + (this.isDeductionOpen ? ' open' : '');
    const inner = document.createElement('div');
    inner.className = 'collapsible-inner space-y-1';
    steps.forEach(step => {
      const line = document.createElement('div');
      line.className = 'text-[10px] text-slate-500';
      line.textContent = step;
      inner.appendChild(line);
    });
    wrapper.appendChild(inner);
    return wrapper;
  }

  renderActions(msg, index) {
    if (msg.sender !== 'ai') return null;
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 mt-2';
    // 复制、折叠、分支按钮
    ['copy', 'fold', 'branch'].forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'text-[9px] text-slate-400 hover:text-slate-600';
      btn.textContent = action;
      btn.onclick = () => this.handleAction(action, msg, index);
      actions.appendChild(btn);
    });
    return actions;
  }

  handleAction(action, msg, index) {
    if (action === 'copy') navigator.clipboard.writeText(msg.text);
    if (action === 'fold') this.isDeductionOpen = !this.isDeductionOpen;
    this.render();
  }
}
```

- [ ] **Step 2: Create SidebarChat**

```js
// js/ui/components/sidebar-chat.js
import { ChatAreaBase } from './base/chat-area-base.js';

export class SidebarChat extends ChatAreaBase {
  constructor(containerId) {
    super(containerId, { bubbleRadius: '12px', bubblePadding: '10px', fontSize: '10px' });
  }

  renderBubbleContent(msg, bubbleEl, index) {
    const content = document.createElement('div');
    content.className = 'p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed shadow-sm';
    content.style.borderRadius = this.bubbleRadius;
    content.textContent = msg.text;
    bubbleEl.appendChild(content);
  }

  renderActions(msg, index) {
    if (msg.sender !== 'ai') return null;
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 mt-1';
    ['copy'].forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'text-[8px] text-slate-400 hover:text-slate-600';
      btn.textContent = action;
      btn.onclick = () => navigator.clipboard.writeText(msg.text);
      actions.appendChild(btn);
    });
    return actions;
  }
}
```

- [ ] **Step 3: Create EditChat**

```js
// js/ui/components/edit-chat.js
import { ChatAreaBase } from './base/chat-area-base.js';

export class EditChat extends ChatAreaBase {
  constructor() {
    super('edit-chat-list', { bubbleRadius: '12px', bubblePadding: '10px', fontSize: '10px' });
  }

  renderBubbleContent(msg, bubbleEl, index) {
    const content = document.createElement('div');
    content.className = 'p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed shadow-sm';
    content.style.borderRadius = this.bubbleRadius;
    if (msg.toolCalls?.length) {
      content.innerHTML = '<span class="text-blue-500 font-bold">🔧 工具调用</span><br>' + msg.text;
    } else {
      content.textContent = msg.text;
    }
    bubbleEl.appendChild(content);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add js/ui/components/main-dialogue.js js/ui/components/sidebar-chat.js js/ui/components/edit-chat.js
git commit -m "v1.0.0u04 feat: ChatArea 子类（MainDialogue, SidebarChat, EditChat）"
```

---

### Task 5: Create CrudHandler

**Covers:** S5

**Files:**
- Create: `js/ui/components/base/crud-handler.js`
- Modify: `js/engine/tool-executor.js`

- [ ] **Step 1: Create CrudHandler**

```js
// js/ui/components/base/crud-handler.js
export class CrudHandler {
  constructor(entityType, collectionPath) {
    this.entityType = entityType;
    this.collectionPath = collectionPath; // e.g. 'worldview.nodes', 'scenes', 'characters'
  }

  // 从设定集中获取集合
  getCollection(setting) {
    const parts = this.collectionPath.split('.');
    let obj = setting;
    for (const part of parts) {
      if (obj === undefined) return undefined;
      obj = obj[part];
    }
    return obj;
  }

  // 设置集合中的值
  setCollection(setting, value) {
    const parts = this.collectionPath.split('.');
    let obj = setting;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }

  // 通用 add
  add(setting, args, genId) {
    const id = args.id || genId(this.entityType, args.name);
    const entity = this.createEntity(id, args);
    const collection = this.getCollection(setting);
    if (Array.isArray(collection)) {
      collection.push(entity);
    } else {
      collection[id] = entity;
    }
    return entity;
  }

  // 通用 edit
  edit(setting, args) {
    const entity = this.find(setting, args);
    if (!entity) return { error: `${this.entityType}不存在` };
    this.applyChanges(entity, args);
    return entity;
  }

  // 通用 delete
  delete(setting, args) {
    const collection = this.getCollection(setting);
    if (Array.isArray(collection)) {
      const idx = collection.findIndex(e => e.id === this.getEntityId(args));
      if (idx === -1) return { error: `${this.entityType}不存在` };
      return collection.splice(idx, 1)[0];
    } else {
      const id = this.getEntityId(args);
      if (!collection[id]) return { error: `${this.entityType}不存在` };
      const deleted = collection[id];
      delete collection[id];
      return deleted;
    }
  }

  // 可覆写：创建实体
  createEntity(id, args) {
    return { id, ...args };
  }

  // 可覆写：查找实体
  find(setting, args) {
    const collection = this.getCollection(setting);
    const id = this.getEntityId(args);
    if (Array.isArray(collection)) {
      return collection.find(e => e.id === id);
    }
    return collection[id];
  }

  // 可覆写：应用修改
  applyChanges(entity, args) {
    for (const [key, value] of Object.entries(args)) {
      if (key !== 'id' && key !== 'lore_path' && value !== undefined) {
        entity[key] = value;
      }
    }
  }

  // 可覆写：获取实体 ID
  getEntityId(args) {
    return args.node_id || args.char_id || args.scene_id || args.item_id || args.history_id || args.geo_id || args.edge_id;
  }

  // 级联删除（子类覆写）
  cascadeDelete(setting, entityId) {
    // 默认无级联
  }
}
```

- [ ] **Step 2: Create specialized CrudHandlers**

```js
// js/ui/components/base/crud-handlers/worldview-crud.js
import { CrudHandler } from '../crud-handler.js';

export class WorldviewCrud extends CrudHandler {
  constructor() {
    super('worldview_node', 'worldview.nodes');
  }

  createEntity(id, args) {
    return {
      id,
      priority: args.priority || 99,
      name: args.name,
      tags: args.tags || ['自定义'],
      content: { description: args.content?.description || '', detail: args.content?.detail || '' }
    };
  }

  applyChanges(entity, args) {
    if (args.name) entity.name = args.name;
    if (args.priority !== undefined) entity.priority = args.priority;
    if (args.tags) entity.tags = args.tags;
    if (args.content?.description) entity.content.description = args.content.description;
    if (args.content?.detail) entity.content.detail = args.content.detail;
  }

  cascadeDelete(setting, entityId) {
    setting.worldview.edges = setting.worldview.edges.filter(
      e => e.subject !== entityId && e.object !== entityId
    );
  }

  getEntityId(args) { return args.node_id; }
}
```

类似地创建 `SceneCrud`, `CharacterCrud`, `ItemCrud`, `HistoryCrud`, `GeographyCrud`, `EdgeCrud`。

- [ ] **Step 3: Refactor tool-executor.js**

将 switch 中的 21 个 case 替换为 CrudHandler 调用：

```js
import { WorldviewCrud } from '../ui/components/base/crud-handlers/worldview-crud.js';
import { SceneCrud } from '../ui/components/base/crud-handlers/scene-crud.js';
// ... 其他 imports

const crudHandlers = {
  add_worldview_node: new WorldviewCrud(),
  edit_worldview_node: new WorldviewCrud(),
  delete_worldview_node: new WorldviewCrud(),
  add_scene: new SceneCrud(),
  // ... 其他 handlers
};

// executeTool 中：
const handler = crudHandlers[toolName];
if (handler) {
  const action = toolName.split('_')[0]; // add, edit, delete
  const result = handler[action](setting, args, DB.genId);
  if (result.error) return { error: result.error };
  await DB.loresets.put(setting);
  return { success: true, data: result };
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "v1.0.0u05 feat: CrudHandler 统一21个CRUD case"
```

---

### Task 6: Create SettingsSaver

**Covers:** S6

**Files:**
- Create: `js/ui/components/base/settings-saver.js`
- Modify: `js/ui/views/settings.js`

- [ ] **Step 1: Create SettingsSaver**

```js
// js/ui/components/base/settings-saver.js
export class SettingsSaver {
  // 通用：从 DOM 读取值并保存到 localStorage
  static save(key, domId, transform = (v) => v) {
    const el = document.getElementById(domId);
    if (!el) return;
    const value = transform(el.value || el.textContent);
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  // 通用：从 localStorage 读取值并设置到 DOM
  static load(key, domId, defaultValue = '') {
    const el = document.getElementById(domId);
    if (!el) return;
    const value = localStorage.getItem(key) || defaultValue;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.value = value;
    } else {
      el.textContent = value;
    }
  }

  // 通用：保存一组设置
  static saveGroup(configs) {
    for (const { key, domId, transform } of configs) {
      this.save(key, domId, transform);
    }
    // 保存成功提示
    const toast = document.getElementById('toast-container');
    if (toast) {
      toast.textContent = '设置已保存';
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2000);
    }
  }

  // 通用：加载一组设置
  static loadGroup(configs) {
    for (const { key, domId, defaultValue } of configs) {
      this.load(key, domId, defaultValue);
    }
  }
}
```

- [ ] **Step 2: Refactor settings save functions**

将 10+ 个 save 函数统一为配置驱动：

```js
import { SettingsSaver } from '../components/base/settings-saver.js';

// 替换 saveHyperparameters
window.saveHyperparameters = () => SettingsSaver.saveGroup([
  { key: 'temperature', domId: 'setting-temperature' },
  { key: 'topp', domId: 'setting-topp' },
  { key: 'maxtokens', domId: 'setting-maxtokens' },
]);

// 替换 saveNodePlanning
window.saveNodePlanning = () => SettingsSaver.saveGroup([
  { key: 'planner-prefix', domId: 'planner-prefix-textarea' },
  { key: 'planner-suffix', domId: 'planner-suffix-textarea' },
]);

// 替换 saveWritingPrefs
window.saveWritingPrefs = () => SettingsSaver.saveGroup([
  { key: 'writing-style', domId: 'setting-writing-style' },
  { key: 'writing-length', domId: 'setting-writing-length' },
]);

// ... 类似地替换其他 save 函数
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "v1.0.0u06 feat: SettingsSaver 统一10+个save函数"
```

---

### Task 7: Create ModelSelector

**Covers:** S7

**Files:**
- Create: `js/ui/components/base/model-selector.js`
- Modify: `js/ui/components/input-box.js`
- Modify: `js/ui/app.js`

- [ ] **Step 1: Create ModelSelector**

```js
// js/ui/components/base/model-selector.js
import { getAllModels, getDuplicateModelNames, getShortModelName } from '../../utils/model-manager.js';

export class ModelSelector {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.onSelect = options.onSelect || (() => {});
    this.compact = options.compact || false;
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const allModels = getAllModels();
    const dups = getDuplicateModelNames();
    const activeModel = window.selectedModelName || localStorage.getItem('global-active-model') || '';

    container.innerHTML = '';
    allModels.forEach(m => {
      const isActive = m.name === activeModel;
      const isGray = !m.hasKey;
      const showProvider = dups.has(m.name) && m.providerName;

      const opt = document.createElement('div');
      opt.className = `flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer${isActive ? ' active' : ''}${isGray ? ' opacity-50 cursor-not-allowed' : ''}`;
      opt.innerHTML = `
        <span class="text-[10px] ${isActive && !isGray ? 'font-bold text-blue-500' : isGray ? 'font-medium text-slate-400' : 'font-medium text-slate-600'}">
          ${getShortModelName(m.name, 32)}${showProvider ? ` <span class="text-[8px] font-normal text-slate-400">(${m.providerName})</span>` : ''}
        </span>
        ${isActive ? '<span class="text-[8px] text-blue-500 font-bold">已选</span>' : ''}
      `;

      if (!isGray) {
        opt.onclick = () => {
          window.selectedModelName = m.name;
          localStorage.setItem('global-active-model', m.name);
          this.onSelect(m.name);
          this.render();
        };
      }
      container.appendChild(opt);
    });
  }
}
```

- [ ] **Step 2: Use ModelSelector in InputBox**

在 InputBox 的模型下拉部分使用 ModelSelector：

```js
import { ModelSelector } from './base/model-selector.js';

// 在 InputBox.init() 中替换手动模型列表渲染
this.modelSelector = new ModelSelector(modelDropdownId, {
  onSelect: (name) => this.updateModel(name)
});
this.modelSelector.render();
```

- [ ] **Step 3: Use ModelSelector in quick-actions-popup**

```js
const qaModelSelector = new ModelSelector('qa-model-list', {
  onSelect: (name) => {
    window.selectedModelName = name;
    document.querySelectorAll('.model-dropdown').forEach(d => d.classList.add('hidden'));
  }
});
qaModelSelector.render();
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "v1.0.0u07 feat: ModelSelector 统一3处模型选择器"
```

---

### Task 8: Integration Test

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Verify all modules load correctly**

Open `http://localhost:3000/test-modules.html` and confirm all 25 modules load without errors.

- [ ] **Step 2: Verify main page renders**

Open `http://localhost:3000` and verify:
- Home page renders with input box and story list
- Sidebar shows collections and stories
- Popups open/close correctly
- Settings page loads and saves work

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "v1.0.0u08 test: 统一化调用集成验证通过"
```
