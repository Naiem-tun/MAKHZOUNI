import React from 'react';
import { Package } from 'lucide-react';
import { useLocalImage } from '../../hooks/useLocalImage';

interface ProductImageProps {
  productId?: string;
  hasLocalImage?: boolean;
  cloudImageUrl?: string | null;
  className?: string;
  iconSize?: number;
}

export function ProductImage({ productId, hasLocalImage, cloudImageUrl, className = "w-full h-full object-cover", iconSize = 32 }: ProductImageProps) {
  const imageUrl = useLocalImage(productId, hasLocalImage, cloudImageUrl);

  if (imageUrl) {
    return <img src={imageUrl} alt="Product" loading="lazy" className={className} />;
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-[#0F172A]/30 text-zinc-300 dark:text-zinc-600 ${className.replace('object-cover', '')}`}>
      <Package size={iconSize} strokeWidth={1} />
    </div>
  );
}
