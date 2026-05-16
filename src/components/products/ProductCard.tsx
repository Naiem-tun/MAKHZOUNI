import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useAnimation, PanInfo } from 'motion/react';
import { Package, Plus } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';
import { useCategories, categoryIcons } from '../../hooks/useCategories';
import { cn, formatCurrency } from '../../lib/utils';

interface ProductCardProps {
  product: Product;
  index: number;
  showBoxInfo?: boolean;
  onEdit: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
}

const ProductIcon = ({ category: catName, className }: { category?: string, className?: string }) => {
  const { categories } = useCategories();
  const category = categories.find(c => c.name === catName);
  const iconName = category?.icon || 'Package';
  const Icon = categoryIcons[iconName] || Package;
  
  return (
    <div className={cn("flex items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/20", className)}>
      <Icon size={16} />
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, index, showBoxInfo, onEdit, onAddQuantity }) => {
  const { t, i18n } = useTranslation();
  const { settings } = useAppContext();
  const language = i18n.language;
  
  const [isSwiped, setIsSwiped] = useState(false);
  const controls = useAnimation();

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (showBoxInfo) return;
    
    // Check swipe threshold
    if (!isSwiped && info.offset.x < -50) {
      setIsSwiped(true);
      controls.start({ x: -100 });
    } else if (isSwiped && info.offset.x > 50) {
      setIsSwiped(false);
      controls.start({ x: 0 });
    } else {
      controls.start({ x: isSwiped ? -100 : 0 });
    }
  };

  const profit = (product.sellingPrice || 0) - (product.purchasePrice || 0);
  const profitMargin = (product.purchasePrice || 0) > 0 ? (profit / product.purchasePrice!) * 100 : 0;

  return (
    <div className="relative group/swipe touch-pan-y">
      {/* Background layer for profit (Revealed when swiped left/right) */}
      {!showBoxInfo && (
        <div className="absolute inset-0 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-end px-4 overflow-hidden" dir="ltr">
          <div className="flex flex-col items-end opacity-90 transition-opacity">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">نسبة الربح</span>
            <span className="text-sm font-black text-amber-700 dark:text-amber-300">
               {formatCurrency(profit, settings.currency, language)}
            </span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-800/50 px-1 rounded mt-0.5">
              {profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Foreground card */}
      <motion.div
        drag={!showBoxInfo ? "x" : false}
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative z-10 flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-2 px-3 rounded-2xl cursor-pointer active:scale-[0.99] transition-transform"
        onClick={(e) => {
          // Prevent triggering edit if it's currently swiped open and being tapped
          if (isSwiped) {
             e.preventDefault();
             setIsSwiped(false);
             controls.start({ x: 0 });
             return;
          }
          onEdit(product);
        }}
        onPanStart={(e, info) => {
          // Optional: handle panning styling
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ProductIcon category={product.category} className="w-8 h-8 shrink-0" />
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
              <div className="flex items-center gap-1 font-mono font-bold text-[10px] text-neutral-700 dark:text-neutral-300">
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
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddQuantity(product);
            }}
            className="flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-2xl text-[11px] font-bold transition-all hover:bg-brand-700 shrink-0 h-9 shadow-sm"
          >
            <Plus size={12} />
            <span>{t('add_quantity')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

