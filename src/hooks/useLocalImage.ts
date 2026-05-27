import { useState, useEffect } from 'react';
import { getLocalImage } from '../lib/localImages';

export function useLocalImage(productId?: string, hasLocalImage?: boolean) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let isMounted = true;

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

    return () => {
      isMounted = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [productId, hasLocalImage]);

  return imageUrl;
}
