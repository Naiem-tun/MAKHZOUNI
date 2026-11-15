import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { Supplier } from '../../types';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface SupplierHeaderProps {
  setEditingSupplier: (s: Supplier | null) => void;
  setSelectedVisitDays: (days: number[]) => void;
  setIsModalOpen: (open: boolean) => void;
  theme?: FolioTheme;
}

export function SupplierHeader({
  setEditingSupplier,
  setSelectedVisitDays,
  setIsModalOpen,
  theme,
}: SupplierHeaderProps) {
  const { t } = useTranslation();
  const activeTheme = theme || resolveFolioTheme(false);

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
          <span className="font-mono tabular-nums" style={{ color: activeTheme.accent }}>
            FOLIO
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{t('suppliers_subtitle')}</span>
        </div>
        <h1
          className="text-2xl sm:text-3xl font-black tracking-tight leading-tight truncate"
          style={{ color: activeTheme.text }}
        >
          {t('suppliers_book')}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
        <button
          type="button"
          onClick={() => {
            setEditingSupplier(null);
            setSelectedVisitDays([]);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          style={{
            backgroundColor: activeTheme.text,
            color: activeTheme.surface,
            borderColor: activeTheme.text,
          }}
        >
          <UserPlus size={14} />
          <span>{t('add_supplier')}</span>
        </button>
      </div>
    </header>
  );
}
