import { DB, _allLoreSets, _allStories, _allChats } from '../core/db.js';
import { state } from './state.js';
import { seedDatabase, createLoreSet, createChatSession, createChatMessage, createInstanceFromTemplate, addInstanceVersion } from '../core/models.js';
import { callLLM } from '../core/api.js';
import { LORESET_TOOLS } from '../core/tools.js';
import { executeTool } from '../engine/tool-executor.js';
import { createWrappedExecuteTool, UnderstandingJSON, ExpandNodes, UJSON_cache } from '../engine/ujson.js';
import { LORESET_SYSTEM_PROMPT } from '../prompts/system-prompts.js';
import { TOOL_DESCRIPTIONS, USER_CONFIGURABLE_PROMPTS, refreshUserConfigurablePrompts } from '../prompts/tool-descriptions.js';
import { deductionBridge } from '../engine/deduction-bridge.js';
import { getAllModels, getCustomModels, getDuplicateModelNames, getShortModelName } from './utils/model-manager.js';
import { showToast, autoResizeTextarea, bindAutoResize, positionPopupSmart, copyText } from './utils/dom-helpers.js';
import './components/sidebar.js';
import './components/modal.js';
import './views/settings.js';
import './views/dialogue.js';
import './views/collection.js';
import './views/home.js';
import './views/chat.js';

window.seedDatabase = seedDatabase;
window.refreshUserConfigurablePrompts = refreshUserConfigurablePrompts;

const wrappedExecuteTool = createWrappedExecuteTool(executeTool);
window.selectedModelName = localStorage.getItem('global-active-model') || '自定义模型';

function getLatestDesc(inst, type) {
    if (!inst || !inst.versions || inst.versions.length === 0) return '';
    const v = inst.versions[inst.versions.length - 1];
    if (type === 'character') return v.persona || '';
    return v.content?.description || '';
}

async function loadDataFromDB() {
    const allLoreSets = await DB.loresets.getAll();
    const allStoriesRaw = await DB.stories.getAll();
    const allChats = await DB.chatSessions.getAll();

    _allLoreSets.length = 0;
    _allLoreSets.push(...allLoreSets);
    _allStories.length = 0;
    _allStories.push(...allStoriesRaw);
    _allChats.length = 0;
    _allChats.push(...allChats);

    state.allStories.length = 0;
    for (const key in state.loresetData) delete state.loresetData[key];
    for (const key in state.storySessions) delete state.storySessions[key];

    for (const ls of allLoreSets) {
        const colKey = ls.id;
        const displayName = ls.name;

        const charNodes = Object.values(ls.characters || {}).map(c => ({ id: c.id, name: c.name, type: 'character', desc: c.default.persona }));
        const sceneNodes = Object.values(ls.scenes || {}).map(s => ({ id: s.id, name: s.name, type: 'scene', desc: s.default.content.description }));
        const itemNodes = Object.values(ls.items || {}).map(i => ({ id: i.id, name: i.name, type: 'prop', desc: i.default.content.description }));
        const worldviewNodes = (ls.worldview.nodes || []).map(n => ({ id: n.id, name: n.name, type: 'worldview', desc: n.content.description }));
        const allNodes = [...worldviewNodes, ...charNodes, ...sceneNodes, ...itemNodes];
        const allEdges = (ls.worldview.edges || []).map(e => ({ source: e.subject, target: e.object, label: e.relation }));

        state.loresetData[colKey] = {
            id: ls.id, title: displayName, displayName: displayName,
            desc: ls.worldview.nodes[0]?.content.description || '',
            stories: [], chats: [],
            kg: { nodes: allNodes, links: allEdges }
        };

        const lsStories = allStoriesRaw.filter(s => s.associatedLoreSetId === ls.id);
        for (const sto of lsStories) {
            state.loresetData[colKey].stories.push({
                id: sto.id, name: sto.title, rounds: sto.ticks?.length || 0,
                words: sto.eventQuadruples?.length + ' events',
                desc: sto.eventQuadruples?.[0]?.content?.substring(0, 50) || ''
            });
            state.allStories.push({
                id: sto.id, name: sto.title, type: ls.id, rounds: sto.ticks?.length || 0,
                words: sto.eventQuadruples?.length + ' events',
                desc: sto.eventQuadruples?.[0]?.content?.substring(0, 80) || ''
            });

            if (sto.ticks && sto.ticks.length > 0) {
                const dialogues = [];
                const _charNames = {};
                if (sto.associatedLoreSetId) {
                    try {
                        const _ls = await DB.loresets.getById(sto.associatedLoreSetId);
                        if (_ls?.characters) {
                            for (const [cid, c] of Object.entries(_ls.characters)) _charNames[cid] = c.name || cid;
                        }
                    } catch (e) { /* ignore */ }
                }
                for (const tick of sto.ticks) {
                    if (tick.routingLayout?.narrativeIntent) {
                        dialogues.push({ sender: "user", text: tick.routingLayout.narrativeIntent });
                    }
                    const deductionSteps = [];
                    for (const [cid, snap] of Object.entries(tick.mtipSnapshots || {})) {
                        const charName = _charNames[cid] || snap.charId || cid;
                        const fields = {};
                        if (snap.raw) {
                            const parts = snap.raw.replace(/^\[|\]$/g, '').split('|||');
                            fields.intent = parts[2]?.trim() || '';
                        }
                        deductionSteps.push(`Deciding ${charName}` + (fields.intent ? ': ' + fields.intent : ''));
                    }
                    for (const ded of (tick.deductions || [])) {
                        if (ded.scope) deductionSteps.push('📖 Interpreter: ' + ded.scope);
                    }
                    deductionSteps.push('✍️ Writer 撰写中..');
                    const chapterIdx = (tick.tickIndex || 1) - 1;
                    const chapter = sto.chapters?.[chapterIdx];
                    const novelText = chapter?.content || '';
                    dialogues.push({ sender: "ai", text: novelText, deduction: deductionSteps, stats: "", isDeductionOpen: false });
                }
                if (dialogues.length > 0) state.storySessions[sto.title] = dialogues;
            }
        }

        const lsChats = allChats.filter(c => c.associatedLoreSetId === ls.id);
        for (const chat of lsChats) {
            state.loresetData[colKey].chats.push({ id: chat.id, target: chat.title, replies: chat.messages?.length || 0 });
        }
    }

    const standaloneStories = allStoriesRaw.filter(s => !s.associatedLoreSetId);
    for (const sto of standaloneStories) {
        state.allStories.push({
            id: sto.id, name: sto.title, type: 'standalone', rounds: sto.ticks?.length || 0,
            words: sto.eventQuadruples?.length + ' events',
            desc: sto.eventQuadruples?.[0]?.content?.substring(0, 80) || ''
        });
    }

    console.log('[WorldStory] 数据同步完成:', Object.keys(state.loresetData).length, '个设定集,', state.allStories.length, '个故事');
}

