import { state } from '../state.js';

let activeTabIdentifier = 'home';
const collectionExpandStates = {};

function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    
    setTimeout(() => {
        if (state.viewMode === 'graph' && state.kg) {
            state.kg.render(state.currentData.kg);
        }
    }, 300);
}

function setActiveSidebarTab(element) {
    if (!element) return;
    document.querySelectorAll('#sidebar .sidebar-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
    
    const dataId = element.getAttribute('data-id');
    if (dataId) {
        activeTabIdentifier = dataId;
    }
}

function renderSidebarCollections() {
    const container = document.getElementById('sidebar-collections-container');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(state.collectionsData).forEach(id => {
        const col = state.collectionsData[id];
        const displayName = col.displayName || col.title || `设定集 ${id}`;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'space-y-1';

        const headerTab = document.createElement('div');
        headerTab.className = 'sidebar-tab font-bold text-slate-700 hover:text-blue-500 relative pr-8';
        headerTab.setAttribute('data-id', `col-${id}`);

        if (`col-${id}` === activeTabIdentifier) {
            headerTab.classList.add('active');
        }

        headerTab.onclick = () => {
            window.setInterfaceState('collection-view', displayName);
            setActiveSidebarTab(headerTab);
        };

        headerTab.innerHTML = `
            <svg viewBox="0 0 100 100" class="w-3.5 h-3.5 shrink-0" stroke="currentColor" fill="none" stroke-width="10" stroke-linecap="round">
                <rect x="18" y="22" width="26" height="14" rx="7" />
                <rect x="60" y="16" width="14" height="30" rx="7" />
                <rect x="18" y="52" width="14" height="30" rx="7" />
                <rect x="48" y="62" width="26" height="14" rx="7" />
            </svg>
            <span id="sidebar-collection-title-${id}" class="sidebar-text">${displayName}</span>
        `;

        const isExpanded = collectionExpandStates[id] !== false;
        const caret = document.createElement('div');
        caret.className = `absolute right-2 top-1/2 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/50 cursor-pointer collection-caret-btn ${isExpanded ? '' : 'collapsed-caret'}`;

        caret.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5 text-slate-400">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;

        headerTab.appendChild(caret);
        groupDiv.appendChild(headerTab);

        const childrenWrapper = document.createElement('div');
        childrenWrapper.className = `story-list-wrapper ${isExpanded ? '' : 'collapsed'}`;

        const innerWrapper = document.createElement('div');
        innerWrapper.className = 'story-list-inner space-y-1';

        const stories = state.allStories.filter(s => s.type === id);
        stories.forEach(story => {
            const storyTab = document.createElement('div');
            storyTab.className = 'sidebar-tab pl-6 relative pr-8 group';
            storyTab.setAttribute('data-id', `story-${story.name}`);

            if (`story-${story.name}` === activeTabIdentifier) {
                storyTab.classList.add('active');
            }

            storyTab.onclick = () => {
                window.setInterfaceState('dialogue', story.name);
                setActiveSidebarTab(storyTab);
            };
            storyTab.innerHTML = `
                <svg class="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span class="sidebar-text truncate max-w-[100px]">${story.name}</span>
            `;

            const optionsBtn = document.createElement('div');
            optionsBtn.className = 'absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/50 cursor-pointer story-options-btn transition-all opacity-0 group-hover:opacity-100';
            optionsBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5 text-slate-400">
                    <circle cx="5" cy="12" r="2"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                    <circle cx="19" cy="12" r="2"></circle>
                </svg>
            `;
            optionsBtn.onclick = (e) => {
                e.stopPropagation();
                window.showStoryOptionsPopup(optionsBtn, story.id);
            };
            storyTab.appendChild(optionsBtn);

            innerWrapper.appendChild(storyTab);
        });

        const newStoryTab = document.createElement('div');
        newStoryTab.className = 'sidebar-tab pl-6 text-blue-500 hover:text-blue-600 font-semibold';
        newStoryTab.setAttribute('data-id', `newstory-${displayName}`);

        if (`newstory-${displayName}` === activeTabIdentifier) {
            newStoryTab.classList.add('active');
        }

        newStoryTab.onclick = () => {
            window.setInterfaceState('creating', displayName);
            setActiveSidebarTab(newStoryTab);
        };
        newStoryTab.innerHTML = `
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
            <span class="sidebar-text">新建故事</span>
        `;
        innerWrapper.appendChild(newStoryTab);

        childrenWrapper.appendChild(innerWrapper);
        groupDiv.appendChild(childrenWrapper);
        container.appendChild(groupDiv);

        caret.onclick = (e) => {
            e.stopPropagation();

            const isCurrentlyCollapsed = childrenWrapper.classList.contains('collapsed');
            if (isCurrentlyCollapsed) {
                childrenWrapper.classList.remove('collapsed');
                caret.classList.remove('collapsed-caret');
                collectionExpandStates[id] = true;
            } else {
                childrenWrapper.classList.add('collapsed');
                caret.classList.add('collapsed-caret');
                collectionExpandStates[id] = false;
            }
        };
    });
}

function renderSidebarIndependentStories() {
    const container = document.getElementById('sidebar-independent-container');
    if (!container) return;
    container.innerHTML = '';

    const independentStories = state.allStories.filter(s => s.type === 'independent');
    independentStories.forEach(story => {
        const storyTab = document.createElement('div');
        storyTab.className = 'sidebar-tab font-semibold text-slate-700 relative pr-8 group';
        storyTab.setAttribute('data-id', `independent-${story.name}`);

        if (`independent-${story.name}` === activeTabIdentifier) {
            storyTab.classList.add('active');
        }

        storyTab.onclick = () => {
            window.setInterfaceState('dialogue', story.name);
            setActiveSidebarTab(storyTab);
        };
        storyTab.innerHTML = `
            <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <span class="sidebar-text truncate max-w-[100px]">${story.name}</span>
        `;

        const optionsBtn = document.createElement('div');
        optionsBtn.className = 'absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/50 cursor-pointer story-options-btn transition-all opacity-0 group-hover:opacity-100';
        optionsBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5 text-slate-400">
                <circle cx="5" cy="12" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
            </svg>
        `;
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            window.showStoryOptionsPopup(optionsBtn, story.id);
        };
        storyTab.appendChild(optionsBtn);

        container.appendChild(storyTab);
    });
}

function handleSidebarQuickCreateStory(event) {
    event.stopPropagation();
    
    let collectionName = '';
    if (document.body.classList.contains('state-collection-view')) {
        collectionName = document.getElementById('collection-title')?.textContent || '';
    } else if (document.body.classList.contains('state-collection-edit')) {
        collectionName = document.getElementById('edit-collection-title')?.textContent || '';
    }
    
    if (!collectionName) {
        collectionName = state.currentData.displayName || state.currentData.title || '设定集';
    }
    
    window.setInterfaceState('creating', collectionName);
}

window.toggleSidebar = toggleSidebar;
window.setActiveSidebarTab = setActiveSidebarTab;
window.renderSidebarCollections = renderSidebarCollections;
window.renderSidebarIndependentStories = renderSidebarIndependentStories;
window.handleSidebarQuickCreateStory = handleSidebarQuickCreateStory;
