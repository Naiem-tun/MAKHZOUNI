import React from 'react';
import { FileText, Printer, FileSpreadsheet, Activity, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SupplierToolbarProps {
  showExportMenu: boolean;
  setShowExportMenu: (show: boolean) => void;
  settings: any;
  setIsPrintModalOpen: (open: boolean) => void;
  exportToExcel: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  setIsClearAllConfirmOpen: (open: boolean) => void;
}

export function SupplierToolbar({
  showExportMenu,
  setShowExportMenu,
  settings,
  setIsPrintModalOpen,
  exportToExcel,
  fileInputRef,
  setIsClearAllConfirmOpen
}: SupplierToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-start gap-2">
      <div className="relative">
        <button 
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
          title="تقارير"
        >
          <FileText size={18} />
        </button>
        
        {showExportMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
              {(settings.enablePurchasesReports ?? false) && (
                <button
                  onClick={() => { setShowExportMenu(false); setIsPrintModalOpen(true); }}
                  className="w-full justify-start px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-bold text-zinc-700 dark:text-zinc-300"
                >
                  <Printer size={16} />
                  <span>طباعة سجل العمليات</span>
                </button>
              )}
              <button
                onClick={() => { setShowExportMenu(false); exportToExcel(); }}
                className="w-full justify-start px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-bold text-[#107C41]"
              >
                <FileSpreadsheet size={16} />
                <span>تصدير Excel</span>
              </button>
            </div>
          </>
        )}
      </div>

      <button 
        onClick={() => fileInputRef.current?.click()}
        className="h-10 px-3 flex items-center gap-2 bg-brand-50 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-lg shadow-sm active:scale-95 transition-all text-sm font-bold"
        title="استيراد للمقارنة"
      >
        <Activity size={18} />
        <span className="hidden sm:inline">مقارنة بـ Excel</span>
      </button>

      <button 
        onClick={() => setIsClearAllConfirmOpen(true)}
        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-sm hover:text-[#B34C36] dark:hover:text-[#B34C36] text-zinc-300 dark:text-zinc-700 active:scale-95 transition-transform"
        title={t('clear_all_transactions')}
      >
        <Trash2 size={18}/>
      </button>
    </div>
  );
}
