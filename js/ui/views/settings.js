import { state } from '../state.js';
import { DB } from '../../core/db.js';
import { SettingsSaver } from '../components/base/settings-saver.js';
import { getAllModels } from '../utils/model-manager.js';
import { refreshUserConfigurablePrompts } from '../../prompts/tool-descriptions.js';

const settingsTabContents = {
    'model-select': `
        <div class="space-y-6 fade-in select-none">
            <div class="p-4 bg-blue-50/40 border border-blue-200/60 rounded-2xl">
                <h3 class="text-xs font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>默认大语言模型 (LLM)
                </h3>
                <p class="text-[10px] text-blue-700/80 leading-normal">
                    选择用于驱动整个故事创作、情节推演、角色对话的核心大语言模型。设置将全局同步。
                </p>
            </div>
            
            <div class="space-y-3" id="model-select-container">
                <!-- Gemini 3.5 Flash -->
                <div class="model-setting-card p-3.5 border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-slate-50/50 transition-all flex items-start gap-3 bg-white" onclick="setSettingModel('Gemini 3.5 Flash')">
                    <input type="radio" name="settings-radio-model" id="radio-flash35" class="mt-1 accent-blue-500" />
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-800">Gemini 3.5 Flash</span>
                            <span class="bg-blue-100 text-blue-700 text-[8.5px] px-1.5 py-0.5 rounded-full font-bold">推荐 / 默认</span>
                        </div>
                        <p class="text-[10px] text-slate-500 mt-1">高速度与极高推理能力的完美结合，适合快速迭代生成各种创意故事。</p>
                    </div>
                </div>

                <!-- Gemini 3.1 Pro -->
                <div class="model-setting-card p-3.5 border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-slate-50/50 transition-all flex items-start gap-3 bg-white" onclick="setSettingModel('Gemini 3.1 Pro')">
                    <input type="radio" name="settings-radio-model" id="radio-pro31" class="mt-1 accent-blue-500" />
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-800">Gemini 3.1 Pro</span>
                            <span class="bg-indigo-100 text-indigo-700 text-[8.5px] px-1.5 py-0.5 rounded-full font-bold">高精度</span>
                        </div>
                        <p class="text-[10px] text-slate-500 mt-1">适合处理复杂设定、长文脉络，以及细致的人物心理描写与复杂逻辑推理。</p>
                    </div>
                </div>

                <!-- Gemini 3.1 Flash-Lite -->
                <div class="model-setting-card p-3.5 border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-slate-50/50 transition-all flex items-start gap-3 bg-white" onclick="setSettingModel('Gemini 3.1 Flash-Lite')">
                    <input type="radio" name="settings-radio-model" id="radio-lite31" class="mt-1 accent-blue-500" />
                    <div class="flex-1 min-w-0">
                        <span class="text-xs font-bold text-slate-800">Gemini 3.1 Flash-Lite</span>
                        <p class="text-[10px] text-slate-500 mt-1">极速轻量模型，拥有超低的响应延迟，适用于高频次的即时指令对话。</p>
                    </div>
                </div>
            </div>
        </div>
    `,
    
    'api-key': `
        <div class="space-y-5 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">API 密钥配置</h3>
                <p class="text-[10px] text-slate-500 leading-normal">配置模型接口服务的密钥和接口地址。支持官方 Google Cloud 接口以及兼容中转代理。</p>
            </div>
            
            <div class="space-y-4">
                <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-500">接口服务类型</label>
                    <select id="setting-api-provider" onchange="onApiProviderChange()" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 outline-none focus:border-blue-400 transition-colors">
                        <option value="google">Google Gemini API (Official)</option>
                        <option value="custom">自定义代理 (OpenAI API Format Compatible)</option>
                    </select>
                </div>
                
                <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-500">API 接口地址 (Base URL)</label>
                    <input type="text" id="setting-api-url" placeholder="https://generativelanguage.googleapis.com" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 transition-colors" />
                </div>
                
                    <label class="text-[10px] font-bold text-slate-500 flex justify-between">
                        <span>API 密钥 (API Key)</span>
                        <span class="text-blue-500 hover:text-blue-600 cursor-pointer" onclick="toggleApiKeyInputVisibility()">显示/隐藏</span>
                    </label>
                    <input type="password" id="setting-api-key" placeholder="输入 AI 接口的 API 密钥" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 transition-colors" />
                </div>
                
                <div class="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl flex gap-2">
                    <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <p class="text-[9px] text-amber-700 leading-normal">API 密钥将直接存储在您本机的浏览器缓存 (LocalStorage) 中，通信请求只由您本地的客户端直连发起，绝无泄露风险。</p>
                </div>
                
                <div class="flex gap-3 pt-2">
                    <button onclick="testSettingsApiConnection()" class="h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-600 transition-all flex-1 active:scale-[0.98]">
                        测试网络连接
                    </button>
                    <button onclick="saveSettingsApiConfig()" class="h-8 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold transition-all flex-1 active:scale-[0.98] shadow-sm shadow-blue-100">
                        保存配置
                    </button>
                </div>
            </div>
        </div>
    `,
    
    'deduction-level': `
        <div class="space-y-6 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">功能占位</h3>
                <p class="text-[10px] text-slate-500 leading-normal">此部分设置逻辑已删除，全局将统一采用 Providers 集群和当前激活的模型参数。</p>
            </div>
        </div>
    `,

    'deduction-params': `
        <div class="space-y-6 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">功能占位</h3>
                <p class="text-[10px] text-slate-500 leading-normal">此部分设置逻辑已删除，全局将统一采用 Providers 集群和当前激活的模型参数。</p>
            </div>
        </div>
    `,

    'writing-prefs': `
        <div class="space-y-6 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">功能占位</h3>
                <p class="text-[10px] text-slate-500 leading-normal">此部分设置逻辑已删除，全局将统一采用 Providers 集群和当前激活的模型参数。</p>
            </div>
        </div>
    `,

    'writing-style': `
        <div class="space-y-6 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">功能占位</h3>
                <p class="text-[10px] text-slate-500 leading-normal">此部分设置逻辑已删除，全局将统一采用 Providers 集群和当前激活的模型参数。</p>
            </div>
        </div>
    `,

    'generation-len': `
        <div class="space-y-6 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">功能占位</h3>
                <p class="text-[10px] text-slate-500 leading-normal">此部分设置逻辑已删除，全局将统一采用 Providers 集群和当前激活的模型参数。</p>
            </div>
        </div>
    `,

    'theme-appearance': `
        <div class="space-y-5 fade-in select-none">
            <div class="p-4 bg-blue-50/40 border border-blue-200/60 rounded-2xl">
                <h3 class="text-xs font-bold text-blue-900 mb-1">主题与外观设置</h3>
                <p class="text-[10px] text-blue-700/80 leading-normal">调节故事写作平台的全局视觉外观，如主配色、字体大小和炫酷的图形渲染特效。</p>
            </div>
            
            <div class="space-y-4">
                <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-500">UI 主题配色</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="setGlobalTheme('light')" id="theme-btn-light" class="h-10 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-center items-center">
                            <span>优雅极简</span>
                            <span class="text-[7.5px] font-normal text-slate-400 mt-0.5">默认浅色</span>
                        </button>
                        <button onclick="setGlobalTheme('dark')" id="theme-btn-dark" class="h-10 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-center items-center">
                            <span>深邃黑夜</span>
                            <span class="text-[7.5px] font-normal text-slate-400 mt-0.5">实验性暗色</span>
                        </button>
                        <button onclick="setGlobalTheme('blue-gradient')" id="theme-btn-blue-gradient" class="h-10 rounded-xl border border-blue-200 text-[10px] font-bold text-blue-700 bg-blue-50/50 hover:bg-blue-100/30 transition-colors flex flex-col justify-center items-center">
                            <span>极客底光</span>
                            <span class="text-[7.5px] font-normal text-blue-400 mt-0.5">蓝紫渐变光圈</span>
                        </button>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <div class="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>写作文本字号 (Font Size)</span>
                        <span id="font-size-val">12px</span>
                    </div>
                    <input type="range" min="11" max="16" step="1" value="12" id="setting-font-size" oninput="onSettingsFontSizeChange()" class="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>

                <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[10px] font-bold text-slate-700">启用知识图谱发光效果 (Node Glow)</span>
                        <span class="text-[9px] text-slate-400">开启关系网络节点的霓虹荧光阴影特效，让知识图谱更加灵动。</span>
                    </div>
                    <input type="checkbox" id="setting-node-glow" class="w-4 h-4 rounded text-blue-500 accent-blue-500" onchange="saveThemeToggles()" />
                </div>
                
                <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[10px] font-bold text-slate-700">启用极致毛玻璃模糊 (Glassmorphism)</span>
                        <span class="text-[9px] text-slate-400">在侧边栏、对话气泡和悬浮面板上叠加高斯模糊滤镜，呈现毛玻璃质感。</span>
                    </div>
                    <input type="checkbox" id="setting-glassmorphism" class="w-4 h-4 rounded text-blue-500 accent-blue-500" onchange="saveThemeToggles()" />
                </div>
            </div>
        </div>
    `,

    'backup-recovery': `
        <div class="space-y-5 fade-in select-none">
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 class="text-xs font-bold text-slate-800 mb-1">备份与数据维护</h3>
                <p class="text-[10px] text-slate-500 leading-normal">管理您的本地数据库、缓存的故事设定。支持全量备份文件的导出和重置操作。</p>
            </div>
            
            <div class="space-y-4">
                <div class="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                    <div class="flex-1">
                        <h4 class="text-xs font-bold text-slate-800">导出数据备份 (.json)</h4>
                        <p class="text-[9.5px] text-slate-400 mt-0.5">将全部设定集、关联故事、历史对话等本地数据打包并下载到本地电脑。</p>
                    </div>
                    <button onclick="triggerExportAction()" class="h-8 px-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-[10px] font-bold shrink-0 transition-colors">
                        导出本地数据
                    </button>
                </div>

                <div class="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                    <div class="flex-1">
                        <h4 class="text-xs font-bold text-slate-800">清空本地缓存并重置</h4>
                        <p class="text-[9.5px] text-rose-500 mt-0.5">警告：此操作将永久清空您浏览器的所有设定和故事缓存。请在重置前确保已经做好备份。</p>
                    </div>
                    <button onclick="triggerResetAction()" class="h-8 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-[10px] font-bold shrink-0 transition-colors">
                        重置所有数据
                    </button>
                </div>
            </div>
        </div>
    `
};

