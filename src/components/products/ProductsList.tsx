import React from 'react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface ProductsListProps {
  products: Product[];
  showBoxInfo: boolean;
  showPosStock?: boolean;
  onEdit: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
  onCardClick?: (product: Product) => void;
  theme?: FolioTheme;
}

export const ProductsList: React.FC<ProductsListProps> = ({
  products,
  showBoxInfo,
  showPosStock,
  onEdit,
  onAddQuantity,
  onCardClick,
  theme,
}) => {
  const activeTheme = theme || resolveFolioTheme(false);

  if (products.length === 0) {
    return (
      <div
        className="border p-10 text-center text-xs font-bold"
        style={{
          backgroundColor: activeTheme.surface,
          borderColor: activeTheme.border,
          color: activeTheme.textMuted,
        }}
      >
        لا توجد منتجات مطابقة للتصفية الحالية.
      </div>
    );
  }

  return (
    <div
      className="border divide-y"
      style={{ backgroundColor: activeTheme.surface, borderColor: activeTheme.border }}
    >
      {products.map((p, idx) => (
        <ProductCard
          key={p.id}
          product={p}
          index={idx}
          showBoxInfo={showBoxInfo}
          showPosStock={showPosStock}
          onEdit={onEdit}
          onAddQuantity={onAddQuantity}
          onCardClick={onCardClick}
          theme={activeTheme}
        />
      ))}
    </div>
  );
};
