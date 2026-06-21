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
      opt.className = `flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors${isActive ? ' active' : ''}${isGray ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer'}`;
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