async function initSettingsView() {
    syncSettingsUserProfile();

    const collectionsCountVal = Object.keys(state.loresetData).length;
    const storiesCountVal = state.allStories.length;
    
    const colCountEl = document.getElementById('settings-collections-count');
    const storyCountEl = document.getElementById('settings-stories-count');
    if (colCountEl) colCountEl.textContent = collectionsCountVal;
    if (storyCountEl) storyCountEl.textContent = storiesCountVal;
    
    const tokenWordsEl = document.getElementById('settings-token-words');
    if (tokenWordsEl) {
        const words = localStorage.getItem('stats-token-words') || `${(Math.random() * 10 + 10).toFixed(1)}k 字`;
        localStorage.setItem('stats-token-words', words);
        tokenWordsEl.textContent = words;
    }

    switchSettingsTab('model-providers');
}

function switchSettingsTab(tabId) {
    {
        try {
            let existingProviders = JSON.parse(localStorage.getItem('providers-list') || '[]');
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

        window.rebuildAllModelSelects = function() {
            const activeModel = localStorage.getItem('global-active-model') || '自定义模型';
            const allModels = getAllModels();
            const models = allModels.map(m => m.name);

            document.querySelectorAll('select').forEach(select => {
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
                    const currentValue = select.value;
                    select.innerHTML = '';
                    models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.textContent = m;
                        if (m === currentValue || m === activeModel) {
                            opt.selected = true;
                        }
                        select.appendChild(opt);
                    });
                }
            });
        };

        if (typeof syncModelsFromProviders === 'function') syncModelsFromProviders();

        const titleEl = document.getElementById('detail-panel-title');
        const contentEl = document.getElementById('detail-panel-content');
        if (titleEl && contentEl) {
            if (tabId === 'module-prompts') {
                titleEl.textContent = '详细设置面板 > 模块提示词配置';

                const modules = ['planner', 'mtip', 'interpreter', 'writer', 'reviewer'];
                const moduleNames = {
                    planner: 'Planner（规划器）',
                    mtip: 'MTIP Generator（MTIP生成器）',
                    interpreter: 'Interpreter（解释器）',
                    writer: 'Writer（写作者）',
                    reviewer: 'Reviewer（审阅者）'
                };

                let html = '<div class="space-y-4 fade-in select-none">';
                html += '<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl"><h3 class="text-xs font-bold text-slate-800">模块提示词配置</h3><p class="text-[9px] text-slate-500 mt-0.5">为每个推演模块配置系统提示词前缀和后缀。前缀会添加在固定系统提示词之前，后缀会添加在设定数据之后。</p></div>';

                for (const module of modules) {
                    const prefix = localStorage.getItem(`${module}-prefix`) || '';
                    const suffix = localStorage.getItem(`${module}-suffix`) || '';

                    html += `
                        <div class="p-3 border border-slate-200 rounded-xl bg-white">
                            <h4 class="text-[10px] font-bold text-slate-800 mb-2">${moduleNames[module]}</h4>
                            <div class="space-y-2">
                                <div>
                                    <label class="text-[9px] font-semibold text-slate-500 block mb-1">系统提示词前缀</label>
                                    <textarea id="setting-${module}-prefix" class="w-full h-20 text-[10px] p-2 border border-slate-200 rounded-lg resize-none" placeholder="输入${moduleNames[module]}的系统提示词前缀...">${prefix}</textarea>
                                </div>
                                <div>
                                    <label class="text-[9px] font-semibold text-slate-500 block mb-1">提示词后缀</label>
                                    <textarea id="setting-${module}-suffix" class="w-full h-20 text-[10px] p-2 border border-slate-200 rounded-lg resize-none" placeholder="输入${moduleNames[module]}的提示词后缀...">${suffix}</textarea>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="saveModulePrefix('${module}')" class="flex-1 h-7 rounded-lg bg-blue-500 text-white text-[9px] font-bold shadow-sm transition-colors hover:bg-blue-600">保存前缀</button>
                                    <button onclick="saveModuleSuffix('${module}')" class="flex-1 h-7 rounded-lg bg-green-500 text-white text-[9px] font-bold shadow-sm transition-colors hover:bg-green-600">保存后缀</button>
                                </div>
                            </div>
                        </div>
                    `;
                }

                html += '</div>';
                contentEl.innerHTML = html;
            } else if (tabId === 'model-providers') {
                titleEl.textContent = '详细设置面板 > Providers';
                
                let providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
                
                let cardsHTML = '';
                if (providers.length === 0) {
                    cardsHTML = `
                        <div class="col-span-2 p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center flex flex-col items-center justify-center gap-1">
                            <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>目前无任何 API 服务商配置</span>
                            <span class="text-[8.5px] text-slate-400 flex items-center gap-0.5">请点击右上角“<svg class="w-2.5 h-2.5 text-slate-400 inline" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> 创建自定义服务商”开始从零构建！</span>
                        </div>
                    `;
                } else {
                    providers.forEach(p => {
                        cardsHTML += `
                            <div class="p-2 border border-slate-200 rounded-xl bg-white hover:border-blue-300 transition-all cursor-pointer flex flex-col gap-1 relative" onclick="selectProviderTab('${p.id}')">
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] font-bold text-slate-800">${p.name}</span>
                                    <button onclick="deleteCustomProvider('${p.id}'); event.stopPropagation();" class="text-rose-500 hover:text-rose-700 w-3.5 h-3.5 flex items-center justify-center transition-colors"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                                </div>
                                <span class="text-[8px] text-slate-400 truncate">${p.url || '待配置接口'}</span>
                            </div>
                        `;
                    });
                }
                
                contentEl.innerHTML = `
                    <div class="space-y-4 fade-in select-none">
                        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                            <div>
                                <h3 class="text-xs font-bold text-slate-800">API Providers (服务商集群)</h3>
                                <p class="text-[9px] text-slate-500 mt-0.5">从零开始动态创建或配置大模型 API，支持独立接口和模型集。</p>
                            </div>
                            <button onclick="createNewCustomProvider()" class="h-6 px-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[8.5px] font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"><svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>创建自定义服务商</button>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2" id="providers-cards-container">
                            ${cardsHTML}
                        </div>

                        <div class="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2.5" id="provider-details-form" style="${providers.length === 0 ? 'display: none;' : ''}">
                            <div class="flex justify-between items-center pb-1 border-b border-slate-100">
                                <span class="text-[9.5px] font-bold text-slate-700" id="current-provider-title">服务商配置</span>
                                <span class="text-[8.5px] text-slate-400 font-bold" id="current-provider-active-badge"></span>
                            </div>
                            <div class="space-y-2">
                                <div class="space-y-1">
                                    <label class="text-[8.5px] font-bold text-slate-400">接口 Base URL</label>
                                    <input type="text" id="setting-api-url" placeholder="API 接口地址" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs outline-none bg-white" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8.5px] font-bold text-slate-400">API 密钥 (API Key)</label>
                                    <input type="password" id="setting-api-key" placeholder="API 密钥 (API Key)" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs outline-none bg-white" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8.5px] font-bold text-slate-400">关联支持模型列表 (用英文逗号分隔，展现 provider 与模型的一对多关系)</label>
                                    <input type="text" id="setting-api-models" placeholder="例如: gpt-4o, deepseek-chat" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs outline-none bg-white font-mono" />
                                </div>
                            </div>
                            <div class="flex gap-2 pt-1">
                                <button onclick="testSettingsApiConnection()" class="h-8 rounded-xl border border-slate-200 bg-white text-[9.5px] font-bold text-slate-600 flex-1">测试连接</button>
                                <button onclick="saveCurrentProviderConfig()" class="h-8 rounded-xl bg-blue-500 text-white text-[9.5px] font-bold flex-1 shadow-sm transition-colors hover:bg-blue-600">保存配置</button>
                            </div>
                        </div>
                        
                        <div class="p-3 bg-white border border-slate-200 rounded-xl space-y-3" style="${providers.length === 0 ? 'display: none;' : ''}">
                            <div class="pb-1 border-b border-slate-100 flex justify-between items-center">
                                <span class="text-[9.5px] font-bold text-slate-800">默认模型与超参调控</span>
                                <span class="text-[8.5px] text-slate-400">超参与 Slider 数字输入双向绑定</span>
                            </div>
                            <div class="space-y-2">
                                <div class="space-y-1">
                                    <label class="text-[8.5px] font-bold text-slate-400 block">默认执行模型</label>
                                    <select id="select-active-model" class="w-full h-8 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 outline-none" onchange="onActiveModelChange()">
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <div class="flex justify-between text-[8.5px] font-bold text-slate-400"><span>温度 (Temperature)</span></div>
                                    <div class="flex items-center gap-2">
                                        <input type="range" min="0.1" max="1.5" step="0.1" id="setting-hyper-temp" class="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" oninput="syncRangeToNumber('temp')" />
                                        <input type="number" min="0.1" max="1.5" step="0.1" id="setting-hyper-temp-num" class="w-14 h-6 border border-slate-200 rounded-lg px-1 text-[10px] text-center font-bold text-blue-500 bg-white" oninput="syncNumberToRange('temp')" />
                                    </div>
                                </div>
                                <div class="space-y-1">
                                    <div class="flex justify-between text-[8.5px] font-bold text-slate-400"><span>核采样 (Top P)</span></div>
                                    <div class="flex items-center gap-2">
                                        <input type="range" min="0.1" max="1.0" step="0.05" id="setting-hyper-topp" class="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" oninput="syncRangeToNumber('topp')" />
                                        <input type="number" min="0.1" max="1.0" step="0.05" id="setting-hyper-topp-num" class="w-14 h-6 border border-slate-200 rounded-lg px-1 text-[10px] text-center font-bold text-blue-500 bg-white" oninput="syncNumberToRange('topp')" />
                                    </div>
                                </div>
                                <div class="space-y-1">
                                    <div class="flex justify-between text-[8.5px] font-bold text-slate-400"><span>最大 Token (Max Tokens)</span></div>
                                    <div class="flex items-center gap-2">
                                        <input type="range" min="1024" max="384000" step="1024" id="setting-hyper-maxtokens" class="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" oninput="syncRangeToNumber('maxtokens')" />
                                        <input type="number" min="1024" max="384000" step="1024" id="setting-hyper-maxtokens-num" class="w-20 h-6 border border-slate-200 rounded-lg px-1 text-[9px] text-center font-bold text-blue-500 bg-white" oninput="syncNumberToRange('maxtokens')" />
                                    </div>
                                </div>
                                <button onclick="saveGlobalHyperparams()" class="h-8 w-full rounded-xl bg-blue-500 text-white text-[9.5px] font-bold shadow-sm transition-colors hover:bg-blue-600">保存全局超参调控</button>
                            </div>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    if (providers.length > 0) {
                        selectProviderTab(window.selectedProviderTab || providers[0].id);
                        loadGlobalHyperparamsToUI();
                    }
                }, 50);
            } else {
                titleEl.textContent = '详细设置面板 > ' + tabId;
                contentEl.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center py-20 fade-in select-none">
                        <svg class="w-12 h-12 text-slate-200 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.842c-.68-.34-1.44-.06-1.78.62L7.38 18.8c-.34.68-.06 1.44.62 1.78.68.34 1.44.06 1.78-.62l1.18-2.34c.34-.68.06-1.44-.62-1.78zM13.66 8.16c.68.34 1.44.06 1.78-.62l1.18-2.34c.34-.68.06-1.44-.62-1.78-.68-.34-1.44-.06-1.78.62l-1.18 2.34c-.34.68-.06 1.44.62 1.78zM17.66 12.16c.68.34 1.44.06 1.78-.62l1.18-2.34c.34-.68.06-1.44-.62-1.78-.68-.34-1.44-.06-1.78.62l-1.18 2.34c-.34.68-.06 1.44.62 1.78zM6.34 11.84c-.68-.34-1.44-.06-1.78.62L3.38 14.8c-.34.68-.06 1.44.62 1.78.68.34 1.44.06 1.78-.62l1.18-2.34c.34-.68.06-1.44-.62-1.78z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122A3 3 0 00.17 11.75l4.38-8.75A3 3 0 0113.122 9.53l-4.38 8.75A3 3 0 013.122 17.66z" />
                        </svg>
                        <span class="text-xs font-bold text-slate-400">该选项卡无须额外配置</span>
                        <span class="text-[10px] text-slate-300 mt-1">此部分设置逻辑已删除，全局将统一采用 Providers 集群和当前激活的模型参数。</span>
                    </div>
                `;
            }
        }
        
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            }
        });
    }
}

