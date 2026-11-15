import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface SupplierSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  uploadedReports: any[];
  removeUploadedReport: (id: string) => void;
  theme?: FolioTheme;
}

export function SupplierSearchBar({
  searchQuery,
  setSearchQuery,
  uploadedReports,
  removeUploadedReport,
  theme,
}: SupplierSearchBarProps) {
  const { t } = useTranslation();
  const activeTheme = theme || resolveFolioTheme(false);

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 border px-3 py-2.5"
        style={{
          backgroundColor: activeTheme.surface,
          borderColor: activeTheme.border,
        }}
      >
        <Search size={16} style={{ color: activeTheme.textMuted }} className="shrink-0" />
        <input
          type="search"
          name="supplier_search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('search')}
          className="w-full bg-transparent text-xs sm:text-sm outline-none"
          style={{ color: activeTheme.text }}
          dir="rtl"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="مسح البحث"
            className="cursor-pointer shrink-0"
            style={{ color: activeTheme.textMuted }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {uploadedReports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedReports.map((report, idx) => {
            const match = report.name.match(/\((\d+)\)/);
            const shortName = match ? match[0] : `(${idx + 1})`;
            return (
              <div
                key={report.id}
                className="flex items-center gap-2 border px-2.5 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: activeTheme.surface,
                  borderColor: activeTheme.accent,
                  color: activeTheme.text,
                }}
              >
                <span>
                  {report.name}{' '}
                  <span className="font-mono tabular-nums" style={{ color: activeTheme.accent }}>
                    {shortName}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeUploadedReport(report.id)}
                  className="p-0.5 cursor-pointer"
                  style={{ color: activeTheme.negative }}
                  aria-label="إزالة التقرير"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
