import { ChatAreaBase } from './base/chat-area-base.js';

export class MainDialogue extends ChatAreaBase {
  constructor() {
    super('dialogue-chat-area', { bubbleRadius: '36px', bubblePadding: '24px', fontSize: '12px' });
    this.isDeductionOpen = false;
  }

  renderBubbleContent(msg, bubbleEl, index) {
    if (msg.sender === 'user') {
      const content = document.createElement('div');
      content.className = 'p-6 bg-slate-100/70 border border-slate-200 text-sm font-medium text-slate-600 leading-relaxed shadow-sm';
      content.style.borderRadius = this.bubbleRadius;
      content.textContent = msg.text;
      bubbleEl.appendChild(content);
    } else {
      if (msg.deduction?.length) {
        const stepsEl = this.createDeductionSteps(msg.deduction, index);
        bubbleEl.appendChild(stepsEl);
      }
      const content = document.createElement('div');
      content.className = 'p-6 bg-white border border-slate-200 text-sm font-medium text-slate-600 leading-relaxed shadow-sm';
      content.style.borderRadius = this.bubbleRadius;
      content.textContent = msg.text;
      bubbleEl.appendChild(content);
    }
  }

  createDeductionSteps(steps, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'collapsible-wrapper' + (this.isDeductionOpen ? ' open' : '');
    const inner = document.createElement('div');
    inner.className = 'collapsible-inner space-y-1';
    steps.forEach(step => {
      const line = document.createElement('div');
      line.className = 'text-[10px] text-slate-500';
      line.textContent = step;
      inner.appendChild(line);
    });
    wrapper.appendChild(inner);
    return wrapper;
  }

  renderActions(msg, index) {
    if (msg.sender !== 'ai') return null;
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 mt-2';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'text-[9px] text-slate-400 hover:text-slate-600';
    copyBtn.textContent = '复制';
    copyBtn.onclick = () => navigator.clipboard.writeText(msg.text);
    actions.appendChild(copyBtn);
    return actions;
  }
}