// ==========================================
// 【新增的设置参数联动与存取辅助函数】
// ==========================================
function onHyperParamsChange() {
    const temp = parseFloat(document.getElementById('setting-hyper-temp').value);
    const topp = parseFloat(document.getElementById('setting-hyper-topp').value);
    const maxtokens = parseInt(document.getElementById('setting-hyper-maxtokens').value);
    
    document.getElementById('hyper-temp-val').textContent = temp.toFixed(1);
    document.getElementById('hyper-topp-val').textContent = topp.toFixed(2);
    document.getElementById('hyper-max-val').textContent = maxtokens;
    
    let desc = '适中';
    if (temp < 0.4) desc = '严谨精准';
    else if (temp > 1.0) desc = '极富创意';
    document.getElementById('hyper-temp-desc').textContent = desc;
}

function saveHyperparameters() {
    SettingsSaver.saveGroup([
        { key: 'temperature', domId: 'setting-hyper-temp' },
        { key: 'topp', domId: 'setting-hyper-topp' },
        { key: 'maxtokens', domId: 'setting-hyper-maxtokens' },
    ]);
    alert("模型超参数已保存！");
}

function onSysPromptTemplateChange() {
    const template = document.getElementById('setting-sysprompt-template').value;
    const textEl = document.getElementById('setting-system-prompt');
    if (template === 'novelist') {
        textEl.value = '你是一个专业的小说家。在写作时必须严格遵循背景世界观的地理、历史限制，逻辑结构紧密。';
    } else if (template === 'worldbuilder') {
        textEl.value = '你是一个严苛的世界观构建者。在生成后续情节时，必须100%忠实于所提供的人物卡片、组织体系及地理设定，绝不能有任何逻辑冲突。';
    } else if (template === 'minimalist') {
        textEl.value = '你是一个故事创作辅助模型。仅以第三人称提供极简的故事后续发展建议，不做冗长阐述。';
    }
}

