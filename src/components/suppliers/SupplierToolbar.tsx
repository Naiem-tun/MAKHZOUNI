import React from 'react';
import { FileText, Printer, FileSpreadsheet, Activity, ListChecks, Archive } from 'lucide-react';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface SupplierToolbarProps {
  showExportMenu: boolean;
  setShowExportMenu: (show: boolean) => void;
  settings: any;
  setIsPrintModalOpen: (open: boolean) => void;
  exportToExcel: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setIsClearAllConfirmOpen: (open: boolean) => void;
  isTrackingMode: boolean;
  setIsTrackingMode: (mode: boolean) => void;
  setIsAdvisorOpen?: (open: boolean) => void;
  setIsCyclesModalOpen?: (open: boolean) => void;
  archivedCyclesCount?: number;
  theme?: FolioTheme;
}

export function SupplierToolbar({
  showExportMenu,
  setShowExportMenu,
  settings,
  setIsPrintModalOpen,
  exportToExcel,
  fileInputRef,
  isTrackingMode,
  setIsTrackingMode,
  setIsAdvisorOpen,
  setIsCyclesModalOpen,
  archivedCyclesCount = 0,
  theme,
}: SupplierToolbarProps) {
  const activeTheme = theme || resolveFolioTheme(Boolean(settings?.darkMode));

  return (
    <div
      className="border p-2 flex flex-wrap items-center justify-between gap-2"
      style={{
        backgroundColor: activeTheme.surface,
        borderColor: activeTheme.border,
      }}
    >
      <div className="flex items-center gap-1.5">
        {setIsAdvisorOpen && (
          <button
            type="button"
            onClick={() => setIsAdvisorOpen(true)}
            className="h-9 px-3 flex items-center justify-center border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: activeTheme.surfaceMuted,
              borderColor: activeTheme.border,
              color: activeTheme.text,
            }}
            title="مستشار"
          >
            <span>مستشار</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="h-9 px-2.5 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer"
            style={{
              backgroundColor: activeTheme.bg,
              borderColor: activeTheme.border,
              color: activeTheme.text,
            }}
            title="تقارير"
          >
            <FileText size={15} style={{ color: activeTheme.textMuted }} />
            <span className="hidden sm:inline">تقارير</span>
          </button>

          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
              <div
                className="absolute right-0 mt-1.5 w-48 border shadow-xl z-50 overflow-hidden py-1"
                style={{
                  backgroundColor: activeTheme.surface,
                  borderColor: activeTheme.border,
                }}
              >
                {(settings.enablePurchasesReports ?? false) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      setIsPrintModalOpen(true);
                    }}
                    className="w-full justify-start px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-bold transition-colors cursor-pointer hover:opacity-80"
                    style={{ color: activeTheme.text }}
                  >
                    <Printer size={15} />
                    <span>طباعة سجل العمليات</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    exportToExcel();
                  }}
                  className="w-full justify-start px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-bold transition-colors cursor-pointer hover:opacity-80"
                  style={{ color: activeTheme.positive }}
                >
                  <FileSpreadsheet size={15} />
                  <span>تصدير Excel</span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: activeTheme.bg,
            borderColor: activeTheme.border,
            color: activeTheme.accent,
          }}
          title="استيراد للمقارنة"
        >
          <Activity size={15} />
          <span className="hidden md:inline">مقارنة بـ Excel</span>
        </button>

        <button
          type="button"
          onClick={() => setIsTrackingMode(!isTrackingMode)}
          className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: isTrackingMode ? activeTheme.positive : activeTheme.bg,
            borderColor: isTrackingMode ? activeTheme.positive : activeTheme.border,
            color: isTrackingMode ? '#FFFFFF' : activeTheme.text,
          }}
          title="وضع المتابعة"
        >
          <ListChecks size={15} />
          <span className="hidden sm:inline">المتابعة</span>
        </button>

        {setIsCyclesModalOpen && (
          <button
            type="button"
            onClick={() => setIsCyclesModalOpen(true)}
            className="h-9 px-2.5 sm:px-3 flex items-center gap-1.5 border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: activeTheme.bg,
              borderColor: activeTheme.border,
              color: activeTheme.text,
            }}
            title="أرشيف الدورات السابقة للموردين"
          >
            <Archive size={15} style={{ color: activeTheme.textMuted }} />
            <span className="hidden sm:inline">الأرشيف</span>
            {archivedCyclesCount > 0 && (
              <span
                className="font-mono tabular-nums text-[11px]"
                style={{ color: activeTheme.accent }}
              >
                ({archivedCyclesCount})
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
