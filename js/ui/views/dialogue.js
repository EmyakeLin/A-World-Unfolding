import { state } from '../state.js';
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

// ===== Helper: get current sidebar dialogue history =====
function getSidebarDialogueHistory() {
    if (!state.currentSidebarStoryId) return [];
    if (!state.sidebarSessions[state.currentSidebarStoryId]) state.sidebarSessions[state.currentSidebarStoryId] = [];
    return state.sidebarSessions[state.currentSidebarStoryId];
}

// ===== Copy/Edit helpers for main dialogue =====
function copyMainMessage(idx) {
    if (state.activeStoryMessages[idx]) {
        const text = state.activeStoryMessages[idx].text;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        copyText(tempDiv.textContent || tempDiv.innerText || "");
    }
}

function editMessage(uniqueId, oldText) {
    const newText = prompt("编辑此消息内容?", oldText);
    if (newText !== null && newText.trim() !== '') {
        const parts = uniqueId.split('-');
        const idx = parseInt(parts[parts.length - 1]);
        if (!isNaN(idx) && state.activeStoryMessages[idx]) {
            state.activeStoryMessages[idx].text = newText;
            renderDialogueArea();
        }
    }
}

function triggerMainMessageEdit(idx) {
    if (state.activeStoryMessages[idx]) {
        const sender = state.activeStoryMessages[idx].sender;
        editMessage(`${sender}-${idx}`, state.activeStoryMessages[idx].text);
    }
}

function branchFromMessage(uniqueId) {
    alert(`已从节点【${uniqueId}】建立新的故事剧情独立演化分支！`);
}

// ===== Copy/Edit helpers for sidebar dialogue =====
function copySidebarMessage(containerId, idx) {
    const historyArray = containerId === 'sidebar-chat-list' ? getSidebarDialogueHistory() : state.editorSessions;
    if (historyArray[idx]) {
        const text = historyArray[idx].text;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        copyText(tempDiv.textContent || tempDiv.innerText || "");
    }
}

function editSidebarMessage(containerId, uniqueId, oldText) {
    const newText = prompt("编辑此消息内容?", oldText);
    if (newText !== null && newText.trim() !== '') {
        const historyArray = containerId === 'sidebar-chat-list' ? getSidebarDialogueHistory() : state.editorSessions;
        const parts = uniqueId.split('-');
        const idx = parseInt(parts[parts.length - 1]);
        if (!isNaN(idx) && historyArray[idx]) {
            historyArray[idx].text = newText;
            renderSidebarDialogueArea(containerId, historyArray);
        }
    }
}

function triggerSidebarMessageEdit(containerId, idx) {
    const historyArray = containerId === 'sidebar-chat-list' ? getSidebarDialogueHistory() : state.editorSessions;
    if (historyArray[idx]) {
        const sender = historyArray[idx].sender;
        editSidebarMessage(containerId, `${containerId}-${sender}-${idx}`, historyArray[idx].text);
    }
}

// ===== Bubble toggle/detail =====
function toggleBubbleDetail(uniqueId) {
    const drawer = document.getElementById(`${uniqueId}-tools-drawer`);
    const toggleIcon = document.getElementById(`${uniqueId}-toggle-icon`);
    const path = document.getElementById(`${uniqueId}-path`);
    if (!drawer || !toggleIcon || !path) return;
    
    const isOpen = drawer.classList.contains('expanded');
    if (isOpen) {
        drawer.classList.remove('expanded');
        drawer.style.width = '24px';
        toggleIcon.style.transform = 'rotate(0deg)';
        path.setAttribute('d', 'M9 5l7 7-7 7');
    } else {
        drawer.classList.add('expanded');
        
        let totalWidth = 28 + 10;
        const children = drawer.children;
        for (let i = 0; i < children.length; i++) {
            totalWidth += children[i].offsetWidth || 0;
        }
        if (children.length > 1) {
            totalWidth += (children.length - 1) * 8;
        }
        
        drawer.style.width = `${totalWidth}px`;
        
        toggleIcon.style.transform = 'rotate(180deg)';
        path.setAttribute('d', 'M15 19l-7-7 7-7');
    }
}

function toggleBubbleFoldLocal(uniqueId, idx) {
    const isFolded = !(state.activeStoryMessages[idx].isFolded === false ? false : true);
    state.activeStoryMessages[idx].isFolded = isFolded;
    
    const textEl = document.getElementById(`${uniqueId}-text`);
    if (!textEl) return;
    
    const bubbleEl = textEl.parentElement;
    const btnEl = bubbleEl ? bubbleEl.querySelector('button[onclick*="toggleBubbleFoldLocal"]') : null;
    const svgEl = btnEl ? btnEl.querySelector('svg') : null;
    
    const isUser = uniqueId.startsWith('user');
    const targetClampClass = isUser ? 'line-clamp-2' : 'line-clamp-3';
    
    if (!isFolded) {
        const collapsedHeight = textEl.offsetHeight;
        const fullHeight = textEl.scrollHeight;
        
        textEl.style.overflow = 'hidden';
        textEl.style.maxHeight = collapsedHeight + 'px';
        textEl.classList.remove(targetClampClass);
        
        textEl.offsetHeight;
        textEl.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        textEl.style.maxHeight = fullHeight + 'px';
        
        setTimeout(() => {
            textEl.style.maxHeight = '';
            textEl.style.transition = '';
            textEl.style.overflow = '';
        }, 300);
        
        if (svgEl) svgEl.classList.add('rotate-180');
    } else {
        const fullHeight = textEl.offsetHeight;
        textEl.classList.add(targetClampClass);
        const collapsedHeight = textEl.offsetHeight;
        textEl.classList.remove(targetClampClass);
        
        textEl.style.overflow = 'hidden';
        textEl.style.maxHeight = fullHeight + 'px';
        
        textEl.offsetHeight;
        textEl.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        textEl.style.maxHeight = collapsedHeight + 'px';
        
        setTimeout(() => {
            textEl.classList.add(targetClampClass);
            textEl.style.maxHeight = '';
            textEl.style.transition = '';
            textEl.style.overflow = '';
        }, 300);
        
        if (svgEl) svgEl.classList.remove('rotate-180');
    }
}

function toggleDeductionLocal(idx) {
    const isOpen = !state.activeStoryMessages[idx].isDeductionOpen;
    state.activeStoryMessages[idx].isDeductionOpen = isOpen;
    
    const uniqueId = `ai-${idx}`;
    const contentEl = document.getElementById(`${uniqueId}-deduction-content`);
    if (contentEl) {
        if (isOpen) {
            contentEl.classList.add('open');
        } else {
            contentEl.classList.remove('open');
        }
        
        const btn = contentEl.previousElementSibling ? contentEl.previousElementSibling.querySelector('button') : null;
        const svg = btn ? btn.querySelector('svg') : null;
        if (svg) {
            if (isOpen) {
                svg.classList.add('rotate-180');
            } else {
                svg.classList.remove('rotate-180');
            }
        }
    }
}