function saveSystemPrompt() {
    SettingsSaver.save('system-prompt', 'setting-system-prompt');
    refreshUserConfigurablePrompts();
    alert("全局系统提示词已成功保存！");
}

// 保存各模块系统提示词前缀
function saveModulePrefix(module) {
    SettingsSaver.save(`${module}-prefix`, `setting-${module}-prefix`);
    refreshUserConfigurablePrompts();
    alert(`${module} 系统提示词前缀已保存！`);
}

function saveModuleSuffix(module) {
    SettingsSaver.save(`${module}-suffix`, `setting-${module}-suffix`);
    refreshUserConfigurablePrompts();
    alert(`${module} 提示词后缀已保存！`);
}

function saveNodePlanning() {
    SettingsSaver.saveGroup([
        { key: 'node-planning-model', domId: 'setting-node-planning-model' },
        { key: 'node-planning-depth', domId: 'setting-node-planning-depth' },
    ]);
    alert("规划节点配置已保存！");
}

function saveNodeDeduction() {
    SettingsSaver.saveGroup([
        { key: 'node-deduction-model', domId: 'setting-node-deduction-model' },
        { key: 'node-deduction-entities', domId: 'setting-node-deduction-entities' },
    ]);
    alert("演绎节点配置已保存！");
}

function saveNodeExplanation() {
    SettingsSaver.saveGroup([
        { key: 'node-explanation-model', domId: 'setting-node-explanation-model' },
        { key: 'node-explanation-format', domId: 'setting-node-explanation-format' },
    ]);
    alert("解释节点配置已保存！");
}

function saveNodeCorrection() {
    SettingsSaver.saveGroup([
        { key: 'node-correction-model', domId: 'setting-node-correction-model' },
        { key: 'node-correction-strictness', domId: 'setting-node-correction-strictness' },
    ]);
    alert("修正节点配置已保存！");
}

