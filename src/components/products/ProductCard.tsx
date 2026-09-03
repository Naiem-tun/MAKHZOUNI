import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Package, Plus, SquarePen, Lock } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';
import { useCategories, categoryIcons } from '../../hooks/useCategories';
import { cn, formatCurrency, cleanQuantity, formatQuantity } from '../../lib/utils';
import { ProductImage } from './ProductImage';
import { auditProduct } from '../../lib/priceAuditor';

interface ProductCardProps {
  product: Product;
  index: number;
  showBoxInfo?: boolean;
  showPosStock?: boolean;
  onEdit: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
  onCardClick?: (product: Product) => void;
}

const ProductIcon = ({ product, className }: { product: Product, className?: string }) => {
  const { categories } = useCategories();
  const category = categories.find(c => c.name === product.category);
  const iconName = category?.icon || 'Package';
  const Icon = categoryIcons[iconName] || Package;
  
  if ((product.hasLocalImage || product.hasCloudImage) && product.id) {
    return (
      <div className={cn("overflow-hidden shrink-0", className)}>
        <ProductImage productId={product.id} hasLocalImage={product.hasLocalImage} hasCloudImage={product.hasCloudImage} FallbackIcon={Icon} iconSize={16} />
      </div>
    );
  }
  
  return (
    <div className={cn("flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/20", className)}>
      <Icon size={16} />
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, index, showBoxInfo, showPosStock, onEdit, onAddQuantity, onCardClick }) => {
  const { t, i18n } = useTranslation();
  const { settings, activeSupplier, showToast } = useAppContext();
  const language = i18n.language;

  const baseSellingPrice = showBoxInfo ? (product.sellingPrice || 0) * (product.piecesPerBox || 1) : (product.sellingPrice || 0);
  const basePurchasePrice = showBoxInfo ? (product.boxPurchasePrice || ((product.purchasePrice || 0) * (product.piecesPerBox || 1))) : (product.purchasePrice || 0);

  const profit = baseSellingPrice - basePurchasePrice;
  const calcMethod = settings.profitCalculationMethod || 'markup'; // markup: profit/cost * 100, margin: profit/sell * 100
  const profitMargin = calcMethod === 'margin' 
    ? (baseSellingPrice > 0 ? (profit / baseSellingPrice) * 100 : 0)
    : (basePurchasePrice > 0 ? (profit / basePurchasePrice) * 100 : 0);

  const isPurchaseDisabled = settings.requireSupplierSession && !activeSupplier;
  const enablePriceAudit = settings.enablePriceAudit ?? true;
  const audit = useMemo(() => auditProduct(product), [product]);
  const hasPriceError = enablePriceAudit && audit.hasIssues;
  const mainIssue = audit.issues[0];

  const unitMap: Record<string, string> = {
    piece: 'قطعة',
    carton: 'كرتونة',
    kg: 'كغ',
    gram: 'غرام',
    liter: 'لتر',
    box: 'صندوق',
    meter: 'متر'
  };
  const unitText = product.unit ? (unitMap[product.unit] || t(product.unit) || 'قطعة') : t('piece');

  return (
    <div className="relative group overflow-hidden rounded-lg">
      {/* Background layer for profit (Revealed when swiped left/right) */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-4 z-0 w-28 justify-end bg-brand-50 dark:bg-brand-900/20" dir="ltr">
        <div className="flex flex-col items-end opacity-90 transition-opacity">
          <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
            {t('profit_margin')} {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1 ? `(${t('box')})` : ''}
          </span>
          <span className="text-sm font-black text-brand-700 dark:text-brand-300">
             {formatCurrency(profit, settings.currency, language)} 
           </span>
          <span className="text-[10px] font-bold text-brand-600 bg-brand-100 dark:bg-brand-800/50 px-1 rounded mt-0.5">
            {profitMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Foreground card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -112, right: 0 }}
        dragElastic={0.1}
        className={cn(
          "relative z-10 flex items-center justify-between gap-3 bg-white p-3 shadow-sm border rounded-lg cursor-pointer transition-colors",
          hasPriceError
            ? "border-red-300 bg-red-50/20 dark:bg-red-950/10 dark:border-red-800/60"
            : "border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800"
        )}
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
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <h3 className="text-base font-medium text-black dark:text-white leading-tight truncate">{product.name}</h3>
              {hasPriceError && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold border shrink-0",
                  mainIssue?.severity === 'error'
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800"
                    : mainIssue?.severity === 'warning'
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                )}>
                  ⚠️ {mainIssue?.title || 'خطأ تسعير'}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 text-[10px] text-neutral-500 font-bold">
              {showPosStock ? (
                <div className="flex items-center gap-1.5 bg-neutral-100/60 dark:bg-zinc-800/40 border border-neutral-200/50 dark:border-zinc-700/40 px-1.5 py-0.5 rounded w-fit text-[9px] font-bold text-neutral-500 dark:text-neutral-400">
                  <span className="opacity-70">مخزون الكاشير:</span>
                  {settings.defaultStockView === 'boxes' && product.piecesPerBox && product.piecesPerBox > 1 ? (
                    <>
                      <span className="text-teal-600 dark:text-teal-400 font-extrabold font-mono">
                        {(cleanQuantity(product.posQuantity !== undefined ? product.posQuantity : product.quantity) / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="opacity-50 font-normal">كرتونة</span>
                      </span>
                      <span className="text-[9px] text-neutral-400 font-medium">
                        ({formatQuantity(product.posQuantity !== undefined ? product.posQuantity : product.quantity)} {unitText})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-teal-600 dark:text-teal-400 font-extrabold font-mono">
                        {formatQuantity(product.posQuantity !== undefined ? product.posQuantity : product.quantity)} <span className="opacity-50 font-normal">{unitText}</span>
                      </span>
                      {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1 && (
                        <span className="text-[9px] text-neutral-400 font-medium">
                          ({Math.floor(cleanQuantity(product.posQuantity !== undefined ? product.posQuantity : product.quantity) / product.piecesPerBox)} كرتونة و {formatQuantity(cleanQuantity(product.posQuantity !== undefined ? product.posQuantity : product.quantity) % product.piecesPerBox)} {unitText})
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-neutral-100/60 dark:bg-zinc-800/40 border border-neutral-200/50 dark:border-zinc-700/40 px-1.5 py-0.5 rounded w-fit text-[9px] font-bold text-neutral-500 dark:text-neutral-400">
                  <span className="opacity-70">{t('stock_label')}:</span>
                  {settings.defaultStockView === 'boxes' && product.piecesPerBox && product.piecesPerBox > 1 ? (
                    <>
                      <span className={cn("font-extrabold font-mono", cleanQuantity(product.quantity) <= (product.minQuantity ?? 0) ? "text-delete-text" : "text-blue-600 dark:text-blue-400")}>
                        {(cleanQuantity(product.quantity) / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="opacity-50 font-normal">كرتونة</span>
                      </span>
                      <span className="text-[9px] text-neutral-400 font-medium">
                        ({formatQuantity(product.quantity)} {unitText})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={cn("font-extrabold font-mono", cleanQuantity(product.quantity) <= (product.minQuantity ?? 0) ? "text-delete-text" : "text-blue-600 dark:text-blue-400")}>
                        {formatQuantity(product.quantity)} <span className="opacity-50 font-normal">{unitText}</span>
                      </span>
                      {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1 && (
                        <span className="text-[9px] text-neutral-400 font-medium">
                          ({Math.floor(cleanQuantity(product.quantity) / product.piecesPerBox)} كرتونة و {formatQuantity(cleanQuantity(product.quantity) % product.piecesPerBox)} {unitText})
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 font-mono font-bold text-[12px] text-neutral-700 dark:text-neutral-300">
                {showBoxInfo ? (
                  <>
                    <span className="text-brand-600 dark:text-brand-400">
                      {formatCurrency(product.boxPurchasePrice || 0, settings.currency, language)}
                    </span>
                    <span className="opacity-30">/</span>
                    <span className="font-sans text-neutral-400">{t('box')} ({product.piecesPerBox} {unitText})</span>
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

        <div className="flex items-center gap-2 shrink-0 self-end mt-2 mb-0.5">
          {showBoxInfo && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product);
              }}
              className="flex items-center justify-center w-[34px] h-[34px] bg-blue-50/50 border border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 hover:border-blue-300 dark:hover:bg-blue-500/30 transition-all active:scale-95 shrink-0"
              title={t('edit') || 'Edit'}
            >
              <SquarePen size={16} strokeWidth={1.5} />
            </button>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (isPurchaseDisabled) {
                showToast('يجب فتح حصة مورد أولاً لإضافة المشتريات', 'error');
                return;
              }
              onAddQuantity(product);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 h-[34px] rounded-lg transition-all shrink-0",
              isPurchaseDisabled 
                ? "bg-zinc-100 border border-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 cursor-not-allowed" 
                : "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 active:scale-95"
            )}
            title={isPurchaseDisabled ? 'يجب فتح حصة مورد أولاً' : t('add_quantity')}
          >
            {isPurchaseDisabled ? (
              <Lock size={14} strokeWidth={2.5} />
            ) : (
              <Plus size={16} strokeWidth={2.5} />
            )}
            <span className="text-xs font-bold">{t('add_quantity')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

