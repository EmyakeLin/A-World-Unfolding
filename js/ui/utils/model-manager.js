// 从 localStorage 获取所有 provider 的模型，附带元数据
// 返回: [{ name, providerName, providerId, hasKey }]
export function getAllModels() {
    const providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
    const all = [];
    providers.forEach(p => {
        if (!p || !p.models) return;
        const models = p.models.split(',').map(m => m.trim()).filter(m => m);
        const hasKey = !!(p.key && p.key.trim());
        models.forEach(m => {
            all.push({ name: m, providerName: p.name || p.id, providerId: p.id, hasKey });
        });
    });
    if (all.length === 0) {
        const fallback = localStorage.getItem('global-active-model') || '自定义模型';
        all.push({ name: fallback, providerName: '', providerId: '', hasKey: false });
    }
    return all;
}

// 获取所有 provider 的模型列表（扁平化，用于输入框下拉兼容旧调用）
export function getCustomModels() {
    const all = getAllModels();
    return all.map(m => m.name);
}

// 检测哪些模型名在多个 provider 中出现
export function getDuplicateModelNames() {
    const all = getAllModels();
    const counts = {};
    all.forEach(m => { counts[m.name] = (counts[m.name] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
}

export function getShortModelName(modelName, maxLength = 16) {
    if (modelName && modelName.length > maxLength) return modelName.substring(0, maxLength - 2) + '…';
    return modelName;
}