function setWritingModel(modelName, triggerUpdate = true) {
    document.querySelectorAll('#writing-model-container .model-setting-card').forEach(card => {
        card.classList.remove('border-blue-400', 'bg-blue-50/20');
        card.classList.add('border-slate-200', 'bg-white');
    });
    
    let radioId = '';
    if (modelName === 'Gemini 3.5 Flash') radioId = 'write-radio-flash35';
    else if (modelName === 'Gemini 3.1 Pro') radioId = 'write-radio-pro31';
    
    const radio = document.getElementById(radioId);
    if (radio) {
        radio.checked = true;
        const card = radio.closest('.model-setting-card');
        if (card) {
            card.classList.remove('border-slate-200', 'bg-white');
            card.classList.add('border-blue-400', 'bg-blue-50/20');
        }
    }
    
    localStorage.setItem('writing-model-name', modelName);
    if (triggerUpdate) {
        alert("已设置正文写作专用模型为: " + modelName);
    }
}

function onWritingParamsChange() {
    const temp = parseFloat(document.getElementById('setting-writing-temp').value);
    const topp = parseFloat(document.getElementById('setting-writing-topp').value);
    const maxtokens = parseInt(document.getElementById('setting-writing-maxtokens').value);
    
    document.getElementById('writing-temp-val').textContent = temp.toFixed(1);
    document.getElementById('writing-topp-val').textContent = topp.toFixed(2);
    document.getElementById('writing-max-val').textContent = maxtokens;
}

function saveWritingModelSettings() {
    SettingsSaver.saveGroup([
        { key: 'writing-temp', domId: 'setting-writing-temp' },
        { key: 'writing-topp', domId: 'setting-writing-topp' },
        { key: 'writing-maxtokens', domId: 'setting-writing-maxtokens' },
        { key: 'writing-sysprompt', domId: 'setting-writing-sysprompt' },
    ]);
    alert("正文写作模型设置与超参已成功保存！");
}

function onChatParamsChange() {
    const temp = parseFloat(document.getElementById('setting-chat-temp').value);
    document.getElementById('chat-temp-val').textContent = temp.toFixed(1);
}

function saveChatModelSettings() {
    SettingsSaver.saveGroup([
        { key: 'chat-model-name', domId: 'setting-chat-model-name' },
        { key: 'chat-temp', domId: 'setting-chat-temp' },
        { key: 'chat-sysprompt', domId: 'setting-chat-sysprompt' },
    ]);
    alert("聊天模型设置已保存！");
}

function onChatIntegrationChange() {
    const val = parseInt(document.getElementById('setting-chat-integration-level').value);
    const badge = document.getElementById('chat-integration-val');
    const desc = document.getElementById('chat-integration-desc');
    if (!badge || !desc) return;
    
    if (val === 1) {
        badge.textContent = '低度融入 (Low)';
        badge.className = "bg-slate-100 text-slate-700 text-[9px] px-2 py-0.5 rounded-full font-bold";
        desc.textContent = '当前设定：低度融入。聊天助手仅作为普通问答对话，不会自动读取并链接您当前的故事设定集或故事线脉络。';
    } else if (val === 3) {
        badge.textContent = '深度融入 (High)';
        badge.className = "bg-purple-100 text-purple-800 text-[9px] px-2 py-0.5 rounded-full font-bold";
        desc.textContent = '当前设定：高度融入。聊天助手将强制完全融入当前世界观和所有角色设定。对话时AI会充分代入当前背景，非常适合沉浸式角色扮演或世界观脑暴。';
    } else {
        badge.textContent = '中度融入 (Medium)';
        badge.className = "bg-blue-100 text-blue-800 text-[9px] px-2 py-0.5 rounded-full font-bold";
        desc.textContent = '当前设定：中度融入。聊天助手会自动在您的问题中提取关键词并链接匹配的设定项，给您精准情节辅助。';
    }
}

// 保存聊天集成度
function saveChatIntegration() {
    SettingsSaver.save('chat-integration-level', 'setting-chat-integration-level');
    alert("聊天集成度设置已保存！");
}

// 聊天群聊变更
function onChatGroupChange() {}

// 保存群聊设置
function saveChatGroupSettings() {
    const multi = document.getElementById('setting-chat-group-multi').checked;
    const turn = document.getElementById('setting-chat-group-turn').value;
    
    localStorage.setItem('chat-group-multi', multi ? 'true' : 'false');
    localStorage.setItem('chat-group-turn', turn);
    
    alert("群聊参数设置已保存！");
}

// 助手参数变更显示
function onAssistantParamsChange() {
    const temp = parseFloat(document.getElementById('setting-assistant-temp').value);
    document.getElementById('assistant-temp-val').textContent = temp.toFixed(1);
}

// 保存助手模型设置
function saveAssistantModelSettings() {
    SettingsSaver.saveGroup([
        { key: 'assistant-model-name', domId: 'setting-assistant-model-name' },
        { key: 'assistant-temp', domId: 'setting-assistant-temp' },
        { key: 'assistant-sysprompt', domId: 'setting-assistant-sysprompt' },
    ]);
    alert("助手模型设置已保存！");
}

function saveAssistantBehaviorSettings() {
    SettingsSaver.saveGroup([
        { key: 'assistant-auth', domId: 'setting-assistant-auth' },
        { key: 'assistant-detail', domId: 'setting-assistant-detail' },
        { key: 'assistant-workflow', domId: 'setting-assistant-workflow' },
    ]);
    alert("助手行为设置已保存！");
}

// 4. 用户头像、名片同步函数
function syncSettingsUserProfile() {
    const avatarEl = document.getElementById('settings-avatar');
    const usernameEl = document.getElementById('settings-username');
    const loginBtn = document.getElementById('settings-login-btn');
    
    if (!avatarEl || !usernameEl || !loginBtn) return;
    
    if (state.isUserLoggedIn) {
        const qaAvatarText = document.getElementById('qa-avatar').textContent.trim();
        const qaUsernameText = document.getElementById('qa-username').textContent.trim();
        avatarEl.textContent = qaAvatarText;
        usernameEl.textContent = qaUsernameText;
        
        loginBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>管理账号 / 同步</span>
        `;
    } else {
        avatarEl.textContent = "G";
        usernameEl.textContent = "游客账户";
        
        loginBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>登录 / 导入数据库</span>
        `;
    }
}

// 5. 登出与数据导出联合动作
function handleSettingsLogout() {
    if (!state.isUserLoggedIn) {
        alert("您目前处于游客账户模式。");
        return;
    }
    const confirmLogout = confirm("确定要登出该账户吗？系统将自动在登出前为您导出数据库的最新镜像备份文件。");
    if (confirmLogout) {
        // 1. Export database first
        handleQAExport();
        // 2. Trigger standard logout handler
        handleQAImport();
        // 3. Update local display
        syncSettingsUserProfile();
    }
}

