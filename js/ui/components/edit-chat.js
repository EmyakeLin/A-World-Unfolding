import { ChatAreaBase } from './base/chat-area-base.js';

export class EditChat extends ChatAreaBase {
  constructor() {
    super('edit-chat-list', { bubbleRadius: '12px', bubblePadding: '10px', fontSize: '10px' });
  }

  renderBubbleContent(msg, bubbleEl, index) {
    const content = document.createElement('div');
    content.className = 'p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed shadow-sm';
    content.style.borderRadius = this.bubbleRadius;
    if (msg.toolCalls?.length) {
      content.innerHTML = '<span class="text-blue-500 font-bold">工具调用</span><br>' + (msg.text || '');
    } else {
      content.textContent = msg.text;
    }
    bubbleEl.appendChild(content);
  }
}
