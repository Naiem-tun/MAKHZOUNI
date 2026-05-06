import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Package, Trash2, Edit, Plus } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';
import { cn, formatCurrency } from '../../lib/utils';

interface ProductCardProps {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
}

const ProductIcon = ({ category, className }: { category?: string, className?: string }) => {
  return (
    <div className={cn("flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400", className)}>
      <Package size={16} />
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, index, onEdit, onDelete, onAddQuantity }) => {
  const { t, i18n } = useTranslation();
  const { settings } = useAppContext();
  const language = i18n.language;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 py-2 px-3 rounded-2xl group shadow-sm"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ProductIcon category={product.category} className="w-8 h-8 shrink-0" />
        <div className="min-w-0 flex-1 flex flex-col">
          <h3 className="text-[13px] font-bold text-black dark:text-white leading-tight mb-0.5 truncate">{product.name}</h3>
          <div className="flex flex-col gap-0.5 text-[10px] text-neutral-500 font-medium">
            <div className="flex items-center gap-1">
              <span className="opacity-70">المخزون:</span>
              <span className={cn((product.quantity || 0) < 10 ? "text-delete-text font-bold" : "")}>
                {product.quantity || 0} <span className="text-[9px] opacity-50 font-normal">{t('piece')}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono font-bold text-neutral-700 dark:text-neutral-300">
              <span>{formatCurrency(product.purchasePrice || 0, settings.currency, language)}</span>
              <span className="opacity-30">.</span>
              <span>{formatCurrency(product.sellingPrice || 0, settings.currency, language)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => onDelete(product)}
          className="w-[30px] h-[30px] flex items-center justify-center bg-delete-bg text-delete-text border border-delete-border rounded-lg hover:opacity-80 transition-all dark:bg-neutral-950 dark:border-red-900/30"
          title={t("delete")}
        >
          <Trash2 size={14} />
        </button>
        <button 
          onClick={() => onEdit(product)}
          className="w-[30px] h-[30px] flex items-center justify-center bg-edit-bg text-edit-text border border-edit-border rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all dark:bg-neutral-950 dark:border-neutral-800"
          title={t("edit")}
        >
          <Edit size={14} />
        </button>
        <button 
          onClick={() => onAddQuantity(product)}
          className="flex items-center gap-1 px-3 py-1.5 bg-add-bg text-add-text border border-add-border rounded-full text-[10px] font-bold hover:opacity-80 transition-all dark:bg-neutral-950 dark:border-emerald-900/30"
        >
          <Plus size={12} />
          <span>إضافة كمية</span>
        </button>
      </div>
    </motion.div>
  );
};
