import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface ProductsHeaderProps {
  onAddProduct: () => void;
  onOpenPriceAudit?: () => void;
  priceIssuesCount?: number;
}

export const ProductsHeader: React.FC<ProductsHeaderProps> = ({
  onAddProduct,
  onOpenPriceAudit,
  priceIssuesCount = 0
}) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const enablePriceAudit = settings.enablePriceAudit ?? true;

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="text-right min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white leading-tight truncate">{t('products')}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{t('products_list_subtitle')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {enablePriceAudit && onOpenPriceAudit && (
          <button
            onClick={onOpenPriceAudit}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 h-11 px-3 sm:px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap ${
              priceIssuesCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 shadow-amber-500/10 animate-pulse'
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            }`}
            title="تدقيق الأسعار وتصحيح التجزئة والكرتونة"
          >
            <ShieldAlert size={18} className={priceIssuesCount > 0 ? "text-amber-600 dark:text-amber-400 shrink-0" : "text-zinc-400 shrink-0"} />
            <span className="hidden sm:inline">تدقيق الأسعار</span>
            <span className="sm:hidden">التدقيق</span>
            {priceIssuesCount > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full font-mono">
                {priceIssuesCount}
              </span>
            )}
          </button>
        )}

        <button 
          onClick={onAddProduct}
          className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand-600 text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-md shadow-brand-500/20 active:scale-95 whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>{t('add_product')}</span>
        </button>
      </div>
    </header>
  );
};

