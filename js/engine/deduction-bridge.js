import { runTick } from './tick-runner.js';
import { DB } from '../core/db.js';

export async function deductionBridge(text) {
  const activeStoryMessages = window.activeStoryMessages;
  const inputBox = window.inputBox;
  const renderDialogueArea = window.renderDialogueArea;
  const activeStoryId = window.activeStoryId;

  activeStoryMessages.push({
  if (inputBox) inputBox.setValue('');
  renderDialogueArea();

  const storyName = activeStoryId;
  const storyData = await DB.stories.getAll();
  const story = storyData.find(s => s.title === storyName || s.id === storyName);
  if (!story) {
    activeStoryMessages.push({
      sender: "ai", text: "⚠️ 未找到当前故事数据，请先创建故事。",
      deduction: [], stats: "", isDeductionOpen: false, isNew: true, isBubbleNew: true
    });
    renderDialogueArea();
    return;
  }

  const aiMsgIdx = activeStoryMessages.length;
  const uniqueId = 'ai-' + aiMsgIdx;
  const aiMsg = {
    sender: "ai", text: "", deduction: [], stats: "",
    isDeductionOpen: true, isStreaming: true, currentHeader: "Initializing...",
    isNew: true, isBubbleNew: true
  };
  activeStoryMessages.push(aiMsg);
  renderDialogueArea();

  await runTick(story, text, (stage, detail) => {
    const stageLabels = {
      'planner-done': 'Planning Deduction：' + detail,
      'mtip': detail,
      'mtip-done': '✅ ' + detail,
      'interpreter': '📖 ' + detail,
      'interpreter-done': '📖 ' + detail,
      'fix': '🔧 Interpret-Fix 检测冲突...',
      'fix-done': '🔧 修正完成',
      'writer': '✍️ Writer 撰写中...',
      'writer-stream': detail,
      'writer-done': '✍️ 小说撰写完成',
      'reviewer': '👁️ Reviewer 审查...',
      'reviewer-done': '👁️ 审查完成',
      'complete': '🎉 推演完成',
      'error': '❌ ' + detail
    };

    if (stage === 'writer-stream') {
      aiMsg.text += detail;
      const textEl = document.getElementById(uniqueId + '-text');
      if (textEl) textEl.textContent = aiMsg.text;
      const chatArea = document.getElementById('dialogue-chat-area');
      if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
    } else if (stage === 'mtip') {
      if (!aiMsg._mtipIndexMap) aiMsg._mtipIndexMap = {};
      aiMsg._mtipIndexMap[detail] = aiMsg.deduction.length;
      aiMsg.deduction.push(detail);
      aiMsg.currentHeader = detail;
      renderDialogueArea();
      if (window.animateButtonHeader) window.animateButtonHeader(uniqueId, detail);
    } else if (stage === 'mtip-done') {
      const charName = detail.split(':')[0].trim();
      const intent = detail.split(':').slice(1).join(':').trim();
      const map = aiMsg._mtipIndexMap || {};
      const idx = Object.entries(map).find(([label]) => label.includes(charName))?.[1];
      if (idx !== undefined && aiMsg.deduction[idx] !== undefined) {
        aiMsg.deduction[idx] = aiMsg.deduction[idx] + '：' + intent;
        const stepsContainer = document.querySelector(`#${uniqueId}-deduction-content .flex-1`);
        if (stepsContainer) {
          const stepEls = stepsContainer.querySelectorAll('.flex.flex-col.gap-0\\.5');
          if (stepEls[idx]) {
            const detailEl = stepEls[idx].querySelector('.text-slate-500');
            if (detailEl) detailEl.textContent = intent;
          }
        }
      }
    } else if (stage === 'planner') {
    } else if (stage === 'planner-tool') {
      aiMsg.deduction.push(detail);
      aiMsg.currentHeader = detail;
      renderDialogueArea();
      if (window.animateButtonHeader) window.animateButtonHeader(uniqueId, detail);
    } else if (stage === 'planner-tool-done') {
      const lastIdx = aiMsg.deduction.length - 1;
      if (lastIdx >= 0) {
        aiMsg.deduction[lastIdx] = aiMsg.deduction[lastIdx] + ' ' + detail;
        const stepsContainer = document.querySelector(`#${uniqueId}-deduction-content .flex-1`);
        if (stepsContainer) {
          const stepEls = stepsContainer.querySelectorAll('.flex.flex-col.gap-0\\.5');
          if (stepEls[lastIdx]) {
            const detailEl = stepEls[lastIdx].querySelector('.text-slate-500');
            if (detailEl) detailEl.textContent = detailEl.textContent + ' ' + detail;
          }
        }
      }
    } else if (stage === 'planner-tools-batch') {
      aiMsg.deduction.push('Invoking Multiple Tools');
      aiMsg.currentHeader = 'Invoking Multiple Tools';
      renderDialogueArea();
      if (window.animateButtonHeader) window.animateButtonHeader(uniqueId, 'Invoking Multiple Tools');
    } else if (stage === 'planner-tools-batch-done') {
      const lastIdx = aiMsg.deduction.length - 1;
      if (lastIdx >= 0) {
        aiMsg.deduction[lastIdx] = 'Invoking Multiple Tools：' + detail;
        const stepsContainer = document.querySelector(`#${uniqueId}-deduction-content .flex-1`);
        if (stepsContainer) {
          const stepEls = stepsContainer.querySelectorAll('.flex.flex-col.gap-0\\.5');
          if (stepEls[lastIdx]) {
            const detailEl = stepEls[lastIdx].querySelector('.text-slate-500');
            if (detailEl) detailEl.textContent = detail;
          }
        }
      }
    } else {
      const label = stageLabels[stage] || detail;
      aiMsg.deduction.push(label);
      aiMsg.currentHeader = label;
      renderDialogueArea();
      if (window.animateButtonHeader) window.animateButtonHeader(uniqueId, label);
    }
  });

  aiMsg.isStreaming = false;
  aiMsg.currentHeader = "Show Deduction Steps";
  aiMsg.stats = (story.ticks?.length || 0) + ' ticks / ' + (story.eventQuadruples?.length || 0) + ' events';
  renderDialogueArea();
}

window._deductionBridge = deductionBridge;
