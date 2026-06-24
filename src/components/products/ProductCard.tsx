import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Package, Plus, Pencil } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';
import { useCategories, categoryIcons } from '../../hooks/useCategories';
import { cn, formatCurrency } from '../../lib/utils';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  index: number;
  showBoxInfo?: boolean;
  onEdit: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
  onCardClick?: (product: Product) => void;
}

const ProductIcon = ({ product, className }: { product: Product, className?: string }) => {
  const { categories } = useCategories();
  const category = categories.find(c => c.name === product.category);
  const iconName = category?.icon || 'Package';
  const Icon = categoryIcons[iconName] || Package;
  
  if (product.hasLocalImage && product.id) {
    return (
      <div className={cn("overflow-hidden shrink-0", className)}>
        <ProductImage productId={product.id} hasLocalImage={product.hasLocalImage} />
      </div>
    );
  }
  
  return (
    <div className={cn("flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/20", className)}>
      <Icon size={16} />
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, index, showBoxInfo, onEdit, onAddQuantity, onCardClick }) => {
  const { t, i18n } = useTranslation();
  const { settings } = useAppContext();
  const language = i18n.language;

  const profit = (product.sellingPrice || 0) - (product.purchasePrice || 0);
  const calcMethod = settings.profitCalculationMethod || 'markup'; // markup: profit/cost * 100, margin: profit/sell * 100
  const profitMargin = calcMethod === 'margin' 
    ? ((product.sellingPrice || 0) > 0 ? (profit / product.sellingPrice!) * 100 : 0)
    : ((product.purchasePrice || 0) > 0 ? (profit / product.purchasePrice!) * 100 : 0);

  return (
    <div className="relative group overflow-hidden rounded-lg">
      {/* Background layer for profit (Revealed when swiped left/right) */}
      {!showBoxInfo && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 z-0 w-28 justify-end bg-brand-50 dark:bg-brand-900/20" dir="ltr">
          <div className="flex flex-col items-end opacity-90 transition-opacity">
            <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{t('profit_margin')}</span>
            <span className="text-sm font-black text-brand-700 dark:text-brand-300">
               {formatCurrency(profit, settings.currency, language)}
             </span>
            <span className="text-[10px] font-bold text-brand-600 bg-brand-100 dark:bg-brand-800/50 px-1 rounded mt-0.5">
              {profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Foreground card */}
      <motion.div
        drag={!showBoxInfo ? "x" : false}
        dragConstraints={{ left: -112, right: 0 }}
        dragElastic={0.1}
        className="relative z-10 flex items-center justify-between gap-3 bg-white p-3 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg cursor-pointer"
        onClick={(e) => {
          if (onCardClick) {
            onCardClick(product);
          } else {
            onEdit(product);
          }
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ProductIcon product={product} className={cn("w-8 h-8 shrink-0", product.hasLocalImage ? "rounded-[12px]" : "")} />
          <div className="min-w-0 flex-1 flex flex-col">
            <h3 className="text-base font-medium text-black dark:text-white leading-tight mb-0.5 truncate">{product.name}</h3>
            <div className="flex flex-col gap-0.5 text-[10px] text-neutral-500 font-bold">
              <div className="flex items-center gap-1">
                <span className="opacity-70">{t('stock_label')}</span>
                <span className={cn((product.quantity || 0) <= (product.minQuantity ?? 0) ? "text-delete-text font-black" : "")}>
                  {product.quantity || 0} <span className="opacity-50 font-normal">{t('piece')}</span>
                </span>
                {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1 && (
                  <span className="text-[9px] text-zinc-400 font-medium">
                    ({Math.floor(product.quantity / product.piecesPerBox)} {t('box_and')} {product.quantity % product.piecesPerBox} {t('piece')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 font-mono font-bold text-[12px] text-neutral-700 dark:text-neutral-300">
                {showBoxInfo ? (
                  <>
                    <span className="text-brand-600 dark:text-brand-400">
                      {formatCurrency(product.boxPurchasePrice || 0, settings.currency, language)}
                    </span>
                    <span className="opacity-30">/</span>
                    <span className="font-sans text-neutral-400">{t('box')} ({product.piecesPerBox} {t('piece')})</span>
                  </>
                ) : (
                  <>
                    <span>{!(settings.showFinancials ?? true) ? '••••••' : formatCurrency(product.purchasePrice || 0, settings.currency, language)}</span>
                    <span className="opacity-30">.</span>
                    <span>{formatCurrency(product.sellingPrice || 0, settings.currency, language)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showBoxInfo && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product);
              }}
              className="flex items-center justify-center w-10 h-10 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all shrink-0 shadow-sm"
              title={t('edit') || 'Edit'}
            >
              <Pencil size={18} />
            </button>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddQuantity(product);
            }}
            className="flex items-center justify-center w-10 h-10 bg-blue-50 border border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-all shrink-0 shadow-sm"
            title={t('add_quantity')}
          >
            <Plus size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

