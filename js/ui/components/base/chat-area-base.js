export class ChatAreaBase {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.messages = [];
    this.bubbleRadius = options.bubbleRadius || '36px';
    this.bubblePadding = options.bubblePadding || '24px';
    this.fontSize = options.fontSize || '12px';
  }

  getContainer() {
    return document.getElementById(this.containerId);
  }

  getMessages() { return this.messages; }
  setMessages(msgs) { this.messages = msgs; }
  addMessage(msg) { this.messages.push(msg); }

  render() {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML = '';
    this.messages.forEach((msg, idx) => {
      container.appendChild(this.createBubble(msg, idx));
    });
    container.scrollTop = container.scrollHeight;
  }

  createBubble(msg, index) {
    const isUser = msg.sender === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `flex items-start gap-2 ${isUser ? 'justify-end' : ''} w-full`;

    const avatar = document.createElement('div');
    avatar.className = `w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm select-none text-[9px] font-bold ${isUser ? 'bg-slate-200 text-slate-600 border border-slate-300' : 'bg-blue-50 text-blue-500 border border-blue-200'}`;
    avatar.textContent = isUser ? 'U' : 'A';

    const bubble = document.createElement('div');
    bubble.className = 'flex flex-col max-w-[85%]';

    this.renderBubbleContent(msg, bubble, index);

    const actions = this.renderActions(msg, index);
    if (actions) bubble.appendChild(actions);

    if (isUser) {
      wrapper.appendChild(bubble);
      wrapper.appendChild(avatar);
    } else {
      wrapper.appendChild(avatar);
      wrapper.appendChild(bubble);
    }
    return wrapper;
  }

  renderBubbleContent(msg, bubbleEl, index) {
    const content = document.createElement('div');
    content.className = 'p-2.5 bg-white border border-slate-200 text-[10px] font-medium text-slate-600 leading-relaxed shadow-sm';
    content.style.borderRadius = this.bubbleRadius;
    content.textContent = msg.text || '';
    bubbleEl.appendChild(content);
  }

  renderActions(msg, index) {
    return null;
  }

  appendStream(text) {
    const container = this.getContainer();
    if (!container) return;
    const bubbles = container.querySelectorAll('[class*="bg-white"]');
    const lastBubble = bubbles[bubbles.length - 1];
    if (lastBubble) {
      lastBubble.textContent += text;
      container.scrollTop = container.scrollHeight;
    }
  }

  async send(text, callLLM, tools = null) {
    if (!text.trim()) return;
    this.addMessage({ sender: 'user', text });
    this.render();

    const aiMsg = { sender: 'ai', text: '' };
    this.addMessage(aiMsg);
    this.render();

    const llmMessages = this.buildLLMMessages();
    const response = await callLLM(llmMessages, tools, (chunk) => {
      if (chunk.type === 'content') {
        aiMsg.text += chunk.text;
        this.appendStream(chunk.text);
      }
    });
    if (!aiMsg.text) aiMsg.text = response.content;
    this.render();
    return response;
  }

  buildLLMMessages() {
    return this.messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
  }
}