window.loadDataFromDB = loadDataFromDB;

window.addEventListener('hashchange', () => {
    const { state: hashState, name } = window.parseHash();
    state._isHashNavigation = true;
    window.setInterfaceState(hashState, name).finally(() => { state._isHashNavigation = false; });
});

function handleDialogueCollectionPillClick() {
    const nameEl = document.getElementById('dialogue-collection-name');
    const isStandalone = nameEl?.dataset.standalone === 'true';
    if (isStandalone) {
        window.setInterfaceState('standalone-story-edit', state.activeStoryId);
    } else {
        const colName = nameEl?.textContent || '设定集';
        window.setInterfaceState('collection-view', colName);
    }
}

function parseStreamingMessage(rawText) {
    const thinkStart = rawText.indexOf('<think>');
    if (thinkStart === -1) {
        return { thinking: '', text: rawText, hasThinking: false, isThinkingFinished: true };
    }
    const thinkEnd = rawText.indexOf('</think>', thinkStart + 7);
    if (thinkEnd === -1) {
        return { thinking: rawText.substring(thinkStart + 7), text: '', hasThinking: true, isThinkingFinished: false };
    } else {
        return { thinking: rawText.substring(thinkStart + 7, thinkEnd), text: rawText.substring(thinkEnd + 8), hasThinking: true, isThinkingFinished: true };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const popup = document.getElementById('deduction-level-popup');
    if (popup) {
        popup.addEventListener('mouseenter', () => {
            if (state.dlPopupTimeout) { clearTimeout(state.dlPopupTimeout); state.dlPopupTimeout = null; }
        });
        popup.addEventListener('mouseleave', () => { window.hideDlPopup(); });
        popup.querySelectorAll('.dl-popup-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const level = opt.getAttribute('data-level');
                state.isDlPopupClicked = false;
                if (state.dlPopupShowTimeout) clearTimeout(state.dlPopupShowTimeout);
                if (state.dlPopupTimeout) clearTimeout(state.dlPopupTimeout);
                window.syncDeductionLevelToUI(level);
                popup.classList.add('hidden');
            });
        });
    }
});

