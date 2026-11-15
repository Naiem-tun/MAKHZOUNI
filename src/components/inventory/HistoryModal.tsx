import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface HistoryModalProps {
  show: boolean;
  onClose: () => void;
  loading: boolean;
  reports: any[];
  onSelectReport: (report: any) => void;
  onDeleteReport: (reportId: string) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  show,
  onClose,
  loading,
  reports,
  onSelectReport,
  onDeleteReport,
  showConfirm
}) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
          dir="rtl"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[88vh] flex flex-col border shadow-2xl overflow-hidden"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Sticky Header */}
            <div
              className="px-5 py-4 border-b flex justify-between items-center sticky top-0 z-10 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border"
                  style={{
                    color: theme.accent,
                    borderColor: `${theme.accent}45`,
                    backgroundColor: `${theme.accent}12`
                  }}
                >
                  01
                </span>
                <h3 className="font-black text-base sm:text-lg" style={{ color: theme.text }}>
                  {t('inventory_log')}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 border transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 min-h-0 overflow-y-auto space-y-3">
              {loading ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div
                    className="w-8 h-8 border-2 border-t-transparent animate-spin rounded-full"
                    style={{ borderColor: `${theme.accent} transparent ${theme.accent} ${theme.accent}` }}
                  />
                  <span className="text-xs font-bold" style={{ color: theme.textMuted }}>{t('loading_history')}</span>
                </div>
              ) : reports.length === 0 ? (
                <div
                  className="py-12 text-center border border-dashed text-xs font-bold"
                  style={{ borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.surface }}
                >
                  {t('no_inventory_records')}
                </div>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="border p-4 space-y-3 transition-colors"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 cursor-pointer min-w-0" onClick={() => onSelectReport(report)}>
                        <div className="text-sm font-black mb-0.5" style={{ color: theme.text }}>
                          {formatAppDate(safeParseDate(report.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="text-xs font-mono font-bold tabular-nums" style={{ color: theme.textMuted }}>
                          {safeParseDate(report.date).getTime() === 0
                            ? ''
                            : safeParseDate(report.date).toLocaleTimeString(settings.language === 'ar' ? 'ar-TN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(report);
                          }}
                          className="w-9 h-9 border flex items-center justify-center transition-colors cursor-pointer"
                          style={{
                            backgroundColor: `${theme.accent}12`,
                            borderColor: `${theme.accent}40`,
                            color: theme.accent
                          }}
                          title={t('view')}
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm(t('confirm_delete') || 'Are you sure?', () => {
                              onDeleteReport(report.id);
                            });
                          }}
                          className="w-9 h-9 border flex items-center justify-center transition-colors cursor-pointer"
                          style={{
                            backgroundColor: `${theme.negative}10`,
                            borderColor: `${theme.negative}35`,
                            color: theme.negative
                          }}
                          title={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div
                      className="grid grid-cols-3 gap-3 p-3 border cursor-pointer"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                      onClick={() => onSelectReport(report)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>{t('total_sales')}</span>
                        <span className="text-xs sm:text-sm font-mono font-black tabular-nums" style={{ color: theme.text }}>
                          {formatCurrency(report.totalRevenue || 0, settings.currency, settings.language)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>{t('expenses')}</span>
                        <span
                          className="text-xs sm:text-sm font-mono font-black tabular-nums"
                          style={{ color: report.totalExpenses > 0 ? theme.neutral : theme.text }}
                        >
                          {formatCurrency(report.totalExpenses || 0, settings.currency, settings.language)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-end">
                        <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>{t('net_profit')}</span>
                        <span className="text-xs sm:text-sm font-mono font-black tabular-nums" style={{ color: theme.positive }} dir="ltr">
                          +{formatCurrency(report.netProfit || 0, settings.currency, settings.language)}
                        </span>
                      </div>
                    </div>

                    {Number(report.surplusValueUnverified) > 0 && (
                      <div
                        className="flex items-center justify-between px-3 py-1.5 border text-xs font-bold cursor-pointer"
                        style={{
                          backgroundColor: `${theme.neutral}14`,
                          borderColor: `${theme.neutral}45`,
                          color: theme.text
                        }}
                        onClick={() => onSelectReport(report)}
                      >
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle size={13} style={{ color: theme.neutral }} />
                          <span>فائض مخزون غير مبرَّر:</span>
                        </span>
                        <span className="font-mono tabular-nums" style={{ color: theme.neutral }} dir="ltr">
                          {formatCurrency(report.surplusValueUnverified, settings.currency, settings.language)} ({report.surplusItemsCount || 1} صنف)
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
