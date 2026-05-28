import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, X, Trash2, Download } from 'lucide-react';
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
                      className="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700 space-y-3 relative group"
                    >
                      <div className="absolute top-4 left-4 flex gap-2 z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm(t('confirm_delete') || 'Are you sure?', () => {
                              onDeleteReport(report.id);
                            });
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(report);
                          }}
                          className="p-2 text-zinc-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                          title={t('download')}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-start cursor-pointer" onClick={() => onSelectReport(report)}>
                        <div>
                          <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1 pr-10">
                            {formatAppDate(safeParseDate(report.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          <div className="text-[8px] text-zinc-400 font-bold pr-10">
                            {safeParseDate(report.date).getTime() === 0 ? '' : safeParseDate(report.date).toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-emerald-600">+{formatCurrency(report.netProfit || 0, settings.currency, settings.language)}</div>
                          <div className="text-[8px] text-zinc-400 font-medium whitespace-nowrap leading-none">{t('net_profit')}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-700/50 cursor-pointer" onClick={() => onSelectReport(report)}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-zinc-400 font-bold">{t('total_sales')}</span>
                          <span className="text-[11px] font-black">{formatCurrency(report.totalRevenue || 0, settings.currency, settings.language)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="text-[9px] text-zinc-400 font-bold">{t('expenses')}</span>
                          <span className={cn("text-[11px] font-black", report.totalExpenses > 0 ? "text-amber-600" : "")}>
                            {formatCurrency(report.totalExpenses || 0, settings.currency, settings.language)}
                          </span>
                        </div>
                      </div>
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
