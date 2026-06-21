import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { createStory, createChatSession } from '../../core/models.js';
import { InputBox } from '../components/input-box.js';
import { getAllModels, getCustomModels, getDuplicateModelNames, getShortModelName } from '../utils/model-manager.js';

let lastHeightBeforeMore = null;

const creationModeLabels = { AUTO: 'AUTO', COLLECTION: '设定集', INDEPENDENT: '独立故事' };

function simulateAiResponse(userMessage) {
    alert(`[模拟] 用户消息已发送: "${userMessage}"\n处理单元尚未接入，此为临时占位。`);
}

function initInputBoxForPage(pageType) {
    const configs = {
        home: {
            containerId: 'home-input-container',
            type: 'home',
            placeholder: window.selectedCreationMode === 'AUTO' ? '智能自动模式：输入构想开始创作..' :
                         window.selectedCreationMode === 'COLLECTION' ? '设定集模式：输入构建设想来创建一个新的设定集...' :
                         '独立故事模式：输入灵感直接开始创作独立故事..',
            onSubmit: (val) => {
                if (!val.trim()) return;
                if (window.selectedCreationMode === 'AUTO') {
                    console.log('[TODO] AUTO模式：智能分析输入意图并自动决定分流行为');
                    simulateAiResponse(`[AUTO模式] ${val}`);
                } else if (window.selectedCreationMode === 'COLLECTION') {
                    console.log('[TODO] COLLECTION模式：根据输入内容，专门调用创建设定集逻辑');
                    simulateAiResponse(`[设定集模式] 正在根据输入内容创建设定集: ${val}`);
                } else if (window.selectedCreationMode === 'INDEPENDENT') {
                    console.log('[TODO] INDEPENDENT模式：直接将输入内容作为独立故事灵感进行创建');
                    simulateAiResponse(`[独立故事模式] 正在根据灵感直接开始独立故事: ${val}`);
                }
            }
        },
        creating: {
            containerId: 'home-input-container',
            type: 'home',
            placeholder: '输入第一条消息开始创作..',
            onSubmit: async (val) => {
                if (!val.trim()) return;
                const activeColName = document.querySelector('.active-collection-name')?.textContent || '设定集';
                const matchKey = Object.keys(state.collectionsData).find(k => (state.collectionsData[k].displayName || state.collectionsData[k].title) === activeColName);
                const loreSetId = matchKey ? state.collectionsData[matchKey]?.id : null;
                const newStory = createStory(val.trim(), loreSetId);
                await DB.stories.put(newStory);
                if (matchKey && state.collectionsData[matchKey]) {
                    state.collectionsData[matchKey].stories.push({ id: newStory.id, name: newStory.title, rounds: 0, words: '0 events', desc: '' });
                }
                state.allStories.push({ id: newStory.id, name: newStory.title, type: loreSetId, rounds: 0, words: '0 events', desc: '' });
                window.renderSidebarCollections();
                setInterfaceState('dialogue', val.trim());
                window.sendDialogueMessageFromComponent(val.trim());
            }
        },
        dialogue: {
            containerId: 'dialogue-input-container',
            type: 'dialogue',
            placeholder: '输入文本开始创作..',
            onSubmit: (val) => {
                if (!val.trim()) return;
                window.sendDialogueMessageFromComponent(val);
            }
        },
        chat: {
            containerId: 'chat-input-box-wrapper',
            type: 'chat',
            placeholder: '输入文本开始聊天',
            onSubmit: (val) => {
                if (!val.trim()) return;
                window.submitChatLanding();
            }
        },
        sidebar: {
            containerId: 'edit-chat-input-container',
            type: 'sidebar',
            placeholder: '输入设定指令...',
            isCompact: true,
            onSubmit: (val) => {
                window.sendEditChatMessage(val);
            }
        }
    };

    const config = configs[pageType];
    if (!config) return;

    if (config.isCompact) {
        if (!state.sidebarInputBox) {
            state.sidebarInputBox = new InputBox(config);
        } else {
            state.sidebarInputBox.containerId = config.containerId;
            state.sidebarInputBox.type = config.type;
            state.sidebarInputBox.placeholder = config.placeholder;
            state.sidebarInputBox.onSubmit = config.onSubmit;
            state.sidebarInputBox.isCompact = true;
            state.sidebarInputBox.init();
        }
    } else {
        if (!state.inputBox) {
            state.inputBox = new InputBox(config);
        } else {
            state.inputBox.containerId = config.containerId;
            state.inputBox.type = config.type;
            state.inputBox.placeholder = config.placeholder;
            state.inputBox.onSubmit = config.onSubmit;
            state.inputBox.isCompact = false;
            state.inputBox.init();
        }
    }
}

