import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadImageToCloud(productId: string, file: Blob): Promise<string> {
  try {
    const storageRef = ref(storage, `products/${productId}.jpg`);
    
    // Upload the file
    await uploadBytes(storageRef, file, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    });
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Failed to upload image to cloud:', error);
    throw error;
  }
}

export async function deleteCloudImage(productId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `products/${productId}.jpg`);
    await deleteObject(storageRef);
  } catch (error: any) {
    // Ignore error if object doesn't exist
    if (error.code !== 'storage/object-not-found') {
      console.warn('Failed to delete cloud image:', error);
    }
  }
}
