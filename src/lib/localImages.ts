const DB_NAME = 'catalog_images_db';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveLocalImage(productId: string, file: File | Blob): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(file, productId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('image-downloaded', { detail: { productId } }));
    }
  } catch (error) {
    console.error('Failed to save image locally:', error);
    throw error;
  }
}

export async function getLocalImage(productId: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(productId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get image locally:', error);
    return null;
  }
}

export async function deleteLocalImage(productId: string): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(productId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => {
         console.warn('Failed to delete image', request.error);
         resolve();
      };
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('image-downloaded', { detail: { productId } }));
    }
  } catch (error) {
    console.warn('Failed to setup DB for delete', error);
  }
}
