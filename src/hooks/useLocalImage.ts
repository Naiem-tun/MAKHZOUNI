import { useState, useEffect } from 'react';
import { getLocalImage } from '../lib/localImages';

export function useLocalImage(productId?: string, hasLocalImage?: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let isMounted = true;

    const load = () => {
      if (!productId || !hasLocalImage) {
        setImageUrl(null);
        return;
      }
      getLocalImage(productId).then(blob => {
        if (blob && isMounted) {
          url = URL.createObjectURL(blob);
          setImageUrl(url);
        }
      }).catch(console.error);
    };

    load();

    const handleDownload = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.productId === productId) {
        if (url) URL.revokeObjectURL(url);
        load();
      }
    };

    window.addEventListener('image-downloaded', handleDownload);

    return () => {
      isMounted = false;
      window.removeEventListener('image-downloaded', handleDownload);
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [productId, hasLocalImage]);

  return imageUrl;
}