function renderStories(fixedHeight = null) {
    const listContainer = document.getElementById('stories-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const displayStories = state.allStories.map(s => ({
        id: s.id, name: s.name, type: s.type, rounds: s.rounds, words: s.words, desc: s.desc
    }));

    const sliced = displayStories.slice(0, state.visibleLimit);
    sliced.forEach(story => {
        const li = document.createElement('div');
        li.className = 'flex items-center gap-2.5 transition-all duration-200 shrink-0';
        const typeLabel = story.type !== 'independent'
            ? (state.collectionsData[story.type]?.displayName || story.type)
            : '独立故事';
        const displayType = story.type !== 'independent'
            ? `<span class="text-[11px] text-slate-400 font-normal">in ${typeLabel}</span>`
            : '';
        li.innerHTML = `<div class="modern-box cursor-pointer hover:border-slate-300 hover:bg-white transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex items-center justify-center px-3 max-w-[160px]" style="height: var(--global-h);" onclick="setInterfaceState('dialogue', '${story.name}')"><span class="text-[11px] text-slate-600 font-semibold truncate select-none">${story.name}</span></div>${displayType}`;
        listContainer.appendChild(li);
    });

    if (state.visibleLimit < displayStories.length) {
        const moreItem = document.createElement('div');
        moreItem.className = 'pt-2 text-[11px] font-bold text-slate-300 tracking-widest cursor-pointer hover:text-slate-500 transition-colors text-left';
        moreItem.textContent = '. . . . More';
        moreItem.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetHeight = listContainer.getBoundingClientRect().height;
            lastHeightBeforeMore = targetHeight;
            if (state.visibleLimit === 3) state.visibleLimit = 9;
            else state.visibleLimit += 6;
            renderStories(targetHeight);
        });
        listContainer.appendChild(moreItem);
    }

    if (state.visibleLimit > 3) {
        listContainer.classList.add('overflow-y-auto', 'border-t', 'border-b', 'border-slate-200/80', 'py-1.5', 'no-scrollbar');
        listContainer.style.height = (fixedHeight || lastHeightBeforeMore || 126) + 'px';
    } else {
        listContainer.classList.remove('overflow-y-auto', 'border-t', 'border-b', 'border-slate-200/80', 'py-1.5', 'no-scrollbar');
        listContainer.style.height = 'auto';
    }
}

function getCollectionColorClass(colId) {
    if (colId === 'A') return 'text-blue-600 bg-blue-50/80 border-blue-100';
    if (colId === 'B') return 'text-purple-600 bg-purple-50/80 border-purple-100';
    if (colId === 'C') return 'text-amber-600 bg-amber-50/80 border-amber-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
}

function submitChatLanding() {
    if (!state.inputBox) return;
    const textVal = state.inputBox.getValue().trim();
    if (!textVal) return;
    if (state.selectedChatCharacters.length === 0) {
        alert("请先点击左下角的 @ 控件选择至少一个角色进行对话！");
        return;
    }
    const storyName = state.selectedChatCharacters.length === 1
        ? `与 @${state.selectedChatCharacters[0].name} 的对话`
        : `与 @Group 的对话`;
    const namesListStr = state.selectedChatCharacters.map(c => `@${c.name}`).join('、');
    const characterIntroText = state.selectedChatCharacters.length === 1
        ? `已成功接入与 <strong class="text-blue-500">${namesListStr}</strong> 的对话通道。我是你的设定智能助手，已完美同步其设定数据，你可以继续以第一人称或上帝视角展开深度对话。`
        : `已成功创建包含 <strong class="text-blue-500">${namesListStr}</strong> 的多人协同聊天室（群聊 @Group 模式）。所有角色的时空定位和前置状态已自动融合，请随时开启精彩互动！`;
    const chatSession = createChatSession(storyName, null, null, state.selectedChatCharacters.map(c => c.id));
    chatSession.messages = [
        { role: "user", content: textVal, timestamp: new Date().toISOString() },
        { role: "character", charId: state.selectedChatCharacters[0]?.id, content: characterIntroText, toolCalls: [], timestamp: new Date().toISOString() }
    ];
    DB.chatSessions.put(chatSession).catch(e => console.warn('ChatSession save failed', e));
    state.storyDialogues[storyName] = [
        { sender: "user", text: textVal, isNew: true },
        {
            sender: "ai", text: characterIntroText,
            deduction: [
                `建立与 ${state.selectedChatCharacters.map(c => c.name).join(', ')} 角色节点的数据同步锁`,
                "重构多体动力学故事演绎流，对准量子引力逻辑"
            ],
            stats: "1.6k / 0.4k / 60", isNew: true, isBubbleNew: true
        }
    ];
    if (typeof renderStories === 'function') renderStories();
    state.inputBox.setValue('');
    setInterfaceState('dialogue', storyName);
}