// 6. 模型卡片交互切换
function setSettingModel(modelName) {
    document.querySelectorAll('.model-setting-card').forEach(card => {
        card.classList.remove('border-blue-400', 'bg-blue-50/20');
        card.classList.add('border-slate-200', 'bg-white');
    });
    
    let radioId = '';
    if (modelName === 'Gemini 3.5 Flash') radioId = 'radio-flash35';
    else if (modelName === 'Gemini 3.1 Pro') radioId = 'radio-pro31';
    else if (modelName === 'Gemini 3.1 Flash-Lite') radioId = 'radio-lite31';
    
    const radio = document.getElementById(radioId);
    if (radio) {
        radio.checked = true;
        const card = radio.closest('.model-setting-card');
        if (card) {
            card.classList.remove('border-slate-200', 'bg-white');
            card.classList.add('border-blue-400', 'bg-blue-50/20');
        }
    }
    
    // 触发全局模型同步
    window.selectedModelName = modelName;
    if (state.inputBox) state.inputBox.updateModel(modelName);
    if (state.sidebarInputBox) state.sidebarInputBox.updateModel(modelName);
    
    // 同步右上角快捷操作 radio buttons 状态
    document.querySelectorAll('.qa-model-opt').forEach(opt => {
        opt.classList.remove('active');
        const optText = opt.querySelector('span');
        if (optText) optText.className = "text-[10px] font-medium text-slate-600";
        
        const spanText = opt.querySelector('span').textContent.trim();
        if (spanText === modelName) {
            opt.classList.add('active');
            if (optText) optText.className = "text-[10px] font-bold text-blue-500";
        }
    });
}

// 7. API密钥配置交互
window.selectedProviderTab = '';

function createNewCustomProvider() {
    const name = prompt("请输入您要从零开始创建的自定义服务商名称 (如: LocalOllama, DeepSeekPrivate):");
    if (!name || name.trim() === "") return;
    
    const providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
    const newId = 'custom-' + Date.now();
    
    providers.push({
        id: newId,
        name: name.trim(),
        url: '',
        key: '',
        models: 'model-1, model-2'
    });
    
    localStorage.setItem('providers-list', JSON.stringify(providers));
    if (typeof syncModelsFromProviders === 'function') syncModelsFromProviders();
    switchSettingsTab('model-providers');
    selectProviderTab(newId);
}

function deleteCustomProvider(providerId) {
    if (confirm("确定要删除此自定义服务商配置吗？")) {
        let providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
        providers = providers.filter(p => p.id !== providerId);
        localStorage.setItem('providers-list', JSON.stringify(providers));
        window.selectedProviderTab = '';

        if (typeof syncModelsFromProviders === 'function') syncModelsFromProviders();
        switchSettingsTab('model-providers');
    }
}

function selectProviderTab(providerId) {
    window.selectedProviderTab = providerId;
    
    // 更新卡片高亮
    document.querySelectorAll('#providers-cards-container > div').forEach(card => {
        card.classList.remove('border-blue-400', 'bg-blue-50/20');
        card.classList.add('border-slate-200', 'bg-white');
    });
    
    const providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
    const pIndex = providers.findIndex(p => p.id === providerId);
    const cards = document.querySelectorAll('#providers-cards-container > div');
    if (pIndex !== -1 && cards[pIndex]) {
        cards[pIndex].classList.remove('border-slate-200', 'bg-white');
        cards[pIndex].classList.add('border-blue-400', 'bg-blue-50/20');
    }
    
    const urlInput = document.getElementById('setting-api-url');
    const keyInput = document.getElementById('setting-api-key');
    const modelsInput = document.getElementById('setting-api-models');
    const titleEl = document.getElementById('current-provider-title');

    if (!urlInput || !keyInput || !modelsInput) return;

    const currentP = providers.find(p => p.id === providerId);
    if (currentP) {
        if (titleEl) titleEl.textContent = currentP.name + ' 配置';
        urlInput.value = currentP.url;
        keyInput.value = currentP.key;
        modelsInput.value = currentP.models;
    }

    // 展现”provider和模型是一对多关系”：根据当前点击的服务商的模型列表刷新下拉框
    refreshActiveModelSelector(currentP ? currentP.models : '');
}

function refreshActiveModelSelector(modelsStr) {
    const selectEl = document.getElementById('select-active-model');
    if (!selectEl) return;
    
    selectEl.innerHTML = '';
    const models = modelsStr.split(',').map(m => m.trim()).filter(m => m !== '');
    if (models.length === 0) {
        selectEl.innerHTML = '<option value="">(无关联模型，请在上方输入模型列表)</option>';
    } else {
        models.forEach(m => {
            const saved = localStorage.getItem('global-active-model') || '';
            const selected = m === saved ? 'selected' : '';
            selectEl.innerHTML += `<option value="${m}" ${selected}>${m}</option>`;
        });
    }
}

function onActiveModelChange() {
    const selectEl = document.getElementById('select-active-model');
    if (selectEl) {
        localStorage.setItem('global-active-model', selectEl.value);
        window.selectedModelName = selectEl.value;
        if (typeof syncModelsFromProviders === 'function') syncModelsFromProviders();
    }
}

function saveCurrentProviderConfig() {
    const providerId = window.selectedProviderTab;
    const url = document.getElementById('setting-api-url').value.trim();
    const key = document.getElementById('setting-api-key').value.trim();
    const models = document.getElementById('setting-api-models').value.trim();
    
    let providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
    const pIdx = providers.findIndex(p => p.id === providerId);
    if (pIdx !== -1) {
        providers[pIdx].url = url;
        providers[pIdx].key = key;
        providers[pIdx].models = models;
        localStorage.setItem('providers-list', JSON.stringify(providers));
    }
    
    localStorage.setItem('api-base-url', url);
    localStorage.setItem('api-key', key);
    localStorage.setItem('api-provider', 'custom');

    // 同步首个模型为默认模型
    const modelList = models.split(',').map(m => m.trim()).filter(m => m !== '');
    if (modelList.length > 0) {
        localStorage.setItem('global-active-model', modelList[0]);
        window.selectedModelName = modelList[0];
    }
    
    if (typeof syncModelsFromProviders === 'function') syncModelsFromProviders();
    switchSettingsTab('model-providers');
}

// 双向绑定调控函数
function syncRangeToNumber(type) {
    const range = document.getElementById('setting-hyper-' + type);
    const num = document.getElementById('setting-hyper-' + type + '-num');
    if (range && num) {
        num.value = range.value;
    }
}

