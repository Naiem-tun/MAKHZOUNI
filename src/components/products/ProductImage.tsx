import React from 'react';
import { Package, LucideIcon } from 'lucide-react';
import { useLocalImage } from '../../hooks/useLocalImage';

interface ProductImageProps {
  productId?: string;
  hasLocalImage?: boolean;
  className?: string;
  iconSize?: number;
  FallbackIcon?: LucideIcon;
}

export function ProductImage({ productId, hasLocalImage, className = "w-full h-full object-cover", iconSize = 32, FallbackIcon = Package }: ProductImageProps) {
  const imageUrl = useLocalImage(productId, hasLocalImage);

  if (imageUrl) {
    return <img src={imageUrl} alt="Product" className={className} />;
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 ${className.replace('object-cover', '')}`}>
      <FallbackIcon size={iconSize} strokeWidth={1.5} />
    </div>
  );
}
