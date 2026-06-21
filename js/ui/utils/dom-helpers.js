// ===== Toast 通知 =====
export function showToast(message, duration = 2000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = 'padding:8px 16px;border-radius:10px;background:rgba(30,41,59,0.9);backdrop-filter:blur(8px);color:white;font-size:11px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:toastIn 0.3s cubic-bezier(0.4,0,0.2,1);pointer-events:auto;';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s cubic-bezier(0.4,0,0.2,1) forwards';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ===== textarea 自适应高度 =====
export function autoResizeTextarea(el) {
  el.style.height = '0px';
  el.style.height = el.scrollHeight + 'px';
}

export function bindAutoResize(el) {
  el.style.overflow = 'hidden';
  el.addEventListener('input', () => autoResizeTextarea(el));
  requestAnimationFrame(() => autoResizeTextarea(el));
}

// 智能定位算法：根据视口边界空间，选择可用余量最大的一侧展开
export function positionPopupSmart(popup, targetElement, margin = 8) {
    const originallyHidden = popup.classList.contains('hidden');
    if (originallyHidden) {
        popup.classList.remove('hidden');
    }
    // 临时展示但占用物理空间以精确读取高度和宽度
    popup.style.visibility = 'hidden';
    popup.style.position = 'fixed';
    
    const popupHeight = popup.offsetHeight;
    const popupWidth = popup.offsetWidth;
    
    popup.style.visibility = '';
    if (originallyHidden) {
        popup.classList.add('hidden');
    }

    const rect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 计算上下左右四个方向的剩余空间
    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    // 选取拥有最大空余空间的物理边界侧
    const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
    
    let targetLeft = rect.left;
    let targetTop = rect.top;

    if (maxSpace === spaceTop) {
        // 向上展开
        targetTop = rect.top - popupHeight - margin;
        targetLeft = Math.max(8, Math.min(rect.left, viewportWidth - popupWidth - 8));
    } else if (maxSpace === spaceBottom) {
        // 向下展开
        targetTop = rect.bottom + margin;
        targetLeft = Math.max(8, Math.min(rect.left, viewportWidth - popupWidth - 8));
    } else if (maxSpace === spaceLeft) {
        // 向左展开
        targetLeft = rect.left - popupWidth - margin;
        targetTop = Math.max(8, Math.min(rect.top, viewportHeight - popupHeight - 8));
    } else {
        // 向右展开
        targetLeft = rect.right + margin;
        targetTop = Math.max(8, Math.min(rect.top, viewportHeight - popupHeight - 8));
    }

    popup.style.left = `${targetLeft}px`;
    popup.style.top = `${targetTop}px`;
}

// 复制气泡内容
export function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("文本已成功复制到剪贴板！");
    }).catch(err => {
        alert("复制失败: " + err);
    });
}
