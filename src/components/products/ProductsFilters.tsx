import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode, Layers, Filter, Package, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Category } from '../../types';

interface ProductsFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  stockFilter: string;
  setStockFilter: (filter: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  showBoxInfo: boolean;
  setShowBoxInfo: (show: boolean) => void;
  categories: Category[];
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
  categories,
  onOpenScanner
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 group">
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
          <Search size={20} />
        </div>
        <input 
          type="text" 
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
      <div className="flex gap-2">
        <div className="relative group">
          <select 
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="appearance-none flex items-center gap-2 rounded-lg border border-zinc-200 bg-white pr-8 pl-3 py-2 text-sm font-bold text-zinc-600 outline-none hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 cursor-pointer min-w-[110px]"
          >
            <option value="all">{t('all_stock')}</option>
            <option value="available">{t('available_stock')}</option>
            <option value="low">{t('low_stock')}</option>
            <option value="out">{t('out_of_stock')}</option>
          </select>
          <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-zinc-400">
            <Layers size={16} />
          </div>
        </div>

        <div className="relative group">
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none flex items-center gap-2 rounded-lg border border-zinc-200 bg-white pr-8 pl-3 py-2 text-sm font-bold text-zinc-600 outline-none hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 cursor-pointer min-w-[130px]"
          >
            <option value="all">{t('all_categories')}</option>
            {categories.map((c, index) => (
              <option key={`${c.id}-${index}`} value={c.name}>{t(c.key || c.name)}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-zinc-400">
            <Filter size={16} />
          </div>
        </div>

        <button
          onClick={() => setShowBoxInfo(!showBoxInfo)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-bold",
            showBoxInfo 
              ? "bg-brand-600 border-brand-700 text-white shadow-lg shadow-brand-500/20 scale-105" 
              : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
          )}
          title={showBoxInfo ? t('price_negotiation_tool') : t('box')}
        >
          {showBoxInfo ? <Shield size={18} fill="currentColor" fillOpacity={0.2} /> : <Package size={18} />}
          <span>{t('box')}</span>
        </button>
      </div>
    </div>
  );
};
