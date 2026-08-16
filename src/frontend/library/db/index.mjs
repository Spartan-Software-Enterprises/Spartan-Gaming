const DB_NAME = 'SpartanLibrary';
const DB_VERSION = 2;

const STORES = Object.freeze({
  games: {
    keyPath: 'id',
    indexes: [
      'title',
      'platform',
      'hashes.sha1',
      'hashes.md5',
      'hashes.crc32',
      'addedAt',
      'updatedAt',
      'favorite',
    ],
  },
  collections: { keyPath: 'id', indexes: ['name', 'createdAt'] },
  settings: { keyPath: 'key', indexes: [] },
  metadataCache: { keyPath: 'key', indexes: ['provider', 'expiresAt'] },
  scanHistory: { keyPath: 'id', indexes: ['startTime', 'status'] },
});

class LibraryDB {
  constructor(db) {
    this.db = db;
    this.games = this._createStoreWrapper('games');
    this.collections = this._createStoreWrapper('collections');
    this.settings = this._createStoreWrapper('settings');
    this.metadataCache = this._createStoreWrapper('metadataCache');
    this.scanHistory = this._createStoreWrapper('scanHistory');
  }

  _createStoreWrapper(storeName) {
    const database = this.db;
    const store = this.db.objectStoreNames.contains(storeName) ? null : undefined;
    return {
      async put(value) {
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const request = store.put(value);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      async get(key) {
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      async delete(key) {
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      },
      async *iterate(index = null, range = null, direction = 'next') {
        const results = await new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const source = index ? store.index(index) : store;
          const request = source.openCursor(range, direction);
          const values = [];
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              values.push(cursor.value);
              cursor.continue();
            } else {
              resolve(values);
            }
          };
          request.onerror = () => reject(request.error);
        });
        yield* results;
      },
      async query(indexName, range, limit = null) {
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const index = store.index(indexName);
          const request = index.openCursor(range);
          const results = [];
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor && (limit === null || results.length < limit)) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          request.onerror = () => reject(request.error);
        });
      },
      async count(indexName = null, range = null) {
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const source = indexName ? store.index(indexName) : store;
          const request = source.count(range);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
    };
  }

  async close() {
    this.db.close();
  }
}

export async function openLibraryDB(name = DB_NAME) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      for (const [storeName, config] of Object.entries(STORES)) {
        let store;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, { keyPath: config.keyPath });
        } else {
          store = event.target.transaction.objectStore(storeName);
        }

        for (const indexName of config.indexes) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, indexName, { unique: false, multiEntry: true });
          }
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('metadataCache')) {
          const cacheStore = db.createObjectStore('metadataCache', { keyPath: 'key' });
          cacheStore.createIndex('provider', 'provider', { unique: false });
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('scanHistory')) {
          const scanStore = db.createObjectStore('scanHistory', { keyPath: 'id' });
          scanStore.createIndex('startTime', 'startTime', { unique: false });
          scanStore.createIndex('status', 'status', { unique: false });
        }
      }
    };

    request.onsuccess = () => {
      resolve(new LibraryDB(request.result));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function closeLibraryDB(db) {
  if (db) {
    await db.close();
  }
}

export { LibraryDB, STORES };