function syncNumberToRange(type) {
    const range = document.getElementById('setting-hyper-' + type);
    const num = document.getElementById('setting-hyper-' + type + '-num');
    if (range && num) {
        // 做极值守护
        let val = parseFloat(num.value);
        const min = parseFloat(num.min);
        const max = parseFloat(num.max);
        if (val < min) val = min;
        if (val > max) val = max;
        
        num.value = val;
        range.value = val;
    }
}

function loadGlobalHyperparamsToUI() {
    const temp = parseFloat(localStorage.getItem('temperature') || '0.7');
    const topp = parseFloat(localStorage.getItem('topp') || '0.9');
    const maxtokens = parseInt(localStorage.getItem('maxtokens') || '4096');
    
    const rangeTemp = document.getElementById('setting-hyper-temp');
    const numTemp = document.getElementById('setting-hyper-temp-num');
    if (rangeTemp && numTemp) { rangeTemp.value = temp; numTemp.value = temp; }
    
    const rangeTopp = document.getElementById('setting-hyper-topp');
    const numTopp = document.getElementById('setting-hyper-topp-num');
    if (rangeTopp && numTopp) { rangeTopp.value = topp; numTopp.value = topp; }
    
    const rangeMax = document.getElementById('setting-hyper-maxtokens');
    const numMax = document.getElementById('setting-hyper-maxtokens-num');
    if (rangeMax && numMax) { rangeMax.value = maxtokens; numMax.value = maxtokens; }
}

function saveGlobalHyperparams() {
    SettingsSaver.saveGroup([
        { key: 'temperature', domId: 'setting-hyper-temp-num' },
        { key: 'topp', domId: 'setting-hyper-topp-num' },
        { key: 'maxtokens', domId: 'setting-hyper-maxtokens-num' },
    ]);
    const activeModel = document.getElementById('select-active-model')?.value;
    if (activeModel) {
        localStorage.setItem('global-active-model', activeModel);
        window.selectedModelName = activeModel;
    }
    alert("全局大模型超参调控数据已安全保存！");
}

function toggleApiKeyInputVisibility() {
    const keyInput = document.getElementById('setting-api-key');
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
    } else {
        keyInput.type = 'password';
    }
}

