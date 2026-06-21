import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { createLoreSet, createWorldviewNode, createStory, createChatSession, createInstanceFromTemplate, createCharacterTemplate, createSceneTemplate, createItemTemplate } from '../../core/models.js';
import { buildGraph } from '../../core/graph.js';

        function loadCollection(id) {
            state.currentCollectionId = id;
            state.currentData = state.collectionsData[id];

            const displayName = state.collectionsData[id]?.displayName || state.collectionsData[id]?.title || `设定集 ${id}`;
            document.getElementById('collection-title').textContent = displayName;
            document.getElementById('collection-desc').textContent = state.currentData.desc;

            renderStoriesSection();
            renderChatsSection();
            renderCenterContent();
        }

        function renderStoriesSection() {
            const wrapper = document.getElementById('stories-wrapper');
            if (!wrapper) return;
            wrapper.innerHTML = '';
            
            const list = state.currentData.stories;
            document.getElementById('stories-count').textContent = list.length;
            
            const exceedsThreshold = list.length > 3;
            
            if (exceedsThreshold) {
                // 上界分割线
                const upperDivider = document.createElement('div');
                upperDivider.className = "h-px bg-slate-200/80 w-full shrink-0 mb-2";
                wrapper.appendChild(upperDivider);
                
                // 独立滚动的卡片区
                const scrollArea = document.createElement('div');
                scrollArea.className = "flex-1 overflow-y-auto no-scrollbar space-y-2 py-0.5 pr-1";
                scrollArea.style.maxHeight = "280px";
                
                list.forEach(story => {
                    scrollArea.appendChild(createStoryCard(story));
                });
                wrapper.appendChild(scrollArea);
                
                // 下界分割线
                const lowerDivider = document.createElement('div');
                lowerDivider.className = "h-px bg-slate-200/80 w-full shrink-0 mt-2 mb-3.5";
                wrapper.appendChild(lowerDivider);
                
                // 独立于下界之下的新建故事按钮群组
                const buttonGroup = document.createElement('div');
                buttonGroup.className = "space-y-2 shrink-0";
                buttonGroup.appendChild(createNewStoryButton());
                buttonGroup.appendChild(createAppendStoryButton());
                wrapper.appendChild(buttonGroup);
                
            } else {
                const flatList = document.createElement('div');
                flatList.className = "flex-1 flex flex-col gap-2.5 overflow-y-auto no-scrollbar";
                
                list.forEach(story => {
                    flatList.appendChild(createStoryCard(story));
                });
                
                const spacer = document.createElement('div');
                spacer.className = "h-px bg-slate-100 my-1 shrink-0";
                flatList.appendChild(spacer);
                
                flatList.appendChild(createNewStoryButton());
                flatList.appendChild(createAppendStoryButton());
                wrapper.appendChild(flatList);
            }
        }

        function createStoryCard(story) {
            const card = document.createElement('div');
            card.className = "p-3 rounded-2xl border border-slate-200/80 bg-white/75 hover:border-blue-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all cursor-pointer group flex flex-col justify-between h-[72px] shrink-0";
            card.onclick = () => {
                window.setInterfaceState('dialogue', story.name);
            };
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate w-2/3">${story.name}</span>
                    <span class="text-[9px] text-slate-400 font-semibold shrink-0">${story.rounds}轮对话 · ${story.words}字</span>
                </div>
                <p class="text-[9px] text-slate-500 line-clamp-1 leading-normal">${story.desc}</p>
            `;
            return card;
        }

        function createNewStoryButton() {
            const btn = document.createElement('button');
            btn.className = "w-full h-8 border border-dashed border-slate-300 hover:border-blue-300 bg-white/50 hover:bg-blue-50/50 hover:text-blue-600 rounded-xl text-[10px] font-bold text-slate-500 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] shrink-0";
            btn.onclick = () => {
                const name = prompt("请输入新故事的名称:", "未命名新故事");
                if (name) {
                    state.currentData.stories.push({
                        id: state.currentData.stories.length + 1,
                        name: name,
                        rounds: 0,
                        words: "0",
                        desc: "使用当前设定集快速派生创作的全新空白故事。"
                    });
                    renderStoriesSection();
                }
            };
            btn.innerHTML = `
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                <span>新故事</span>
            `;
            return btn;
        }

        function createAppendStoryButton() {
            const btn = document.createElement('button');
            btn.className = "w-full h-[46px] border border-dashed border-slate-300 hover:border-emerald-300 bg-white/50 hover:bg-emerald-50/50 hover:text-emerald-600 rounded-xl flex flex-col justify-center items-center transition-all leading-tight active:scale-[0.97] shrink-0";
            btn.onclick = () => {
                const name = prompt("追加当前设定并创建新故事，请输入新故事的名称:", "追加设定的故事");
                if (name) {
                    state.currentData.stories.push({
                        id: state.currentData.stories.length + 1,
                        name: name,
                        rounds: 1,
                        words: "230",
                        desc: "已完美对齐绑定本设定集的主线，随时可以通过快捷指令扩编。"
                    });
                    renderStoriesSection();
                }
            };
            btn.innerHTML = `
                <span class="text-[10px] font-bold">+ 追加设定的</span>
                <span class="text-[9px] font-medium opacity-80 mt-0.5">新故事</span>
            `;
            return btn;
        }

        function renderChatsSection() {
            const wrapper = document.getElementById('chats-wrapper');
            if (!wrapper) return;
            wrapper.innerHTML = '';
            
            const list = state.currentData.chats;
            document.getElementById('chats-count').textContent = list.length;
            
            const exceedsThreshold = list.length > 3;
            
            if (exceedsThreshold) {
                // 上界分割线
                const upperDivider = document.createElement('div');
                upperDivider.className = "h-px bg-slate-200/80 w-full shrink-0 mb-2";
                wrapper.appendChild(upperDivider);
                
                // 滚动区
                const scrollArea = document.createElement('div');
                scrollArea.className = "flex-1 overflow-y-auto no-scrollbar space-y-2 py-0.5 pr-1";
                scrollArea.style.maxHeight = "280px";
                
                list.forEach(chat => {
                    scrollArea.appendChild(createChatCard(chat));
                });
                wrapper.appendChild(scrollArea);
                
                // 下界分割线
                const lowerDivider = document.createElement('div');
                lowerDivider.className = "h-px bg-slate-200/80 w-full shrink-0 mt-2 mb-3.5";
                wrapper.appendChild(lowerDivider);
                
                // 按钮与快速聊天框独立于下界之下
                const buttonGroup = document.createElement('div');
                buttonGroup.className = "space-y-2 shrink-0";
                buttonGroup.appendChild(createNewChatButton());
                buttonGroup.appendChild(createQuickInputBar());
                wrapper.appendChild(buttonGroup);
                
            } else {
                const flatList = document.createElement('div');
                flatList.className = "flex-1 flex flex-col gap-2.5 overflow-y-auto no-scrollbar";
                
                list.forEach(chat => {
                    flatList.appendChild(createChatCard(chat));
                });
                
                const spacer = document.createElement('div');
                spacer.className = "h-px bg-slate-100 my-1 shrink-0";
                flatList.appendChild(spacer);
                
                flatList.appendChild(createNewChatButton());
                flatList.appendChild(createQuickInputBar());
                wrapper.appendChild(flatList);
            }
        }

        function createChatCard(chat) {
            const card = document.createElement('div');
            card.className = "p-3 rounded-2xl border border-slate-200/80 bg-white/75 hover:border-blue-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all cursor-pointer group flex items-center justify-between h-[52px] shrink-0";
            card.onclick = () => {
                alert(`正在加载与 ${chat.target} 的聊天会话...`);
                window.setInterfaceState('home');
            };
            
            const isGroup = chat.target.startsWith('@Group');
            const iconBg = isGroup ? 'bg-indigo-50 text-indigo-500' : 'bg-blue-50 text-blue-500';
            
            card.innerHTML = `
                <div class="flex items-center gap-2.5 overflow-hidden">
                    <div class="w-7 h-7 rounded-xl ${iconBg} font-bold text-xs flex items-center justify-center shrink-0">
                        ${isGroup ? 'G' : 'C'}
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-[11px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">${chat.target}</span>
                        <span class="text-[8px] text-slate-400 font-semibold mt-0.5">历史数据链路就绪</span>
                    </div>
                </div>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                    ${chat.replies}回复
                </span>
            `;
            return card;
        }

        function createNewChatButton() {
            const btn = document.createElement('button');
            btn.className = "w-full h-8 border border-dashed border-slate-300 hover:border-blue-300 bg-white/50 hover:bg-blue-50/50 hover:text-blue-600 rounded-xl text-[10px] font-bold text-slate-500 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] shrink-0";
            btn.onclick = () => {
                const handle = prompt("请输入聊天对象的ID/群组名称:", "@新角色");
                if (handle) {
                    state.currentData.chats.push({
                        id: state.currentData.chats.length + 1,
                        target: handle.startsWith('@') ? handle : '@' + handle,
                        replies: 0
                    });
                    renderChatsSection();
                }
            };
            btn.innerHTML = `
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                <span>新聊天</span>
            `;
            return btn;
        }

        function createQuickInputBar() {
            const container = document.createElement('div');
            container.className = "w-full h-8 rounded-full border border-slate-300 bg-white flex items-center justify-between px-3.5 gap-2 shrink-0 group focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100/50 transition-all";
            
            const handleText = document.createElement('span');
            handleText.className = "text-[10px] font-bold text-slate-400 select-none shrink-0";
            handleText.textContent = "@";
            
            const input = document.createElement('input');
            input.type = "text";
            input.placeholder = "快速添加单聊角色...";
            input.className = "w-full h-full bg-transparent border-0 outline-none text-[10px] font-semibold text-slate-700 placeholder-slate-300 py-1";
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                    state.currentData.chats.push({
                        id: state.currentData.chats.length + 1,
                        target: '@' + input.value.trim(),
                        replies: 0
                    });
                    input.value = '';
                    renderChatsSection();
                }
            });

            const menuBtn = document.createElement('button');
            menuBtn.className = "text-slate-400 hover:text-slate-600 transition-colors shrink-0";
            menuBtn.title = "选择预设NPC快速开聊";
            menuBtn.onclick = () => {
                const characters = state.currentData.kg.nodes.filter(n => n.type === 'character').map(n => n.name);
                if (characters.length > 0) {
                    const choice = prompt(`请输入要开聊的NPC名称 (${characters.join(' / ')}):`, characters[0]);
                    if (choice) {
                        state.currentData.chats.push({
                            id: state.currentData.chats.length + 1,
                            target: '@' + choice,
                            replies: 0
                        });
                        renderChatsSection();
                    }
                } else {
                    alert("图谱中暂无角色，请先创建角色！");
                }
            };
            menuBtn.innerHTML = `
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            `;

            container.appendChild(handleText);
            container.appendChild(input);
            container.appendChild(menuBtn);
            return container;
        }

        function renderCenterContent() {
            const graphView = document.getElementById('graph-view');
            const listView = document.getElementById('list-view');
            if (!graphView || !listView) return;

            if (state.viewMode === 'graph') {
                graphView.classList.remove('hidden');
                listView.classList.add('hidden');
                initD3ForceGraph();
            } else {
                graphView.classList.add('hidden');
                listView.classList.remove('hidden');
                renderSettingsList();
            }
        }

        function setViewMode(mode) {
            state.viewMode = mode;
            const btnGraph = document.getElementById('btn-view-graph');
            const btnList = document.getElementById('btn-view-list');
            if (!btnGraph || !btnList) return;
            
            if (mode === 'graph') {
                btnGraph.className = "text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition-all";
                btnList.className = "text-[9px] font-bold px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-700 transition-all";
            } else {
                btnList.className = "text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition-all";
                btnGraph.className = "text-[9px] font-bold px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-700 transition-all";
            }
            
            renderCenterContent();
        }

        function initD3ForceGraph() {
            if (!state.kg) {
                state.kg = new window.KGEngine('#kg-svg', {
                    colorMap: { worldview: '#2dd4bf', character: '#fb7185', scene: '#fb923c', prop: '#818cf8', root: '#3b82f6' },
                    radiusMap: { worldview: 8, character: 8, scene: 8, prop: 8, root: 15 },
                    onNodeClick: d => showDetailPanel(d),
                    onEditNode:  d => editCurrentNode(),
                    onBgClick:   () => closeDetailPanel(),
                    showDetailPanel: false,
                });
            }
            state.kg.render(state.currentData.kg);
        }

        function showDetailPanel(d) {
            state.activeSelectedNode = d;
            
            const typeLabels = {
                root: '中心设定',
                worldview: '世界观',
                character: '角色',
                scene: '场景',
                prop: '道具'
            };

            const typeColors = {
                root: 'bg-blue-500',
                worldview: 'bg-teal-500',
                character: 'bg-rose-500',
                scene: 'bg-orange-500',
                prop: 'bg-indigo-500'
            };

            const typeBadge = document.getElementById('node-detail-type');
            if (typeBadge) {
                typeBadge.textContent = typeLabels[d.type] || '设定';
                typeBadge.className = `text-[8px] font-bold px-1.5 py-0.5 rounded text-white uppercase tracking-wider shrink-0 ${typeColors[d.type] || 'bg-slate-500'}`;
            }

            const nameEl = document.getElementById('node-detail-name');
            const descEl = document.getElementById('node-detail-desc');
            if (nameEl) nameEl.textContent = d.name;
            if (descEl) descEl.textContent = d.desc || '暂无该设定的具体描述细节。';
            
            const panel = document.getElementById('node-detail-panel');
            if (panel) panel.classList.remove('hidden');
        }

        function closeDetailPanel() {
            const panel = document.getElementById('node-detail-panel');
            if (panel) panel.classList.add('hidden');
            state.activeSelectedNode = null;
        }

        function editCurrentNode() {
            if (state.activeSelectedNode) {
                const newDesc = prompt(`编修【${state.activeSelectedNode.name}】描述:`, state.activeSelectedNode.desc);
                if (newDesc !== null) {
                    state.activeSelectedNode.desc = newDesc;
                    const originNode = state.currentData.kg.nodes.find(n => n.id === state.activeSelectedNode.id || n.name === state.activeSelectedNode.name);
                    if (originNode) {
                        originNode.desc = newDesc;
                    }
                    showDetailPanel(state.activeSelectedNode);
                    if (state.viewMode === 'list') {
                        renderSettingsList();
                    }
                }
            }
        }

        function handleEditSettings() {
            const displayName = state.currentData?.displayName || state.currentData?.title || '设定集';
            window.setInterfaceState('collection-edit', displayName);
        }

        function jumpToCategory(category) {
            if (state.viewMode === 'graph') {
                const colorMap = {
                    worldview: "#2dd4bf",
                    character: "#fb7185",
                    scene: "#fb923c",
                    prop: "#818cf8"
                };

                window.d3.selectAll('#kg-svg .node circle')
                    .attr("r", d => d.type === category ? 12 : 8)
                    .attr("stroke-width", d => d.type === category ? 3 : 1.5)
                    .attr("stroke", d => d.type === category ? "#ffffff" : "#cbd5e1")
                    .style("filter", d => d.type === category ? `drop-shadow(0 0 10px ${colorMap[category]})` : 'none');

                window.d3.selectAll('#kg-svg .link-line')
                    .style("stroke-opacity", l => (l.source.type === category || l.target.type === category) ? 0.8 : 0.05)
                    .style("stroke-width", l => (l.source.type === category || l.target.type === category) ? 2 : 1);

                alert(`图谱已筛选高亮【${category.toUpperCase()}】设定。双击图谱空白处可恢复。`);
            } else {
                const targetEl = document.getElementById(`list-section-${category}`);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }

        function renderSettingsList() {
            const worldviewItems = document.getElementById('list-worldview-items');
            const sceneItems = document.getElementById('list-scene-items');
            const characterItems = document.getElementById('list-character-items');
            const propItems = document.getElementById('list-prop-items');
            
            if (!worldviewItems || !sceneItems || !characterItems || !propItems) return;
            
            worldviewItems.innerHTML = '';
            sceneItems.innerHTML = '';
            characterItems.innerHTML = '';
            propItems.innerHTML = '';
            
            const nodes = state.currentData.kg.nodes;
            
            nodes.forEach(node => {
                if (node.type === 'root') return;
                
                const item = document.createElement('div');
                item.className = "p-3 rounded-xl border border-slate-200/60 bg-white/80 hover:border-blue-200 hover:bg-white transition-all flex flex-col justify-between cursor-pointer group shadow-sm";
                item.onclick = () => {
                    const newDesc = prompt(`编修设定【${node.name}】描述:`, node.desc);
                    if (newDesc !== null) {
                        node.desc = newDesc;
                        renderSettingsList();
                    }
                };
                item.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-slate-800 group-hover:text-blue-500 transition-colors">${node.name}</span>
                        <span class="text-[8px] font-bold text-slate-400 opacity-60 uppercase shrink-0">点击编辑</span>
                    </div>
                    <p class="text-[9px] text-slate-500 mt-1 leading-normal">${node.desc || '暂无详细描述...'}</p>
                `;
                
                if (node.type === 'worldview') worldviewItems.appendChild(item);
                if (node.type === 'scene') sceneItems.appendChild(item);
                if (node.type === 'character') characterItems.appendChild(item);
                if (node.type === 'prop') propItems.appendChild(item);
            });
        }

        async function renameCollection() {
            if (state.isEditingIndependentStory) {
                const currentName = state.currentData.displayName || state.currentData.title || '独立故事';
                const newName = prompt('重命名独立故事:', currentName);
                if (newName && newName.trim()) {
                    const trimmedName = newName.trim();
                    
                    // 1. 更新内存中的当前编辑数据
                    state.currentData.displayName = trimmedName;
                    state.currentData.title = trimmedName;
                    
                    // 2. 查找并更新 state.allStories 里的对应独立故事的 title / name
                    const story = state.allStories.find(s => s.id === state.activeEditingStoryId);
                    if (story) {
                        story.title = trimmedName;
                        story.name = trimmedName;
                        
                        // 3. 保存回 IndexedDB
                        await DB.stories.put(story);
                    }
                    
                    // 4. 动态更新界面中的文本标签
                    const editTitleEl = document.getElementById('edit-collection-title');
                    if (editTitleEl) editTitleEl.textContent = `独立故事设定: ${trimmedName}`;
                    
                    // 5. 更新对话页的 header 胶囊和全局状态
                    const dialogueColNameEl = document.getElementById('dialogue-collection-name');
                    if (dialogueColNameEl && (window.activeStoryName === currentName || dialogueColNameEl.textContent === currentName || dialogueColNameEl.dataset.independent === 'true')) {
                        dialogueColNameEl.textContent = trimmedName;
                    }
                    if (window.activeStoryName === currentName) {
                        window.activeStoryName = trimmedName;
                    }
                    if (window.currentSidebarStoryName === currentName) {
                        window.currentSidebarStoryName = trimmedName;
                        // 迁移侧边栏会话 DB key（无论当前处于 story 还是 edit 模式）
                        if (window._currentSidebarSessionSource === 'story' && window._currentSidebarSessionId === currentName) {
                            const oldId = 'sidebar_story_' + currentName;
                            window._currentSidebarSessionId = trimmedName;
                            const newId = 'sidebar_story_' + trimmedName;
                            try {
                                const session = await DB.sidebarSessions.getById(oldId);
                                if (session) {
                                    session.id = newId;
                                    session.sessionId = trimmedName;
                                    await DB.sidebarSessions.put(session);
                                    await DB.sidebarSessions.delete(oldId);
                                }
                            } catch (e) { console.warn('[WorldStory] 侧边栏会话迁移失败', e); }
                        } else {
                            // 编辑模式下也需要迁移 story 模式的会话 key（否则返回对话时会话丢失）
                            const oldId = 'sidebar_story_' + currentName;
                            const newId = 'sidebar_story_' + trimmedName;
                            try {
                                const session = await DB.sidebarSessions.getById(oldId);
                                if (session) {
                                    session.id = newId;
                                    session.sessionId = trimmedName;
                                    await DB.sidebarSessions.put(session);
                                    await DB.sidebarSessions.delete(oldId);
                                }
                            } catch (e) { console.warn('[WorldStory] 编辑模式侧边栏会话迁移失败', e); }
                        }
                    }

                    // 6. 重新刷新侧边栏独立故事列表
                    await window.renderSidebarIndependentStories();
                    
                    // 7. 如果在首页，也刷新故事卡片
                    if (typeof renderCollectionOverview === 'function') {
                        await renderCollectionOverview();
                    }
                }
            } else {
                const currentName = state.currentData.displayName || state.currentData.title || '设定集';
                const newName = prompt('重命名设定集:', currentName);
                if (newName && newName.trim()) {
                    const trimmedName = newName.trim();

                    // 更新内存数据
                    if (state.collectionsData[state.currentCollectionId]) {
                        state.collectionsData[state.currentCollectionId].displayName = trimmedName;
                        state.collectionsData[state.currentCollectionId].title = trimmedName;
                    }
                    state.currentData.displayName = trimmedName;
                    state.currentData.title = trimmedName;

                    // 动态更新页面中的所有设定集名称标签
                    const editTitleEl = document.getElementById('edit-collection-title');
                    if (editTitleEl) editTitleEl.textContent = trimmedName;

                    const viewTitleEl = document.getElementById('collection-title');
                    if (viewTitleEl) viewTitleEl.textContent = trimmedName;

                    const dialogueColNameEl = document.getElementById('dialogue-collection-name');
                    if (dialogueColNameEl) dialogueColNameEl.textContent = trimmedName;

                    // 重新刷新侧边栏和概览页
                    await window.renderSidebarCollections();
                    if (document.body.classList.contains('state-collection-overview')) {
                        await renderCollectionOverview();
                    }
                }
            }
        }

        async function renameStory(storyId) {
            const storyDb = await DB.stories.getById(storyId);
            if (!storyDb) {
                alert("未找到该故事！");
                return;
            }

            const oldTitle = storyDb.title;
            const newTitle = prompt("重命名故事:", oldTitle);
            if (!newTitle || !newTitle.trim() || newTitle.trim() === oldTitle) {
                return;
            }

            const trimmedTitle = newTitle.trim();

            // 1. 更新数据库中的 title
            storyDb.title = trimmedTitle;
            await DB.stories.put(storyDb);

            // 2. 更新内存 state.allStories 数组中的属性
            const storyMem = state.allStories.find(s => s.id === storyId);
            if (storyMem) {
                storyMem.name = trimmedTitle;
                storyMem.title = trimmedTitle;
            }

            // 3. 更新内存 state.collectionsData 里的 stories 列表
            for (const key in state.collectionsData) {
                const col = state.collectionsData[key];
                if (col.stories) {
                    const stoCol = col.stories.find(s => s.id === storyId);
                    if (stoCol) {
                        stoCol.name = trimmedTitle;
                        stoCol.title = trimmedTitle;
                    }
                }
            }

            // 4. 更新 state.storyDialogues 对话数据缓存中的键名
            if (state.storyDialogues[oldTitle]) {
                state.storyDialogues[trimmedTitle] = state.storyDialogues[oldTitle];
                delete state.storyDialogues[oldTitle];
            }

            // 5. 如果是当前处于 active 状态的故事，刷新相关的文本和全局变量
            if (window.activeStoryName === oldTitle) {
                window.activeStoryName = trimmedTitle;
                const titleEl = document.getElementById('dialogue-story-title');
                if (titleEl) titleEl.textContent = trimmedTitle;
            }
            if (window.currentSidebarStoryName === oldTitle) {
                window.currentSidebarStoryName = trimmedTitle;
                // 迁移侧边栏会话 DB key（无论当前处于 story 还是 edit 模式）
                if (window._currentSidebarSessionSource === 'story' && window._currentSidebarSessionId === oldTitle) {
                    const oldId = 'sidebar_story_' + oldTitle;
                    window._currentSidebarSessionId = trimmedTitle;
                    const newId = 'sidebar_story_' + trimmedTitle;
                    try {
                        const session = await DB.sidebarSessions.getById(oldId);
                        if (session) {
                            session.id = newId;
                            session.sessionId = trimmedTitle;
                            await DB.sidebarSessions.put(session);
                            await DB.sidebarSessions.delete(oldId);
                        }
                    } catch (e) { console.warn('[WorldStory] 侧边栏会话迁移失败', e); }
                } else {
                    // 编辑模式下也需要迁移 story 模式的会话 key（否则返回对话时会话丢失）
                    const oldId = 'sidebar_story_' + oldTitle;
                    const newId = 'sidebar_story_' + trimmedTitle;
                    try {
                        const session = await DB.sidebarSessions.getById(oldId);
                        if (session) {
                            session.id = newId;
                            session.sessionId = trimmedTitle;
                            await DB.sidebarSessions.put(session);
                            await DB.sidebarSessions.delete(oldId);
                        }
                    } catch (e) { console.warn('[WorldStory] 编辑模式侧边栏会话迁移失败', e); }
                }
            }

            // 6. 重新刷新侧边栏设定集列表与独立故事列表
            window.renderSidebarCollections();
            window.renderSidebarIndependentStories();

            // 7. 刷新主页概览
            if (typeof renderCollectionOverview === 'function') {
                renderCollectionOverview();
            }
        }

        async function deleteStory(storyId) {
            const storyDb = await DB.stories.getById(storyId);
            if (!storyDb) {
                alert("未找到该故事！");
                return;
            }

            const title = storyDb.title;
            if (!confirm(`确认要永久删除故事「${title}」吗？该操作不可逆，将彻底移除对话记录和推演历史。`)) {
                return;
            }

            // 1. 从 IndexedDB 物理删除
            await DB.stories.delete(storyId);

            // 2. 从内存 state.allStories 移除
            const idx = state.allStories.findIndex(s => s.id === storyId);
            if (idx !== -1) {
                state.allStories.splice(idx, 1);
            }

            // 3. 从内存 state.collectionsData stories 列表移除
            for (const key in state.collectionsData) {
                const col = state.collectionsData[key];
                if (col.stories) {
                    const cIdx = col.stories.findIndex(s => s.id === storyId);
                    if (cIdx !== -1) {
                        col.stories.splice(cIdx, 1);
                    }
                }
            }

            // 4. 从对话缓存中删除
            delete state.storyDialogues[title];

            // 5. 如果被删除的故事是当前正在查看的故事，切换回首页状态
            if (window.activeStoryName === title) {
                window.activeStoryName = "";
                window.setInterfaceState('home');
            }
            if (window.currentSidebarStoryName === title) {
                window.currentSidebarStoryName = "";
                // 清理已删除故事的侧边栏会话
                if (window._currentSidebarSessionSource === 'story' && window._currentSidebarSessionId === title) {
                    try { await DB.sidebarSessions.delete('sidebar_story_' + title); } catch (e) { /* ignore */ }
                    window._currentSidebarSessionSource = null;
                    window._currentSidebarSessionId = null;
                }
            }

            // 6. 重新刷新侧边栏
            window.renderSidebarCollections();
            window.renderSidebarIndependentStories();

            // 7. 刷新主页概览
            if (typeof renderCollectionOverview === 'function') {
                renderCollectionOverview();
            }
        }

        function showStoryOptionsPopup(trigger, storyId) {
            let popup = document.getElementById('story-options-popup');
            if (!popup) {
                popup = document.createElement('div');
                popup.id = 'story-options-popup';
                popup.className = 'hidden fixed z-[999] w-32 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-1.5 shadow-xl flex flex-col gap-0.5 text-left transition-all duration-150 scale-95 opacity-0 origin-top-right';
                
                popup.innerHTML = `
                    <div class="story-option-item flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer select-none" id="story-opt-rename">
                        <svg class="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"/>
                        </svg>
                        <div class="flex flex-col">
                            <span class="text-[9.5px] font-semibold text-slate-700 leading-none">重命名故事</span>
                            <span class="text-[8px] text-slate-400 font-normal mt-0.5">修改故事名称</span>
                        </div>
                    </div>
                    <div class="story-option-item flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer select-none group" id="story-opt-delete">
                        <svg class="w-3 h-3 text-slate-500 group-hover:text-red-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        <div class="flex flex-col">
                            <span class="text-[9.5px] font-semibold text-slate-700 group-hover:text-red-600 leading-none">删除故事</span>
                            <span class="text-[8px] text-slate-400 font-normal mt-0.5">永久移除此故事</span>
                        </div>
                    </div>
                `;
                document.body.appendChild(popup);
            }

            const renameItem = popup.querySelector('#story-opt-rename');
            const deleteItem = popup.querySelector('#story-opt-delete');

            renameItem.onclick = (e) => {
                e.stopPropagation();
                popup.classList.add('hidden');
                renameStory(storyId);
            };

            deleteItem.onclick = (e) => {
                e.stopPropagation();
                popup.classList.add('hidden');
                deleteStory(storyId);
            };

            if (!popup.classList.contains('hidden') && popup.dataset.activeStoryId === String(storyId)) {
                popup.classList.add('hidden');
                return;
            }

            popup.dataset.activeStoryId = storyId;
            popup.style.transform = 'scale(0.95)';
            popup.style.opacity = '0';
            popup.classList.remove('hidden');

            // 动态定位悬浮操作面板
            const rect = trigger.getBoundingClientRect();
            const popupWidth = 120;
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
            popup.style.left = `${rect.right - popupWidth - 12}px`;

            // 微动画平滑展出
            setTimeout(() => {
                popup.style.transform = 'scale(1)';
                popup.style.opacity = '1';
            }, 10);
        }

        async function renderCollectionOverview() {
            const collectionsList = document.getElementById('overview-collections-list');
            const storiesList = document.getElementById('overview-stories-list');
            const collectionsCount = document.getElementById('overview-collections-count');
            const storiesCount = document.getElementById('overview-stories-count');

            if (!collectionsList || !storiesList) return;

            collectionsList.innerHTML = '';
            storiesList.innerHTML = '';

            // 1. 渲染设定集列表
            const collectionKeys = Object.keys(state.collectionsData);
            if (collectionsCount) collectionsCount.textContent = collectionKeys.length;

            collectionKeys.forEach(id => {
                const col = state.collectionsData[id];
                const displayName = col.displayName || col.title || `设定集 ${id}`;
                const desc = col.desc || '暂无描述信息...';

                const associatedStoriesCount = state.allStories.filter(s => s.type === id).length;
                const nodesCount = col.kg?.nodes?.filter(n => n.type !== 'root').length || 0;

                const card = document.createElement('div');
                card.className = "p-4 rounded-2xl border border-slate-200/50 bg-white/60 hover:bg-white/95 backdrop-blur-md hover:border-blue-300 hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.12)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[110px] group fade-in";
                card.onclick = () => {
                    window.setInterfaceState('collection-view', displayName);
                    const sidebarEl = document.getElementById(`sidebar-collection-title-${id}`);
                    if (sidebarEl) {
                        window.setActiveSidebarTab(sidebarEl.closest('.sidebar-tab'));
                    }
                };

                card.innerHTML = `
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                                    <svg viewBox="0 0 100 100" class="w-4 h-4 text-blue-500" stroke="currentColor" fill="none" stroke-width="10" stroke-linecap="round">
                                        <rect x="18" y="22" width="26" height="14" rx="7" />
                                        <rect x="60" y="16" width="14" height="30" rx="7" />
                                        <rect x="18" y="52" width="14" height="30" rx="7" />
                                        <rect x="48" y="62" width="26" height="14" rx="7" />
                                    </svg>
                                </div>
                                <span class="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">${displayName}</span>
                            </div>
                            <span class="text-[9.5px] text-slate-500 font-bold bg-slate-100/80 border border-slate-200/60 px-2 py-0.5 rounded-full select-none group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200/40 transition-colors">${associatedStoriesCount} 故事 · ${nodesCount} 设定</span>
                        </div>
                        <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed ml-10">${desc}</p>
                    </div>
                `;
                collectionsList.appendChild(card);
            });

            // 2. 渲染独立故事列表
            const independentStories = state.allStories.filter(s => s.type === 'independent');
            if (storiesCount) storiesCount.textContent = independentStories.length;
            
            independentStories.forEach(story => {
                const card = document.createElement('div');
                card.className = "p-4 rounded-2xl border border-slate-200/50 bg-white/60 hover:bg-white/95 backdrop-blur-md hover:border-indigo-300 hover:shadow-[0_8px_20px_-6px_rgba(99,102,241,0.12)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[110px] group fade-in";
                card.onclick = () => {
                    window.setInterfaceState('dialogue', story.name);
                };
                
                card.innerHTML = `
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100 transition-colors flex items-center justify-center shrink-0">
                                    <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                    </svg>
                                </div>
                                <span class="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">${story.name}</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="text-[9.5px] text-slate-500 font-bold bg-slate-100/80 border border-slate-200/60 px-2 py-0.5 rounded-full select-none group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200/40 transition-colors">${story.roundCount || 0} 轮 · ${story.wordCount || 0} 字</span>
                                <button onclick="event.stopPropagation(); window.setInterfaceState('independent-story-edit', '${story.name}')" class="text-[9.5px] text-slate-500 font-bold bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 px-2.5 py-0.5 rounded-full select-none shadow-sm cursor-pointer transition-all flex items-center gap-1" title="编辑独立故事设定">
                                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                                    </svg>
                                    <span>编辑设定</span>
                                </button>
                            </div>
                        </div>
                        <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed ml-10">${story.desc || '暂无故事背景描述，点击进入对话即可开始独创故事。'}</p>
                    </div>
                `;
                storiesList.appendChild(card);
            });
            
            // 3. 追加“新建独立故事”卡片式按钮 (完美的卡片样式，符合设定集概览页面.png设计)
            const createBtnCard = document.createElement('div');
            createBtnCard.className = "p-4 rounded-2xl border border-dashed border-slate-300 hover:border-indigo-300 bg-white/40 hover:bg-indigo-50/30 hover:shadow-[0_8px_20px_-6px_rgba(99,102,241,0.08)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-center items-center min-h-[110px] group fade-in active:scale-[0.98]";
            createBtnCard.onclick = handleCreateNewIndependentStory;
            createBtnCard.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 select-none">
                    <div class="w-8 h-8 rounded-full border border-dashed border-slate-400 group-hover:border-indigo-400 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-all group-hover:bg-white shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                    </div>
                    <span class="text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">新建独立故事</span>
                </div>
            `;
            storiesList.appendChild(createBtnCard);
        }

        async function handleCreateNewCollection() {
            const title = prompt("请输入新建设定集名称:", "未命名设定集");
            if (!title || !title.trim()) return;

            const desc = prompt("请输入设定集的描述背景:", "探索全新的时空裂缝与其规则故事...");
            if (desc === null) return;

            // 创建 LoreSet 并写入 DB
            const newLoreSet = createLoreSet(title.trim());
            newLoreSet.worldview.nodes.push(
                createWorldviewNode(title.trim(), { priority: 1, tags: ['自定义'], description: desc.trim() || '暂无描述信息...' })
            );
            await DB.loresets.put(newLoreSet);

            // 同步到 mock 变量（使用 DB ID 作为 key，保证刷新后稳定）
            state.collectionsData[newLoreSet.id] = {
                id: newLoreSet.id, title: title.trim(), displayName: title.trim(), desc: desc.trim() || '暂无描述信息...',
                stories: [], chats: [],
                kg: { nodes: [{ id: newLoreSet.worldview.nodes[0].id, name: title.trim(), type: 'worldview', desc: desc.trim() }], links: [] }
            };

            alert(`设定集【${title.trim()}】创建成功！`);

            // Refresh views
            window.renderSidebarCollections();
            renderCollectionOverview();
        }

        async function handleCreateNewIndependentStory() {
            const title = prompt("请输入新独立故事的名称:", "未命名独立故事");
            if (!title || !title.trim()) return;

            const desc = prompt("请输入故事的背景简述:", "一则发生在虚无之中的精彩科幻故事...");
            if (desc === null) return;

            const newStory = createStory(title.trim(), null);
            await DB.stories.put(newStory);

            state.allStories.push({
                id: newStory.id, name: title.trim(), type: 'independent',
                rounds: 0, words: '0 events',
                desc: desc.trim() || '暂无故事背景简述...'
            });

            alert(`独立故事【${title.trim()}】创建成功！`);

            // Refresh views
            window.renderSidebarIndependentStories();
            renderCollectionOverview();
        }

        async function enterCollectionEdit(collectionName) {
            state.isEditingIndependentStory = false;

            // 从 state.collectionsData 反查 LoreSet ID
            const allLS = await DB.loresets.getAll();
            const matchLS = allLS.find(ls => ls.name === collectionName);
            state.currentLoreSetId = matchLS?.id || null;

            // 确保显示世界观选项卡
            const worldviewTab = document.querySelector('#edit-category-tabs [data-category="worldview"]');
            if (worldviewTab) worldviewTab.style.display = 'block';

            // 设置返回按钮提示
            document.getElementById('edit-exit-btn')?.setAttribute('title', '返回设定集查看');

            // 切换为设定集图标和重命名提示
            document.getElementById('edit-collection-icon-blocks')?.classList.remove('hidden');
            document.getElementById('edit-collection-icon-book')?.classList.add('hidden');
            document.getElementById('edit-rename-btn')?.setAttribute('title', '重命名设定集');

            // 从 state.collectionsData 按名称查找设定集
            const matchKey = Object.keys(state.collectionsData).find(k => {
                const col = state.collectionsData[k];
                return (col.displayName || col.title) === collectionName;
            });
            if (!matchKey) { console.warn('设定集未找到:', collectionName); return; }
            state.currentCollectionId = matchKey;
            loadCollection(matchKey);

            const displayName = collectionName;
            
            const titleEl = document.getElementById('edit-collection-title');
            if (titleEl) titleEl.textContent = displayName;
            
            state.editActiveCategory = 'worldview';
            document.querySelectorAll('#edit-category-tabs .edit-category-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.category === 'worldview') tab.classList.add('active');
            });
            
            // 设定默认的“列表”（卡片网格）视图
            state.editViewMode = 'list';
            const btnList = document.getElementById('edit-view-list-btn');
            const btnGraph = document.getElementById('edit-view-graph-btn');
            if (btnList) btnList.className = "text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition-all";
            if (btnGraph) btnGraph.className = "text-[9px] font-bold px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-700 transition-all";
            
            const cardsContainer = document.getElementById('edit-cards-container');
            const graphArea = document.getElementById('edit-graph-area');
            if (cardsContainer) cardsContainer.classList.remove('hidden');
            if (graphArea) graphArea.classList.add('hidden');
            
            renderEditCards();

            window.initInputBoxForPage('sidebar');

            // 加载或创建编辑侧边栏会话
            // 注意1：必须在更新 session ID 之前保存旧会话，否则会用新会话的空数据覆盖旧会话
            // 注意2：session key 必须使用 DB ID 而非位置索引（matchKey），否则刷新后顺序变化导致会话错位
            console.log('[DEBUG enterCollectionEdit] 旧会话:', window._currentSidebarSessionSource, window._currentSidebarSessionId);
            if (window._currentSidebarSessionSource) {
                const _oldSource = window._currentSidebarSessionSource;
                const _oldId = window._currentSidebarSessionId;
                const id = 'sidebar_' + _oldSource + '_' + _oldId;
                const messages = _oldSource === 'story'
                    ? (window.sidebarDialogueHistories[_oldId] || [])
                    : window.editDialogueHistory;
                try {
                    await DB.sidebarSessions.put({
                        id, source: _oldSource, sessionId: _oldId,
                        messages: JSON.parse(JSON.stringify(messages))
                    });
                } catch (e) { console.warn('[WorldStory] 保存旧侧边栏会话失败', e); }
            }
            window._currentSidebarSessionSource = 'edit';
            window._currentSidebarSessionId = 'loreset_' + (state.currentData.id || matchKey);
            console.log('[DEBUG enterCollectionEdit] 新会话ID:', window._currentSidebarSessionId, 'DB_ID:', state.currentData.id, 'matchKey:', matchKey);
            await window.loadOrCreateSidebarSession('edit', window._currentSidebarSessionId);
            console.log('[DEBUG enterCollectionEdit] 加载后消息数:', window.editDialogueHistory.length, '首条:', window.editDialogueHistory[0]?.text?.substring(0, 30));
            window.renderSidebarDialogueArea('edit-chat-list', window.editDialogueHistory);
        }

        async function enterIndependentStoryEdit(storyName) {
            state.isEditingIndependentStory = true;
            
            // 查找对应的独立故事对象
            const story = state.allStories.find(s => s.name === storyName || s.title === storyName);
            if (!story) {
                console.warn('独立故事未找到:', storyName);
                return;
            }
            state.activeEditingStoryId = story.id;

            const _storyForLore = await DB.stories.getById(state.activeEditingStoryId);
            state.currentLoreSetId = _storyForLore?.associatedLoreSetId || null;

            // 隐藏世界观选项卡（因为独立故事是扁平实例，无设定集的世界观概念）
            const worldviewTab = document.querySelector('#edit-category-tabs [data-category="worldview"]');
            if (worldviewTab) worldviewTab.style.display = 'none';

            // 设置返回按钮提示
            document.getElementById('edit-exit-btn')?.setAttribute('title', '返回故事');

            // 切换为独立故事书本图标和重命名提示
            document.getElementById('edit-collection-icon-blocks')?.classList.add('hidden');
            document.getElementById('edit-collection-icon-book')?.classList.remove('hidden');
            document.getElementById('edit-rename-btn')?.setAttribute('title', '重命名独立故事');

            // 初始化内存中的 state.currentData 结构（将独立故事的 instances 映射为 D3/cards 支持 of state.kg.nodes 模型）
            state.currentData = {
                title: story.title || story.name,
                displayName: story.title || story.name,
                desc: '独立故事的专属设定（直接存储在此故事中，不影响任何外部设定集）。',
                kg: { nodes: [], links: [] }
            };

            // 添加根节点以使 D3 力导向图可以正确支撑中心结构
            state.currentData.kg.nodes.push({ id: 'independent-root', name: story.title || story.name, type: 'root' });

            // 提取人物、场景和道具实例
            const typeMap = { 'characters': 'character', 'scenes': 'scene', 'items': 'prop' };
            Object.keys(story.instances || {}).forEach(instKey => {
                const type = typeMap[instKey];
                if (!type) return;
                const insts = story.instances[instKey];
                Object.keys(insts).forEach(id => {
                    state.currentData.kg.nodes.push({
                        id: id,
                        name: insts[id].name,
                        desc: insts[id].desc,
                        type: type
                    });
                    state.currentData.kg.links.push({ source: 'independent-root', target: id });
                });
            });

            const titleEl = document.getElementById('edit-collection-title');
            if (titleEl) titleEl.textContent = `独立故事设定: ${story.title || story.name}`;

            // 独立故事默认激活“角色”分类
            state.editActiveCategory = 'character';
            document.querySelectorAll('#edit-category-tabs .edit-category-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.category === 'character') tab.classList.add('active');
            });

            // 设定默认的“列表”（卡片网格）视图
            state.editViewMode = 'list';
            const btnList = document.getElementById('edit-view-list-btn');
            const btnGraph = document.getElementById('edit-view-graph-btn');
            if (btnList) btnList.className = "text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition-all";
            if (btnGraph) btnGraph.className = "text-[9px] font-bold px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-700 transition-all";
            
            const cardsContainer = document.getElementById('edit-cards-container');
            const graphArea = document.getElementById('edit-graph-area');
            if (cardsContainer) cardsContainer.classList.remove('hidden');
            if (graphArea) graphArea.classList.add('hidden');

            renderEditCards();

            window.initInputBoxForPage('sidebar');

            // 加载或创建编辑侧边栏会话
            // 注意：必须在更新 session ID 之前保存旧会话，否则会用新会话的空数据覆盖旧会话
            if (window._currentSidebarSessionSource) {
                const _oldSource = window._currentSidebarSessionSource;
                const _oldId = window._currentSidebarSessionId;
                const id = 'sidebar_' + _oldSource + '_' + _oldId;
                const messages = _oldSource === 'story'
                    ? (window.sidebarDialogueHistories[_oldId] || [])
                    : window.editDialogueHistory;
                try {
                    await DB.sidebarSessions.put({
                        id, source: _oldSource, sessionId: _oldId,
                        messages: JSON.parse(JSON.stringify(messages))
                    });
                } catch (e) { console.warn('[WorldStory] 保存旧侧边栏会话失败', e); }
            }
            window._currentSidebarSessionSource = 'edit';
            window._currentSidebarSessionId = 'story_' + story.id;
            await window.loadOrCreateSidebarSession('edit', window._currentSidebarSessionId);
            window.renderSidebarDialogueArea('edit-chat-list', window.editDialogueHistory);
        }

        function exitCollectionEdit() {
            if (state.isEditingIndependentStory) {
                window.setInterfaceState('dialogue', state.currentData.title);
            } else {
                const displayName = state.currentData.displayName || state.currentData.title || '设定集';
                window.setInterfaceState('collection-view', displayName);
            }
        }

        function handleEditIndependentStorySettingsFromHome() {
            const independentStories = state.allStories.filter(s => s.type === 'independent');
            if (independentStories.length === 0) {
                alert("当前没有独立故事，请先创建一个独立故事。");
                return;
            }
            const targetStory = independentStories[0];
            window.setInterfaceState('independent-story-edit', targetStory.title || targetStory.name);
        }

        function switchEditCategory(category, element) {
            state.editActiveCategory = category;
            document.querySelectorAll('#edit-category-tabs .edit-category-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            if (element) element.classList.add('active');
            
            if (state.editViewMode === 'list') {
                renderEditCards();
            } else {
                initEditD3ForceGraph();
            }
        }

        function setEditViewMode(mode) {
            state.editViewMode = mode;
            const btnList = document.getElementById('edit-view-list-btn');
            const btnGraph = document.getElementById('edit-view-graph-btn');
            const cardsContainer = document.getElementById('edit-cards-container');
            const graphArea = document.getElementById('edit-graph-area');
            
            if (mode === 'list') {
                if (btnList) btnList.className = "text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition-all";
                if (btnGraph) btnGraph.className = "text-[9px] font-bold px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-700 transition-all";
                
                if (cardsContainer) cardsContainer.classList.remove('hidden');
                if (graphArea) graphArea.classList.add('hidden');
                renderEditCards();
            } else {
                if (btnGraph) btnGraph.className = "text-[9px] font-bold px-3 py-0.5 rounded-full bg-white text-slate-800 shadow-sm transition-all";
                if (btnList) btnList.className = "text-[9px] font-bold px-3 py-0.5 rounded-full text-slate-500 hover:text-slate-700 transition-all";
                
                if (cardsContainer) cardsContainer.classList.add('hidden');
                if (graphArea) graphArea.classList.remove('hidden');
                initEditD3ForceGraph();
            }
        }

        function filterEditCards() {
            if (state.editViewMode === 'list') {
                renderEditCards();
            } else {
                initEditD3ForceGraph();
            }
        }

        function renderEditCards() {
            const area = document.getElementById('edit-cards-area');
            if (!area) return;
            area.innerHTML = '';
            
            const searchText = (document.getElementById('edit-search-input') ? document.getElementById('edit-search-input').value : '').trim().toLowerCase();
            const nodes = state.currentData.kg.nodes.filter(function(n) {
                if (n.type === 'root') return false;
                if (n.type !== state.editActiveCategory) return false;
                if (searchText && !n.name.toLowerCase().includes(searchText) && !(n.desc || '').toLowerCase().includes(searchText)) return false;
                return true;
            });

            const colorMap = {
                worldview: '#2dd4bf',
                character: '#fb7185',
                scene: '#fb923c',
                prop: '#818cf8'
            };
            const typeLabels = {
                worldview: '世界观',
                character: '角色',
                scene: '场景',
                prop: '道具'
            };

            if (nodes.length === 0) {
                area.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-center py-16">' +
                    '<svg class="w-10 h-10 text-slate-200 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>' +
                    '</svg>' +
                    '<span class="text-xs font-bold text-slate-300">暂无' + typeLabels[state.editActiveCategory] + '设定</span>' +
                    '<span class="text-[10px] text-slate-300 mt-1">点击下方"新增设定"或使用右侧AI助手创建</span>' +
                    '</div>';
                return;
            }

            var grid = document.createElement('div');
            grid.className = 'grid grid-cols-3 gap-3';
            
            nodes.forEach(function(node) {
                var card = document.createElement('div');
                card.className = 'setting-card group fade-in';
                card.onclick = function() { window.editSettingNode(node); };
                card.innerHTML = '<div class="flex items-center gap-2">' +
                    '<div class="card-type-dot" style="background-color: ' + colorMap[node.type] + '"></div>' +
                    '<span class="text-[11px] font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">' + node.name + '</span>' +
                    '</div>' +
                    '<p class="text-[9px] text-slate-500 leading-relaxed line-clamp-3 flex-1">' + (node.desc || '暂无描述...') + '</p>' +
                    '<div class="flex items-center justify-between mt-auto">' +
                    '<span class="text-[8px] font-bold text-slate-400 uppercase">' + typeLabels[node.type] + '</span>' +
                    '<svg class="w-3 h-3 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>' +
                    '</svg></div>';
                grid.appendChild(card);
            });
            area.appendChild(grid);
        }

        function initEditD3ForceGraph() {
            if (state.editKG) { state.editKG.destroy(); state.editKG = null; }
            const container = document.getElementById('edit-kg-svg');
            if (!container) return;

            const searchText = (document.getElementById('edit-search-input') ? document.getElementById('edit-search-input').value : '').trim().toLowerCase();
            const filteredNodes = state.currentData.kg.nodes.filter(n => {
                if (n.type === 'root') return false;
                if (searchText && !n.name.toLowerCase().includes(searchText) && !(n.desc || '').toLowerCase().includes(searchText)) return false;
                return true;
            });
            const nodeIds = new Set(filteredNodes.map(n => n.id));
            const filteredLinks = state.currentData.kg.links.filter(l => {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                return nodeIds.has(sourceId) && nodeIds.has(targetId);
            });

            state.editKG = new window.KGEngine('#edit-kg-svg', {
                colorMap: { worldview: '#2dd4bf', character: '#fb7185', scene: '#fb923c', prop: '#818cf8' },
                radiusMap: { worldview: 9, character: 9, scene: 9, prop: 9 },
                showDetailPanel: false,
                showEdgeLabels: true,
                filterRootType: '__none__',
                onNodeClick: d => window.editSettingNode(d),
                onBgClick: null,
            });
            state.editKG.render({ nodes: filteredNodes, links: filteredLinks });

            // 应用编辑分类高亮：激活分类全亮，其余半透明
            const svgSelector = '#edit-kg-svg';
            window.d3.selectAll(svgSelector + ' .node circle')
                .style('opacity', d => d.type === state.editActiveCategory ? 1.0 : 0.25)
                .style('filter', d => d.type === state.editActiveCategory ? `drop-shadow(0 0 6px ${({worldview:'#2dd4bf',character:'#fb7185',scene:'#fb923c',prop:'#818cf8'})[d.type] || '#94a3b8'})` : 'none');
            window.d3.selectAll(svgSelector + ' .node text')
                .style('opacity', d => d.type === state.editActiveCategory ? 1.0 : 0.3)
                .style('font-weight', d => d.type === state.editActiveCategory ? 'bold' : 'normal');
            window.d3.selectAll(svgSelector + ' .link-line')
                .style('stroke-opacity', l => {
                    const hasActive = (l.source.type === state.editActiveCategory) || (l.target.type === state.editActiveCategory);
                    return hasActive ? 0.45 : 0.08;
                });
        }

        async function addNewSettingItem() {
          window.showNewSettingDialog(async (name, desc) => {
            var prefix = state.isEditingIndependentStory ? 'independent' : state.currentCollectionId;
            var typeCode = state.editActiveCategory.charAt(0);
            var newId = prefix + '-' + typeCode + Date.now();
            var newNode = { id: newId, name: name, type: state.editActiveCategory, desc: desc };
            state.currentData.kg.nodes.push(newNode);
            state.currentData.kg.links.push({ source: prefix + '-root', target: newId });
            if (state.editViewMode === 'list') renderEditCards(); else initEditD3ForceGraph();

            if (state.isEditingIndependentStory && state.activeEditingStoryId) {
              try {
                const story = await DB.stories.getById(state.activeEditingStoryId);
                if (story) {
                  if (!story.instances) story.instances = { characters: {}, scenes: {}, items: {} };
                  const typeMap = { 'character': 'characters', 'scene': 'scenes', 'prop': 'items' };
                  const instKey = typeMap[state.editActiveCategory];
                  if (instKey) {
                    if (!story.instances[instKey]) story.instances[instKey] = {};
                    if (state.editActiveCategory === 'character') { const tmpl = createCharacterTemplate(name, { persona: desc }); story.instances[instKey][newId] = createInstanceFromTemplate(tmpl, 'character'); }
                    else if (state.editActiveCategory === 'scene') { const tmpl = createSceneTemplate(name, [], desc, ''); story.instances[instKey][newId] = createInstanceFromTemplate(tmpl, 'scene'); }
                    else { const tmpl = createItemTemplate(name, ['自定义'], desc, '', ''); story.instances[instKey][newId] = createInstanceFromTemplate(tmpl, 'item'); }
                    await DB.stories.put(story);
                  }
                }
              } catch (e) { console.error('新建独立设定失败', e); }
            }
          });
        }

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


// Attach all functions to window for cross-module access
window.loadCollection = loadCollection;
window.renderStoriesSection = renderStoriesSection;
window.createStoryCard = createStoryCard;
window.createNewStoryButton = createNewStoryButton;
window.createAppendStoryButton = createAppendStoryButton;
window.renderChatsSection = renderChatsSection;
window.createChatCard = createChatCard;
window.createNewChatButton = createNewChatButton;
window.createQuickInputBar = createQuickInputBar;
window.renderCenterContent = renderCenterContent;
window.setViewMode = setViewMode;
window.initD3ForceGraph = initD3ForceGraph;
window.showDetailPanel = showDetailPanel;
window.closeDetailPanel = closeDetailPanel;
window.editCurrentNode = editCurrentNode;
window.handleEditSettings = handleEditSettings;
window.jumpToCategory = jumpToCategory;
window.renderSettingsList = renderSettingsList;
window.renameCollection = renameCollection;
window.renameStory = renameStory;
window.deleteStory = deleteStory;
window.showStoryOptionsPopup = showStoryOptionsPopup;
window.renderCollectionOverview = renderCollectionOverview;
window.handleCreateNewCollection = handleCreateNewCollection;
window.handleCreateNewIndependentStory = handleCreateNewIndependentStory;
window.enterCollectionEdit = enterCollectionEdit;
window.enterIndependentStoryEdit = enterIndependentStoryEdit;
window.exitCollectionEdit = exitCollectionEdit;
window.handleEditIndependentStorySettingsFromHome = handleEditIndependentStorySettingsFromHome;
window.switchEditCategory = switchEditCategory;
window.setEditViewMode = setEditViewMode;
window.filterEditCards = filterEditCards;
window.renderEditCards = renderEditCards;
window.initEditD3ForceGraph = initEditD3ForceGraph;
window.addNewSettingItem = addNewSettingItem;
