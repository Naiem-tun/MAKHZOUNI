import React from 'react';
import { FileText, Printer, FileSpreadsheet, Activity, Trash2, ListChecks, BrainCircuit, Archive, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SupplierToolbarProps {
  showExportMenu: boolean;
  setShowExportMenu: (show: boolean) => void;
  settings: any;
  setIsPrintModalOpen: (open: boolean) => void;
  exportToExcel: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  setIsClearAllConfirmOpen: (open: boolean) => void;
  isTrackingMode: boolean;
  setIsTrackingMode: (mode: boolean) => void;
  setIsAdvisorOpen?: (open: boolean) => void;
  setIsCyclesModalOpen?: (open: boolean) => void;
  archivedCyclesCount?: number;
}

export function SupplierToolbar({
  showExportMenu,
  setShowExportMenu,
  settings,
  setIsPrintModalOpen,
  exportToExcel,
  fileInputRef,
  setIsClearAllConfirmOpen,
  isTrackingMode,
  setIsTrackingMode,
  setIsAdvisorOpen,
  setIsCyclesModalOpen,
  archivedCyclesCount = 0
}: SupplierToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Deal & Procurement Advisor Button */}
        {setIsAdvisorOpen && (
          <button
            onClick={() => setIsAdvisorOpen(true)}
            className="h-10 px-3 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg shadow-sm shadow-amber-500/20 active:scale-95 transition-all text-xs sm:text-sm font-black"
            title="مستشار الصفقات والسيولة الذكي"
          >
            <BrainCircuit size={17} />
            <span>مستشار الصفقات 🧠</span>
          </button>
        )}

        {/* Cycles Archive Button */}
        {setIsCyclesModalOpen && (
          <button
            onClick={() => setIsCyclesModalOpen(true)}
            className="h-10 px-2.5 sm:px-3 flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg shadow-sm active:scale-95 transition-all text-xs sm:text-sm font-bold"
            title="أرشيف الدورات السابقة"
          >
            <Archive size={16} className="text-amber-500" />
            <span className="hidden sm:inline">أرشيف الدورات</span>
            {archivedCyclesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-black">
                {archivedCyclesCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
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
          className="h-10 px-2.5 sm:px-3 flex items-center gap-1.5 bg-brand-50 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-lg shadow-sm active:scale-95 transition-all text-xs sm:text-sm font-bold"
          title="استيراد للمقارنة"
        >
          <Activity size={17} />
          <span className="hidden md:inline">مقارنة بـ Excel</span>
        </button>

        <button
          onClick={() => setIsTrackingMode(!isTrackingMode)}
          className={`h-10 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-lg shadow-sm active:scale-95 transition-all text-xs sm:text-sm font-bold ${
            isTrackingMode 
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20' 
              : 'bg-white text-zinc-600 border border-zinc-100 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
          title="وضع المتابعة"
        >
          <ListChecks size={17} />
          <span className="hidden sm:inline">المتابعة</span>
        </button>
        
        <button 
          onClick={() => setIsClearAllConfirmOpen(true)}
          className="h-10 px-2.5 sm:px-3 flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm hover:text-amber-600 dark:hover:text-amber-400 text-zinc-500 active:scale-95 transition-all text-xs sm:text-sm font-bold"
          title="أرشفة الدورة أو مسحها"
        >
          <Archive size={17} className="text-amber-500" />
          <span className="hidden sm:inline">إغلاق الدورة</span>
        </button>
      </div>
    </div>
  );
}
