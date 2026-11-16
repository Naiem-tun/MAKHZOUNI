import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldAlert } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface ProductsHeaderProps {
  onAddProduct: () => void;
  onOpenPriceAudit?: () => void;
  priceIssuesCount?: number;
  theme?: FolioTheme;
}

export const ProductsHeader: React.FC<ProductsHeaderProps> = ({
  onAddProduct,
  onOpenPriceAudit,
  priceIssuesCount = 0,
  theme,
}) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const enablePriceAudit = settings.enablePriceAudit ?? true;
  const activeTheme = theme || resolveFolioTheme(Boolean(settings.darkMode));

  return (
    <header
      className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
      style={{ borderColor: activeTheme.border }}
    >
      <div className="space-y-1 min-w-0">
        <div
          className="flex items-center gap-2 text-xs font-bold"
          style={{ color: activeTheme.textMuted }}
        >
          <span className="truncate">{t('products_list_subtitle')}</span>
        </div>
        <h1
          className="text-2xl sm:text-3xl font-black tracking-tight leading-tight truncate"
          style={{ color: activeTheme.text }}
        >
          {t('products')}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
        {enablePriceAudit && onOpenPriceAudit && (
          <button
            type="button"
            onClick={onOpenPriceAudit}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: activeTheme.surface,
              borderColor: priceIssuesCount > 0 ? activeTheme.negative : activeTheme.border,
              color: priceIssuesCount > 0 ? activeTheme.negative : activeTheme.text,
            }}
            title="تدقيق الأسعار وتصحيح التجزئة والكرتونة"
          >
            <ShieldAlert size={14} />
            <span className="hidden sm:inline">تدقيق الأسعار</span>
            <span className="sm:hidden">التدقيق</span>
            {priceIssuesCount > 0 && (
              <span className="font-mono tabular-nums font-black">({priceIssuesCount})</span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onAddProduct}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          style={{
            backgroundColor: activeTheme.text,
            color: activeTheme.surface,
            borderColor: activeTheme.text,
          }}
        >
          <Plus size={14} />
          <span>{t('add_product')}</span>
        </button>
      </div>
    </header>
  );
};
