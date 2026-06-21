const DB_NAME = 'worldstory_db';
const DB_VERSION = 2;
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('loresets')) db.createObjectStore('loresets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('stories')) { const s = db.createObjectStore('stories', { keyPath: 'id' }); s.createIndex('loresetId', 'associatedLoreSetId'); }
      if (!db.objectStoreNames.contains('chatSessions')) { const s = db.createObjectStore('chatSessions', { keyPath: 'id' }); s.createIndex('loresetId', 'associatedLoreSetId'); s.createIndex('storyId', 'associatedStoryId'); }
      if (!db.objectStoreNames.contains('sidebarSessions')) { const s = db.createObjectStore('sidebarSessions', { keyPath: 'id' }); s.createIndex('source', 'source'); s.createIndex('sessionId', 'sessionId'); }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function promisify(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function getStore(name, mode) { const db = await openDB(); return db.transaction(name, mode).objectStore(name); }

export let _allLoreSets = [];
export let _allStories = [];
export let _allChats = [];

export function genId(type, name) {
  const base = type + '_' + name;
  const ids = new Set();
  for (const ls of _allLoreSets) {
    ids.add(ls.id);
    for (const n of (ls.worldview?.nodes || [])) ids.add(n.id);
    for (const e of (ls.worldview?.edges || [])) ids.add(e.id);
    for (const h of (ls.worldview?.history || [])) ids.add(h.id);
    for (const g of (ls.worldview?.geography || [])) ids.add(g.id);
    for (const s of Object.values(ls.scenes || {})) ids.add(s.id);
    for (const c of Object.values(ls.characters || {})) ids.add(c.id);
    for (const i of Object.values(ls.items || {})) ids.add(i.id);
  }
  for (const s of _allStories) ids.add(s.id);
  for (const c of _allChats) ids.add(c.id);
  let count = 0;
  for (const id of ids) { if (id === base || id.startsWith(base + '_')) count++; }
  return count === 0 ? base : base + '_' + String(count).padStart(2, '0');
}

const loresets = {
  async getAll() { return promisify((await getStore('loresets')).getAll()); },
  async getById(id) { return promisify((await getStore('loresets')).get(id)); },
  async put(data) { return promisify((await getStore('loresets', 'readwrite')).put(data)); },
  async delete(id) { return promisify((await getStore('loresets', 'readwrite')).delete(id)); }
};

const stories = {
  async getAll() { return promisify((await getStore('stories')).getAll()); },
  async getById(id) { return promisify((await getStore('stories')).get(id)); },
  async getByLoreSet(loresetId) { return promisify((await getStore('stories')).index('loresetId').getAll(loresetId)); },
  async put(data) { return promisify((await getStore('stories', 'readwrite')).put(data)); },
  async delete(id) { return promisify((await getStore('stories', 'readwrite')).delete(id)); }
};

const chatSessions = {
  async getAll() { return promisify((await getStore('chatSessions')).getAll()); },
  async getById(id) { return promisify((await getStore('chatSessions')).get(id)); },
  async getByLoreSet(loresetId) { return promisify((await getStore('chatSessions')).index('loresetId').getAll(loresetId)); },
  async getByStory(storyId) { return promisify((await getStore('chatSessions')).index('storyId').getAll(storyId)); },
  async put(data) { return promisify((await getStore('chatSessions', 'readwrite')).put(data)); },
  async delete(id) { return promisify((await getStore('chatSessions', 'readwrite')).delete(id)); }
};

const sidebarSessions = {
  async getById(id) { return promisify((await getStore('sidebarSessions')).get(id)); },
  async getBySession(source, sessionId) { return promisify((await getStore('sidebarSessions')).index('sessionId').get(sessionId)); },
  async put(data) { return promisify((await getStore('sidebarSessions', 'readwrite')).put(data)); },
  async delete(id) { return promisify((await getStore('sidebarSessions', 'readwrite')).delete(id)); }
};

async function resetDB() { _db = null; return new Promise((resolve, reject) => { const req = indexedDB.deleteDatabase(DB_NAME); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); }

export const DB = { open: openDB, loresets, stories, chatSessions, sidebarSessions, genId, reset: resetDB };
