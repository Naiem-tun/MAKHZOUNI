import { useState, useEffect } from 'react';
import { getLocalImage } from '../lib/localImages';

export function useLocalImage(productId?: string, hasLocalImage?: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;
    let isMounted = true;

    const load = () => {
      if (!productId) {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
          currentUrl = null;
        }
        setImageUrl(null);
        return;
      }

      getLocalImage(productId).then(blob => {
        if (!isMounted) return;
        if (blob) {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          currentUrl = URL.createObjectURL(blob);
          setImageUrl(currentUrl);
        } else {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
            currentUrl = null;
          }
          setImageUrl(null);

          // Retry if save was in progress or flag was set
          if (hasLocalImage) {
            setTimeout(() => {
              if (!isMounted) return;
              getLocalImage(productId).then(retryBlob => {
                if (retryBlob && isMounted) {
                  if (currentUrl) URL.revokeObjectURL(currentUrl);
                  currentUrl = URL.createObjectURL(retryBlob);
                  setImageUrl(currentUrl);
                }
              }).catch(console.error);
            }, 250);
          }
        }
      }).catch(err => {
        console.error("Error loading local image:", err);
        if (isMounted) {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
            currentUrl = null;
          }
          setImageUrl(null);
        }
      });
    };

    load();

    const handleDownload = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail?.productId || customEvent.detail.productId === productId) {
        load();
      }
    };

    window.addEventListener('image-downloaded', handleDownload);

    return () => {
      isMounted = false;
      window.removeEventListener('image-downloaded', handleDownload);
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [productId, hasLocalImage]);

  return imageUrl;
}
