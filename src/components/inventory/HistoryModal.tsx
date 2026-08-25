import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, X, Trash2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency, cn } from '../../lib/utils';
import { useAppContext } from '../../AppContext';

interface HistoryModalProps {
  show: boolean;
  onClose: () => void;
  loading: boolean;
  reports: any[];
  onSelectReport: (report: any) => void;
  onDeleteReport: (reportId: string) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ show, onClose, loading, reports, onSelectReport, onDeleteReport, showConfirm }) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-50 dark:bg-zinc-900 rounded-lg overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800"
          >
            <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center sticky top-0 bg-inherit pt-2 pb-4 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600">
                    <History size={20} />
                  </div>
                  <h3 className="font-bold text-lg">{t('inventory_log')}</h3>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent animate-spin rounded-full" />
                    <span className="text-xs text-zinc-400 font-bold">{t('loading_history')}</span>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs font-bold">{t('no_inventory_records')}</div>
                ) : (
                  reports.map((report) => (
                    <div 
                      key={report.id} 
                      className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700/50 p-4 space-y-4 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 cursor-pointer" onClick={() => onSelectReport(report)}>
                          <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 mb-0.5">
                            {formatAppDate(safeParseDate(report.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          <div className="text-xs text-zinc-500 font-bold">
                            {safeParseDate(report.date).getTime() === 0 ? '' : safeParseDate(report.date).toLocaleTimeString(settings.language === 'ar' ? 'ar-TN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectReport(report);
                            }}
                            className="w-9 h-9 flex items-center justify-center text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors bg-zinc-50 dark:bg-zinc-900"
                            title={t('view')}
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              showConfirm(t('confirm_delete') || 'Are you sure?', () => {
                                onDeleteReport(report.id);
                              });
                            }}
                            className="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors bg-zinc-50 dark:bg-zinc-900"
                            title={t('delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg cursor-pointer" onClick={() => onSelectReport(report)}>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-zinc-400 font-bold">{t('total_sales')}</span>
                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{formatCurrency(report.totalRevenue || 0, settings.currency, settings.language)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-zinc-400 font-bold">{t('expenses')}</span>
                          <span className={cn("text-sm font-black", report.totalExpenses > 0 ? "text-amber-500" : "text-zinc-900 dark:text-zinc-100")}>
                            {formatCurrency(report.totalExpenses || 0, settings.currency, settings.language)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 text-end">
                          <span className="text-[10px] text-zinc-400 font-bold">{t('net_profit')}</span>
                          <span className="text-sm font-black text-emerald-500 tracking-tight">+{formatCurrency(report.netProfit || 0, settings.currency, settings.language)}</span>
                        </div>
                      </div>
                      {Number(report.surplusValueUnverified) > 0 && (
                        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer" onClick={() => onSelectReport(report)}>
                          <span>⚠️ فائض مخزون غير مبرَّر:</span>
                          <span dir="ltr">{formatCurrency(report.surplusValueUnverified, settings.currency, settings.language)} ({report.surplusItemsCount || 1} صنف)</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