// ===== Render deduction steps =====
function renderDeductionStepsHTML(deduction) {
    if (!deduction || deduction.length === 0) return '';
    
    let html = '';
    deduction.forEach(line => {
        const isSubStep = line.startsWith(' ') || line.startsWith('\t');
        let cleanLine = line.trim();
        
        cleanLine = cleanLine.replace(/^\d+[\.\s、]+/, '');
        
        if (isSubStep) {
            html += `
                <div class="pl-4 text-[10px] font-normal text-slate-400 leading-relaxed text-left italic">
                    ${cleanLine}
                </div>
            `;
        } else {
            let separatorIdx = cleanLine.indexOf('：');
            if (separatorIdx === -1) {
                separatorIdx = cleanLine.indexOf(':');
            }
            
            if (separatorIdx !== -1) {
                const title = cleanLine.substring(0, separatorIdx).trim();
                const detail = cleanLine.substring(separatorIdx + 1).trim();
                html += `
                    <div class="flex flex-col gap-0.5 text-left mt-2 first:mt-0 italic">
                        <div class="text-[12px] font-bold text-slate-700 leading-relaxed">${title}</div>
                        <div class="text-[10px] font-normal text-slate-500 leading-relaxed">${detail}</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="text-[12px] font-bold text-slate-700 leading-relaxed text-left mt-2 first:mt-0 italic">
                        ${cleanLine}
                    </div>
                `;
            }
        }
    });
    return html;
}

function renderSingleDeductionStepHTML(header, detail) {
    return `
        <div class="flex flex-col gap-0.5 text-left mt-2 first:mt-0 italic fade-in">
            <div class="text-[12px] font-bold text-slate-700 leading-relaxed">${header}</div>
            <div class="text-[10px] font-normal text-slate-500 leading-relaxed">${detail}</div>
        </div>
    `;
}

function animateButtonHeader(uniqueId, newHeader, isSlow = false) {
    const span = document.getElementById(`${uniqueId}-deduction-btn-text`);
    if (!span) return;
    
    const outClass = isSlow ? 'wipe-out-text-slow' : 'wipe-out-text';
    const inClass = isSlow ? 'wipe-in-text-slow' : 'wipe-in-text';
    const outDuration = isSlow ? 450 : 200;
    const pauseDuration = isSlow ? 200 : 100;
    const inDuration = isSlow ? 450 : 200;
    
    span.classList.remove('wipe-in-text', 'wipe-in-text-slow');
    span.classList.add(outClass);
    
    setTimeout(() => {
        span.textContent = newHeader;
        span.classList.remove(outClass);
        span.classList.add(inClass);
        
        setTimeout(() => {
            span.classList.remove(inClass);
        }, inDuration);
    }, outDuration + pauseDuration);
}

