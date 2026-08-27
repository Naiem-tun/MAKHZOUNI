import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode, Layers, Filter, Package, ChevronDown, Monitor } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Category } from '../../types';
import { useAppContext } from '../../AppContext';

interface ProductsFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  stockFilter: string;
  setStockFilter: (filter: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  showBoxInfo: boolean;
  setShowBoxInfo: (show: boolean) => void;
  showPosStock?: boolean;
  setShowPosStock?: (show: boolean) => void;
  categories: Category[];
  priceErrorsCount?: number;
  onOpenScanner: () => void;
}

export const ProductsFilters: React.FC<ProductsFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  stockFilter,
  setStockFilter,
  categoryFilter,
  setCategoryFilter,
  showBoxInfo,
  setShowBoxInfo,
  showPosStock,
  setShowPosStock,
  categories,
  priceErrorsCount = 0,
  onOpenScanner
}) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  
  const [stockDropdownOpen, setStockDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  
  const stockRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stockRef.current && !stockRef.current.contains(event.target as Node)) {
        setStockDropdownOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const stockOptions = useMemo(() => {
    const opts = [
      { value: 'all', label: t('all_stock') },
      { value: 'available', label: t('available_stock') },
      { value: 'low', label: t('low_stock') },
      { value: 'out', label: t('out_of_stock') }
    ];
    if (priceErrorsCount > 0) {
      opts.push({
        value: 'price_error',
        label: `⚠️ أخطاء التسعير (${priceErrorsCount})`
      });
    }
    return opts;
  }, [priceErrorsCount, t]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: 'all', label: t('all_categories') }];
    const seen = new Set<string>(['all']);
    categories.forEach(c => {
      if (c && c.name && !seen.has(c.name)) {
        seen.add(c.name);
        options.push({ value: c.name, label: t(c.key || c.name) });
      }
    });
    return options;
  }, [categories, t]);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 group">
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
          <Search size={20} />
        </div>
        <input 
          type="search" 
          name="product_search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          placeholder={t('search_product_placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white py-3 pr-12 pl-12 outline-none focus:ring-2 focus:ring-brand-500 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
        />
        <div className="absolute inset-y-0 left-2 flex items-center pr-2">
          <button 
            type="button"
            onClick={onOpenScanner}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all active:scale-90 dark:text-zinc-500 dark:hover:bg-zinc-800"
          >
            <ScanBarcode size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 sm:flex-none overflow-x-auto md:overflow-visible no-scrollbar pb-[260px] -mb-[260px] md:pb-0 md:mb-0 pointer-events-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 w-max md:w-auto h-full pointer-events-auto">
          <div className="relative shrink-0" ref={stockRef}>
            <button 
              onClick={() => setStockDropdownOpen(!stockDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-600 outline-none hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 min-w-[110px] h-full"
            >
              <Layers size={16} className="text-zinc-400 shrink-0" />
              <span className="flex-1 text-right">{stockOptions.find(o => o.value === stockFilter)?.label}</span>
            </button>
            {stockDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-full min-w-[140px] z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden py-1">
                {stockOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setStockFilter(opt.value);
                      setStockDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-right px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors",
                      stockFilter === opt.value ? "text-brand-600 font-bold bg-brand-50/50 dark:bg-brand-900/10 dark:text-brand-400" : "text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative shrink-0" ref={categoryRef}>
            <button 
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-600 outline-none hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 min-w-[130px] h-full"
            >
              <Filter size={16} className="text-zinc-400 shrink-0" />
              <span className="flex-1 text-right truncate">{categoryOptions.find(o => o.value === categoryFilter)?.label}</span>
            </button>
            {categoryDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-full min-w-[160px] max-h-[220px] overflow-y-auto z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1">
                {categoryOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setCategoryFilter(opt.value);
                      setCategoryDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-right px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors truncate",
                      categoryFilter === opt.value ? "text-brand-600 font-bold bg-brand-50/50 dark:bg-brand-900/10 dark:text-brand-400" : "text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowBoxInfo(!showBoxInfo)}
            className={cn(
              "flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-bold h-full",
              showBoxInfo 
                ? "bg-brand-600 border-brand-700 text-white shadow-lg shadow-brand-500/20 scale-105" 
                : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
            )}
            title={showBoxInfo ? t('box_mode') || 'وضع الكرتونة' : t('box')}
          >
            <Package size={18} className="shrink-0" />
            <span>{t('box')}</span>
          </button>

          {settings.enablePOS && settings.showCashierStockButton !== false && setShowPosStock && (
            <button
              onClick={() => setShowPosStock(!showPosStock)}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-bold h-full whitespace-nowrap",
                showPosStock 
                  ? "bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-500/20 scale-105" 
                  : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
              )}
              title="عرض مخزون الكاشير"
            >
              <Monitor size={18} className="shrink-0" />
              <span>مخزون الكاشير</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
