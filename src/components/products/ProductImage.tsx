import React, { useState } from 'react';
import { Package, LucideIcon, CloudDownload, CloudUpload } from 'lucide-react';
import { useLocalImage } from '../../hooks/useLocalImage';
import { downloadCloudImage, uploadCloudImage } from '../../lib/cloudImages';
import { saveLocalImage, getLocalImage } from '../../lib/localImages';
import { useAppContext } from '../../AppContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ProductImageProps {
  productId?: string;
  hasLocalImage?: boolean;
  hasCloudImage?: boolean;
  className?: string;
  iconSize?: number;
  FallbackIcon?: LucideIcon;
}

export function ProductImage({ productId, hasLocalImage, hasCloudImage, className = "w-full h-full object-cover", iconSize = 32, FallbackIcon = Package }: ProductImageProps) {
  const imageUrl = useLocalImage(productId, hasLocalImage || hasCloudImage);
  const { user, settings } = useAppContext();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Local state to hide the upload button after a successful upload before the parent re-renders
  const [optimisticCloudImage, setOptimisticCloudImage] = useState(false);
  
  const effectiveHasCloudImage = hasCloudImage || optimisticCloudImage;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!productId || !user) return;
    
    setIsDownloading(true);
    try {
      const blob = await downloadCloudImage(user.uid, productId);
      if (blob) {
        await saveLocalImage(productId, blob);
        window.dispatchEvent(new CustomEvent('image-downloaded', { detail: { productId } }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!productId || !user) return;

    setIsUploading(true);
    try {
      const blob = await getLocalImage(productId);
      if (blob) {
        await uploadCloudImage(user.uid, productId, blob);
        await updateDoc(doc(db, `users/${user.uid}/products/${productId}`), {
          hasCloudImage: true
        });
        setOptimisticCloudImage(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const canUpload = hasLocalImage && !effectiveHasCloudImage && settings.syncImages && imageUrl;

  if (imageUrl) {
    return (
      <div className={`relative ${className.replace('object-cover', '')} w-full h-full group overflow-hidden`}>
        <img src={imageUrl} alt="Product" className={`w-full h-full object-cover`} />
        {canUpload && (
          <button 
            onClick={handleUpload}
            disabled={isUploading}
            title="رفع الصورة إلى السحابة"
            className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm rounded-lg p-1.5 flex items-center justify-center text-white hover:bg-black/80 transition-all shadow-sm"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
            ) : (
              <CloudUpload size={iconSize * 0.6} />
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full h-full relative flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 ${className.replace('object-cover', '')}`}>
      <FallbackIcon size={iconSize} strokeWidth={1.5} />
      {effectiveHasCloudImage && !imageUrl && (
        <button 
          onClick={handleDownload}
          disabled={isDownloading}
          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
        >
          {isDownloading ? (
            <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
          ) : (
            <CloudDownload size={iconSize * 0.8} />
          )}
        </button>
      )}
    </div>
  );
}