// ===== Main dialogue area renderer =====
function renderDialogueArea() {
    const chatArea = document.getElementById('dialogue-chat-area');
    if (!chatArea) return;
    chatArea.innerHTML = '';
    
    state.activeStoryMessages.forEach((msg, idx) => {
        const uniqueId = `${msg.sender}-${idx}`;
        const isUser = msg.sender === 'user';
        
        const wrapper = document.createElement('div');
        const isNew = msg.isNew;
        const isBubbleNew = msg.isBubbleNew === true;
        wrapper.className = `flex flex-col w-full max-w-[720px] mx-auto ${isUser ? 'items-end' : 'items-start'} mb-6 ${isNew ? 'fade-in' : ''}`;
        if (isNew) msg.isNew = false;
        wrapper.dataset.role = msg.sender;
        
        if (isUser) {
            const text = msg.text;
            const needsFolding = text.length > 80;
            const isFolded = msg.isFolded !== false;
            
            wrapper.innerHTML = `
                <div class="flex items-start gap-3 justify-end w-full">
                    <div class="flex flex-col items-end max-w-[85%]">
                        <div class="message-bubble bg-slate-100/70 border border-slate-200 text-[11px] font-medium text-slate-700 leading-relaxed text-left shadow-sm">
                            <div id="${uniqueId}-text" class="${needsFolding && isFolded ? 'line-clamp-2' : ''} whitespace-pre-wrap">${text}</div>
                            
                            <div id="${uniqueId}-tools-drawer" class="bubble-tools-drawer type-user flex items-center gap-2">
                                <button onclick="window.copyMainMessage(${idx})" class="w-5 h-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="复制">
                                    <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                    </svg>
                                </button>
                                <button onclick="window.triggerMainMessageEdit(${idx})" class="w-5 h-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="编辑">
                                    <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                </button>
                                <button onclick="window.branchFromMessage('${uniqueId}')" class="w-5 h-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="分支">
                                    <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <circle cx="18" cy="18" r="3"></circle>
                                        <circle cx="6" cy="6" r="3"></circle>
                                        <circle cx="6" cy="18" r="3"></circle>
                                        <path d="M18 15V9a4 4 0 00-4-4H9"></path>
                                        <line x1="6" y1="9" x2="6" y2="15"></line>
                                    </svg>
                                </button>
                            </div>

                            <button onclick="window.toggleBubbleDetail('${uniqueId}')" class="bubble-left-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors shadow-sm" title="操作">
                                <svg id="${uniqueId}-toggle-icon" class="w-2.5 h-2.5 text-slate-500 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                    <path id="${uniqueId}-path" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                            
                            ${needsFolding ? `
                                <button onclick="window.toggleBubbleFoldLocal('${uniqueId}', ${idx})" class="bubble-right-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="折叠/展开">
                                    <svg class="w-2.5 h-2.5 text-slate-500 transition-transform ${!isFolded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="w-6 h-6 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold text-slate-600 mt-1 select-none">
                        U
                    </div>
                </div>
            `;
        } else {
            const text = msg.text;
            const needsFolding = text.length > 100;
            const isFolded = msg.isFolded !== false;
            const stats = msg.stats || '12.4k / 1.1k / 120';
            const deduction = msg.deduction || [];
            const isDeductionOpen = msg.isDeductionOpen === true;
            
            wrapper.innerHTML = `
                ${(deduction.length > 0 || msg.isStreaming) ? `
                    <div class="w-full flex flex-col mb-4">
                        <div class="flex items-center gap-3 w-full">
                            <div class="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold text-blue-500 select-none">
                                A
                            </div>
                            <button onclick="window.toggleDeductionLocal(${idx})" class="h-6 rounded-full border border-transparent bg-transparent hover:bg-slate-100 text-[9px] font-bold text-slate-500 hover:text-slate-800 px-3.5 flex items-center gap-1.5 transition-all select-none">
                                <span id="${uniqueId}-deduction-btn-text" class="font-bold inline-block">${msg.isStreaming ? (msg.currentHeader || 'Initializing Deduction...') : 'Show Deduction Steps'}</span>
                                <svg class="w-2.5 h-2.5 text-slate-400 transition-transform duration-200 ${isDeductionOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="collapsible-wrapper ${isDeductionOpen ? 'open' : ''} w-full" id="${uniqueId}-deduction-content">
                            <div class="collapsible-inner w-full flex">
                                <div class="w-9 shrink-0 flex justify-end">
                                    <div class="w-[2px] bg-slate-300 h-full"></div>
                                </div>
                                
                                <div class="flex-1 pl-4 py-1 space-y-2 italic">
                                    ${renderDeductionStepsHTML(deduction)}
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="${(msg.isStreaming && !msg.text) ? 'hidden' : 'flex'} items-start gap-3 w-full ${isBubbleNew ? 'fade-in' : ''}" id="${uniqueId}-story-bubble-container">
                    <div class="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold text-blue-500 mt-1 select-none ${(deduction.length > 0 || msg.isStreaming) ? 'opacity-0 pointer-events-none' : ''}">
                        A
                     </div>
                     
                     <div class="flex flex-col items-start max-w-[85%] flex-1">
                         <div class="message-bubble ${msg.playScanEffect ? 'sweep-scan-active' : ''} bg-white border border-slate-200 text-[11px] font-medium text-slate-700 leading-relaxed text-left shadow-sm w-full">
                             <div id="${uniqueId}-text" class="${needsFolding && isFolded ? 'line-clamp-3' : ''} whitespace-pre-wrap">${text}</div>
                             
                             <div id="${uniqueId}-tools-drawer" class="bubble-tools-drawer type-ai flex items-center gap-2">
                                 <button onclick="window.copyMainMessage(${idx})" class="w-5 h-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="复制">
                                     <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                         <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                         <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                     </svg>
                                 </button>
                                 <button onclick="window.triggerMainMessageEdit(${idx})" class="w-5 h-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="编辑">
                                     <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                         <path d="M12 20h9"></path>
                                         <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                     </svg>
                                 </button>
                                 <button onclick="window.branchFromMessage('${uniqueId}')" class="w-5 h-5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="分支">
                                     <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                         <circle cx="18" cy="18" r="3"></circle>
                                         <circle cx="6" cy="6" r="3"></circle>
                                         <circle cx="6" cy="18" r="3"></circle>
                                         <path d="M18 15V9a4 4 0 00-4-4H9"></path>
                                         <line x1="6" y1="9" x2="6" y2="15"></line>
                                     </svg>
                                 </button>
                                 
                                 <div class="h-5 flex items-center gap-1 text-[8.5px] font-bold text-slate-400 bg-slate-100/80 px-2.5 rounded-full border border-slate-200 shrink-0" title="Token消耗: 缓存命中 / 输入 / 输出">
                                     <svg class="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                     <span class="shrink-0 text-slate-500">${stats}</span>
                                 </div>
                             </div>

                             <button onclick="window.toggleBubbleDetail('${uniqueId}')" class="bubble-left-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="操作">
                                 <svg id="${uniqueId}-toggle-icon" class="w-2.5 h-2.5 text-slate-500 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                     <path id="${uniqueId}-path" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                                 </svg>
                             </button>
                             
                             ${needsFolding ? `
                                 <button onclick="window.toggleBubbleFoldLocal('${uniqueId}', ${idx})" class="bubble-right-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="折叠/展开">
                                     <svg class="w-2.5 h-2.5 text-slate-500 transition-transform ${!isFolded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                         <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                     </svg>
                                 </button>
                             ` : ''}
                         </div>
                     </div>
                </div>
            `;
        }
        chatArea.appendChild(wrapper);
        if (msg.playScanEffect) msg.playScanEffect = false;
        if (msg.isBubbleNew) msg.isBubbleNew = false;
    });
    chatArea.scrollTop = chatArea.scrollHeight;
    setTimeout(buildNodeBar, 50);
}

// ===== Load story dialogue =====
async function loadStoryDialogue(storyName) {
    if (state._currentSidebarChatSource) {
        const _oldSource = state._currentSidebarChatSource;
        const _oldId = state._currentSidebarChatId;
        await (async () => {
            const id = 'sidebar-chat_' + _oldSource + '_' + _oldId;
            const messages = _oldSource === 'story'
                ? (state.sidebarSessions[_oldId] || [])
                : state.editorSessions;
            try {
                await DB.sidebarSessions.put({
                    id, source: _oldSource, sessionId: _oldId,
                    messages: JSON.parse(JSON.stringify(messages))
                });
            } catch (e) { console.warn('[WorldStory] 保存旧侧边栏会话失败', e); }
        })();
    }
    state._currentSidebarChatSource = 'story';
    state._currentSidebarChatId = storyName;
    await loadOrCreateSidebarSession('story', storyName);

    state.activeStoryId = storyName;
    const _storyMeta = state.allStories.find(s => s.name === storyName || s.title === storyName);
    if (_storyMeta) {
        try { window._activeFullStory = await DB.stories.getById(_storyMeta.id); } catch (e) { window._activeFullStory = null; }
    } else {
        window._activeFullStory = null;
    }
    document.getElementById('dialogue-story-title').textContent = storyName;

    let collectionName = null;
    let foundColId = null;
    Object.keys(state.loresetData).forEach(id => {
        if (state.loresetData[id].stories?.some(s => s.name === storyName)) {
            collectionName = state.loresetData[id].displayName || state.loresetData[id].title;
            foundColId = id;
        }
    });
    state.currentLoreSetId = foundColId;
    const isStandalone = !collectionName;
    document.getElementById('dialogue-collection-name').textContent = isStandalone ? '独立故事' : collectionName;
    document.getElementById('dialogue-collection-name').dataset.standalone = isStandalone ? 'true' : 'false';

    if (isStandalone) {
        document.getElementById('dialogue-collection-icon-blocks')?.classList.add('hidden');
        document.getElementById('dialogue-collection-icon-book')?.classList.remove('hidden');
    } else {
        document.getElementById('dialogue-collection-icon-blocks')?.classList.remove('hidden');
        document.getElementById('dialogue-collection-icon-book')?.classList.add('hidden');
    }

    state.activeStoryMessages = state.storySessions[storyName] ? JSON.parse(JSON.stringify(state.storySessions[storyName])) : [];

    window.initInputBoxForPage('dialogue');
    renderDialogueArea();
    renderSidebarDialogueArea('sidebar-chat-list', getSidebarDialogueHistory());
    renderSidebarItems();
}

// ===== Send dialogue message =====
function sendDialogueMessageFromComponent(text) {
    if (window._deductionBridge) {
        window._deductionBridge(text);
        return;
    }
    state.activeStoryMessages.push({
        sender: "user",
        text: text,
        isFolded: text.length > 80,
        isNew: true
    });
    
    if (state.inputBox) state.inputBox.setValue('');
    renderDialogueArea();
    
    setTimeout(() => {
        const aiMsgIdx = state.activeStoryMessages.length;
        const uniqueId = `ai-${aiMsgIdx}`;
        
        const newAiMsg = {
            sender: "ai",
            text: "",
            deduction: [],
            stats: "0.0k / 0.0k / 0",
            isDeductionOpen: true,
            isFolded: false,
            isStreaming: true,
            currentHeader: "Initializing Deduction...",
            isNew: true,
            isBubbleNew: true
        };
        
        state.activeStoryMessages.push(newAiMsg);
        renderDialogueArea();
        
        const streamSteps = [
            { header: "Planning Narration", detail: "Analyzing narrative drive of user prompt and structural conflict." },
            { header: "Checking Coherence", detail: "Ensuring character states (2 active) align with the worldview timeline." },
            { header: "Optimizing Aesthetics", detail: "Selecting premium vocabulary and atmospheric modifiers for deep immersion." },
            { header: "Generating Outline", detail: "Constructing plot points: sudden encounter, internal conflict, tactical choice." }
        ];
        
        let stepIdx = 0;
        
        function streamNextStep() {
            if (stepIdx < streamSteps.length) {
                const step = streamSteps[stepIdx];
                
                const formattedLine = `${step.header}：${step.detail}`;
                newAiMsg.deduction.push(formattedLine);
                newAiMsg.currentHeader = step.header;
                
                const stepsContainer = document.querySelector(`#${uniqueId}-deduction-content .flex-1`);
                if (stepsContainer) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = renderSingleDeductionStepHTML(step.header, step.detail).trim();
                    stepsContainer.appendChild(tempDiv.firstChild);
                }
                
                animateButtonHeader(uniqueId, step.header);
                
                stepIdx++;
                setTimeout(streamNextStep, 1500);
            } else {
                newAiMsg.isStreaming = false;
                newAiMsg.currentHeader = "";
                animateButtonHeader(uniqueId, "Show Deduction Steps", true);
                
                const storyContainer = document.getElementById(`${uniqueId}-story-bubble-container`);
                if (storyContainer) {
                    storyContainer.classList.remove('hidden');
                    storyContainer.classList.add('flex');
                }
                
                const fullNovelText = `基于您的创作提示："${text}"，时空裂隙逐渐收拢，暴雨倾盆落下。\n\n冷冽的工业废墟中，霓虹灯的残影被敲碎在泥泞的柏油路面上，折射出带有铁锈味的蓝紫色光泽。阿尔法拉低了风衣的衣领，金属带扣在寒风中发出一声轻微的脆响。他知道自已被跟踪了，但身后的脚步声却始终保持着诡异的匀速——那不是人类的步幅，更像是某种经过精密标定的机械义体。\n"你不该回来的，"耳机里传来安娜冰冷的声音，带着由于高频干扰产生的轻微啸叫。"芯片里的数据已经锁死，这里是个陷阱。"`;
                
                let charIdx = 0;
                const textEl = document.getElementById(`${uniqueId}-text`);
                
                const textTimer = setInterval(() => {
                    if (charIdx < fullNovelText.length) {
                        const currentChunk = fullNovelText.substring(0, charIdx + 3);
                        charIdx += 3;
                        newAiMsg.text = currentChunk;
                        if (textEl) {
                            textEl.textContent = currentChunk;
                            const chatArea = document.getElementById('dialogue-chat-area');
                            if (chatArea) {
                                chatArea.scrollTop = chatArea.scrollHeight;
                            }
                        }
                    } else {
                        clearInterval(textTimer);
                        newAiMsg.text = fullNovelText;
                        newAiMsg.stats = "26.8k / 3.4k / 420";
                        if (textEl) textEl.textContent = fullNovelText;
                        const bubbleEl = textEl?.closest('.message-bubble');
                        if (bubbleEl) bubbleEl.classList.add('sweep-scan-active');
                    }
                }, 40);
            }
        }
        
        setTimeout(streamNextStep, 800);
        
    }, 800);
}

