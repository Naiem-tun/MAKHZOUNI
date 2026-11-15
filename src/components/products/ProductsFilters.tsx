import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode, Layers, Filter, Package, Monitor, X } from 'lucide-react';
import { Category } from '../../types';
import { useAppContext } from '../../AppContext';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

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
  theme?: FolioTheme;
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
  onOpenScanner,
  theme,
}) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const activeTheme = theme || resolveFolioTheme(Boolean(settings.darkMode));

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
      { value: 'out', label: t('out_of_stock') },
    ];
    if (priceErrorsCount > 0) {
      opts.push({
        value: 'price_error',
        label: `أخطاء التسعير (${priceErrorsCount})`,
      });
    }
    return opts;
  }, [priceErrorsCount, t]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: 'all', label: t('all_categories') }];
    const seen = new Set<string>(['all']);
    categories.forEach((c) => {
      if (c && c.name && !seen.has(c.name)) {
        seen.add(c.name);
        options.push({ value: c.name, label: t(c.key || c.name) });
      }
    });
    return options;
  }, [categories, t]);

  return (
    <div className="flex flex-col lg:flex-row gap-2.5">
      {/* Search + Scanner Bar */}
      <div
        className="flex items-center gap-2 border px-3 py-2 flex-1"
        style={{ backgroundColor: activeTheme.surface, borderColor: activeTheme.border }}
      >
        <Search size={16} style={{ color: activeTheme.textMuted }} className="shrink-0" />
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
          className="w-full bg-transparent text-xs sm:text-sm outline-none"
          style={{ color: activeTheme.text }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="مسح البحث"
            className="cursor-pointer shrink-0"
            style={{ color: activeTheme.textMuted }}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenScanner}
          className="p-1.5 border cursor-pointer shrink-0 transition-colors"
          style={{
            backgroundColor: activeTheme.bg,
            borderColor: activeTheme.border,
            color: activeTheme.text,
          }}
          title="مسح الباركود"
        >
          <ScanBarcode size={16} />
        </button>
      </div>

      {/* Filters & View Toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative" ref={stockRef}>
          <button
            type="button"
            onClick={() => setStockDropdownOpen(!stockDropdownOpen)}
            className="h-10 px-3 flex items-center gap-2 border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor:
                stockFilter !== 'all' ? activeTheme.text : activeTheme.surface,
              borderColor:
                stockFilter !== 'all' ? activeTheme.text : activeTheme.border,
              color: stockFilter !== 'all' ? activeTheme.surface : activeTheme.text,
            }}
          >
            <Layers size={14} />
            <span>{stockOptions.find((o) => o.value === stockFilter)?.label}</span>
          </button>
          {stockDropdownOpen && (
            <div
              className="absolute top-full right-0 mt-1 min-w-[165px] z-50 border shadow-xl overflow-hidden py-1"
              style={{
                backgroundColor: activeTheme.surface,
                borderColor: activeTheme.border,
              }}
            >
              {stockOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setStockFilter(opt.value);
                    setStockDropdownOpen(false);
                  }}
                  className="w-full text-right px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      stockFilter === opt.value ? activeTheme.surfaceMuted : 'transparent',
                    color: stockFilter === opt.value ? activeTheme.accent : activeTheme.text,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={categoryRef}>
          <button
            type="button"
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className="h-10 px-3 flex items-center gap-2 border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer max-w-[170px]"
            style={{
              backgroundColor:
                categoryFilter !== 'all' ? activeTheme.text : activeTheme.surface,
              borderColor:
                categoryFilter !== 'all' ? activeTheme.text : activeTheme.border,
              color: categoryFilter !== 'all' ? activeTheme.surface : activeTheme.text,
            }}
          >
            <Filter size={14} className="shrink-0" />
            <span className="truncate">
              {categoryOptions.find((o) => o.value === categoryFilter)?.label}
            </span>
          </button>
          {categoryDropdownOpen && (
            <div
              className="absolute top-full right-0 mt-1 min-w-[175px] max-h-[240px] overflow-y-auto z-50 border shadow-xl py-1"
              style={{
                backgroundColor: activeTheme.surface,
                borderColor: activeTheme.border,
              }}
            >
              {categoryOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(opt.value);
                    setCategoryDropdownOpen(false);
                  }}
                  className="w-full text-right px-3.5 py-2 text-xs font-bold transition-colors truncate cursor-pointer"
                  style={{
                    backgroundColor:
                      categoryFilter === opt.value ? activeTheme.surfaceMuted : 'transparent',
                    color: categoryFilter === opt.value ? activeTheme.accent : activeTheme.text,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowBoxInfo(!showBoxInfo)}
          className="h-10 px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          style={{
            backgroundColor: showBoxInfo ? activeTheme.accent : activeTheme.surface,
            borderColor: showBoxInfo ? activeTheme.accent : activeTheme.border,
            color: showBoxInfo ? activeTheme.accentText : activeTheme.text,
          }}
          title={showBoxInfo ? t('box_mode') || 'وضع الكرتونة' : t('box')}
        >
          <Package size={14} />
          <span>{t('box')}</span>
        </button>

        {settings.enablePOS && settings.showCashierStockButton !== false && setShowPosStock && (
          <button
            type="button"
            onClick={() => setShowPosStock(!showPosStock)}
            className="h-10 px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: showPosStock ? activeTheme.positive : activeTheme.surface,
              borderColor: showPosStock ? activeTheme.positive : activeTheme.border,
              color: showPosStock ? '#FFFFFF' : activeTheme.text,
            }}
            title="عرض مخزون الكاشير"
          >
            <Monitor size={14} />
            <span>مخزون الكاشير</span>
          </button>
        )}
      </div>
    </div>
  );
};