function updateHash(pageState, name) {
    if (state._isHashNavigation) return;
    const stateToRoute = {
        'home': '/home', 'creating': '/creating', 'collection-overview': '/collection-overview',
        'collection-view': '/collection-view', 'collection-edit': '/collection-edit',
        'independent-story-edit': '/independent-story-edit', 'dialogue': '/dialogue',
        'chat': '/chat', 'settings': '/settings'
    };
    const route = stateToRoute[pageState] || '/home';
    const hash = name ? `#${route}/${encodeURIComponent(name)}` : `#${route}`;
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
}

function parseHash() {
    const hash = window.location.hash || '#/home';
    const parts = hash.replace('#', '').split('/').filter(Boolean);
    const pageState = parts[0] || 'home';
    const name = parts[1] ? decodeURIComponent(parts[1]) : '';
    return { state: pageState, name };
}

async function setInterfaceState(pageState, nameOrCollectionName = '') {
    const body = document.body;
    body.classList.remove('state-home', 'state-creating', 'state-collection-overview', 'state-collection-view', 'state-collection-edit', 'state-dialogue', 'state-chat', 'state-settings');

    if (pageState === 'creating') {
        body.classList.add('state-creating');
        document.querySelectorAll('.active-collection-name').forEach(el => { el.textContent = nameOrCollectionName; });
    } else if (pageState === 'collection-overview') {
        body.classList.add('state-collection-overview');
        window.renderCollectionOverview();
    } else if (pageState === 'collection-view') {
        body.classList.add('state-collection-view');
        const matchKey = Object.keys(state.collectionsData).find(k => {
            const col = state.collectionsData[k];
            return (col.displayName || col.title) === nameOrCollectionName;
        });
        if (matchKey) window.loadCollection(matchKey);
    } else if (pageState === 'collection-edit') {
        body.classList.add('state-collection-edit');
        await window.enterCollectionEdit(nameOrCollectionName);
    } else if (pageState === 'independent-story-edit') {
        body.classList.add('state-collection-edit');
        await window.enterIndependentStoryEdit(nameOrCollectionName);
    } else if (pageState === 'dialogue') {
        body.classList.add('state-dialogue');
        state.currentSidebarStoryName = nameOrCollectionName;
        await window.loadStoryDialogue(nameOrCollectionName);
    } else if (pageState === 'chat') {
        body.classList.add('state-chat');
        window.initChatView();
    } else if (pageState === 'settings') {
        body.classList.add('state-settings');
        window.initSettingsView();
    } else {
        body.classList.add('state-home');
        state.visibleLimit = 3;
        renderStories();
    }

    const stateToInputType = { 'home': 'home', 'creating': 'creating', 'dialogue': 'dialogue', 'chat': 'chat', 'collection-edit': 'sidebar' };
    if (stateToInputType[pageState]) initInputBoxForPage(stateToInputType[pageState]);
    if (state.sidebarInputBox) state.sidebarInputBox.init();
    if (state.inputBox) state.inputBox.init();

    window.renderSidebarCollections();
    window.renderSidebarIndependentStories();
    updateHash(pageState, nameOrCollectionName);
}

function selectModel(modelName, element) {
    window.selectedModelName = modelName;
    localStorage.setItem('global-active-model', modelName);
    if (state.inputBox) state.inputBox.updateModel(modelName);
    if (state.sidebarInputBox) state.sidebarInputBox.updateModel(modelName);
    document.querySelectorAll('.model-dropdown').forEach(d => d.classList.add('hidden'));
    const qaPopup = document.getElementById('quick-actions-popup');
    if (qaPopup) qaPopup.classList.add('hidden');
}

