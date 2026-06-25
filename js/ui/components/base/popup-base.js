export class PopupBase {
  constructor(popupId, options = {}) {
    this.popupId = popupId;
    this.margin = options.margin || 8;
    this.onShow = options.onShow || null;
    this.onHide = options.onHide || null;
    this.triggerSelector = null;
    this.el = null;
  }

  _resolve() {
    if (!this.el) this.el = document.getElementById(this.popupId);
    return this.el;
  }

  show(triggerEl) {
    const el = this._resolve();
    if (!el || !triggerEl) return;
    el.classList.remove('hidden');
    this.position(triggerEl);
    this.onShow?.();
  }

  hide() {
    const el = this._resolve();
    if (!el) return;
    el.classList.add('hidden');
    this.onHide?.();
  }

  toggle(triggerEl) {
    const el = this._resolve();
    if (!el) return;
    if (el.classList.contains('hidden')) {
      this.show(triggerEl);
    } else {
      this.hide();
    }
  }

  position(triggerEl) {
    const el = this._resolve();
    if (!el) return;
    const rect = triggerEl.getBoundingClientRect();
    const popupWidth = el.offsetWidth || 192;
    const popupHeight = el.offsetHeight || 132;

    let left = rect.right + this.margin;
    let top = rect.bottom;

    if (left + popupWidth > window.innerWidth) {
      left = rect.left - popupWidth - this.margin;
    }
    if (top + popupHeight > window.innerHeight) {
      top = window.innerHeight - popupHeight - this.margin;
    }
    if (top < this.margin) {
      top = this.margin;
    }

    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  register(triggerSelector) {
    this.triggerSelector = triggerSelector;
    const self = this;
    document.addEventListener('click', (e) => {
      const el = self._resolve();
      if (!el || el.classList.contains('hidden')) return;
      if (self.triggerSelector && e.target.closest(self.triggerSelector)) return;
      if (!el.contains(e.target)) {
        self.hide();
      }
    });
  }
}
