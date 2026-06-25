import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { InputBox } from '../components/input-box.js';

function initChatView() {
    window.initInputBoxForPage('chat');
    
    renderChatView();
}

function renderChatView() {
    const titleEl = document.getElementById('chat-view-title');
    const aboutTitleEl = document.getElementById('chat-about-title');
    const aboutContentEl = document.getElementById('chat-about-content');
    
    if (!titleEl || !aboutTitleEl || !aboutContentEl) return;
    
    if (state.inputBox) {
        state.inputBox.init();
    }
    
    const count = state.selectedChatCharacters.length;
    
    if (count === 0) {
        titleEl.innerHTML = `与<span class="modern-pill inline-flex items-center gap-1 bg-white border border-slate-200 text-xs px-2.5 py-0.5 align-middle mx-1 select-none hover:bg-slate-50 transition-colors cursor-pointer" onclick="openChatAtPopup(event)"><span class="text-blue-500 font-bold shrink-0">@</span><span class="font-normal text-slate-800">角色</span></span><br>聊些什么？`;
        aboutTitleEl.innerHTML = `About @角色`;
        aboutContentEl.innerHTML = `
            <div class="w-full p-8 rounded-2xl border border-dashed border-slate-300 bg-white/40 flex flex-col items-center justify-center text-slate-400 h-full min-h-[140px]">
                <svg class="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <div class="text-[10px] font-semibold">点击左下角 @ 控件选择一个角色开始聊天</div>
            </div>
        `;
    } else if (count === 1) {
        const char = state.selectedChatCharacters[0];
        const charName = char.name;
        const collectionName = char.collectionName;
        const charId = char.id;
        const charDesc = char.desc || '暂无设定描述。';
        
        titleEl.innerHTML = `与<span class="modern-pill inline-flex items-center gap-1 bg-white border border-slate-200 text-xs px-2.5 py-0.5 align-middle mx-1 select-none hover:bg-slate-50 transition-colors cursor-pointer" onclick="openChatAtPopup(event)"><span class="text-blue-500 font-bold shrink-0">@</span><span class="font-normal text-slate-800">${charName}</span></span><br>聊些什么？`;
        aboutTitleEl.innerHTML = `About <span class="bg-blue-50/50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100 font-bold text-[9px] lowercase">@${charName}</span>`;
        
        aboutContentEl.innerHTML = `
            <div class="w-full p-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md flex gap-6 h-full items-stretch shadow-sm">
                <!-- Left Column -->
                <div class="w-[45%] flex flex-col justify-between py-1 border-r border-slate-200 pr-4 text-left shrink-0">
                    <div class="space-y-1">
                        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">位于设定集</div>
                        <div class="inline-flex items-center gap-1 bg-blue-50/50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[9px] font-bold">
                            <svg viewBox="0 0 100 100" class="w-2.5 h-2.5 text-blue-400 shrink-0" stroke="currentColor" fill="none" stroke-width="10" stroke-linecap="round">
                                <rect x="18" y="22" width="26" height="14" rx="7" />
                                <rect x="60" y="16" width="14" height="30" rx="7" />
                                <rect x="18" y="52" width="14" height="30" rx="7" />
                                <rect x="48" y="62" width="26" height="14" rx="7" />
                            </svg>
                            <span class="truncate max-w-[120px]">${collectionName}</span>
                        </div>
                    </div>
                    <div class="space-y-0.5 mt-2">
                        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ID</div>
                        <div class="text-[10px] font-mono text-slate-600 select-all">${charId}</div>
                    </div>
                </div>
                <!-- Right Column -->
                <div class="flex-1 flex flex-col py-1 text-left overflow-y-auto no-scrollbar">
                    <div class="space-y-0.5">
                        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">人物角色</div>
                        <div class="text-xs font-bold text-slate-800">${charName}</div>
                    </div>
                    <div class="space-y-0.5 mt-2 flex-1 min-h-0">
                        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">设定描述</div>
                        <div class="text-[10px] text-slate-500 leading-relaxed overflow-y-auto no-scrollbar max-h-[75px]">${charDesc}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        titleEl.innerHTML = `与<span class="modern-pill inline-flex items-center gap-1 bg-white border border-slate-200 text-xs px-2.5 py-0.5 align-middle mx-1 select-none hover:bg-slate-50 transition-colors cursor-pointer" onclick="openChatAtPopup(event)"><span class="text-blue-500 font-bold shrink-0">@</span><span class="font-normal text-slate-800">Group</span></span><br>聊些什么？`;
        aboutTitleEl.innerHTML = `About <span class="bg-blue-50/50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100 font-bold text-[9px] lowercase">@Group</span>`;
        
        let cardsHTML = '';
        state.selectedChatCharacters.forEach(c => {
            cardsHTML += `
                <div class="w-full p-3 rounded-2xl border border-slate-200 bg-white/60 hover:bg-white/80 transition-colors flex gap-4 items-center shadow-sm shrink-0">
                    <!-- Icon or Avatar -->
                    <div class="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-500 shrink-0 select-none">
                        ${c.name.charAt(0)}
                    </div>
                    <!-- Middle info -->
                    <div class="flex-1 min-w-0 text-left">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-800">${c.name}</span>
                            <span class="inline-flex items-center gap-0.5 bg-blue-50/50 text-blue-600 border border-blue-100 px-1.5 py-0.2 rounded-full text-[8px] font-bold">
                                ${c.collectionName.replace(/设定集\s*/, '')}
                            </span>
                        </div>
                        <div class="text-[9px] text-slate-400 mt-0.5 truncate">${c.desc || '暂无设定描述。'}</div>
                    </div>
                    <!-- Right side: ID and Value -->
                    <div class="text-right shrink-0 border-l border-slate-200 pl-4 space-y-0.5 min-w-[100px]">
                        <div class="text-[8px] font-mono text-slate-400">ID: ${c.id}</div>
                    </div>
                    <!-- Delete button -->
                    <button onclick="removeCharFromGroup('${c.id}')" class="w-4.5 h-4.5 rounded-full border border-slate-200 bg-white hover:bg-red-50 hover:text-red-500 flex items-center justify-center shadow-sm transition-all text-slate-400" title="从群聊移除" style="width:18px; height:18px;">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `;
        });
        
        aboutContentEl.innerHTML = `
            <div class="w-full h-full overflow-y-auto pr-1 space-y-2.5 scroll-smooth no-scrollbar" style="max-height: 100%;">
                ${cardsHTML}
            </div>
        `;
    }
}

window.removeCharFromGroup = function(charId) {
    state.selectedChatCharacters = state.selectedChatCharacters.filter(c => c.id !== charId);
    renderChatView();
};

function selectChatCharacter(char) {
    const idx = state.selectedChatCharacters.findIndex(c => c.id === char.id);
    if (idx !== -1) {
        state.selectedChatCharacters.splice(idx, 1);
    } else {
        state.selectedChatCharacters.push(char);
    }
    renderChatView();
}

function openChatAtPopup(e) {
    const popup = document.getElementById('chat-at-popup');
    if (!popup) return;
    
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        const btn = e.currentTarget || e.target.closest('button, .modern-circle, .modern-pill') || document.querySelector('.chat-at-btn');
        window.positionPopupSmart(popup, btn, 8);
        
        renderChatAtList();
        const searchInput = document.getElementById('chat-at-search');
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    }
    e.stopPropagation();
}

function filterChatAtItems() {
    const search = document.getElementById('chat-at-search');
    renderChatAtList(search ? search.value.trim() : '');
}

function renderChatAtList(filter = '') {
    const list = document.getElementById('chat-at-list');
    if (!list) return;
    list.innerHTML = '';

    const characters = [];
    Object.keys(state.loresetData).forEach(colId => {
        const col = state.loresetData[colId];
        const collectionName = col.displayName || col.title || `设定集 ${colId}`;
        const charNodes = (col.kg?.nodes || []).filter(n => n.type === 'character');
        charNodes.forEach(node => {
            characters.push({
                id: node.id,
                name: node.name,
                desc: node.desc,
                colId: colId,
                collectionName: collectionName
            });
        });
    });

    const filtered = filter ? characters.filter(c => c.name.includes(filter)) : characters;
    
    if (filtered.length === 0) {
        list.innerHTML = `<div class="px-3 py-2 text-[9px] text-slate-400 italic text-center">未找到匹配的角色</div>`;
        return;
    }
    
    const hasSelected = state.selectedChatCharacters.length > 0;
    
    filtered.forEach(char => {
        const isAlreadySelected = state.selectedChatCharacters.some(c => c.id === char.id);
        const el = document.createElement('div');
        el.className = 'px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2 select-none';
        el.style.borderRadius = 'var(--global-radius)';
        
        let iconHTML = '';
        if (isAlreadySelected) {
            iconHTML = `
                <svg class="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
            `;
        } else if (hasSelected) {
            iconHTML = `
                <svg class="w-3 h-3 text-slate-400 hover:text-blue-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                </svg>
            `;
        }
        
        const badgeColorClass = window.getCollectionColorClass(char.colId);
        
        el.innerHTML = `
            ${iconHTML}
            <span class="font-bold text-slate-700">${char.name}</span>
            <span class="text-slate-400 font-normal mx-0.5">in</span>
            <span class="text-[8px] font-bold px-1.5 py-0.5 rounded border ${badgeColorClass}">
                ${char.collectionName}
            </span>
        `;
        
        el.onclick = (e) => {
            e.stopPropagation();
            selectChatCharacter(char);
            document.getElementById('chat-at-popup').classList.add('hidden');
        };
        
        list.appendChild(el);
    });
}

window.initChatView = initChatView;
window.renderChatView = renderChatView;
window.selectChatCharacter = selectChatCharacter;
window.openChatAtPopup = openChatAtPopup;
window.filterChatAtItems = filterChatAtItems;
window.renderChatAtList = renderChatAtList;