// ===== Sidebar category switching =====
function switchSidebarCategory(dir) {
    state.sidebarCategoryIndex = (state.sidebarCategoryIndex + dir + sidebarCategories.length) % sidebarCategories.length;
    const label = document.getElementById('sidebar-category-label');
    if (label) label.textContent = sidebarCategories[state.sidebarCategoryIndex];
    const searchInput = document.getElementById('sidebar-search');
    if (searchInput) searchInput.value = '';
    renderSidebarItems();
}

// ===== Right sidebar toggle =====
function toggleRightSidebar() {
    state.isSidebarCollapsed = !state.isSidebarCollapsed;
    if (state.isSidebarCollapsed) {
        document.body.classList.add('drawer-collapsed');
    } else {
        document.body.classList.remove('drawer-collapsed');
    }
    
    setTimeout(() => {
        if (window.viewMode === 'graph' && window.kg) {
            window.kg.render(window.currentData.kg);
        }
    }, 350);
}

// ===== Sidebar items filter & render =====
function filterSidebarItems() { renderSidebarItems(); }

async function renderSidebarItems() {
    const list = document.getElementById('sidebar-item-list');
    if (!list) return;
    list.innerHTML = '';
    const category = sidebarCategories[state.sidebarCategoryIndex];
    const entityType = categoryToType[category];

    let items = [];
    const nameEl = document.getElementById('dialogue-collection-name');
    const isStandalone = nameEl?.dataset.standalone === 'true';
    const fullStory = window._activeFullStory;

    if (entityType === 'event') {
        if (fullStory) {
            const sceneLookup = {};
            const charLookup = {};
            if (fullStory.associatedLoreSetId) {
                try {
                    const ls = await DB.loresets.getById(fullStory.associatedLoreSetId);
                    if (ls) {
                        Object.entries(ls.scenes || {}).forEach(([id, s]) => { sceneLookup[id] = s.name || id; });
                        Object.entries(ls.characters || {}).forEach(([id, c]) => { charLookup[id] = c.name || id; });
                    }
                } catch (e) { /* ignore */ }
            }
            items = (fullStory.eventQuadruples || []).map(eq => ({
                id: eq.id,
                name: (eq.content || '').substring(0, 30) || '未命名事件',
                desc: eq.content || '',
                type: 'event',
                _time: eq.state?.time || '',
                _scenes: (eq.state?.scene || []).map(sid => sceneLookup[sid] || sid),
                _chars: (eq.char || []).map(cid => charLookup[cid] || cid),
                _intent: eq.intent || {}
            }));
        }
    } else if (isStandalone) {
        if (fullStory && fullStory.instances) {
            const typeMap = { 'character': 'characters', 'scene': 'scenes', 'prop': 'items' };
            const instKey = typeMap[entityType];
            if (instKey && fullStory.instances[instKey]) {
                const insts = fullStory.instances[instKey];
                items = Object.keys(insts).map(id => ({
                    id: id,
                    name: insts[id].name || id,
                    desc: insts[id].desc || '',
                    type: entityType
                }));
            }
        }
    } else if (state.currentLoreSetId && state.loresetData[state.currentLoreSetId]) {
        const col = state.loresetData[state.currentLoreSetId];
        items = (col.kg?.nodes || []).filter(n => n.type === entityType);
    }

    const searchInput = document.getElementById('sidebar-search');
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchText) {
        items = items.filter(item =>
            (item.name || '').toLowerCase().includes(searchText) ||
            (item.desc || '').toLowerCase().includes(searchText)
        );
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'p-2.5 bg-white border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors';
        card.style.borderRadius = 'var(--global-radius)';

        if (category === '事件') {
            card.innerHTML = `
                <div class="text-[11px] font-bold text-slate-700 mb-1 line-clamp-1">${item.name}</div>
                <div class="text-[9px] text-slate-500 mb-1 line-clamp-2">${item.desc || ''}</div>
                <div class="flex gap-3 text-[9px] text-slate-400">
                    <span>⏰ ${item._time || '-'}</span>
                    <span>🗺 ${item._scenes?.join(', ') || '-'}</span>
                    <span>👤 ${item._chars?.join(', ') || '-'}</span>
                </div>
            `;
            card.onclick = () => showEventDetail(item);
        } else {
            card.innerHTML = `
                <div class="text-[11px] font-bold text-slate-700">${item.name}</div>
                <div class="text-[9px] text-slate-400 mt-0.5">${item.desc || '暂无描述'}</div>
            `;
            card.onclick = () => window.editSettingNode(item);
        }
        list.appendChild(card);
    });
}

