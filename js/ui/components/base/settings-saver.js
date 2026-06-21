export class SettingsSaver {
  static save(key, domId, transform = (v) => v) {
    const el = document.getElementById(domId);
    if (!el) return;
    const value = transform(el.value || el.textContent);
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  static load(key, domId, defaultValue = '') {
    const el = document.getElementById(domId);
    if (!el) return;
    const value = localStorage.getItem(key) || defaultValue;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.value = value;
    } else {
      el.textContent = value;
    }
  }

  static saveGroup(configs) {
    for (const { key, domId, transform } of configs) {
      this.save(key, domId, transform);
    }
  }

  static loadGroup(configs) {
    for (const { key, domId, defaultValue } of configs) {
      this.load(key, domId, defaultValue);
    }
  }
}
