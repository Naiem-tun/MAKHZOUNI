import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Package, Trash2, Edit, Plus } from 'lucide-react';
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={() => onEdit(product)}
      className="flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-2 px-3 rounded-2xl group cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ProductIcon category={product.category} className="w-8 h-8 shrink-0" />
        <div className="min-w-0 flex-1 flex flex-col">
          <h3 className="text-base font-medium text-black dark:text-white leading-tight mb-0.5 truncate">{product.name}</h3>
          <div className="flex flex-col gap-0.5 text-[10px] text-neutral-500 font-bold">
            <div className="flex items-center gap-1">
              <span className="opacity-70">المخزون:</span>
              <span className={cn((product.quantity || 0) < 10 ? "text-delete-text font-black" : "")}>
                {product.quantity || 0} <span className="opacity-50 font-normal">{t('piece')}</span>
              </span>
              {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1 && (
                <span className="text-[9px] text-zinc-400 font-medium">
                  ({Math.floor(product.quantity / product.piecesPerBox)} كرتونة و {product.quantity % product.piecesPerBox} قطعة)
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
                  <span className="font-sans text-neutral-400">كرتونة ({product.piecesPerBox} قطعة)</span>
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
          <span>إضافة كمية</span>
        </button>
      </div>
    </motion.div>
  );
};