function rebuildQAModelList() {
    const container = document.getElementById('qa-model-list');
    if (!container) return;
    const allModels = getAllModels();
    const dups = getDuplicateModelNames();
    const activeModel = window.selectedModelName || localStorage.getItem('global-active-model') || (allModels[0] && allModels[0].name) || '自定义模型';
    container.innerHTML = '';
    allModels.forEach((m, i) => {
        const isActive = m.name === activeModel;
        const isGray = !m.hasKey;
        const showProvider = dups.has(m.name) && m.providerName;
        const div = document.createElement('div');
        div.className = 'qa-model-opt flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors' +
            (isActive ? ' active' : '') + (isGray ? ' cursor-not-allowed opacity-50' : ' cursor-pointer');
        if (!isGray) div.onclick = function() { selectModel(m.name, this); };
        const nameHtml = getShortModelName(m.name, 32) + (showProvider ? ` <span class="text-[8px] font-normal text-slate-400">(${m.providerName})</span>` : '');
        div.innerHTML = `<span class="text-[10px] ${isActive && !isGray ? 'font-bold text-blue-500' : isGray ? 'font-medium text-slate-400' : 'font-medium text-slate-600'}">${nameHtml}</span>` +
            (i === 0 && !isGray ? '<span class="text-[8px] text-blue-500 font-bold">默认</span>' : isGray ? '<span class="text-[8px] text-slate-300">无Key</span>' : '');
        container.appendChild(div);
    });
}

function setCreationMode(mode) {
    state.selectedCreationMode = mode;
    window.selectedCreationMode = mode;
    const label = document.getElementById('creation-mode-label');
    if (label) label.textContent = creationModeLabels[mode] || mode;
    document.querySelectorAll('.creation-mode-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === mode);
    });
    const drawer = document.getElementById('creation-mode-drawer');
    const trigger = document.getElementById('creation-mode-trigger');
    const arrow = document.getElementById('creation-mode-arrow');
    if (drawer && trigger) {
        drawer.classList.remove('expanded');
        const triggerWidth = trigger.offsetWidth || 0;
        drawer.style.width = `${triggerWidth}px`;
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
    updateHomeInputBoxBehavior(mode);
}

