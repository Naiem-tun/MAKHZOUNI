import { useState, useEffect } from 'react';
import { getLocalImage } from '../lib/localImages';

export function useLocalImage(productId?: string, hasLocalImage?: boolean, cloudImageUrl?: string | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let isMounted = true;

    if (!productId) {
      setImageUrl(cloudImageUrl || null);
      return;
    }

    if (hasLocalImage) {
      getLocalImage(productId).then(blob => {
        if (blob && isMounted) {
          url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else if (isMounted && cloudImageUrl) {
          // Fallback to cloud URL if local image is not found
          setImageUrl(cloudImageUrl);
        } else if (isMounted && !blob && !cloudImageUrl) {
          setImageUrl(null);
        }
      }).catch(err => {
        console.error(err);
        if (isMounted && cloudImageUrl) setImageUrl(cloudImageUrl);
      });
    } else if (cloudImageUrl) {
      setImageUrl(cloudImageUrl);
    } else {
      setImageUrl(null);
    }

    return () => {
      isMounted = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [productId, hasLocalImage, cloudImageUrl]);

  return imageUrl;
}
