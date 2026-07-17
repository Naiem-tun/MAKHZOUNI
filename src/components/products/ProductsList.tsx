import React from 'react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductsListProps {
  products: Product[];
  showBoxInfo: boolean;
  showPosStock?: boolean;
  onEdit: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
  onCardClick?: (product: Product) => void;
}

export const ProductsList: React.FC<ProductsListProps> = ({
  products,
  showBoxInfo,
  showPosStock,
  onEdit,
  onAddQuantity,
  onCardClick
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        />
      ))}
    </div>
  );
};
