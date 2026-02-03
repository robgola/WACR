import { openDB } from 'idb';

const DB_NAME = 'acr_server_cache_v1';
const STORE_NAME = 'api_responses';

export const cacheManager = {
    dbPromise: openDB(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME);
        },
    }),

    async get(key) {
        return (await this.dbPromise).get(STORE_NAME, key);
    },

    async set(key, val) {
        return (await this.dbPromise).put(STORE_NAME, val, key);
    },

    async delete(key) {
        return (await this.dbPromise).delete(STORE_NAME, key);
    },

    async clear() {
        return (await this.dbPromise).clear(STORE_NAME);
    },
};
