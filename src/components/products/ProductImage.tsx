import React, { useState } from 'react';
import { Package, LucideIcon, CloudDownload } from 'lucide-react';
import { useLocalImage } from '../../hooks/useLocalImage';
import { downloadCloudImage } from '../../lib/cloudImages';
import { saveLocalImage } from '../../lib/localImages';
import { useAppContext } from '../../AppContext';

interface ProductImageProps {
  productId?: string;
  hasLocalImage?: boolean;
  hasCloudImage?: boolean;
  className?: string;
  iconSize?: number;
  FallbackIcon?: LucideIcon;
}

export function ProductImage({ productId, hasLocalImage, hasCloudImage, className = "w-full h-full object-cover", iconSize = 32, FallbackIcon = Package }: ProductImageProps) {
  const imageUrl = useLocalImage(productId, hasLocalImage || hasCloudImage); // Try to load it if either is true, since we might have just downloaded it
  const { user } = useAppContext();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!productId || !user) return;
    
    setIsDownloading(true);
    try {
      const blob = await downloadCloudImage(user.uid, productId);
      if (blob) {
        await saveLocalImage(productId, blob);
        // We trigger a re-render by doing a hard reload or relying on useLocalImage? 
        // useLocalImage depends on hasLocalImage prop. We could force a reload of the image here, but since it's just cached, let's just reload the page or use an event.
        // Actually, let's dispatch a custom event to force useLocalImage to re-fetch
        window.dispatchEvent(new CustomEvent('image-downloaded', { detail: { productId } }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (imageUrl) {
    return <img src={imageUrl} alt="Product" className={className} />;
  }

  return (
    <div className={`w-full h-full relative flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 ${className.replace('object-cover', '')}`}>
      <FallbackIcon size={iconSize} strokeWidth={1.5} />
      {hasCloudImage && !imageUrl && (
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