// ===== Event detail popup =====
function showEventDetail(evt) {
    const intentLines = Object.entries(evt._intent || {}).map(([cid, text]) =>
        `<div class="flex gap-1"><span class="font-semibold text-blue-500">${cid}:</span><span>${text}</span></div>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(15,23,42,0.25);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="width:400px;max-height:80vh;overflow-y:auto;background:rgba(255,255,255,0.95);backdrop-filter:blur(16px);border:1px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.12);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></div>
                <span style="font-size:13px;font-weight:700;color:#1e293b;">事件详情</span>
                <span style="font-size:9px;font-weight:600;color:#f59e0b;background:#fef3c7;padding:2px 8px;border-radius:8px;margin-left:auto;">EVENT</span>
            </div>
            <div style="font-size:11px;color:#334155;line-height:1.6;margin-bottom:12px;">${evt.desc || '无内容'}</div>
            <div style="display:flex;gap:16px;font-size:10px;color:#64748b;margin-bottom:12px;">
                <span>⏰ ${evt._time || '-'}</span>
                <span>🗺 ${evt._scenes?.join(', ') || '-'}</span>
                <span>👤 ${evt._chars?.join(', ') || '-'}</span>
            </div>
            ${intentLines ? `<div style="border-top:1px solid #e2e8f0;padding-top:12px;"><div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:6px;">角色意图</div>${intentLines}</div>` : ''}
            <div style="text-align:right;margin-top:16px;">
                <button onclick="this.closest('div[style*=fixed]').remove()" style="height:32px;padding:0 16px;border-radius:10px;border:1px solid #e2e8f0;background:white;font-size:10px;font-weight:700;color:#64748b;cursor:pointer;">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// ===== Sidebar session persistence =====
function createEditWelcomeMsg() {
    const tips = window.isEditingStandalone ?
        '· <strong class="text-blue-500">新增一个角色设定</strong><br>' +
        '· <strong class="text-blue-500">添加一个新场景</strong><br>' +
        '· <strong class="text-blue-500">修改某个设定的描述</strong>' :
        '· <strong class="text-blue-500">创建一个新的世界观设定</strong><br>' +
        '· <strong class="text-blue-500">新增一个角色</strong><br>' +
        '· <strong class="text-blue-500">修改某个设定的描述</strong>';
    return {
        sender: "ai",
        isWelcome: true,
        text: '你好！我是设定编辑助手。你可以告诉我你想创建或修改的设定内容，比如：<br><br>' + tips
    };
}

async function saveCurrentSidebarSession() {
    if (!state._currentSidebarChatSource || !state._currentSidebarChatId) return;
    const id = 'sidebar-chat_' + state._currentSidebarChatSource + '_' + state._currentSidebarChatId;
    const messages = state._currentSidebarChatSource === 'story'
        ? (state.sidebarSessions[state._currentSidebarChatId] || [])
        : state.editorSessions;
    try {
        await DB.sidebarSessions.put({
            id,
            source: state._currentSidebarChatSource,
            sessionId: state._currentSidebarChatId,
            messages: JSON.parse(JSON.stringify(messages))
        });
    } catch (e) { console.warn('[WorldStory] 保存侧边栏会话失败', e); }
}

async function loadOrCreateSidebarSession(source, sessionId) {
    const id = 'sidebar-chat_' + source + '_' + sessionId;
    let session = null;
    try { session = await DB.sidebarSessions.getById(id); } catch (e) { /* ignore */ }
    console.log('[DEBUG loadSession] id:', id, 'found:', !!session, 'messages:', session?.messages?.length);
    if (session && session.messages && session.messages.length > 0) {
        if (source === 'story') {
            state.sidebarSessions[sessionId] = session.messages;
        } else {
            state.editorSessions = session.messages;
        }
        return;
    }
    if (source === 'story') {
        state.sidebarSessions[sessionId] = [];
    } else {
        state.editorSessions = [createEditWelcomeMsg()];
        await DB.sidebarSessions.put({
            id, source, sessionId,
            messages: JSON.parse(JSON.stringify(state.editorSessions))
        });
    }
}

// ===== Sidebar dialogue area renderer =====
function renderSidebarDialogueArea(containerId, historyArray) {
    const chatList = document.getElementById(containerId);
    if (!chatList) return;
    chatList.innerHTML = '';
    
    historyArray.forEach((msg, idx) => {
        const uniqueId = `${containerId}-${msg.sender}-${idx}`;
        const isUser = msg.sender === 'user';
        if (msg.sender === 'tool') return;
        const wrapper = document.createElement('div');
        const isNew = msg.isNew;
        const isBubbleNew = msg.isBubbleNew === true;
        
        wrapper.className = `flex flex-col w-full ${isUser ? 'items-end' : 'items-start'} mb-4 ${isNew ? 'fade-in' : ''}`;
        if (isNew) msg.isNew = false;
        wrapper.dataset.role = msg.sender;
        
        if (isUser) {
            const text = msg.text;
            const needsFolding = text.length > 50;
            const isFolded = msg.isFolded !== false;
            
            wrapper.innerHTML = `
                <div class="flex items-start gap-2 justify-end w-full">
                    <div class="flex flex-col items-end max-w-[85%]">
                        <div class="message-bubble bg-slate-100/70 border border-slate-200 text-[10px] font-medium text-slate-700 leading-relaxed text-left shadow-sm">
                            <div id="${uniqueId}-text" class="${needsFolding && isFolded ? 'line-clamp-2' : ''} whitespace-pre-wrap">${text}</div>
                            
                            <div id="${uniqueId}-tools-drawer" class="bubble-tools-drawer type-user flex items-center gap-1.5">
                                <button onclick="window.copySidebarMessage('${containerId}', ${idx})" class="w-4.5 h-4.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="复制" style="width: 17px; height: 17px;">
                                    <svg class="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                    </svg>
                                </button>
                                <button onclick="window.triggerSidebarMessageEdit('${containerId}', ${idx})" class="w-4.5 h-4.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="编辑" style="width: 17px; height: 17px;">
                                    <svg class="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                </button>
                            </div>

                            <button onclick="window.toggleBubbleDetail('${uniqueId}')" class="bubble-left-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="操作" style="width: 20px; height: 20px; border-radius: 10px;">
                                <svg id="${uniqueId}-toggle-icon" class="w-2 h-2 text-slate-500 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                    <path id="${uniqueId}-path" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                                </svg>
                            </button>
                            
                            ${needsFolding ? `
                                <button onclick="window.toggleSidebarBubbleFoldLocal('${containerId}', '${uniqueId}', ${idx})" class="bubble-right-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="折叠/展开" style="width: 20px; height: 20px; border-radius: 10px;">
                                    <svg class="w-2 h-2 text-slate-500 transition-transform ${!isFolded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="w-5 h-5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 shadow-sm text-[9px] font-bold text-slate-600 mt-0.5 select-none">
                        U
                    </div>
                </div>
            `;
        } else {
            if (msg.isWelcome) {
                wrapper.innerHTML = `
                    <div class="flex items-start gap-2 w-full">
                        <div class="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-sm text-[9px] font-bold text-blue-500 mt-0.5 select-none">
                            A
                        </div>
                        <div class="flex flex-col items-start max-w-[85%]">
                            <div class="p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed text-left shadow-sm" style="border-radius: var(--global-radius);">
                                ${msg.text}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const text = msg.text;
                const needsFolding = text.length > 60;
                const isFolded = msg.isFolded !== false;
                
                const hasThinking = !!msg.thinking;
                const isThinkingOpen = msg.isThinkingOpen !== false;
                const stats = msg.stats || '12.4k / 1.1k / 120';
                
                wrapper.innerHTML = `
                    ${(hasThinking || msg.isStreamingThinking) ? `
                        <div class="w-full flex flex-col mb-2">
                            <div class="flex items-center gap-2 w-full">
                                <div class="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-sm text-[9px] font-bold text-blue-500 select-none">
                                    A
                                </div>
                                <button onclick="window.toggleSidebarThinkingLocal('${containerId}', ${idx})" class="h-5 rounded-full border border-transparent bg-transparent hover:bg-slate-100 text-[8.5px] font-bold text-slate-500 hover:text-slate-800 px-2.5 flex items-center gap-1 transition-all select-none">
                                    <span id="${uniqueId}-thinking-btn-text" class="font-bold inline-block">${msg.isStreamingThinking ? (msg.currentThinkingHeader || 'Thinking...') : 'Show Thinking'}</span>
                                    <svg class="w-2 h-2 text-slate-400 transition-transform duration-200 ${isThinkingOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="collapsible-wrapper ${isThinkingOpen ? 'open' : ''} w-full" id="${uniqueId}-thinking-content">
                                <div class="collapsible-inner w-full flex">
                                    <div class="w-7 shrink-0 flex justify-end">
                                        <div class="w-[1.5px] bg-slate-300 h-full"></div>
                                    </div>
                                    <div class="flex-1 pl-3 py-1 text-[9px] font-normal text-slate-400 leading-relaxed text-left italic whitespace-pre-wrap" id="${uniqueId}-thinking-text-el">${msg.thinking || ''}</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="${(!text || !text.trim()) ? 'hidden' : 'flex'} items-start gap-2 w-full ${isBubbleNew ? 'fade-in' : ''}" id="${uniqueId}-story-bubble-container">
                        <div class="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-sm text-[9px] font-bold text-blue-500 mt-0.5 select-none ${(hasThinking || msg.isStreamingThinking) ? 'opacity-0 pointer-events-none' : ''}">
                            A
                        </div>
                        
                        <div class="flex flex-col items-start max-w-[85%] flex-1">
                            <div class="message-bubble ${msg.playScanEffect ? 'sweep-scan-active' : ''} bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed text-left shadow-sm w-full">
                                <div id="${uniqueId}-text" class="${needsFolding && isFolded ? 'line-clamp-3' : ''} whitespace-pre-wrap">${text}</div>
                                
                                <div id="${uniqueId}-tools-drawer" class="bubble-tools-drawer type-ai flex items-center gap-1.5">
                                    <button onclick="window.copySidebarMessage('${containerId}', ${idx})" class="w-4.5 h-4.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="复制" style="width: 17px; height: 17px;">
                                        <svg class="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                        </svg>
                                    </button>
                                    <button onclick="window.triggerSidebarMessageEdit('${containerId}', ${idx})" class="w-4.5 h-4.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center shadow-sm shrink-0 transition-all text-slate-500 hover:text-slate-800" title="编辑" style="width: 17px; height: 17px;">
                                        <svg class="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                            <path d="M12 20h9"></path>
                                            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                        </svg>
                                    </button>
                                    
                                    <div class="h-4 flex items-center gap-0.5 text-[7.5px] font-bold text-slate-400 bg-slate-100/80 px-1.5 rounded-full border border-slate-200 shrink-0" title="Token消耗">
                                        <svg class="w-2 h-2 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                        <span class="shrink-0 text-slate-500 scale-90">${stats}</span>
                                    </div>
                                </div>

                                <button onclick="window.toggleBubbleDetail('${uniqueId}')" class="bubble-left-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="操作" style="width: 20px; height: 20px; border-radius: 10px;">
                                    <svg id="${uniqueId}-toggle-icon" class="w-2 h-2 text-slate-500 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                        <path id="${uniqueId}-path" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                                    </svg>
                                </button>
                                
                                ${needsFolding ? `
                                    <button onclick="window.toggleSidebarBubbleFoldLocal('${containerId}', '${uniqueId}', ${idx})" class="bubble-right-btn border border-slate-300 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm" title="折叠/展开" style="width: 20px; height: 20px; border-radius: 10px;">
                                        <svg class="w-2 h-2 text-slate-500 transition-transform ${!isFolded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                        </svg>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        chatList.appendChild(wrapper);
        if (msg.playScanEffect) msg.playScanEffect = false;
        if (msg.isBubbleNew) msg.isBubbleNew = false;
    });
    chatList.scrollTop = chatList.scrollHeight;
}

// ===== Sidebar bubble fold toggle =====
function toggleSidebarBubbleFoldLocal(containerId, uniqueId, idx) {
    const historyArray = containerId === 'sidebar-chat-list' ? getSidebarDialogueHistory() : state.editorSessions;
    const isFolded = !(historyArray[idx].isFolded === false ? false : true);
    historyArray[idx].isFolded = isFolded;
    
    const textEl = document.getElementById(`${uniqueId}-text`);
    if (!textEl) return;
    
    const bubbleEl = textEl.parentElement;
    const btnEl = bubbleEl ? bubbleEl.querySelector('button[onclick*="toggleSidebarBubbleFoldLocal"]') : null;
    const svgEl = btnEl ? btnEl.querySelector('svg') : null;
    
    const isUser = uniqueId.includes('-user-');
    const targetClampClass = isUser ? 'line-clamp-2' : 'line-clamp-3';
    
    if (!isFolded) {
        const collapsedHeight = textEl.offsetHeight;
        const fullHeight = textEl.scrollHeight;
        
        textEl.style.overflow = 'hidden';
        textEl.style.maxHeight = collapsedHeight + 'px';
        textEl.classList.remove(targetClampClass);
        
        textEl.offsetHeight;
        textEl.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        textEl.style.maxHeight = fullHeight + 'px';
        
        setTimeout(() => {
            textEl.style.maxHeight = '';
            textEl.style.transition = '';
            textEl.style.overflow = '';
        }, 300);
        
        if (svgEl) svgEl.classList.add('rotate-180');
    } else {
        const fullHeight = textEl.offsetHeight;
        textEl.classList.add(targetClampClass);
        const collapsedHeight = textEl.offsetHeight;
        textEl.classList.remove(targetClampClass);
        
        textEl.style.overflow = 'hidden';
        textEl.style.maxHeight = fullHeight + 'px';
        
        textEl.offsetHeight;
        textEl.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        textEl.style.maxHeight = collapsedHeight + 'px';
        
        setTimeout(() => {
            textEl.classList.add(targetClampClass);
            textEl.style.maxHeight = '';
            textEl.style.transition = '';
            textEl.style.overflow = '';
        }, 300);
        
        if (svgEl) svgEl.classList.remove('rotate-180');
    }
}

// ===== Sidebar thinking toggle =====
function toggleSidebarThinkingLocal(containerId, idx) {
    const historyArray = containerId === 'sidebar-chat-list' ? getSidebarDialogueHistory() : state.editorSessions;
    const isOpen = !historyArray[idx].isThinkingOpen;
    historyArray[idx].isThinkingOpen = isOpen;
    
    const uniqueId = `${containerId}-ai-${idx}`;
    const contentEl = document.getElementById(`${uniqueId}-thinking-content`);
    if (contentEl) {
        if (isOpen) {
            contentEl.classList.add('open');
        } else {
            contentEl.classList.remove('open');
        }
        
        const btn = contentEl.previousElementSibling ? contentEl.previousElementSibling.querySelector('button') : null;
        const svg = btn ? btn.querySelector('svg') : null;
        if (svg) {
            if (isOpen) {
                svg.classList.add('rotate-180');
            } else {
                svg.classList.remove('rotate-180');
            }
        }
    }
}

// ===== Animate thinking button text =====
function animateThinkingBtnText(uniqueId, newText, isSlow = false) {
    const span = document.getElementById(`${uniqueId}-thinking-btn-text`);
    if (!span) return;
    
    const outClass = isSlow ? 'wipe-out-text-slow' : 'wipe-out-text';
    const inClass = isSlow ? 'wipe-in-text-slow' : 'wipe-in-text';
    const outDuration = isSlow ? 450 : 200;
    const pauseDuration = isSlow ? 200 : 100;
    const inDuration = isSlow ? 450 : 200;
    
    span.classList.remove('wipe-in-text', 'wipe-in-text-slow');
    span.classList.add(outClass);
    
    setTimeout(() => {
        span.textContent = newText;
        span.classList.remove(outClass);
        span.classList.add(inClass);
        
        setTimeout(() => {
            span.classList.remove(inClass);
        }, inDuration);
    }, outDuration + pauseDuration);
}

// ===== Send sidebar message =====
async function sendSidebarMessageFromComponent(text) {
    const chatList = document.getElementById('sidebar-chat-list');
    if (!chatList) return;

    getSidebarDialogueHistory().push({
        sender: "user",
        text: text,
        isFolded: text.length > 50,
        isNew: true
    });
    await saveCurrentSidebarSession();

    if (state.sidebarInputBox) state.sidebarInputBox.setValue('');
    renderSidebarDialogueArea('sidebar-chat-list', getSidebarDialogueHistory());
    
    setTimeout(() => {
        const aiIdx = getSidebarDialogueHistory().length;
        const uniqueId = `sidebar-chat-list-ai-${aiIdx}`;
        
        const newAiMsg = {
            sender: "ai",
            text: "",
            thinking: "",
            isThinkingOpen: true,
            isFolded: false,
            isStreaming: true,
            isStreamingThinking: true,
            currentThinkingHeader: "Thinking...",
            isNew: true,
            isBubbleNew: true
        };
        
        getSidebarDialogueHistory().push(newAiMsg);
        renderSidebarDialogueArea('sidebar-chat-list', getSidebarDialogueHistory());
        
        const fullThinkingText = `用户输入指令。${text}。\n分析当前设定集上下文。\n检查设定条目关联性。\n同步数据结构。\n推理完成。`;
        const fullNovelText = `已收到指令。已处理 "<strong class="text-blue-500 font-bold">${text}</strong>" 相关的设定变更。`;
        
        let thinkCharIdx = 0;
        const thinkTimer = setInterval(() => {
            if (thinkCharIdx < fullThinkingText.length) {
                newAiMsg.thinking = fullThinkingText.substring(0, thinkCharIdx + 4);
                thinkCharIdx += 4;
                
                const textEl = document.getElementById(`${uniqueId}-thinking-text-el`);
                if (textEl) {
                    textEl.textContent = newAiMsg.thinking;
                }
                chatList.scrollTop = chatList.scrollHeight;
            } else {
                clearInterval(thinkTimer);
                newAiMsg.thinking = fullThinkingText;
                newAiMsg.isStreamingThinking = false;
                
                animateThinkingBtnText(uniqueId, "Show Thinking", true);
                
                const storyContainer = document.getElementById(`${uniqueId}-story-bubble-container`);
                if (storyContainer) {
                    storyContainer.classList.remove('hidden');
                    storyContainer.classList.add('flex');
                }
                
                let charIdx = 0;
                const textTimer = setInterval(() => {
                    if (charIdx < fullNovelText.length) {
                        newAiMsg.text = fullNovelText.substring(0, charIdx + 3);
                        charIdx += 3;
                        
                        const textEl = document.getElementById(`${uniqueId}-text`);
                        if (textEl) {
                            textEl.innerHTML = newAiMsg.text;
                        }
                        chatList.scrollTop = chatList.scrollHeight;
                    } else {
                        clearInterval(textTimer);
                        newAiMsg.text = fullNovelText;
                        newAiMsg.isStreaming = false;
                        newAiMsg.stats = "12.8k / 1.4k / 180";
                        const sidebarTextEl = document.getElementById(`${uniqueId}-text`);
                        if (sidebarTextEl) sidebarTextEl.textContent = fullNovelText;
                        const sidebarBubbleEl = sidebarTextEl?.closest('.message-bubble');
                        if (sidebarBubbleEl) sidebarBubbleEl.classList.add('sweep-scan-active');
                        saveCurrentSidebarSession();
                    }
                }, 30);
            }
        }, 30);
    }, 800);
}

// ===== Setting ref popup =====
function openSettingRefPopup(e) {
    const popup = document.getElementById('setting-ref-popup');
    if (!popup) return;
    
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        const btn = e.target.closest('button') || e.currentTarget;
        positionPopupSmart(popup, btn, 8);
        
        renderSettingRefList();
        const searchInput = document.getElementById('setting-ref-search');
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    }
    e.stopPropagation();
}

// ===== Collection mount popup =====
function openCollectionMountPopup(e) {
    const popup = document.getElementById('collection-mount-popup');
    if (!popup) return;

    const list = document.getElementById('collection-mount-list');
    if (list) {
        list.innerHTML = '';
        Object.keys(state.loresetData).forEach(id => {
            const col = state.loresetData[id];
            const displayName = col.displayName || col.title || `设定集${id}`;

            const el = document.createElement('div');
            el.className = 'px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-blue-50/70 hover:text-blue-600 rounded-xl cursor-pointer transition-colors flex items-center gap-2 select-none';
            el.innerHTML = `
                <svg viewBox="0 0 100 100" class="w-3.5 h-3.5 text-slate-400 shrink-0" stroke="currentColor" fill="none" stroke-width="10" stroke-linecap="round">
                    <rect x="18" y="22" width="26" height="14" rx="7" />
                    <rect x="60" y="16" width="14" height="30" rx="7" />
                    <rect x="18" y="52" width="14" height="30" rx="7" />
                    <rect x="48" y="62" width="26" height="14" rx="7" />
                </svg>
                <span>${displayName}</span>
            `;
            el.onclick = () => {
                if (typeof window.setInterfaceState === 'function') {
                    window.setInterfaceState('creating', displayName);
                }
                popup.classList.add('hidden');
            };
            list.appendChild(el);
        });
    }
    
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        const btn = e.target.closest('button') || e.currentTarget;
        positionPopupSmart(popup, btn, 8);
    }
    e.stopPropagation();
}

// ===== Setting ref list =====
async function renderSettingRefList(filter = '') {
    const list = document.getElementById('setting-ref-list');
    if (!list) return;
    list.innerHTML = '';

    const allItems = [];
    if (state.currentLoreSetId && state.loresetData[state.currentLoreSetId]) {
        const col = state.loresetData[state.currentLoreSetId];
        const typeToCategory = { event: '事件', character: '角色', worldview: '世界观', prop: '道具', scene: '场景' };
        (col.kg?.nodes || []).forEach(n => {
            allItems.push({ category: typeToCategory[n.type] || n.type, name: n.name });
        });
    }
    
    const filtered = filter ? allItems.filter(i => i.name.includes(filter)) : allItems;
    
    filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = 'px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-blue-50 rounded cursor-pointer transition-colors flex items-center gap-2';
        el.style.borderRadius = 'var(--global-radius)';
        el.innerHTML = `
            <span class="text-[8px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">${item.category}</span>
            <span>${item.name}</span>
        `;
        el.onclick = () => {
            if (state.sidebarInputBox && state.sidebarInputBox.textarea) {
                state.sidebarInputBox.textarea.value += `@${item.name} `;
                state.sidebarInputBox.textarea.focus();
            }
            document.getElementById('setting-ref-popup').classList.add('hidden');
        };
        list.appendChild(el);
    });
}

function filterSettingRefItems() {
    const search = document.getElementById('setting-ref-search');
    renderSettingRefList(search ? search.value.trim() : '');
}

// ===== Quick actions popup =====
function toggleQuickActionsPopup(e) {
    const popup = document.getElementById('quick-actions-popup');
    if (!popup) return;
    
    const btn = e.target.closest('button, div');
    const rect = btn.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
    popup.style.left = `${rect.left + window.scrollX - 210}px`;
    popup.classList.toggle('hidden');
    e.stopPropagation();
}

// ===== QA Import/Export =====
function handleQAImport() {
    if (window.isUserLoggedIn) {
        window.isUserLoggedIn = false;
        state.isUserLoggedIn = false;
        
        document.getElementById('qa-avatar').textContent = "G";
        document.getElementById('qa-username').textContent = "游客账户 (Guest)";
        document.getElementById('qa-db-status').textContent = "数据库未导入";
        
        const importBtn = document.getElementById('qa-import-btn');
        importBtn.className = "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100/80 active:scale-[0.98] border border-blue-200/60 text-[10px] font-bold text-blue-600 transition-all";
        importBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>导入数据库 (登录)</span>
        `;
        
        const exportBtn = document.getElementById('qa-export-btn');
        exportBtn.disabled = true;
        exportBtn.className = "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200/40 text-[10px] font-bold transition-all cursor-not-allowed";
        exportBtn.querySelector('span').textContent = "导出数据库 (需登录)";
        
        alert("已成功退出登录，已断开数据库连接！");
    } else {
        const username = prompt("请输入用户名以导入个人数据库:", "Xiaodai");
        if (username === null) return;
        if (!username.trim()) return alert("用户名不能为空！");
        
        const dbName = prompt("请输入要挂载的数据库名称:", "WorldStory_DB_v1.0");
        if (dbName === null) return;
        if (!dbName.trim()) return alert("数据库名称不能为空！");
        
        window.isUserLoggedIn = true;
        state.isUserLoggedIn = true;
        
        document.getElementById('qa-avatar').textContent = username.trim().charAt(0).toUpperCase();
        document.getElementById('qa-username').textContent = `${username.trim()} (Administrator)`;
        document.getElementById('qa-db-status').textContent = `已挂载: ${dbName.trim()}`;
        
        const importBtn = document.getElementById('qa-import-btn');
        importBtn.className = "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100/80 active:scale-[0.98] border border-rose-200/60 text-[10px] font-bold text-rose-600 transition-all";
        importBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>退出登录 (断开数据库)</span>
        `;
        
        const exportBtn = document.getElementById('qa-export-btn');
        exportBtn.disabled = false;
        exportBtn.className = "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] border border-emerald-200/60 text-[10px] font-bold text-emerald-600 transition-all cursor-pointer";
        exportBtn.querySelector('span').textContent = "导出数据库 (JSON)";
        
        alert(`欢迎回来，${username.trim()}！成功导入数据库【${dbName.trim()}】。`);
    }
}

function handleQAExport() {
    if (!window.isUserLoggedIn) return;
    alert("正在备份并生成数据库镜像...\n\n已成功导出云数据库备份：\n'WorldStory_Backup.json'，已保存至您的本地云存储空间。");
}

// ===== Node bar =====
function buildNodeBar() {
    const track = document.getElementById('node-bar-track');
    const chatArea = document.getElementById('dialogue-chat-area');
    if (!track || !chatArea) return;
    track.innerHTML = '';
    
    const allMessages = chatArea.children;
    const userNodes = [];
    
    for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i];
        if (msg.dataset && msg.dataset.role === 'user') {
            let aiHeight = 0;
            for (let j = i + 1; j < allMessages.length; j++) {
                if (allMessages[j].dataset && allMessages[j].dataset.role === 'user') break;
                aiHeight += allMessages[j].offsetHeight || 50;
            }
            if (aiHeight === 0) aiHeight = 50;
            userNodes.push({ element: msg, aiHeight: aiHeight });
        }
    }
    
    if (userNodes.length === 0) return;
    
    if (userNodes.length === 1) {
        const dot = document.createElement('div');
        dot.className = `w-2.5 h-2.5 rounded-full border cursor-pointer transition-all bg-emerald-500 border-emerald-600 shadow-md`;
        dot.title = `最新消息`;
        dot.onclick = () => {
            userNodes[0].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        track.appendChild(dot);
        return;
    }
    
    const intervalsCount = userNodes.length - 1;
    let totalWeight = 0;
    for (let i = 0; i < intervalsCount; i++) {
        totalWeight += userNodes[i].aiHeight;
    }
    
    const dotHeight = 10;
    const trackHeight = track.clientHeight || 400;
    const remainingHeight = Math.max(0, trackHeight - userNodes.length * dotHeight);
    
    userNodes.forEach((node, idx) => {
        const isLast = idx === userNodes.length - 1;
        const dot = document.createElement('div');
        dot.className = `w-2.5 h-2.5 rounded-full border cursor-pointer transition-all shrink-0 ${isLast ? 'bg-emerald-500 border-emerald-600 shadow-md' : 'bg-slate-300 border-slate-400 hover:bg-slate-400'}`;
        dot.title = `消息 ${idx + 1}`;
        dot.onclick = () => {
            node.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        track.appendChild(dot);
        
        if (!isLast) {
            const spacer = document.createElement('div');
            const weightRatio = totalWeight > 0 ? (node.aiHeight / totalWeight) : (1 / intervalsCount);
            const spacerHeight = remainingHeight * weightRatio;
            spacer.style.height = `${spacerHeight}px`;
            spacer.className = 'shrink-0';
            track.appendChild(spacer);
        }
    });
}

// ===== Expose all functions to window =====
window.loadStoryDialogue = loadStoryDialogue;
window.renderDeductionStepsHTML = renderDeductionStepsHTML;
window.renderDialogueArea = renderDialogueArea;
window.toggleBubbleDetail = toggleBubbleDetail;
window.editMessage = editMessage;
window.triggerMainMessageEdit = triggerMainMessageEdit;
window.sendDialogueMessageFromComponent = sendDialogueMessageFromComponent;
window.switchSidebarCategory = switchSidebarCategory;
window.toggleRightSidebar = toggleRightSidebar;
window.filterSidebarItems = filterSidebarItems;
window.renderSidebarItems = renderSidebarItems;
window.showEventDetail = showEventDetail;
window.createEditWelcomeMsg = createEditWelcomeMsg;
window.saveCurrentSidebarSession = saveCurrentSidebarSession;
window.loadOrCreateSidebarSession = loadOrCreateSidebarSession;
window.renderSidebarDialogueArea = renderSidebarDialogueArea;
window.toggleSidebarBubbleFoldLocal = toggleSidebarBubbleFoldLocal;
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
window.renderSingleDeductionStepHTML = renderSingleDeductionStepHTML;
window.animateButtonHeader = animateButtonHeader;

// Also expose helper functions referenced by inline onclick
window.copyMainMessage = copyMainMessage;
window.copySidebarMessage = copySidebarMessage;
window.triggerSidebarMessageEdit = triggerSidebarMessageEdit;
window.branchFromMessage = branchFromMessage;
window.toggleBubbleFoldLocal = toggleBubbleFoldLocal;
window.toggleDeductionLocal = toggleDeductionLocal;
window.toggleSidebarThinkingLocal = toggleSidebarThinkingLocal;
window.getSidebarDialogueHistory = getSidebarDialogueHistory;
