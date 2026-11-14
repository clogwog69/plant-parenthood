import type { Photo, Plant } from './types';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('sprout', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('plants', { keyPath: 'id' });
        db.createObjectStore('photos', { keyPath: 'id' }).createIndex('plantId', 'plantId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function run<T>(store: 'plants' | 'photos', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const allPlants = () => run<Plant[]>('plants', 'readonly', (s) => s.getAll());
export const putPlant = (p: Plant) => run('plants', 'readwrite', (s) => s.put(p));
export const deletePlant = (id: string) => run('plants', 'readwrite', (s) => s.delete(id));
export const putPhoto = (p: Photo) => run('photos', 'readwrite', (s) => s.put(p));
export const photoIds = () => run<IDBValidKey[]>('photos', 'readonly', (s) => s.getAllKeys()).then((k) => k.map(String));
export const getPhoto = (id: string) => run<Photo | undefined>('photos', 'readonly', (s) => s.get(id));

export async function deletePhotosFor(plantId: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const req = tx.objectStore('photos').index('plantId').openKeyCursor(IDBKeyRange.only(plantId));
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        tx.objectStore('photos').delete(c.primaryKey);
        c.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
