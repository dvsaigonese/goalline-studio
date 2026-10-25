// js/shared/gl-db.js
const DB_NAME = 'GoalLineStudioDB';
const DB_VERSION = 1;

const STORES = {
    TACTICAL_PROJECTS: 'tactical_projects',
    VIDEO_PROJECTS: 'video_projects',
    BRIDGE_QUEUE: 'bridge_queue' // Chứa gói dữ liệu xuất từ Tactical Board sang Module 07
};

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORES.TACTICAL_PROJECTS)) {
                db.createObjectStore(STORES.TACTICAL_PROJECTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.VIDEO_PROJECTS)) {
                db.createObjectStore(STORES.VIDEO_PROJECTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.BRIDGE_QUEUE)) {
                db.createObjectStore(STORES.BRIDGE_QUEUE, { keyPath: 'id' });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore(storeName, mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = callback(store);

        tx.oncomplete = () => {
            db.close();
            resolve(req ? req.result : true);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

export const GLDatabase = {
    // --- QUẢN LÝ DỰ ÁN TACTICAL BOARD ---
    async getAllTacticalProjects() {
        const list = await withStore(STORES.TACTICAL_PROJECTS, 'readonly', (s) => s.getAll());
        return (list || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    async getTacticalProject(id) {
        return await withStore(STORES.TACTICAL_PROJECTS, 'readonly', (s) => s.get(id));
    },

    async saveTacticalProject(project) {
        project.updatedAt = Date.now();
        return await withStore(STORES.TACTICAL_PROJECTS, 'readwrite', (s) => s.put(project));
    },

    async deleteTacticalProject(id) {
        return await withStore(STORES.TACTICAL_PROJECTS, 'readwrite', (s) => s.delete(id));
    },

    // --- QUẢN LÝ DỰ ÁN VIDEO (MODULE 07) ---
    async getAllVideoProjects() {
        const list = await withStore(STORES.VIDEO_PROJECTS, 'readonly', (s) => s.getAll());
        return (list || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    async getVideoProject(id) {
        return await withStore(STORES.VIDEO_PROJECTS, 'readonly', (s) => s.get(id));
    },

    async saveVideoProject(project) {
        project.updatedAt = Date.now();
        return await withStore(STORES.VIDEO_PROJECTS, 'readwrite', (s) => s.put(project));
    },

    async deleteVideoProject(id) {
        return await withStore(STORES.VIDEO_PROJECTS, 'readwrite', (s) => s.delete(id));
    },

    // --- CẦU NỐI TACTICAL BOARD -> MODULE 07 ---
    async pushToVideoBridge(payload) {
        payload.id = 'latest_bridge_export';
        payload.createdAt = Date.now();
        return await withStore(STORES.BRIDGE_QUEUE, 'readwrite', (s) => s.put(payload));
    },

    async consumeVideoBridge() {
        const data = await withStore(STORES.BRIDGE_QUEUE, 'readonly', (s) => s.get('latest_bridge_export'));
        if (data) {
            await withStore(STORES.BRIDGE_QUEUE, 'readwrite', (s) => s.delete('latest_bridge_export'));
        }
        return data;
    }
};