document.addEventListener('click', (e) => {
    document.querySelectorAll('.model-dropdown').forEach(dropdown => {
        if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !e.target.closest('.model-select-trigger')) {
            dropdown.classList.add('hidden');
        }
    });
    const storyPopup = document.getElementById('story-options-popup');
    if (storyPopup && !storyPopup.classList.contains('hidden') && !storyPopup.contains(e.target) && !e.target.closest('.story-options-btn')) {
        storyPopup.classList.add('hidden');
    }
    const dlPopup = document.getElementById('deduction-level-popup');
    if (dlPopup && !dlPopup.classList.contains('hidden') && !dlPopup.contains(e.target) && !e.target.closest('.thinking-level-option')) {
        state.isDlPopupClicked = false;
        if (state.dlPopupShowTimeout) clearTimeout(state.dlPopupShowTimeout);
        if (state.dlPopupTimeout) clearTimeout(state.dlPopupTimeout);
        dlPopup.classList.add('hidden');
    }
    const refPopup = document.getElementById('setting-ref-popup');
    if (refPopup && !refPopup.contains(e.target) && !e.target.closest('[onclick*="openSettingRefPopup"]') && !e.target.closest('[title="引用设定"]')) {
        refPopup.classList.add('hidden');
    }
    const mountPopup = document.getElementById('collection-mount-popup');
    if (mountPopup && !mountPopup.contains(e.target) && !e.target.closest('[onclick*="openCollectionMountPopup"]') && !e.target.closest('[title="挂载设定集"]')) {
        mountPopup.classList.add('hidden');
    }
    const qaPopup = document.getElementById('quick-actions-popup');
    if (qaPopup && !qaPopup.contains(e.target) && !e.target.closest('[onclick*="toggleQuickActionsPopup"]')) {
        qaPopup.classList.add('hidden');
    }
    const chatAtPopup = document.getElementById('chat-at-popup');
    if (chatAtPopup && !chatAtPopup.contains(e.target) && !e.target.closest('#chat-at-btn') && !e.target.closest('[onclick*="openChatAtPopup"]')) {
        chatAtPopup.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    try {
        let existingProviders = JSON.parse(localStorage.getItem('providers-list') || '[]') || [];
        let customOnly = existingProviders.filter(p => p && p.id && p.id.startsWith('custom-'));
        localStorage.setItem('providers-list', JSON.stringify(customOnly));
        let activeModel = localStorage.getItem('global-active-model') || '';
        if (!activeModel || /gemini|google|openai|claude|anthropic/i.test(activeModel)) {
            if (customOnly.length > 0) {
                const models = customOnly[0].models.split(',').map(m => m.trim()).filter(m => m);
                localStorage.setItem('global-active-model', models[0] || '自定义模型');
            } else {
                localStorage.setItem('global-active-model', '自定义模型');
            }
        }
    } catch (e) {
        console.error("LocalStorage cleanup failed", e);
    }

    if (typeof window.rebuildQAModelList === 'function') window.rebuildQAModelList();

    window.rebuildAllModelSelects = function() {
        try {
            const activeModel = localStorage.getItem('global-active-model') || '自定义模型';
            const allModels = getAllModels();
            const desiredModels = allModels.map(m => m.name);
            document.querySelectorAll('select').forEach(select => {
                try {
                    let isModelSelect = false;
                    if (/model|provider/i.test(select.id) || /model|provider/i.test(select.className)) {
                        isModelSelect = true;
                    } else {
                        for (let opt of select.options) {
                            if (/gemini|google|openai|claude|anthropic/i.test(opt.value) || /gemini|google|openai|claude|anthropic/i.test(opt.text)) {
                                isModelSelect = true;
                                break;
                            }
                        }
                    }
                    if (isModelSelect) {
                        let currentOptions = Array.from(select.options).map(o => o.value);
                        let isMatching = currentOptions.length === desiredModels.length && currentOptions.every((val, i) => val === desiredModels[i]);
                        if (!isMatching) {
                            const currentValue = select.value;
                            select.innerHTML = '';
                            desiredModels.forEach(m => {
                                const opt = document.createElement('option');
                                opt.value = m;
                                opt.textContent = m;
                                if (m === currentValue || m === activeModel) { opt.selected = true; }
                                select.appendChild(opt);
                            });
                            try { select.dispatchEvent(new Event('change')); } catch (evErr) { console.error("Event dispatch error", evErr); }
                        }
                    }
                } catch (selectErr) { console.error("Individual select processing failed", selectErr); }
            });
        } catch (globalSelectErr) { console.error("Global select rebuild failed", globalSelectErr); }
    };

    window.syncModelsFromProviders = function() {
        try {
            const activeModel = localStorage.getItem('global-active-model') || '自定义模型';
            window.selectedModelName = activeModel;
            if (typeof window.rebuildAllModelSelects === 'function') window.rebuildAllModelSelects();
            if (typeof window.rebuildQAModelList === 'function') window.rebuildQAModelList();
            [state.inputBox, state.sidebarInputBox].forEach(inst => {
                if (inst && typeof inst.rebuildDropdown === 'function') inst.rebuildDropdown();
            });
        } catch (err) { console.error("syncModelsFromProviders error", err); }
    };
});

window.handleDialogueCollectionPillClick = handleDialogueCollectionPillClick;
window.parseStreamingMessage = parseStreamingMessage;

document.addEventListener('DOMContentLoaded', () => {
    if (window.d3) {
        window.d3.select("#kg-svg").on("dblclick", function() {
            if (state.viewMode === 'graph') {
                window.d3.selectAll('#kg-svg .node circle')
                    .attr("r", d => d.type === 'root' ? 15 : 8)
                    .attr("stroke-width", 1.5)
                    .attr("stroke", "#ffffff")
                    .style("filter", d => d.type === 'root' ? 'drop-shadow(0 0 8px rgba(59,130,246,0.65))' : 'none');
                window.d3.selectAll('#kg-svg .link-line')
                    .style("stroke-opacity", 0.3)
                    .style("stroke-width", 1.5)
                    .style("stroke", "#94a3b8");
            }
        });
    }
});

window.addEventListener('resize', function() {
    window.buildNodeBar();
    if (document.body.classList.contains('state-collection-edit') && state.editViewMode === 'graph') {
        window.initEditD3ForceGraph();
    }
});