async function testSettingsApiConnection() {
    const urlInput = document.getElementById('setting-api-url');
    const keyInput = document.getElementById('setting-api-key');
    const btn = event.target;
    const originalText = btn.textContent;

    const url = (urlInput?.value || '').trim().replace(/\/+$/, '');
    const key = (keyInput?.value || '').trim();

    if (!url) { alert('请先填写 API 接口地址'); return; }
    if (!key) { alert('请先填写 API 密钥'); return; }

    btn.textContent = '正在测试...';
    btn.disabled = true;

    const start = performance.now();
    try {
        const resp = await fetch(url + '/models', {
            headers: { 'Authorization': 'Bearer ' + key },
            signal: AbortSignal.timeout(10000)
        });
        const latency = Math.round(performance.now() - start);

        if (resp.ok) {
            const data = await resp.json().catch(() => null);
            const modelCount = data?.data?.length ?? '?';
            alert(`连接成功！\n响应延迟: ${latency}ms\n可用模型: ${modelCount} 个`);
        } else {
            const body = await resp.text().catch(() => '');
            alert(`连接失败 (${resp.status})\n延迟: ${latency}ms\n${body.substring(0, 200)}`);
        }
    } catch (e) {
        const latency = Math.round(performance.now() - start);
        alert(`连接超时或网络错误\n延迟: ${latency}ms\n${e.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 8. 演绎深度与推理参数交互
function onSettingsDeductionSliderChange() {
    const slider = document.getElementById('deduction-slider');
    if (!slider) return;
    
    const val = parseInt(slider.value);
    let level = 'Standard';
    if (val === 1) {
        level = 'Fast';
    } else if (val === 3) {
        level = 'Extended';
    }
    
    window.syncDeductionLevelToUI(level);
}

function saveDeductionStepVisibility() {
    const checked = document.getElementById('setting-show-deduction-steps').checked;
    localStorage.setItem('show-deduction-steps', checked ? 'true' : 'false');
}

function onSettingsTempChange() {
    const temp = parseFloat(document.getElementById('setting-temperature').value);
    document.getElementById('temp-val').textContent = temp.toFixed(1);
    
    let desc = '适中';
    if (temp < 0.4) desc = '严谨精准';
    else if (temp > 1.0) desc = '极富创意';
    document.getElementById('temp-desc').textContent = desc;
}

function saveDeductionParams() {
    const temp = document.getElementById('setting-temperature').value;
    const sysPrompt = document.getElementById('setting-system-prompt').value;
    
    localStorage.setItem('temperature', temp);
    localStorage.setItem('system-prompt', sysPrompt);
    
    alert("推理控制参数已成功保存！");
}

// 9. 创作偏好与文风设置
function saveWritingPrefs() {
    const genre = document.getElementById('setting-default-genre').value;
    const pov = document.getElementById('setting-default-pov').value;
    
    localStorage.setItem('default-genre', genre);
    localStorage.setItem('default-pov', pov);
    
    alert("故事创作首选项已保存。新建故事时将应用此模板参数！");
}

function setSettingStyle(style, showAlert = true) {
    document.querySelectorAll('.style-opt-card').forEach(card => {
        card.classList.remove('border-emerald-400', 'bg-emerald-50/20');
        card.classList.add('border-slate-200', 'bg-white');
        const dot = card.querySelector('.style-dot');
        if (dot) {
            dot.className = "w-2.5 h-2.5 rounded-full border border-slate-300 bg-white style-dot shrink-0";
        }
    });
    
    let activeCardIndex = 0;
    if (style === 'classic') activeCardIndex = 1;
    else if (style === 'hard-boiled') activeCardIndex = 2;
    
    const activeCard = document.querySelectorAll('.style-opt-card')[activeCardIndex];
    if (activeCard) {
        activeCard.classList.remove('border-slate-200', 'bg-white');
        activeCard.classList.add('border-emerald-400', 'bg-emerald-50/20');
        const dot = activeCard.querySelector('.style-dot');
        if (dot) {
            dot.className = "w-2.5 h-2.5 rounded-full border-4 border-emerald-500 bg-white style-dot shrink-0";
        }
    }
    
    localStorage.setItem('default-style', style);
    if (showAlert) {
        alert(`文风风格已更新为《${style === 'classic' ? '古典雅致' : (style === 'hard-boiled' ? '冷峻硬汉' : '标准叙事')}》`);
    }
}

// 10. 字数控制
function saveGenerationLen() {
    const maxWords = document.getElementById('setting-max-words').value;
    const paraStyle = document.getElementById('setting-paragraph-style').value;
    
    localStorage.setItem('max-words', maxWords);
    localStorage.setItem('paragraph-style', paraStyle);
    
    alert("排版字数规格已保存！已将其作为AI生成内容的默认约束规则。");
}

// 11. 主题与界面调整交互
function setGlobalTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    
    if (theme === 'light') {
        document.body.classList.add('theme-light');
    } else if (theme === 'dark') {
        document.body.classList.add('theme-dark');
    }
    
    localStorage.setItem('global-theme', theme);
    updateThemeButtons(theme);
}

function updateThemeButtons(theme) {
    const lightBtn = document.getElementById('theme-btn-light');
    const darkBtn = document.getElementById('theme-btn-dark');
    const blueBtn = document.getElementById('theme-btn-blue-gradient');
    
    if (!lightBtn || !darkBtn || !blueBtn) return;
    
    const btns = [lightBtn, darkBtn, blueBtn];
    btns.forEach(btn => {
        btn.className = "h-10 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex flex-col justify-center items-center";
    });
    
    if (theme === 'light') {
        lightBtn.className = "h-10 rounded-xl border border-blue-400 text-[10px] font-bold text-blue-600 bg-blue-50/20 flex flex-col justify-center items-center";
    } else if (theme === 'dark') {
        darkBtn.className = "h-10 rounded-xl border border-blue-400 text-[10px] font-bold text-blue-500 bg-slate-800 flex flex-col justify-center items-center";
    } else {
        blueBtn.className = "h-10 rounded-xl border border-blue-400 text-[10px] font-bold text-blue-600 bg-blue-50/20 flex flex-col justify-center items-center";
    }
}

function onSettingsFontSizeChange() {
    const size = parseInt(document.getElementById('setting-font-size').value);
    document.getElementById('font-size-val').textContent = `${size}px`;
    
    localStorage.setItem('font-size', size);
    applyFontSizeStyle(size);
}

// Toggles sync
function saveThemeToggles() {
    const nodeGlow = document.getElementById('setting-node-glow').checked;
    const glassmorphic = document.getElementById('setting-glassmorphism').checked;
    
    localStorage.setItem('node-glow', nodeGlow ? 'true' : 'false');
    localStorage.setItem('glassmorphism', glassmorphic ? 'true' : 'false');
    
    document.querySelectorAll('.node circle').forEach(c => {
        if (nodeGlow) {
            c.classList.add('node-glow');
        } else {
            c.classList.remove('node-glow');
        }
    });
}

function applyFontSizeStyle(size) {
    let styleEl = document.getElementById('settings-font-size-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'settings-font-size-style';
        document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
        .bubble-left-btn, .bubble-right-btn, 
        .dialogue-bubble-content, 
        .chat-bubble-content {
            font-size: ${size}px !important;
            line-height: 1.6 !important;
        }
    `;
}

// 12. 数据备份及重置
function triggerExportAction() {
    if (state.isUserLoggedIn) {
        handleQAExport();
    } else {
        alert("正在导出并备份本地全部数据...\n\n成功下载并生成本地数据镜像：\n'WorldStory_Local_Backup.json'，已保存至您的默认下载目录！");
    }
}

function triggerResetAction() {
    const confirmReset = confirm("警告：此操作将永久清空您在此浏览器里的所有故事列表、设定节点、消息历史！\n\n确定要清空并重置吗？");
    if (confirmReset) {
        localStorage.clear();
        alert("系统缓存已成功重置！");
        window.location.reload();
    }
}

// Attach all functions to window for cross-module calls
window.settingsTabContents = settingsTabContents;
window.initSettingsView = initSettingsView;
window.switchSettingsTab = switchSettingsTab;
window.onHyperParamsChange = onHyperParamsChange;
window.saveHyperparameters = saveHyperparameters;
window.onSysPromptTemplateChange = onSysPromptTemplateChange;
window.saveSystemPrompt = saveSystemPrompt;
window.saveModulePrefix = saveModulePrefix;
window.saveModuleSuffix = saveModuleSuffix;
window.saveNodePlanning = saveNodePlanning;
window.saveNodeDeduction = saveNodeDeduction;
window.saveNodeExplanation = saveNodeExplanation;
window.saveNodeCorrection = saveNodeCorrection;
window.setWritingModel = setWritingModel;
window.onWritingParamsChange = onWritingParamsChange;
window.saveWritingModelSettings = saveWritingModelSettings;
window.onChatParamsChange = onChatParamsChange;
window.saveChatModelSettings = saveChatModelSettings;
window.onChatIntegrationChange = onChatIntegrationChange;
window.saveChatIntegration = saveChatIntegration;
window.onChatGroupChange = onChatGroupChange;
window.saveChatGroupSettings = saveChatGroupSettings;
window.onAssistantParamsChange = onAssistantParamsChange;
window.saveAssistantModelSettings = saveAssistantModelSettings;
window.saveAssistantBehaviorSettings = saveAssistantBehaviorSettings;
window.syncSettingsUserProfile = syncSettingsUserProfile;
window.handleSettingsLogout = handleSettingsLogout;
window.setSettingModel = setSettingModel;
window.createNewCustomProvider = createNewCustomProvider;
window.deleteCustomProvider = deleteCustomProvider;
window.selectProviderTab = selectProviderTab;
window.refreshActiveModelSelector = refreshActiveModelSelector;
window.onActiveModelChange = onActiveModelChange;
window.saveCurrentProviderConfig = saveCurrentProviderConfig;
window.syncRangeToNumber = syncRangeToNumber;
window.syncNumberToRange = syncNumberToRange;
window.loadGlobalHyperparamsToUI = loadGlobalHyperparamsToUI;
window.saveGlobalHyperparams = saveGlobalHyperparams;
window.toggleApiKeyInputVisibility = toggleApiKeyInputVisibility;
window.testSettingsApiConnection = testSettingsApiConnection;
window.onSettingsDeductionSliderChange = onSettingsDeductionSliderChange;
window.saveDeductionStepVisibility = saveDeductionStepVisibility;
window.onSettingsTempChange = onSettingsTempChange;
window.saveDeductionParams = saveDeductionParams;
window.saveWritingPrefs = saveWritingPrefs;
window.setSettingStyle = setSettingStyle;
window.saveGenerationLen = saveGenerationLen;
window.setGlobalTheme = setGlobalTheme;
window.updateThemeButtons = updateThemeButtons;
window.onSettingsFontSizeChange = onSettingsFontSizeChange;
window.saveThemeToggles = saveThemeToggles;
window.applyFontSizeStyle = applyFontSizeStyle;
window.triggerExportAction = triggerExportAction;
window.triggerResetAction = triggerResetAction;
window.selectedProviderTab = '';