function toggleCreationModeDrawer(e) {
    if (e) e.stopPropagation();
    const trigger = document.getElementById('creation-mode-trigger');
    const drawer = document.getElementById('creation-mode-drawer');
    const arrow = document.getElementById('creation-mode-arrow');
    const spacer = document.getElementById('creation-mode-drawer-spacer');
    if (!trigger || !drawer) return;

    const isOpen = drawer.classList.contains('expanded');
    const triggerWidth = trigger.offsetWidth || 0;

    if (isOpen) {
        drawer.classList.remove('expanded');
        drawer.style.width = `${triggerWidth}px`;
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        drawer.classList.add('expanded');
        if (spacer) spacer.style.width = `${triggerWidth}px`;
        let totalWidth = triggerWidth;
        const children = drawer.children;
        for (let i = 1; i < children.length; i++) totalWidth += children[i].offsetWidth || 0;
        if (children.length > 2) totalWidth += (children.length - 2) * 4;
        totalWidth += 8;
        drawer.style.width = `${totalWidth}px`;
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

function updateHomeInputBoxBehavior(mode) {
    if (!state.inputBox || state.inputBox.type !== 'home') return;
    let placeholderText = '构建设定并创作故事..';
    if (mode === 'AUTO') placeholderText = '智能自动模式：输入构想开始创作..';
    else if (mode === 'COLLECTION') placeholderText = '设定集模式：输入构建设想来创建一个新的设定集...';
    else if (mode === 'INDEPENDENT') placeholderText = '独立故事模式：输入灵感直接开始创作独立故事..';

    state.inputBox.placeholder = placeholderText;
    state.inputBox.onSubmit = (val) => {
        if (!val.trim()) return;
        if (window.selectedCreationMode === 'AUTO') simulateAiResponse(`[AUTO模式] ${val}`);
        else if (window.selectedCreationMode === 'COLLECTION') simulateAiResponse(`[设定集模式] 正在根据输入内容创建设定集: ${val}`);
        else if (window.selectedCreationMode === 'INDEPENDENT') simulateAiResponse(`[独立故事模式] 正在根据灵感直接开始独立故事: ${val}`);
    };
    state.inputBox.init();
}

function setDeductionLevel(level) {
    state.selectedDeductionLevel = level;
    const btns = ['dl-fast', 'dl-standard', 'dl-extended'].map(id => document.getElementById(id));
    btns.forEach(btn => {
        if (btn) btn.className = 'flex-1 text-[9px] font-semibold py-1 rounded-md text-center text-slate-500 hover:text-slate-700 transition-all';
    });
    let activeBtn = btns[1];
    if (level === 'Fast') activeBtn = btns[0];
    if (level === 'Extended') activeBtn = btns[2];
    if (activeBtn) activeBtn.className = 'flex-1 text-[9px] font-semibold py-1 rounded-md text-center bg-white text-slate-800 shadow-sm transition-all';
}

window.openDeductionLevelPopup = function(triggerEl) {
    const popup = document.getElementById('deduction-level-popup');
    if (!popup) return;
    popup.classList.remove('hidden');
    const rect = triggerEl.getBoundingClientRect();
    const popupWidth = 192;
    const popupHeight = popup.offsetHeight || 132;
    let left = rect.right + 12;
    let top = rect.bottom - popupHeight;
    if (left + popupWidth > window.innerWidth) left = rect.left - popupWidth - 12;
    if (top < 8) top = 8;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    const currentLevel = localStorage.getItem('deduction-level') || 'Standard';
    popup.querySelectorAll('.dl-popup-option').forEach(opt => {
        const optLevel = opt.getAttribute('data-level');
        const checkIcon = opt.querySelector('.dl-check-icon');
        if (optLevel === currentLevel) { opt.classList.add('active', 'bg-blue-50/40'); if (checkIcon) checkIcon.classList.remove('hidden'); }
        else { opt.classList.remove('active', 'bg-blue-50/40'); if (checkIcon) checkIcon.classList.add('hidden'); }
    });
};

window.showDlPopup = function(triggerEl) {
    if (state.dlPopupTimeout) { clearTimeout(state.dlPopupTimeout); state.dlPopupTimeout = null; }
    if (state.dlPopupShowTimeout) clearTimeout(state.dlPopupShowTimeout);
    if (state.isDlPopupClicked) window.openDeductionLevelPopup(triggerEl);
    else state.dlPopupShowTimeout = setTimeout(() => { window.openDeductionLevelPopup(triggerEl); }, 200);
};

window.hideDlPopup = function() {
    if (state.dlPopupShowTimeout) { clearTimeout(state.dlPopupShowTimeout); state.dlPopupShowTimeout = null; }
    if (state.isDlPopupClicked) return;
    if (state.dlPopupTimeout) clearTimeout(state.dlPopupTimeout);
    state.dlPopupTimeout = setTimeout(() => {
        const popup = document.getElementById('deduction-level-popup');
        if (popup) popup.classList.add('hidden');
    }, 500);
};

window.syncDeductionLevelToUI = function(level) {
    localStorage.setItem('deduction-level', level);
    state.selectedDeductionLevel = level;
    setDeductionLevel(level);
    document.querySelectorAll('.thinking-level-option').forEach(el => {
        const subText = el.querySelector('.deduction-level-sub');
        if (subText) {
            let dlZh = '常规流程';
            if (level === 'Fast') dlZh = '快速推演';
            if (level === 'Extended') dlZh = '长链验证';
            subText.textContent = `${level} (${dlZh})`;
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('creation-mode-trigger');
    const drawer = document.getElementById('creation-mode-drawer');
    if (trigger && drawer) {
        drawer.style.width = `${trigger.offsetWidth || 0}px`;
        trigger.addEventListener('click', (e) => toggleCreationModeDrawer(e));
    }
    document.querySelectorAll('.creation-mode-option').forEach(opt => {
        opt.addEventListener('click', (e) => { e.stopPropagation(); setCreationMode(opt.dataset.mode); });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#floating-label')) { if (drawer?.classList.contains('expanded')) toggleCreationModeDrawer(); }
    });
    setCreationMode('AUTO');
});

window.initInputBoxForPage = initInputBoxForPage;
window.renderStories = renderStories;
window.getCollectionColorClass = getCollectionColorClass;
window.submitChatLanding = submitChatLanding;
window.updateHash = updateHash;
window.parseHash = parseHash;
window.setInterfaceState = setInterfaceState;
window.selectModel = selectModel;
window.rebuildQAModelList = rebuildQAModelList;
window.setCreationMode = setCreationMode;
window.toggleCreationModeDrawer = toggleCreationModeDrawer;
window.updateHomeInputBoxBehavior = updateHomeInputBoxBehavior;
window.setDeductionLevel = setDeductionLevel;
