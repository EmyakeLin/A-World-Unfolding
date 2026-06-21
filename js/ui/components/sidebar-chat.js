import { ChatAreaBase } from './base/chat-area-base.js';

export class SidebarChat extends ChatAreaBase {
  constructor(containerId) {
    super(containerId, { bubbleRadius: '12px', bubblePadding: '10px', fontSize: '10px' });
  }

  renderBubbleContent(msg, bubbleEl, index) {
    const content = document.createElement('div');
    content.className = 'p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed shadow-sm';
    content.style.borderRadius = this.bubbleRadius;
    content.textContent = msg.text;
    bubbleEl.appendChild(content);
  }

  renderActions(msg, index) {
    if (msg.sender !== 'ai') return null;
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 mt-1';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'text-[8px] text-slate-400 hover:text-slate-600';
    copyBtn.textContent = '复制';
    copyBtn.onclick = () => navigator.clipboard.writeText(msg.text);
    actions.appendChild(copyBtn);
    return actions;
  }
}
