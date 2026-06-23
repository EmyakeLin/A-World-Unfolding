import { getAllModels, getCustomModels, getDuplicateModelNames, getShortModelName } from '../utils/model-manager.js';
import { state } from '../state.js';

class InputBox {
    constructor(options) {
        this.containerId = options.containerId;
        this.type = options.type; // 'home' | 'dialogue' | 'sidebar'
        this.placeholder = options.placeholder || '输入文本开始创作...';
        this.onSubmit = options.onSubmit;
        this.isCompact = options.isCompact || false;
        
        this.element = null;
        this.textarea = null;
        this._sendBtn = null;

        this.init();
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        const prevVal = this.textarea ? this.textarea.value : '';
        const isCompact = this.isCompact;
        
        container.innerHTML = '';
        
        // Create outer container
        const outer = document.createElement('div');
        this.element = outer;
        
        if (isCompact) {
            // Sidebar compact input style (concentric R=22px, offset = 22 - 11 = 11px)
            outer.className = 'sidebar-box-outer w-full flex flex-col relative';
            outer.style.height = '90px';
            outer.style.borderRadius = '22px';
            outer.style.padding = '8px 12px';
            
            // Textarea inside compact box
            const textarea = document.createElement('textarea');
            textarea.className = 'w-full flex-1 bg-transparent border-0 outline-none resize-none text-slate-700 placeholder-slate-400 font-normal leading-relaxed text-[10px] py-0.5 focus:ring-0';
            textarea.placeholder = this.placeholder;
            textarea.style.marginBottom = '24px';
            this.textarea = textarea;
            outer.appendChild(textarea);
            
            // Left wrapper (absolutely positioned concentric at left: 11px; bottom: 11px;)
            const leftContainer = document.createElement('div');
            leftContainer.className = 'absolute left-[11px] bottom-[11px] flex items-center gap-1.5 z-10';
            
            // Left @ button (diameter 22px)
            const leftBtn = document.createElement('button');
            leftBtn.className = 'w-[22px] h-[22px] rounded-full border border-slate-300 flex items-center justify-center bg-white hover:bg-slate-50 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0';
            leftBtn.title = '引用设定';
            leftBtn.innerHTML = '<span class="text-[10px] font-bold text-slate-500">@</span>';
            leftBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof openSettingRefPopup === 'function') {
                    openSettingRefPopup(e);
                }
            });
            leftContainer.appendChild(leftBtn);
            
            // Replicating normal checkmark + pill pattern in miniature, matching the main input box!
            let currentColName = '设定集';
            if (this.type === 'sidebar' && this.containerId === 'edit-chat-input-container') {
                const editTitleEl = document.getElementById('edit-collection-title');
                if (editTitleEl && editTitleEl.textContent.trim()) {
                    currentColName = editTitleEl.textContent.trim();
                } else {
                    currentColName = document.getElementById('dialogue-collection-name')?.textContent || '设定集';
                }
            } else {
                currentColName = document.getElementById('dialogue-collection-name')?.textContent || '设定集';
            }
            
            // 检测是否为独立故事（侧边栏模式使用 isEditingIndependentStory，避免受 dialogue 页残留 dataset 影响）
            const isIndependentCol = (this.type === 'sidebar')
                ? state.isEditingIndependentStory
                : (document.getElementById('dialogue-collection-name')?.dataset.independent === 'true');

            if (isIndependentCol) {
                // 独立故事：斜杠 + "独立故事"（蓝色，不可点击）
                const colCheck = document.createElement('div');
                colCheck.className = 'w-[22px] h-[22px] rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm shrink-0 select-none cursor-default';
                colCheck.title = '无设定集';
                colCheck.innerHTML = `
                    <svg class="w-2.5 h-2.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6"/>
                    </svg>
                `;
                leftContainer.appendChild(colCheck);

                const colPill = document.createElement('span');
                colPill.className = 'inline-flex items-center gap-1 bg-blue-50/50 border border-blue-200/80 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-blue-600 shadow-sm truncate max-w-[80px] select-none cursor-default';
                colPill.style.height = '22px';
                colPill.title = '独立故事';
                colPill.innerHTML = `<span class="truncate active-col-name">独立故事</span>`;
                leftContainer.appendChild(colPill);
            } else {
                // 设定集故事：✔ + 设定集胶囊（可点击）
                const colCheck = document.createElement('div');
                colCheck.className = 'w-[22px] h-[22px] rounded-full border border-blue-200 flex items-center justify-center bg-blue-50/50 shadow-sm shrink-0 select-none cursor-default';
                colCheck.title = '设定集已挂载';
                colCheck.innerHTML = `
                    <svg class="w-2.5 h-2.5 text-blue-500" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                `;
                leftContainer.appendChild(colCheck);

                const colPill = document.createElement('span');
                colPill.className = 'inline-flex items-center gap-1 bg-white border border-slate-200/80 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 hover:bg-slate-50 shadow-sm truncate max-w-[80px] select-none cursor-pointer';
                colPill.style.height = '22px';
                colPill.title = currentColName;
                colPill.innerHTML = `
                    <svg viewBox="0 0 100 100" class="w-2.5 h-2.5 text-slate-400 shrink-0" stroke="currentColor" fill="none" stroke-width="10" stroke-linecap="round">
                        <rect x="18" y="22" width="26" height="14" rx="7" />
                        <rect x="60" y="16" width="14" height="30" rx="7" />
                        <rect x="18" y="52" width="14" height="30" rx="7" />
                        <rect x="48" y="62" width="26" height="14" rx="7" />
                    </svg>
                    <span class="truncate active-col-name">${currentColName}</span>
                `;
                colPill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof setInterfaceState === 'function') {
                        setInterfaceState('collection-view', currentColName);
                    }
                });
                leftContainer.appendChild(colPill);
            }
            
            outer.appendChild(leftContainer);
            
            // Right controls container (absolutely positioned concentric at right: 11px; bottom: 11px;)
            const rightContainer = document.createElement('div');
            rightContainer.className = 'absolute right-[11px] bottom-[11px] flex items-center gap-1.5 z-10';
            
            // Model Trigger Inside Compact (Fully replicating the regular input box pattern with arrows and inline dropdowns!)
            const modelWrapper = document.createElement('div');
            modelWrapper.className = 'relative inline-block text-left';
            
            const currentModel = window.selectedModelName || localStorage.getItem('global-active-model') || '自定义模型';
            modelWrapper.innerHTML = `
                <div class="model-select-trigger hover:bg-slate-100/60 transition-all pl-2 pr-4 py-0.5 rounded-[10px] text-[9.5px] font-bold text-slate-600 cursor-pointer flex items-center gap-0.5 select-none relative">
                    <span class="selected-model-text truncate max-w-[55px]">${getShortModelName(currentModel)}</span>
                    <svg class="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
                <div class="model-dropdown hidden absolute right-0 bottom-full mb-1.5 z-50 w-48 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-2 shadow-xl flex flex-col gap-1 text-left">
                    ${this.getDropdownOptionsHTML()}
                </div>
            `;
            
            this.bindDropdownEvents(modelWrapper);
            rightContainer.appendChild(modelWrapper);
            
            // Send / Stop Button Inside Compact
            const sendBtn = document.createElement('button');
            sendBtn.className = 'w-[22px] h-[22px] rounded-full border border-slate-300 flex items-center justify-center bg-white hover:bg-slate-50 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0';
            sendBtn.title = '发送';
            sendBtn.innerHTML = `
                <svg class="w-2.5 h-2.5 text-slate-500 send-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                </svg>
                <svg class="w-2.5 h-2.5 text-red-500 stop-icon hidden" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
            `;
            sendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sendBtn.dataset.mode === 'stop') {
                    if (window._currentAbortController) {
                        window._currentAbortController.abort();
                        window._currentAbortController = null;
                    }
                    this.setSendMode();
                } else {
                    this.submit();
                }
            });
            this._sendBtn = sendBtn;
            rightContainer.appendChild(sendBtn);
            
            outer.appendChild(rightContainer);
        } else {
            // Normal input styles (concentric R=36px, padding is standard via classes, no absolute positioning needed for bottom elements!)
            outer.className = 'modern-box-outer w-full flex flex-col pt-8';
            outer.style.height = '130px';
            
            // Textarea
            const textarea = document.createElement('textarea');
            textarea.className = 'w-full flex-1 bg-transparent border-0 outline-none resize-none text-slate-700 placeholder-slate-400 font-normal leading-relaxed text-xs pl-1.5 focus:ring-0';
            textarea.placeholder = this.placeholder;
            this.textarea = textarea;
            outer.appendChild(textarea);
            
            // Bottom toolbar
            const toolbar = document.createElement('div');
            toolbar.className = 'flex items-center justify-between w-full mt-auto relative';
            
            // Left container: Plus / Check + Pill / At + Character(s)
            const leftContainer = document.createElement('div');
            leftContainer.className = 'flex items-center gap-2';
            
            const isHome = this.type === 'home';
            const isChat = this.type === 'chat';
            const isCreating = document.body.classList.contains('state-creating');
            const activeColName = document.querySelector('.active-collection-name')?.textContent || '设定集';
            const currentDialogueColName = document.getElementById('dialogue-collection-name')?.textContent || '设定集';
            
            if (isChat) {
                const hasSelected = state.selectedChatCharacters.length > 0;
                if (!hasSelected) {
                    // Chat mode unselected: At + 未加载
                    leftContainer.innerHTML = `
                        <div class="chat-at-btn modern-circle text-sm font-semibold text-slate-500 cursor-pointer active:scale-95" title="引用角色">
                            <span class="text-xs font-bold text-slate-500">@</span>
                        </div>
                        <span class="text-[11px] font-semibold text-slate-400 select-none">未加载</span>
                    `;
                    leftContainer.querySelector('.chat-at-btn').addEventListener('click', openChatAtPopup);
                } else {
                    // Chat mode selected: Checkmark + Character Pill(s)
                    const charName = state.selectedChatCharacters.length === 1 ? state.selectedChatCharacters[0].name : 'Group';
                    leftContainer.innerHTML = `
                        <div class="chat-checkmark-btn modern-circle text-sm font-semibold text-blue-500 border-blue-200 cursor-pointer active:scale-95" title="引用角色">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                        <span class="chat-pill-btn modern-pill inline-flex items-center gap-1 border-slate-200 text-[11px] font-semibold text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50">
                            <span class="text-blue-400 font-bold">@</span>
                            <span class="active-char-name">${charName}</span>
                        </span>
                    `;
                    leftContainer.querySelector('.chat-checkmark-btn').addEventListener('click', openChatAtPopup);
                    leftContainer.querySelector('.chat-pill-btn').addEventListener('click', openChatAtPopup);
                }
            } else if (isHome && !isCreating) {
                // Home mode: Plus + 未加载
                leftContainer.innerHTML = `
                    <div class="plus-btn modern-circle text-sm font-semibold text-slate-500 cursor-pointer active:scale-95" title="挂载设定集">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                    </div>
                    <span class="text-[11px] font-semibold text-slate-400">未加载</span>
                `;
                leftContainer.querySelector('.plus-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof openCollectionMountPopup === 'function') {
                        openCollectionMountPopup(e);
                    } else {
                        setInterfaceState('creating', '设定集');
                    }
                });
            } else {
                // Creating or Dialogue mode
                const colName = isHome ? activeColName : currentDialogueColName;
                const isIndependent = document.getElementById('dialogue-collection-name')?.dataset.independent === 'true';
                if (isIndependent && !isHome) {
                    // 独立故事：斜杠（禁用）+ "独立故事"（蓝色）
                    leftContainer.innerHTML = `
                        <div class="modern-circle text-sm font-semibold text-slate-400 border-slate-200 cursor-default" title="无设定集">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6"/>
                            </svg>
                        </div>
                        <span class="pill-btn modern-pill inline-flex items-center gap-1 border-blue-200 text-[11px] font-semibold text-blue-600 shadow-sm cursor-default bg-blue-50/50">
                            <span class="active-col-name">独立故事</span>
                        </span>
                    `;
                } else {
                    // 设定集故事：✔ + 设定集胶囊
                    leftContainer.innerHTML = `
                        <div class="modern-circle text-sm font-semibold text-blue-500 border-blue-200 cursor-pointer active:scale-95" title="设定集已挂载">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                        <span class="pill-btn modern-pill inline-flex items-center gap-1 border-slate-200 text-[11px] font-semibold text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50">
                            <svg viewBox="0 0 100 100" class="w-3.5 h-3.5 text-slate-400 shrink-0" stroke="currentColor" fill="none" stroke-width="10" stroke-linecap="round">
                                <rect x="18" y="22" width="26" height="14" rx="7" />
                                <rect x="60" y="16" width="14" height="30" rx="7" />
                                <rect x="18" y="52" width="14" height="30" rx="7" />
                                <rect x="48" y="62" width="26" height="14" rx="7" />
                            </svg>
                            <span class="active-col-name">${colName}</span>
                        </span>
                    `;
                    leftContainer.querySelector('.pill-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        setInterfaceState('collection-view', colName);
                    });
                }
            }
            toolbar.appendChild(leftContainer);
            
            // Right container: Model Select + Send
            const rightContainer = document.createElement('div');
            rightContainer.className = 'flex items-center gap-3';
            
            // Model Trigger Inside Normal
            const modelWrapper = document.createElement('div');
            modelWrapper.className = 'relative inline-block text-left';
            
            const currentModel = window.selectedModelName || localStorage.getItem('global-active-model') || '自定义模型';
            const openDirectionClass = isHome ? 'top-full mt-1.5' : 'bottom-full mb-1.5';
            
            modelWrapper.innerHTML = `
                <div class="model-select-trigger hover:bg-slate-100/60 transition-all pl-2 pr-5 py-0.5 rounded text-[11px] font-semibold text-slate-600 cursor-pointer flex items-center gap-1 select-none">
                    <span class="selected-model-text">${getShortModelName(currentModel, 24)}</span>
                    <svg class="w-2.5 h-2.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
                <div class="model-dropdown hidden absolute right-0 z-50 w-56 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-2 shadow-xl flex flex-col gap-1 text-left ${openDirectionClass}">
                    ${this.getDropdownOptionsHTML()}
                </div>
            `;
            
            this.bindDropdownEvents(modelWrapper);
            rightContainer.appendChild(modelWrapper);
            
            // Send / Stop button
            const sendBtn = document.createElement('div');
            sendBtn.className = 'modern-circle text-slate-600 border-slate-200 cursor-pointer active:scale-95';
            sendBtn.title = '发送';
            sendBtn.innerHTML = `
                <svg class="w-3.5 h-3.5 text-slate-500 send-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                </svg>
                <svg class="w-3.5 h-3.5 text-red-500 stop-icon hidden" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
            `;
            sendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sendBtn.dataset.mode === 'stop') {
                    // 中止请求
                    if (window._currentAbortController) {
                        window._currentAbortController.abort();
                        window._currentAbortController = null;
                    }
                    this.setSendMode();
                } else {
                    this.submit();
                }
            });
            this._sendBtn = sendBtn;
            rightContainer.appendChild(sendBtn);
            
            toolbar.appendChild(rightContainer);
            outer.appendChild(toolbar);
        }
        
        container.appendChild(outer);
        
        // Handle Enter key (Shift+Enter for new line)
        if (this.textarea) {
            this.textarea.value = prevVal;
            this.textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.submit();
                }
            });
        }
        
        // Update active checkmarks immediately
        this.updateModel(window.selectedModelName || localStorage.getItem('global-active-model') || '自定义模型');
    }

    getDropdownOptionsHTML() {
        const allModels = getAllModels();
        const activeModel = window.selectedModelName || localStorage.getItem('global-active-model') || (allModels[0] && allModels[0].name) || '自定义模型';
        const dups = getDuplicateModelNames();
        let html = '';
        allModels.forEach((m, i) => {
            const isActive = m.name === activeModel;
            const isGray = !m.hasKey;
            const showProvider = dups.has(m.name) && m.providerName;
            const nameColor = isGray ? 'text-slate-400' : 'text-slate-800';
            const descColor = isGray ? 'text-slate-300' : 'text-slate-400';
            const cursor = isGray ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';
            html += `
            <div class="model-option flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors${isActive ? ' active bg-blue-50/40' : ''} ${cursor}" data-model="${m.name}" data-provider="${m.providerId}"${isGray ? ' data-nokey="true"' : ''}>
                <div class="flex items-center gap-1.5">
                    <svg class="checked-icon w-3 h-3 text-blue-500 shrink-0${isActive ? '' : ' hidden'}" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-semibold ${nameColor}">${getShortModelName(m.name, 32)}${showProvider ? `<span class="text-[8px] font-normal text-slate-400 ml-1">(${m.providerName})</span>` : ''}</span>
                        <span class="text-[9px] ${descColor} font-normal">${isGray ? '未配置 API Key' : m.providerName}</span>
                    </div>
                </div>
            </div>`;
        });

        const dl = localStorage.getItem('deduction-level') || 'Standard';
        let dlZh = '常规流程';
        if (dl === 'Fast') dlZh = '快速推演';
        if (dl === 'Extended') dlZh = '长链验证';

        const levelLabel = (this.type === 'chat' || this.type === 'sidebar') ? 'Thinking Level' : 'Deduction Level';
        html += `
            <div class="h-px bg-slate-100 my-1"></div>

            <!-- Deduction Level Trigger -->
            <div class="thinking-level-option flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <div class="flex items-center gap-1.5">
                    <div class="w-3"></div>
                    <div class="flex flex-col">
                        <span class="text-[10px] font-semibold text-slate-800">${levelLabel}</span>
                        <span class="text-[9px] text-slate-400 font-normal deduction-level-sub">${dl} (${dlZh})</span>
                    </div>
                </div>
                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
            </div>`;
        return html;
    }
    
    bindDropdownEvents(modelWrapper) {
        const trigger = modelWrapper.querySelector('.model-select-trigger');
        const dropdown = modelWrapper.querySelector('.model-dropdown');
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Hide other dropdowns
            document.querySelectorAll('.model-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });
            dropdown.classList.toggle('hidden');
        });
        
        const options = modelWrapper.querySelectorAll('.model-option');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                if (opt.getAttribute('data-nokey') === 'true') return;
                const modelName = opt.getAttribute('data-model');
                const providerId = opt.getAttribute('data-provider');
                // 记录该模型归属的 provider（供 API 调用时取 URL/Key）
                if (providerId) {
                    localStorage.setItem('model-provider-map:' + modelName, providerId);
                }
                if (typeof selectModel === 'function') {
                    selectModel(modelName);
                }
            });
        });

        // Deduction Level Trigger Event Listeners (Hover and Click)
        const dlTrigger = modelWrapper.querySelector('.thinking-level-option');
        if (dlTrigger) {
            dlTrigger.addEventListener('mouseenter', (e) => {
                showDlPopup(dlTrigger);
            });
            dlTrigger.addEventListener('mouseleave', (e) => {
                hideDlPopup();
            });
            dlTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Click pins the Deduction Level popup
                isDlPopupClicked = true;
                if (dlPopupShowTimeout) clearTimeout(dlPopupShowTimeout);
                if (dlPopupTimeout) clearTimeout(dlPopupTimeout);
                window.openDeductionLevelPopup(dlTrigger);
            });
        }
    }
    
    updateModel(modelName) {
        if (!this.element) return;
        const triggerText = this.element.querySelector('.selected-model-text');
        if (triggerText) {
            const maxLen = this.isCompact ? 16 : 24;
            triggerText.textContent = getShortModelName(modelName, maxLen);
        }
        
        const options = this.element.querySelectorAll('.model-option');
        options.forEach(opt => {
            const dataModel = opt.getAttribute('data-model');
            const checkIcon = opt.querySelector('.checked-icon');
            if (dataModel === modelName) {
                opt.classList.add('active', 'bg-blue-50/40');
                if (checkIcon) checkIcon.classList.remove('hidden');
            } else {
                opt.classList.remove('active', 'bg-blue-50/40');
                if (checkIcon) checkIcon.classList.add('hidden');
            }
        });
    }

    // provider 变更时重建下拉菜单（事件驱动）
    rebuildDropdown() {
        if (!this.element) return;
        const dropdown = this.element.querySelector('.model-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = this.getDropdownOptionsHTML();
        const modelWrapper = dropdown.parentElement;
        if (modelWrapper) this.bindDropdownEvents(modelWrapper);
        const activeModel = window.selectedModelName || localStorage.getItem('global-active-model') || '自定义模型';
        this.updateModel(activeModel);
    }

    getValue() {
        return this.textarea ? this.textarea.value : '';
    }

    setValue(val) {
        if (this.textarea) this.textarea.value = val;
    }

    submit() {
        const val = this.getValue();
        if (val.trim() && this.onSubmit) {
            this.onSubmit(val);
        }
    }

    setStopMode() {
        const btn = this._sendBtn;
        if (!btn) return;
        btn.dataset.mode = 'stop';
        btn.title = '停止';
        btn.classList.add('border-red-300');
        btn.classList.remove('border-slate-300', 'border-slate-200');
        btn.querySelector('.send-icon')?.classList.add('hidden');
        btn.querySelector('.stop-icon')?.classList.remove('hidden');
    }

    setSendMode() {
        const btn = this._sendBtn;
        if (!btn) return;
        delete btn.dataset.mode;
        btn.title = '发送';
        btn.classList.remove('border-red-300');
        btn.classList.add('border-slate-300');
        btn.querySelector('.send-icon')?.classList.remove('hidden');
        btn.querySelector('.stop-icon')?.classList.add('hidden');
    }
}

export { InputBox };
window.InputBox = InputBox;
