import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { callLLM } from '../../core/api.js';
import { LORESET_TOOLS } from '../../core/tools.js';
import { executeTool } from '../../engine/tool-executor.js';
import { createWrappedExecuteTool, UnderstandingJSON } from '../../engine/ujson.js';
import { LORESET_SYSTEM_PROMPT } from '../../prompts/system-prompts.js';
import { refreshUserConfigurablePrompts } from '../../prompts/tool-descriptions.js';
import { showToast, autoResizeTextarea, bindAutoResize } from '../utils/dom-helpers.js';

const wrappedExecuteTool = createWrappedExecuteTool(executeTool);


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

// ===== 下拉选择器组件 =====
        function getOptionsForType(type) {
          if (!state.currentData?.kg?.nodes) return [];
          const map = { worldview: 'worldview', scene: 'scene', character: 'character', item: 'prop', history: 'history', geography: 'geography' };
          const targetType = map[type] || type;
          return state.currentData.kg.nodes.filter(n => n.type === targetType && n.type !== 'root');
        }

        function createIdSelector(options, selectedId, onSelect) {
          const wrapper = document.createElement('div');
          wrapper.className = 'id-selector';
          const selected = options.find(o => o.id === selectedId);
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'id-selector-trigger';
          input.value = selected?.name || '';
          input.placeholder = '输入或选择...';
          input.style.cssText += 'cursor:text;';
          const dropdown = document.createElement('div');
          dropdown.className = 'id-selector-dropdown';

          function renderDropdown(filter) {
            dropdown.innerHTML = '';
            const q = (filter || '').toLowerCase();
            const filtered = q ? options.filter(o => o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : options;
            filtered.forEach(opt => {
              const item = document.createElement('div');
              item.className = 'id-selector-option';
              item.innerHTML = `<span class="opt-dot" style="background:${modalColorMap[opt.type] || '#94a3b8'}"></span><span class="opt-name">${opt.name}</span><span class="opt-type">${opt.type}</span>`;
              item.onmousedown = (e) => { e.preventDefault(); input.value = opt.name; dropdown.classList.remove('open'); onSelect(opt.id); };
              dropdown.appendChild(item);
            });
            if (filtered.length === 0) {
              const empty = document.createElement('div');
              empty.style.cssText = 'padding:8px;font-size:10px;color:#94a3b8;text-align:center;';
              empty.textContent = '无匹配';
              dropdown.appendChild(empty);
            }
          }

          input.addEventListener('focus', () => { renderDropdown(input.value); dropdown.classList.add('open'); });
          input.addEventListener('input', () => { renderDropdown(input.value); dropdown.classList.add('open'); });
          input.addEventListener('blur', () => { setTimeout(() => dropdown.classList.remove('open'), 150); });
          wrapper.appendChild(input);
          wrapper.appendChild(dropdown);
          return wrapper;
        }

// 点击外部关闭所有下拉
document.addEventListener('click', () => {
  document.querySelectorAll('.id-selector-dropdown.open').forEach(d => d.classList.remove('open'));
});

// ===== 标签列表组件 =====
        function createTagList(tags, onChange) {
          const wrapper = document.createElement('div');
          wrapper.className = 'tag-list';
          function render() {
            wrapper.innerHTML = '';
            (tags || []).forEach((tag, i) => {
              const el = document.createElement('span');
              el.className = 'tag-item';
              el.innerHTML = `${tag}<button class="tag-remove" title="移除"><svg class="w-2 h-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
              el.querySelector('.tag-remove').onclick = () => { tags.splice(i, 1); onChange(tags); render(); };
              wrapper.appendChild(el);
            });
            const input = document.createElement('input');
            input.className = 'tag-add-input';
            input.placeholder = '+ 标签';
            input.onkeydown = (e) => { if (e.key === 'Enter' && input.value.trim()) { tags.push(input.value.trim()); onChange(tags); render(); } };
            wrapper.appendChild(input);
          }
          render();
          return wrapper;
        }

// ===== ID 列表组件 =====
        function createIdList(ids, type, onChange) {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.flexWrap = 'wrap';
          wrapper.style.alignItems = 'center';
          wrapper.style.gap = '4px';
          const options = getOptionsForType(type);
          function render() {
            wrapper.innerHTML = '';
            (ids || []).forEach((id, i) => {
              const opt = options.find(o => o.id === id);
              const el = document.createElement('span');
              el.className = 'id-list-item';
              el.innerHTML = `<span class="opt-dot" style="background:${modalColorMap[opt?.type] || '#94a3b8'};width:5px;height:5px;border-radius:3px;flex-shrink:0"></span>${opt?.name || id}<button class="id-remove" title="移除"><svg class="w-2 h-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
              el.querySelector('.id-remove').onclick = () => { ids.splice(i, 1); onChange(ids); render(); };
              wrapper.appendChild(el);
            });
            const addBtn = document.createElement('button');
            addBtn.className = 'id-add-btn';
            addBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>添加`;
            addBtn.onclick = (e) => {
              e.stopPropagation();
              const selector = createIdSelector(options, null, (selectedId) => { if (!ids.includes(selectedId)) { ids.push(selectedId); onChange(ids); render(); } selector.remove(); });
              addBtn.parentNode.insertBefore(selector, addBtn);
            };
            wrapper.appendChild(addBtn);
          }
          render();
          return wrapper;
        }

// ===== 关系列表组件 =====
        function createRelList(relations, onChange) {
          const wrapper = document.createElement('div');
          const charOptions = getOptionsForType('character');
          function render() {
            wrapper.innerHTML = '';
            (relations || []).forEach((rel, i) => {
              const el = document.createElement('div');
              el.className = 'rel-entry';
              const subSel = createIdSelector(charOptions, rel.subject, (id) => { relations[i].subject = id; onChange(relations); render(); });
              const relInput = document.createElement('input');
              relInput.type = 'text'; relInput.value = rel.relation || ''; relInput.style.cssText = 'width:60px;height:22px;border:1px solid #e2e8f0;border-radius:6px;padding:0 6px;font-size:10px;outline:none;';
              relInput.onchange = () => { relations[i].relation = relInput.value; onChange(relations); };
              const arrow = document.createElement('span'); arrow.className = 'rel-arrow'; arrow.textContent = '→';
              const objSel = createIdSelector(charOptions, rel.object, (id) => { relations[i].object = id; onChange(relations); render(); });
              const impInput = document.createElement('input');
              impInput.type = 'text'; impInput.value = rel.impression || ''; impInput.placeholder = '印象'; impInput.style.cssText = 'flex:1;min-width:60px;height:22px;border:1px solid #e2e8f0;border-radius:6px;padding:0 6px;font-size:10px;outline:none;';
              impInput.onchange = () => { relations[i].impression = impInput.value; onChange(relations); };
              const removeBtn = document.createElement('button');
              removeBtn.className = 'id-remove'; removeBtn.title = '移除';
              removeBtn.innerHTML = '<svg class="w-2 h-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
              removeBtn.onclick = () => { relations.splice(i, 1); onChange(relations); render(); };
              el.append(subSel, arrow, relInput, arrow.cloneNode(true), objSel, impInput, removeBtn);
              wrapper.appendChild(el);
            });
            const addBtn = document.createElement('button');
            addBtn.className = 'id-add-btn';
            addBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>添加关系';
            addBtn.onclick = () => { relations.push({ subject: '', relation: '', object: '', impression: '' }); onChange(relations); render(); };
            wrapper.appendChild(addBtn);
          }
          render();
          return wrapper;
        }

// ===== cognition 子字段组件 =====
        function createCognitionEditor(cognition, onChange) {
          const wrapper = document.createElement('div');
          const subFields = [
            { key: 'worldview_blacklist', label: '世界观黑名单', type: 'worldview' },
            { key: 'events', label: '已知事件', type: 'history' },
            { key: 'items', label: '已知道具', type: 'item' }
          ];
          function render() {
            wrapper.innerHTML = '';
            subFields.forEach(sf => {
              const group = document.createElement('div');
              group.className = 'field-group';
              const label = document.createElement('label');
              label.textContent = sf.label;
              group.appendChild(label);
              const ids = cognition[sf.key] || [];
              const list = createIdList(ids, sf.type, (newIds) => { cognition[sf.key] = newIds; onChange(cognition); });
              group.appendChild(list);
              wrapper.appendChild(group);
            });
            const charGroup = document.createElement('div');
            charGroup.className = 'field-group';
            const charLabel = document.createElement('label');
            charLabel.textContent = '角色认知';
            charGroup.appendChild(charLabel);
            const chars = cognition.characters || {};
            const charOptions = getOptionsForType('character');
            Object.entries(chars).forEach(([charId, impression]) => {
              const row = document.createElement('div');
              row.className = 'rel-entry';
              const sel = createIdSelector(charOptions, charId, (newId) => { if (newId !== charId) { delete cognition.characters[charId]; cognition.characters[newId] = impression; } onChange(cognition); render(); });
              const impInput = document.createElement('input');
              impInput.type = 'text'; impInput.value = impression; impInput.placeholder = '认知印象'; impInput.style.cssText = 'flex:1;height:22px;border:1px solid #e2e8f0;border-radius:6px;padding:0 6px;font-size:10px;outline:none;';
              impInput.onchange = () => { cognition.characters[charId] = impInput.value; onChange(cognition); };
              const removeBtn = document.createElement('button');
              removeBtn.className = 'id-remove';
              removeBtn.innerHTML = '<svg class="w-2 h-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
              removeBtn.onclick = () => { delete cognition.characters[charId]; onChange(cognition); render(); };
              row.append(sel, impInput, removeBtn);
              charGroup.appendChild(row);
            });
            const addCharBtn = document.createElement('button');
            addCharBtn.className = 'id-add-btn';
            addCharBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>添加角色认知';
            addCharBtn.onclick = () => { cognition.characters = cognition.characters || {}; cognition.characters[''] = ''; onChange(cognition); render(); };
            charGroup.appendChild(addCharBtn);
            wrapper.appendChild(charGroup);
          }
          render();
          return wrapper;
        }

// ===== 编辑模态框 =====
        function openEditModal(node) {
          const overlay = document.getElementById('edit-modal-overlay');
          const dot = document.getElementById('edit-modal-type-dot');
          const title = document.getElementById('edit-modal-title');
          const label = document.getElementById('edit-modal-type-label');
          const body = document.getElementById('edit-modal-body');

          dot.style.backgroundColor = modalColorMap[node.type] || '#94a3b8';
          title.textContent = node.name;
          title.style.display = '';
          const nameInput = document.getElementById('edit-modal-title-input');
          if (nameInput) nameInput.remove();
          label.textContent = modalTypeLabels[node.type] || node.type;
          label.className = 'border ' + (modalTypeLabelColors[node.type] || 'text-slate-600 bg-slate-50 border-slate-200');
          label.className += ' text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0';

          body.innerHTML = `
            <div class="modal-panel" id="modal-panel-tl"></div>
            <div class="modal-panel" id="modal-panel-tr" style="position:relative;overflow:hidden;">
              <div id="modal-kg-topbar">
                <span id="modal-kg-topbar-left">Graph</span>
                <div id="modal-kg-topbar-right">
                  <button class="kg-topbar-btn" onclick="openKgSubModal('add')" title="添加关联">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                  </button>
                  <button class="kg-topbar-btn" onclick="openKgSubModal('remove')" title="移除关联">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg>
                  </button>
                  <button class="kg-topbar-btn" onclick="openKgSubModal('list')" title="关联列表">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                  </button>
                </div>
              </div>
              <svg id="modal-kg-svg" style="width:100%;height:100%;"></svg>
            </div>
            <div class="modal-panel modal-panel-bottom" id="modal-panel-bottom">
              <div class="field-sidebar" id="field-sidebar"></div>
              <div class="field-editor" id="field-editor"></div>
            </div>`;

          loadNodeFullData(node).then(fullData => {
            window._editingNode = node;
            window._editingNodeFull = fullData;
            renderAttrPanel(node, fullData);
            renderFieldSidebar(node.type);
            const fields = EDIT_FIELDS[node.type] || [];
            if (fields.length > 0) selectField(fields[0].key);
            renderModalGraph(node, fullData);
          });

          overlay.classList.add('open');
        }

        async function loadNodeFullData(node) {
          let setting = null;
          if (state.currentLoreSetId) setting = await DB.loresets.getById(state.currentLoreSetId);
          if (!setting && state.currentCollectionId) setting = await DB.loresets.getById(state.currentCollectionId);
          if (!setting) return {};
          const n = node;
          if (n.type === 'worldview') return setting.worldview?.nodes?.find(x => x.id === n.id) || {};
          if (n.type === 'history') return setting.worldview?.history?.find(x => x.id === n.id) || {};
          if (n.type === 'geography') return setting.worldview?.geography?.find(x => x.id === n.id) || {};
          if (n.type === 'scene') return setting.scenes?.[n.id] || {};
          if (n.type === 'character') return setting.characters?.[n.id] || {};
          if (n.type === 'item') return setting.items?.[n.id] || {};
          return {};
        }

// ===== 图谱子模态窗口 =====
        function openKgSubModal(mode) {
          const overlay = document.getElementById('kg-sub-modal-overlay');
          const title = document.getElementById('kg-sub-modal-title');
          const body = document.getElementById('kg-sub-modal-body');
          if (!overlay || !title || !body) return;
          const node = window._editingNode;
          if (!node) return;
          const titles = { add: '添加关联', remove: '移除关联', list: '关联列表' };
          title.textContent = titles[mode] || '';
          body.innerHTML = '';
          _kgSubDir = 'forward';
          window._kgSubTargetId = null;
          if (mode === 'add') renderKgAddContent(node, body);
          else if (mode === 'remove') renderKgRemoveContent(node, body);
          else if (mode === 'list') renderKgListContent(node, body);
          overlay.classList.add('open');
        }

        function renderKgAddContent(node, container) {
          const row = document.createElement('div');
          row.id = 'kg-add-row';
          row.style.cssText = 'display:flex;align-items:center;gap:10px;justify-content:center;';
          container.appendChild(row);
          renderKgArrowRow(node, row);
          const relArea = document.createElement('div');
          relArea.id = 'kg-add-rel-area';
          relArea.style.cssText = 'margin-top:20px;';
          container.appendChild(relArea);
          renderKgRelArea(node, relArea);
          const btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:20px;';
          const cancelBtn = document.createElement('button');
          cancelBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:1px solid #e2e8f0;background:white;font-size:10px;font-weight:700;color:#64748b;cursor:pointer;';
          cancelBtn.textContent = '取消';
          cancelBtn.onclick = closeKgSubModal;
          const addBtn = document.createElement('button');
          addBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:none;background:#3b82f6;font-size:10px;font-weight:700;color:white;cursor:pointer;';
          addBtn.textContent = '添加';
          addBtn.onclick = () => submitKgAdd(node);
          btnRow.append(cancelBtn, addBtn);
          container.appendChild(btnRow);
        }

        function renderKgArrowRow(node, row) {
          row.innerHTML = '';
          const currentName = (node.name || node.id).substring(0, 10);
          const nameEl = document.createElement('span');
          nameEl.style.cssText = 'font-size:11px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;';
          nameEl.textContent = currentName;
          const allOptions = (state.currentData?.kg?.nodes || []).filter(n => n.type !== 'root' && n.id !== node.id);
          const selector = createIdSelector(allOptions, null, (id) => { window._kgSubTargetId = id; });
          selector.style.flex = '1';
          selector.style.minWidth = '0';
          const arrowWrap = document.createElement('div');
          arrowWrap.style.cssText = 'position:relative;flex-shrink:0;display:flex;align-items:center;';
          const toggleBtn = document.createElement('button');
          toggleBtn.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:9px;border:1px solid #e2e8f0;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;';
          toggleBtn.title = '切换方向';
          toggleBtn.innerHTML = '<svg width="10" height="10" fill="none" stroke="#64748b" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
          const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          arrowSvg.setAttribute('width', '60');
          arrowSvg.setAttribute('height', '10');
          arrowSvg.setAttribute('viewBox', '0 0 60 10');
          arrowSvg.style.cssText = 'transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);transform-origin:30px 5px;';
          arrowSvg.innerHTML = '<line x1="4" y1="5" x2="56" y2="5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/><line x1="56" y1="5" x2="48" y2="1.5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>';
          if (_kgSubDir !== 'forward') arrowSvg.style.transform = 'rotate(180deg)';
          toggleBtn.onclick = () => { _kgSubDir = _kgSubDir === 'forward' ? 'backward' : 'forward'; arrowSvg.style.transform = _kgSubDir === 'forward' ? 'rotate(0deg)' : 'rotate(180deg)'; };
          arrowWrap.append(toggleBtn, arrowSvg);
          row.append(nameEl, arrowWrap, selector);
        }

        function renderKgRelArea(node, area) {
          area.innerHTML = '';
          const type = node.type;
          if (type === 'worldview' || type === 'item') {
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = '关系'; g.appendChild(l);
            const t = document.createElement('input'); t.type = 'text'; t.id = 'kg-add-rel-text';
            t.placeholder = '如：控制、敌对、导致、属于...';
            t.style.cssText = 'width:100%;height:32px;border:1px solid #e2e8f0;border-radius:10px;padding:0 10px;font-size:11px;font-weight:500;color:#334155;outline:none;box-sizing:border-box;';
            g.appendChild(t);
            area.appendChild(g);
            return;
          }
          if (type === 'scene' || type === 'geography' || type === 'history') {
            const fixed = { scene: '位于', geography: '归属', history: '关联' }[type];
            const el = document.createElement('div');
            el.style.cssText = 'font-size:11px;font-weight:600;color:#334155;padding:8px 0;';
            el.textContent = '关系：' + fixed;
            area.appendChild(el);
            return;
          }
          if (type === 'character') {
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:1fr 2fr;gap:10px;';
            const g1 = document.createElement('div'); g1.className = 'field-group';
            const l1 = document.createElement('label'); l1.textContent = '关系概要'; g1.appendChild(l1);
            const t1 = document.createElement('input'); t1.type = 'text'; t1.id = 'kg-add-rel-summary';
            t1.placeholder = '如：朋友、敌人';
            t1.style.cssText = 'width:100%;height:32px;border:1px solid #e2e8f0;border-radius:10px;padding:0 10px;font-size:11px;font-weight:500;color:#334155;outline:none;box-sizing:border-box;';
            g1.appendChild(t1);
            const g2 = document.createElement('div'); g2.className = 'field-group';
            const l2 = document.createElement('label'); l2.textContent = '关系描述'; g2.appendChild(l2);
            const t2 = document.createElement('textarea'); t2.id = 'kg-add-rel-desc'; t2.rows = 2; t2.placeholder = '详细描述...';
            t2.style.cssText = 'width:100%;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:500;color:#334155;outline:none;resize:none;overflow:hidden;line-height:1.5;box-sizing:border-box;';
            bindAutoResize(t2);
            g2.appendChild(t2);
            row.append(g1, g2);
            area.appendChild(row);
          }
        }

        async function getNodeRelations(node) {
          const setting = state.currentLoreSetId ? await DB.loresets.getById(state.currentLoreSetId) : null;
          if (!setting) return [];
          const relations = [];
          const nodeId = node.id;
          for (const e of (setting.worldview?.edges || [])) {
            if (e.subject === nodeId || e.object === nodeId) {
              relations.push({ source: e.subject, target: e.object, label: e.relation, type: 'edge', id: e.id });
            }
          }
          if (node.type === 'character') {
            const char = setting.characters?.[nodeId];
            if (char) {
              for (const r of (char.default?.relationship || [])) relations.push({ source: r.subject, target: r.object, label: r.relation, desc: r.impression, type: 'relationship' });
              for (const itemId of (char.default?.inventory || [])) relations.push({ source: nodeId, target: itemId, label: '持有', type: 'inventory' });
            }
          }
          if (node.type === 'scene') {
            const scene = setting.scenes?.[nodeId];
            if (scene) {
              for (const geoId of (scene.default?.position || [])) relations.push({ source: nodeId, target: geoId, label: '位于', type: 'position' });
              for (const itemId of (scene.default?.items || [])) relations.push({ source: nodeId, target: itemId, label: '含有', type: 'items' });
            }
          }
          if (node.type === 'geography') {
            const geo = setting.worldview?.geography?.find(g => g.id === nodeId);
            if (geo) {
              if (geo.father) relations.push({ source: nodeId, target: geo.father, label: '归属', type: 'father' });
              for (const nid of (geo.neighbors || [])) relations.push({ source: nodeId, target: nid, label: '相邻', type: 'neighbor' });
            }
          }
          if (node.type === 'history') {
            const hist = setting.worldview?.history?.find(h => h.id === nodeId);
            if (hist) { for (const cid of (hist.connection || [])) relations.push({ source: nodeId, target: cid, label: '关联', type: 'connection' }); }
          }
          return relations;
        }

        function getNodeShortName(id) {
          const n = state.currentData?.kg?.nodes?.find(n => n.id === id);
          return n?.name || id;
        }

        async function renderKgRemoveContent(node, container) {
          const relations = await getNodeRelations(node);
          if (relations.length === 0) { container.innerHTML = '<div style="color:#94a3b8;font-size:11px;text-align:center;padding:40px 0;">暂无关联可移除</div>'; return; }
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;';
          let selectedIdx = -1;
          const items = [];
          relations.forEach((rel, i) => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;cursor:pointer;transition:all 0.15s;';
            const srcName = document.createElement('span'); srcName.style.cssText = 'font-size:10px;font-weight:600;color:#1e293b;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; srcName.textContent = getNodeShortName(rel.source);
            const label = document.createElement('span'); label.style.cssText = 'font-size:9px;font-weight:700;color:#94a3b8;padding:2px 6px;background:#f8fafc;border-radius:4px;white-space:nowrap;'; label.textContent = rel.label;
            const arrow = document.createElement('span'); arrow.style.cssText = 'font-size:9px;color:#cbd5e1;'; arrow.textContent = '→';
            const tgtName = document.createElement('span'); tgtName.style.cssText = 'font-size:10px;font-weight:600;color:#1e293b;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; tgtName.textContent = getNodeShortName(rel.target);
            item.append(srcName, label, arrow, tgtName);
            item.onclick = () => { items.forEach(it => { it.style.borderColor = '#e2e8f0'; it.style.background = 'white'; }); item.style.borderColor = '#93c5fd'; item.style.background = '#eff6ff'; selectedIdx = i; };
            list.appendChild(item);
            items.push(item);
          });
          container.appendChild(list);
          const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
          const cancelBtn = document.createElement('button'); cancelBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:1px solid #e2e8f0;background:white;font-size:10px;font-weight:700;color:#64748b;cursor:pointer;'; cancelBtn.textContent = '取消'; cancelBtn.onclick = closeKgSubModal;
          const removeBtn = document.createElement('button'); removeBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:none;background:#ef4444;font-size:10px;font-weight:700;color:white;cursor:pointer;'; removeBtn.textContent = '移除';
          removeBtn.onclick = async () => { if (selectedIdx < 0) { showToast('请选择要移除的关联'); return; } await removeRelation(node, relations[selectedIdx]); await renderModalGraph(node, window._editingNodeFull); closeKgSubModal(); };
          btnRow.append(cancelBtn, removeBtn);
          container.appendChild(btnRow);
        }

        async function removeRelation(node, rel) {
          if (!state.currentLoreSetId) return;
          const setting = await DB.loresets.getById(state.currentLoreSetId);
          if (!setting) return;
          if (rel.type === 'edge') { const idx = setting.worldview.edges.findIndex(e => e.id === rel.id); if (idx !== -1) setting.worldview.edges.splice(idx, 1); }
          else if (rel.type === 'relationship') { const char = setting.characters?.[node.id]; if (char) { const rels = char.default?.relationship || []; const idx = rels.findIndex(r => r.subject === rel.source && r.object === rel.target && r.relation === rel.label); if (idx !== -1) rels.splice(idx, 1); char.default.relationship = rels; } }
          else if (rel.type === 'inventory') { const char = setting.characters?.[node.id]; if (char) { const inv = char.default?.inventory || []; const idx = inv.indexOf(rel.target); if (idx !== -1) inv.splice(idx, 1); char.default.inventory = inv; } }
          else if (rel.type === 'position') { const scene = setting.scenes?.[node.id]; if (scene) { const pos = scene.default?.position || []; const idx = pos.indexOf(rel.target); if (idx !== -1) pos.splice(idx, 1); scene.default.position = pos; } }
          else if (rel.type === 'items') { const scene = setting.scenes?.[node.id]; if (scene) { const items = scene.default?.items || []; const idx = items.indexOf(rel.target); if (idx !== -1) items.splice(idx, 1); scene.default.items = items; } }
          else if (rel.type === 'father') { const geo = setting.worldview?.geography?.find(g => g.id === node.id); if (geo) geo.father = null; }
          else if (rel.type === 'neighbor') { const geo = setting.worldview?.geography?.find(g => g.id === node.id); if (geo) { const nb = geo.neighbors || []; const idx = nb.indexOf(rel.target); if (idx !== -1) nb.splice(idx, 1); geo.neighbors = nb; } }
          else if (rel.type === 'connection') { const hist = setting.worldview?.history?.find(h => h.id === node.id); if (hist) { const conn = hist.connection || []; const idx = conn.indexOf(rel.target); if (idx !== -1) conn.splice(idx, 1); hist.connection = conn; } }
          await DB.loresets.put(setting);
          window._editingNodeFull = await loadNodeFullData(node);
        }

        async function renderKgListContent(node, container) {
          const relations = await getNodeRelations(node);
          if (relations.length === 0) { container.innerHTML = '<div style="color:#94a3b8;font-size:11px;text-align:center;padding:40px 0;">暂无关联</div>'; return; }
          const list = document.createElement('div');
          list.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:360px;overflow-y:auto;';
          relations.forEach(rel => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;background:white;';
            const srcName = document.createElement('span'); srcName.style.cssText = 'font-size:10px;font-weight:600;color:#1e293b;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; srcName.textContent = getNodeShortName(rel.source);
            const label = document.createElement('span'); label.style.cssText = 'font-size:9px;font-weight:700;color:#94a3b8;padding:2px 6px;background:#f8fafc;border-radius:4px;white-space:nowrap;'; label.textContent = rel.label;
            const arrow = document.createElement('span'); arrow.style.cssText = 'font-size:9px;color:#cbd5e1;'; arrow.textContent = '→';
            const tgtName = document.createElement('span'); tgtName.style.cssText = 'font-size:10px;font-weight:600;color:#1e293b;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; tgtName.textContent = getNodeShortName(rel.target);
            item.append(srcName, label, arrow, tgtName);
            if (rel.desc) { const desc = document.createElement('span'); desc.style.cssText = 'font-size:9px;color:#94a3b8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; desc.textContent = rel.desc; item.appendChild(desc); }
            list.appendChild(item);
          });
          container.appendChild(list);
          const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:16px;';
          const closeBtn = document.createElement('button'); closeBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:1px solid #e2e8f0;background:white;font-size:10px;font-weight:700;color:#64748b;cursor:pointer;'; closeBtn.textContent = '关闭'; closeBtn.onclick = closeKgSubModal;
          btnRow.appendChild(closeBtn);
          container.appendChild(btnRow);
        }

        async function submitKgAdd(node) {
          const targetId = window._kgSubTargetId;
          if (!targetId) { showToast('请选择目标节点'); return; }
          const isFwd = _kgSubDir === 'forward';
          const subjectId = isFwd ? node.id : targetId;
          const objectId = isFwd ? targetId : node.id;
          const setting = state.currentLoreSetId ? await DB.loresets.getById(state.currentLoreSetId) : null;
          if (!setting) return;
          const type = node.type;
          if (type === 'worldview' || type === 'item') {
            const relation = document.getElementById('kg-add-rel-text')?.value?.trim();
            if (!relation) { showToast('请填写关系'); return; }
            const edgeId = 'edge_' + subjectId + '_' + objectId;
            setting.worldview.edges.push({ id: edgeId, subject: subjectId, relation, object: objectId });
          } else if (type === 'character') {
            const summary = document.getElementById('kg-add-rel-summary')?.value?.trim();
            const desc = document.getElementById('kg-add-rel-desc')?.value?.trim();
            if (!summary) { showToast('请填写关系概要'); return; }
            const char = setting.characters?.[node.id];
            if (char) { const rels = char.default?.relationship || []; rels.push({ subject: node.id, relation: summary, object: targetId, impression: desc || '' }); char.default.relationship = rels; }
          } else if (type === 'scene') {
            const scene = setting.scenes?.[node.id];
            if (scene) { const pos = scene.default?.position || []; if (!pos.includes(targetId)) pos.push(targetId); scene.default.position = pos; }
          } else if (type === 'geography') {
            const geo = setting.worldview?.geography?.find(g => g.id === node.id);
            if (geo) geo.father = targetId;
          } else if (type === 'history') {
            const hist = setting.worldview?.history?.find(h => h.id === node.id);
            if (hist) { const conn = hist.connection || []; if (!conn.includes(targetId)) conn.push(targetId); hist.connection = conn; }
          }
          await DB.loresets.put(setting);
          window._editingNodeFull = await loadNodeFullData(node);
          await renderModalGraph(node, window._editingNodeFull);
          closeKgSubModal();
        }

        function closeKgSubModal(event) {
          if (event && event.target !== document.getElementById('kg-sub-modal-overlay')) return;
          document.getElementById('kg-sub-modal-overlay').classList.remove('open');
        }

// ESC 关闭子模态窗和编辑模态框
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sub = document.getElementById('kg-sub-modal-overlay');
    if (sub && sub.classList.contains('open')) { closeKgSubModal(); return; }
    const editModal = document.getElementById('edit-modal-overlay');
    if (editModal && editModal.classList.contains('open')) { closeEditModal(); return; }
  }
});

// ===== 图谱渲染 =====
        function buildGraphData(currentNode, fullData, setting) {
          const nodes = []; const links = []; const nodeMap = new Map();
          function addNode(id, name, type) { if (!id || nodeMap.has(id)) return; nodeMap.set(id, true); nodes.push({ id, name: name || id, type: type || 'worldview', desc: '' }); }
          function addLink(source, target, label) { if (source && target && source !== target) links.push({ source, target, label: label || '' }); }
          addNode(currentNode.id, currentNode.name, currentNode.type);
          const selfNode = nodes.find(n => n.id === currentNode.id);
          if (selfNode) selfNode.desc = fullData.content?.description || fullData.default?.persona || '';
          if (!setting) return { nodes, links };
          for (const e of (setting.worldview?.edges || [])) { if (e.subject === currentNode.id || e.object === currentNode.id) { const otherId = e.subject === currentNode.id ? e.object : e.subject; addNode(otherId, findNodeName(setting, otherId), findNodeType(setting, otherId)); addLink(e.subject, e.object, e.relation); } }
          if (currentNode.type === 'character') {
            const rels = getFullFieldValue(fullData, 'relationship') || [];
            for (const r of rels) { addNode(r.subject, findNodeName(setting, r.subject), 'character'); addNode(r.object, findNodeName(setting, r.object), 'character'); addLink(r.subject, r.object, r.relation); }
            const inv = getFullFieldValue(fullData, 'inventory') || [];
            for (const itemId of inv) { addNode(itemId, findNodeName(setting, itemId), 'item'); addLink(currentNode.id, itemId, '持有'); }
          }
          if (currentNode.type === 'scene') {
            const pos = fullData.default?.position || fullData.position || [];
            for (const geoId of pos) { addNode(geoId, findNodeName(setting, geoId), 'geography'); addLink(currentNode.id, geoId, '位于'); }
            const items = fullData.default?.items || fullData.items || [];
            for (const itemId of items) { addNode(itemId, findNodeName(setting, itemId), 'item'); addLink(currentNode.id, itemId, '含有'); }
          }
          if (currentNode.type === 'geography') {
            if (fullData.father) { addNode(fullData.father, findNodeName(setting, fullData.father), 'geography'); addLink(currentNode.id, fullData.father, '归属'); }
            for (const nid of (fullData.neighbors || [])) { addNode(nid, findNodeName(setting, nid), 'geography'); addLink(currentNode.id, nid, '相邻'); }
          }
          if (currentNode.type === 'history') { for (const cid of (fullData.connection || [])) { addNode(cid, findNodeName(setting, cid), 'worldview'); addLink(currentNode.id, cid, '关联'); } }
          return { nodes, links };
        }

        function findNodeName(setting, id) {
          const wn = setting.worldview?.nodes?.find(n => n.id === id); if (wn) return wn.name;
          const sc = setting.scenes?.[id]; if (sc) return sc.name;
          const ch = setting.characters?.[id]; if (ch) return ch.name;
          const it = setting.items?.[id]; if (it) return it.name;
          const hi = setting.worldview?.history?.find(h => h.id === id); if (hi) return hi.id;
          const ge = setting.worldview?.geography?.find(g => g.id === id); if (ge) return ge.id;
          return id;
        }

        function findNodeType(setting, id) {
          if (setting.worldview?.nodes?.find(n => n.id === id)) return 'worldview';
          if (setting.scenes?.[id]) return 'scene';
          if (setting.characters?.[id]) return 'character';
          if (setting.items?.[id]) return 'item';
          if (setting.worldview?.history?.find(h => h.id === id)) return 'history';
          if (setting.worldview?.geography?.find(g => g.id === id)) return 'geography';
          return 'worldview';
        }

        async function renderModalGraph(node, fullData) {
          let setting = null;
          if (state.currentLoreSetId) setting = await DB.loresets.getById(state.currentLoreSetId);
          if (!setting && state.currentCollectionId) setting = await DB.loresets.getById(state.currentCollectionId);
          const graphData = buildGraphData(node, fullData, setting);
          if (state._modalKG) { state._modalKG.destroy(); state._modalKG = null; }
          if (graphData.nodes.length <= 1) {
            const svg = document.getElementById('modal-kg-svg');
            if (svg) svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="600" fill="#cbd5e1">暂无关联</text>';
            return;
          }

          // 延迟渲染，等待模态窗 CSS 动画完成（overlay 250ms + panel 350ms）
          await new Promise(r => setTimeout(r, 400));

          state._modalKG = new window.KGEngine('#modal-kg-svg', {
            colorMap: { worldview: '#2dd4bf', character: '#fb7185', scene: '#fb923c', item: '#818cf8', geography: '#a78bfa', history: '#fbbf24', root: '#3b82f6' },
            radiusMap: { worldview: 7, character: 7, scene: 7, item: 7, geography: 7, history: 7, root: 12 },
            showDetailPanel: false,
            showEdgeLabels: true,
            filterRootType: '__none__',
            onNodeClick: null,
            onBgClick: null,
          });
          state._modalKG.render(graphData);
          setTimeout(() => { if (state._modalKG) state._modalKG.focusNode(node.id); }, 300);
        }

        function renderAttrPanel(node, fullData) {
          const panel = document.getElementById('modal-panel-tl');
          if (!panel) return;
          panel.innerHTML = '';
          const fields = ATTR_FIELDS[node.type] || [];
          const grid = document.createElement('div');
          grid.className = 'attr-grid';
          for (const [key, label] of fields) {
            const val = fullData[key];
            const displayVal = (val === undefined || val === null) ? '—' : Array.isArray(val) ? (val.length > 0 ? val.join(', ') : '—') : typeof val === 'object' ? JSON.stringify(val) : String(val);
            const isEditable = key !== 'id';
            const labelEl = document.createElement('span');
            labelEl.className = 'attr-label';
            labelEl.textContent = label;
            if (isEditable) {
              labelEl.style.cursor = 'pointer'; labelEl.style.transition = 'color 0.15s ease';
              labelEl.addEventListener('mouseenter', () => { labelEl.style.color = '#3b82f6'; });
              labelEl.addEventListener('mouseleave', () => { labelEl.style.color = ''; });
              labelEl.title = '点击编辑';
              labelEl.onclick = () => startAttrEdit(key, valCell, valText, fullData);
            }
            grid.appendChild(labelEl);
            const valCell = document.createElement('div');
            valCell.style.display = 'flex'; valCell.style.alignItems = 'center'; valCell.style.gap = '4px'; valCell.style.minWidth = '0';
            const valText = document.createElement('span');
            valText.className = 'attr-value';
            if (isEditable) { valText.style.cursor = 'pointer'; valText.title = '点击编辑'; }
            valText.textContent = displayVal;
            if (isEditable) valText.onclick = () => startAttrEdit(key, valCell, valText, fullData);
            valCell.appendChild(valText);
            grid.appendChild(valCell);
          }
          panel.appendChild(grid);
        }

        function startAttrEdit(key, valCell, valText, fullData) {
          if (valCell.querySelector('textarea, input, .tag-list')) return;
          valText.style.display = 'none';
          const oldVal = fullData[key];
          const isArr = Array.isArray(oldVal);
          function commit(display) { valText.textContent = display ?? '—'; valText.style.display = ''; }
          if (key === 'tags' && isArr) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'animation:nameInputIn 0.25s cubic-bezier(0.4,0,0.2,1);';
            wrapper.appendChild(createTagList([...oldVal], (newTags) => { fullData.tags = newTags; }));
            valCell.appendChild(wrapper);
            const handler = (e) => { if (!valCell.contains(e.target)) { wrapper.remove(); commit((fullData.tags || []).join(', ')); document.removeEventListener('mousedown', handler); } };
            setTimeout(() => document.addEventListener('mousedown', handler), 0);
            return;
          }
          if (key === 'items') {
            const items = oldVal || fullData.default?.items || [];
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'animation:nameInputIn 0.25s cubic-bezier(0.4,0,0.2,1);';
            wrapper.appendChild(createIdList([...items], 'item', (newIds) => { if (fullData.default) fullData.default.items = newIds; else fullData.items = newIds; }));
            valCell.appendChild(wrapper);
            const handler = (e) => { if (!valCell.contains(e.target)) { wrapper.remove(); const v = fullData.default?.items || fullData.items || []; commit(v.join(', ')); document.removeEventListener('mousedown', handler); } };
            setTimeout(() => document.addEventListener('mousedown', handler), 0);
            return;
          }
          const input = document.createElement('textarea');
          input.value = oldVal !== undefined && oldVal !== null ? String(oldVal) : '';
          input.rows = 1;
          input.style.cssText = 'flex:1;min-width:20px;max-width:100%;border:none;border-bottom:1.5px solid #3b82f6;border-radius:0;padding:0;background:transparent;font-size:10px;font-weight:600;color:#334155;outline:none;resize:none;overflow:hidden;line-height:22px;box-sizing:border-box;animation:nameInputIn 0.25s cubic-bezier(0.4,0,0.2,1);';
          let measure = document.getElementById('attr-measure');
          if (!measure) { measure = document.createElement('span'); measure.id = 'attr-measure'; measure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:10px;font-weight:600;padding:0;'; document.body.appendChild(measure); }
          function syncSize() { measure.textContent = input.value || ' '; input.style.width = Math.max(measure.offsetWidth + 4, 20) + 'px'; input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; }
          valCell.appendChild(input);
          syncSize();
          input.focus();
          input.addEventListener('input', syncSize);
          let committed = false;
          const done = () => { if (committed) return; committed = true; if (key === 'priority' || key === 'layer') { fullData[key] = parseInt(input.value) || 0; } else { fullData[key] = input.value; } input.remove(); commit(fullData[key]); };
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); } if (e.key === 'Escape') { committed = true; input.remove(); commit(oldVal); } });
          input.addEventListener('blur', done);
        }

        function renderFieldSidebar(nodeType) {
          const sidebar = document.getElementById('field-sidebar');
          if (!sidebar) return;
          const fields = EDIT_FIELDS[nodeType] || [];
          sidebar.innerHTML = '';
          fields.forEach(f => {
            const item = document.createElement('div');
            item.className = 'field-sidebar-item';
            item.textContent = f.label;
            item.dataset.key = f.key;
            item.onclick = () => selectField(f.key);
            sidebar.appendChild(item);
          });
        }

        function selectField(fieldKey) {
          document.querySelectorAll('#field-sidebar .field-sidebar-item').forEach(el => { el.classList.toggle('active', el.dataset.key === fieldKey); });
          renderFieldEditor(fieldKey);
        }

        function getFullFieldValue(fullData, key) {
          if (fullData[key] !== undefined) return fullData[key];
          if (fullData.default?.[key] !== undefined) return fullData.default[key];
          return undefined;
        }

        function setFullFieldValue(fullData, key, val) {
          if (fullData.default && fullData.default[key] !== undefined) fullData.default[key] = val;
          else if (fullData[key] !== undefined) fullData[key] = val;
          else if (fullData.default) fullData.default[key] = val;
          else fullData[key] = val;
        }

        function renderFieldEditor(fieldKey) {
          const editor = document.getElementById('field-editor');
          if (!editor) return;
          editor.innerHTML = '';
          const fullData = window._editingNodeFull || {};
          if (fieldKey === 'content') {
            const g1 = document.createElement('div'); g1.className = 'field-group';
            const l1 = document.createElement('label'); l1.textContent = 'Description'; g1.appendChild(l1);
            const t1 = document.createElement('textarea'); t1.id = 'field-content-desc'; t1.rows = 3; t1.value = fullData.content?.description || ''; g1.appendChild(t1); bindAutoResize(t1);
            const g2 = document.createElement('div'); g2.className = 'field-group';
            const l2 = document.createElement('label'); l2.textContent = 'Detail'; g2.appendChild(l2);
            const t2 = document.createElement('textarea'); t2.id = 'field-content-detail'; t2.rows = 8; t2.value = fullData.content?.detail || ''; g2.appendChild(t2); bindAutoResize(t2);
            editor.append(g1, g2);
          } else if (fieldKey === 'items') {
            const items = getFullFieldValue(fullData, 'items') || [];
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = '场景内道具'; g.appendChild(l);
            g.appendChild(createIdList([...items], 'item', (newIds) => { setFullFieldValue(fullData, 'items', newIds); }));
            editor.appendChild(g);
          } else if (fieldKey === 'tags') {
            const tags = fullData.tags || [];
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = '标签'; g.appendChild(l);
            g.appendChild(createTagList([...tags], (newTags) => { fullData.tags = newTags; }));
            editor.appendChild(g);
          } else if (fieldKey === 'position') {
            const pos = fullData.default?.position || fullData.position || [];
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = '地理位置'; g.appendChild(l);
            g.appendChild(createIdList([...pos], 'geography', (newIds) => { if (fullData.default) fullData.default.position = newIds; else fullData.position = newIds; }));
            editor.appendChild(g);
          } else if (fieldKey === 'memory') {
            const mem = getFullFieldValue(fullData, 'memory') || { vital: [], longTerm: [], daily: [] };
            [{ key: 'vital', label: '关键记忆 (Vital)' }, { key: 'longTerm', label: '长期记忆 (Long Term)' }, { key: 'daily', label: '日常记忆 (Daily)' }].forEach(sf => {
              const g = document.createElement('div'); g.className = 'field-group';
              const l = document.createElement('label'); l.textContent = sf.label; g.appendChild(l);
              const tags = mem[sf.key] || [];
              g.appendChild(createTagList([...tags], (newTags) => { mem[sf.key] = newTags; setFullFieldValue(fullData, 'memory', mem); }));
              editor.appendChild(g);
            });
          } else if (fieldKey === 'inventory') {
            const inv = getFullFieldValue(fullData, 'inventory') || [];
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = '持有道具'; g.appendChild(l);
            g.appendChild(createIdList([...inv], 'item', (newIds) => { setFullFieldValue(fullData, 'inventory', newIds); }));
            editor.appendChild(g);
          } else if (fieldKey === 'cognition') {
            const cog = getFullFieldValue(fullData, 'cognition') || {};
            const container = document.createElement('div');
            container.appendChild(createCognitionEditor({ ...cog, characters: { ...(cog.characters || {}) } }, (newCog) => { setFullFieldValue(fullData, 'cognition', newCog); }));
            editor.appendChild(container);
          } else if (fieldKey === 'relationship') {
            const rels = getFullFieldValue(fullData, 'relationship') || [];
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = '角色关系'; g.appendChild(l);
            g.appendChild(createRelList(rels.map(r => ({ ...r })), (newRels) => { setFullFieldValue(fullData, 'relationship', newRels); }));
            editor.appendChild(g);
          } else {
            const val = getFullFieldValue(fullData, fieldKey) || '';
            const g = document.createElement('div'); g.className = 'field-group';
            const l = document.createElement('label'); l.textContent = fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1); g.appendChild(l);
            const t = document.createElement('textarea'); t.id = 'field-' + fieldKey; t.rows = 8; t.value = val; g.appendChild(t); bindAutoResize(t);
            editor.appendChild(g);
          }
        }

        function startEditModalName() {
          const title = document.getElementById('edit-modal-title');
          if (!title || document.getElementById('edit-modal-title-input')) return;
          const currentName = title.textContent;
          title.style.display = 'none';
          const input = document.createElement('input');
          input.id = 'edit-modal-title-input';
          input.type = 'text';
          input.value = currentName;
          title.parentNode.insertBefore(input, title.nextSibling);
          input.focus();
          function commit() {
            const newName = input.value.trim();
            if (newName && window._editingNode) {
              window._editingNode.name = newName;
              const originNode = state.currentData.kg.nodes.find(n => n.id === window._editingNode.id);
              if (originNode) originNode.name = newName;
            }
            title.textContent = window._editingNode?.name || currentName;
            title.style.display = '';
            input.remove();
          }
          function cancel() { title.style.display = ''; input.remove(); }
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { cancel(); } });
          input.addEventListener('blur', commit);
        }

        function closeEditModal(event) {
          if (event && event.target !== document.getElementById('edit-modal-overlay')) return;
          document.getElementById('edit-modal-overlay').classList.remove('open');
          window._editingNode = null;
        }

        async function submitEditModal(nodeId) {
          const node = window._editingNode;
          const fullData = window._editingNodeFull;
          if (!node || !fullData) return;
          const attrPanel = document.getElementById('modal-panel-tl');
          if (attrPanel) { const activeEl = attrPanel.querySelector('textarea:focus, input:focus'); if (activeEl) activeEl.blur(); }
          const activeItem = document.querySelector('#field-sidebar .field-sidebar-item.active');
          const fieldKey = activeItem?.dataset?.key;
          const textareaFields = ['persona', 'pursuit', 'ability', 'goal', 'mbti', 'value'];
          if (fieldKey === 'content') {
            if (!fullData.content) fullData.content = {};
            fullData.content.description = document.getElementById('field-content-desc')?.value || '';
            fullData.content.detail = document.getElementById('field-content-detail')?.value || '';
            node.desc = fullData.content.description;
          } else if (textareaFields.includes(fieldKey)) {
            const val = document.getElementById('field-' + fieldKey)?.value || '';
            setFullFieldValue(fullData, fieldKey, val);
            if (fieldKey === 'persona') node.desc = val;
          }
          if (state.currentLoreSetId) {
            const setting = await DB.loresets.getById(state.currentLoreSetId);
            if (setting) {
              if (node.type === 'worldview') { const idx = setting.worldview.nodes.findIndex(n => n.id === nodeId); if (idx !== -1) Object.assign(setting.worldview.nodes[idx], fullData); }
              else if (node.type === 'history') { const idx = setting.worldview.history.findIndex(n => n.id === nodeId); if (idx !== -1) Object.assign(setting.worldview.history[idx], fullData); }
              else if (node.type === 'geography') { const idx = setting.worldview.geography.findIndex(n => n.id === nodeId); if (idx !== -1) Object.assign(setting.worldview.geography[idx], fullData); }
              else if (node.type === 'scene') { if (setting.scenes[nodeId]) Object.assign(setting.scenes[nodeId], fullData); }
              else if (node.type === 'character') { if (setting.characters[nodeId]) Object.assign(setting.characters[nodeId], fullData); }
              else if (node.type === 'item') { if (setting.items[nodeId]) Object.assign(setting.items[nodeId], fullData); }
              await DB.loresets.put(setting);
            }
          }
          await window.loadDataFromDB();
          const originNode = state.currentData.kg.nodes.find(n => n.id === nodeId);
          if (originNode) { originNode.name = node.name; originNode.desc = node.desc; }
          if (state.editViewMode === 'list') window.renderEditCards(); else window.initEditD3ForceGraph();
          closeEditModal();
        }

        async function editSettingNode(node) {
          openEditModal(node);
        }

        function showNewSettingDialog(callback) {
          const typeLabels = { worldview: '世界观', character: '角色', scene: '场景', prop: '道具' };
          const label = typeLabels[state.editActiveCategory] || '设定';
          let dialog = document.getElementById('new-setting-dialog');
          if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = 'new-setting-dialog';
            dialog.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(15,23,42,0.25);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
            dialog.onclick = (e) => { if (e.target === dialog) closeNewSettingDialog(); };
            document.body.appendChild(dialog);
          }
          dialog.innerHTML = '';
          dialog.style.opacity = '0'; dialog.style.pointerEvents = 'none';
          const box = document.createElement('div');
          box.style.cssText = 'width:360px;background:rgba(255,255,255,0.95);backdrop-filter:blur(16px);border:1px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.12);transform:scale(0.96);transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);';
          const title = document.createElement('div');
          title.style.cssText = 'font-size:13px;font-weight:700;color:#1e293b;margin-bottom:16px;';
          title.textContent = `新建${label}`;
          box.appendChild(title);
          const nameGroup = document.createElement('div'); nameGroup.className = 'field-group';
          const nameLabel = document.createElement('label'); nameLabel.textContent = '名称'; nameGroup.appendChild(nameLabel);
          const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.style.cssText = 'width:100%;height:36px;border:1px solid #e2e8f0;border-radius:10px;padding:0 12px;font-size:11px;font-weight:500;color:#334155;background:white;outline:none;box-sizing:border-box;transition:border-color 0.15s ease;';
          nameInput.addEventListener('focus', () => { nameInput.style.borderColor = '#93c5fd'; });
          nameInput.addEventListener('blur', () => { nameInput.style.borderColor = '#e2e8f0'; });
          nameGroup.appendChild(nameInput);
          box.appendChild(nameGroup);
          const descGroup = document.createElement('div'); descGroup.className = 'field-group';
          const descLabel = document.createElement('label'); descLabel.textContent = '描述（可留空）'; descGroup.appendChild(descLabel);
          const descInput = document.createElement('textarea'); descInput.rows = 3; descInput.style.cssText = 'width:100%;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:500;color:#334155;background:white;outline:none;resize:none;overflow:hidden;line-height:1.5;box-sizing:border-box;transition:border-color 0.15s ease;';
          descInput.addEventListener('focus', () => { descInput.style.borderColor = '#93c5fd'; });
          descInput.addEventListener('blur', () => { descInput.style.borderColor = '#e2e8f0'; });
          bindAutoResize(descInput);
          descGroup.appendChild(descInput);
          box.appendChild(descGroup);
          const btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
          const cancelBtn = document.createElement('button');
          cancelBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:1px solid #e2e8f0;background:white;font-size:10px;font-weight:700;color:#64748b;cursor:pointer;transition:background 0.15s ease;';
          cancelBtn.textContent = '取消';
          cancelBtn.onclick = closeNewSettingDialog;
          const createBtn = document.createElement('button');
          createBtn.style.cssText = 'height:32px;padding:0 16px;border-radius:10px;border:none;background:#3b82f6;font-size:10px;font-weight:700;color:white;cursor:pointer;transition:background 0.15s ease;';
          createBtn.textContent = '创建';
          createBtn.onclick = () => { const name = nameInput.value.trim(); if (!name) { nameInput.style.borderColor = '#fca5a5'; return; } closeNewSettingDialog(); callback(name, descInput.value || ''); };
          btnRow.append(cancelBtn, createBtn);
          box.appendChild(btnRow);
          dialog.appendChild(box);
          requestAnimationFrame(() => { dialog.style.opacity = '1'; dialog.style.pointerEvents = 'auto'; box.style.transform = 'scale(1)'; nameInput.focus(); });
          nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); createBtn.click(); } });
          descInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createBtn.click(); } });
        }

        function closeNewSettingDialog() {
          const dialog = document.getElementById('new-setting-dialog');
          if (!dialog) return;
          const box = dialog.firstElementChild;
          if (box) box.style.transform = 'scale(0.96)';
          dialog.style.opacity = '0'; dialog.style.pointerEvents = 'none';
          setTimeout(() => { dialog.innerHTML = ''; }, 250);
        }

        async function resetEditChatWelcome() {
            const chatList = document.getElementById('edit-chat-list');
            if (!chatList) return;

            state.editDialogueHistory = [window.createEditWelcomeMsg()];
            window.renderSidebarDialogueArea('edit-chat-list', state.editDialogueHistory);
            await window.saveCurrentSidebarSession();
        }

        async function clearEditChat() {
            await resetEditChatWelcome();
        }

        async function sendEditChatMessage(text) {
            const chatList = document.getElementById('edit-chat-list');
            if (!chatList) return;

            // 切换为停止按钮
            if (state.sidebarInputBox) state.sidebarInputBox.setStopMode();

            // 写入用户消息
            state.editDialogueHistory.push({ sender: 'user', text, isFolded: text.length > 50, isNew: true });
            if (state.sidebarInputBox) state.sidebarInputBox.setValue('');
            window.renderSidebarDialogueArea('edit-chat-list', state.editDialogueHistory);
            window.saveCurrentSidebarSession();

            // 创建 AI 消息占位
            const aiMsgIdx = state.editDialogueHistory.length;
            const aiUniqueId = `edit-chat-list-ai-${aiMsgIdx}`;
            const aiMsg = { sender: 'ai', text: '', thinking: '', isThinkingOpen: true, isFolded: false, isStreaming: true, isStreamingThinking: true, currentThinkingHeader: 'Thinking...', isNew: true, isBubbleNew: true, toolCalls: [] };
            state.editDialogueHistory.push(aiMsg);
            window.renderSidebarDialogueArea('edit-chat-list', state.editDialogueHistory);

            // 流式增量更新辅助：直接操作 DOM，避免全量重绘杀掉动效
            function streamUpdateDOM() {
                const thinkingEl = document.getElementById(`${aiUniqueId}-thinking-text-el`);
                if (thinkingEl) thinkingEl.textContent = aiMsg.thinking;
                const textEl = document.getElementById(`${aiUniqueId}-text`);
                if (textEl) textEl.innerHTML = aiMsg.text;
                const storyContainer = document.getElementById(`${aiUniqueId}-story-bubble-container`);
                if (storyContainer && aiMsg.text && aiMsg.text.trim()) {
                    storyContainer.classList.remove('hidden');
                    storyContainer.classList.add('flex');
                }
                chatList.scrollTop = chatList.scrollHeight;
            }

            try {
                const messages = editHistoryToMessages(state.editDialogueHistory);
                let response = await callLLM(messages, LORESET_TOOLS, (chunk) => {
                    if (chunk.type === 'reasoning') { aiMsg.thinking += chunk.text; }
                    if (chunk.type === 'content') { aiMsg.text += chunk.text; }
                    streamUpdateDOM();
                });

                // 处理 tool_calls 循环
                while (response.tool_calls?.length) {
                    // 过滤掉 id 为空的无效 tool_call（流式解析可能未收到 id）
                    const validToolCalls = response.tool_calls.filter(tc => tc.id);
                    if (!validToolCalls.length) break;
                    aiMsg.toolCalls = validToolCalls;
                    for (const tc of validToolCalls) {
                        const fn = tc.function;
                        let args;
                        try { args = JSON.parse(fn.arguments); } catch (e) { args = {}; }
                        let toolResult;
                        try { toolResult = await executeTool(fn.name, args); } catch (e) { toolResult = { error: '工具执行异常: ' + e.message }; }
                        state.editDialogueHistory.push({ sender: 'tool', toolCallId: tc.id, result: toolResult });
                    }
                    window.saveCurrentSidebarSession();
                    // 工具调用后全量重绘一次（新 tool 消息需要渲染）
                    window.renderSidebarDialogueArea('edit-chat-list', state.editDialogueHistory);
                    const newMessages = editHistoryToMessages(state.editDialogueHistory);
                    response = await callLLM(newMessages, LORESET_TOOLS, (chunk) => {
                        if (chunk.type === 'reasoning') { aiMsg.thinking += chunk.text; }
                        if (chunk.type === 'content') { aiMsg.text += chunk.text; }
                        streamUpdateDOM();
                    });
                }

                // 思考完成 → 播放 wipe 动效切换标题
                aiMsg.isStreamingThinking = false;
                window.animateThinkingBtnText(aiUniqueId, "Show Thinking", true);

                aiMsg.isStreaming = false;
                aiMsg.stats = (response.reasoning_content?.length || 0) + ' / ' + (aiMsg.text?.length || 0);
            } catch (e) {
                if (e.name === 'AbortError') {
                    // 用户主动中止，不显示错误
                    if (!aiMsg.text) aiMsg.text = '（已中止）';
                } else {
                    aiMsg.text = '⚠️ 错误: ' + e.message;
                }
                aiMsg.isStreaming = false;
                aiMsg.isStreamingThinking = false;
            } finally {
                // 恢复发送按钮
                if (state.sidebarInputBox) state.sidebarInputBox.setSendMode();
                window._currentAbortController = null;
            }
            window.saveCurrentSidebarSession();
            window.renderSidebarDialogueArea('edit-chat-list', state.editDialogueHistory);
            // 完成后播放扫描动效
            const finalTextEl = document.getElementById(`${aiUniqueId}-text`);
            if (finalTextEl) {
                const bubbleEl = finalTextEl.closest('.message-bubble');
                if (bubbleEl) bubbleEl.classList.add('sweep-scan-active');
            }
        }

        function editHistoryToMessages(history) {
            const loreId = state.currentData?.id || '';
            const ctxType = state.isEditingIndependentStory ? '独立故事' : '设定集';
            const ctxName = state.currentData?.title || '';
            const ctx = `${ctxType}「${ctxName}」\nlore_id: ${loreId}`;
            const messages = [{ role: 'system', content: LORESET_SYSTEM_PROMPT + '\n\n当前编辑上下文：' + ctx }];

            // 收集所有有效的 tool_call_id（来自 assistant 消息的 tool_calls）
            const validToolCallIds = new Set();
            for (const msg of history) {
                if (msg.sender === 'ai' && msg.toolCalls?.length) {
                    for (const tc of msg.toolCalls) {
                        if (tc.id) validToolCallIds.add(tc.id);
                    }
                }
            }

            for (const msg of history) {
                if (msg.isWelcome) continue;
                if (msg.sender === 'user') messages.push({ role: 'user', content: msg.text });
                else if (msg.sender === 'ai') {
                    const m = { role: 'assistant', content: msg.text || '' };
                    if (msg.toolCalls?.length) m.tool_calls = msg.toolCalls.filter(tc => tc.id);
                    if (m.tool_calls && !m.tool_calls.length) delete m.tool_calls;
                    messages.push(m);
                } else if (msg.sender === 'tool') {
                    // 过滤掉孤儿 tool 消息（没有对应 assistant tool_call 的）
                    if (!msg.toolCallId || !validToolCallIds.has(msg.toolCallId)) continue;
                    // 优先使用 UJSON 转译后的 markdown，回退到原始 JSON
                    const toolContent = msg.result?._ujson_markdown || JSON.stringify(msg.result);
                    messages.push({ role: 'tool', tool_call_id: msg.toolCallId, content: toolContent });
                }
            }
            return messages;
        }

// ===== 暴露到 window =====
window.getOptionsForType = getOptionsForType;
window.createIdSelector = createIdSelector;
window.createTagList = createTagList;
window.createIdList = createIdList;
window.createRelList = createRelList;
window.createCognitionEditor = createCognitionEditor;
window.openEditModal = openEditModal;
window.loadNodeFullData = loadNodeFullData;
window.openKgSubModal = openKgSubModal;
window.renderKgAddContent = renderKgAddContent;
window.renderKgArrowRow = renderKgArrowRow;
window.renderKgRelArea = renderKgRelArea;
window.getNodeRelations = getNodeRelations;
window.getNodeShortName = getNodeShortName;
window.renderKgRemoveContent = renderKgRemoveContent;
window.removeRelation = removeRelation;
window.renderKgListContent = renderKgListContent;
window.submitKgAdd = submitKgAdd;
window.closeKgSubModal = closeKgSubModal;
window.buildGraphData = buildGraphData;
window.findNodeName = findNodeName;
window.findNodeType = findNodeType;
window.renderModalGraph = renderModalGraph;
window.renderAttrPanel = renderAttrPanel;
window.startAttrEdit = startAttrEdit;
window.renderFieldSidebar = renderFieldSidebar;
window.selectField = selectField;
window.getFullFieldValue = getFullFieldValue;
window.setFullFieldValue = setFullFieldValue;
window.renderFieldEditor = renderFieldEditor;
window.startEditModalName = startEditModalName;
window.closeEditModal = closeEditModal;
window.submitEditModal = submitEditModal;
window.editSettingNode = editSettingNode;
window.showNewSettingDialog = showNewSettingDialog;
window.closeNewSettingDialog = closeNewSettingDialog;
window.resetEditChatWelcome = resetEditChatWelcome;
window.clearEditChat = clearEditChat;
window.sendEditChatMessage = sendEditChatMessage;
window.editHistoryToMessages = editHistoryToMessages;
