export class PopupBase {
  constructor(popupId, options = {}) {
    this.el = document.getElementById(popupId);
    this.popupId = popupId;
    this.margin = options.margin || 8;
    this.onShow = options.onShow || null;
    this.onHide = options.onHide || null;
    this.triggerSelector = null;
  }

  show(triggerEl) {
    if (!this.el || !triggerEl) return;
    this.el.classList.remove('hidden');
    this.position(triggerEl);
    this.onShow?.();
  }

  hide() {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.onHide?.();
  }

  toggle(triggerEl) {
    if (!this.el) return;
    if (this.el.classList.contains('hidden')) {
      this.show(triggerEl);
    } else {
      this.hide();
    }
  }

  position(triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const popupWidth = this.el.offsetWidth || 192;
    const popupHeight = this.el.offsetHeight || 132;

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

    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  }

  static _instances = [];
  static _globalCloserRegistered = false;

  static registerGlobalCloser() {
    if (PopupBase._globalCloserRegistered) return;
    PopupBase._globalCloserRegistered = true;

    document.addEventListener('click', (e) => {
      for (const instance of PopupBase._instances) {
        if (!instance.el || instance.el.classList.contains('hidden')) continue;
        if (instance.triggerSelector && e.target.closest(instance.triggerSelector)) continue;
        if (!instance.el.contains(e.target)) {
          instance.hide();
        }
      }
    });
  }

  register(triggerSelector) {
    this.triggerSelector = triggerSelector;
    PopupBase._instances.push(this);
    PopupBase.registerGlobalCloser();
  }
}
