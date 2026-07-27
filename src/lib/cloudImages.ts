import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function uploadCloudImage(userId: string, productId: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        await setDoc(doc(db, `users/${userId}/productImages/${productId}`), {
          base64: base64data
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadCloudImage(userId: string, productId: string): Promise<Blob | null> {
  try {
    const docSnap = await getDoc(doc(db, `users/${userId}/productImages/${productId}`));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.base64) {
        const res = await fetch(data.base64);
        return await res.blob();
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to download cloud image:", error);
    return null;
  }
}

export async function deleteCloudImage(userId: string, productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, `users/${userId}/productImages/${productId}`));
  } catch (error) {
    console.error("Failed to delete cloud image:", error);
  }
}
