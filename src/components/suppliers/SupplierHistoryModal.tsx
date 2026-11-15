import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Trash2, Archive } from 'lucide-react';
import { Supplier, SupplierTransaction } from '../../types';
import { safeParseDate, formatCurrency, formatAppDate } from '../../lib/utils';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface SupplierHistoryModalProps {
  isHistoryModalOpen: boolean;
  setIsHistoryModalOpen: (open: boolean) => void;
  selectedSupplier: Supplier | null;
  transactions: SupplierTransaction[];
  activeTransactions?: SupplierTransaction[];
  settings: any;
  setDeleteTxConfirmId: (id: string) => void;
}

export function SupplierHistoryModal({
  isHistoryModalOpen,
  setIsHistoryModalOpen,
  selectedSupplier,
  transactions,
  activeTransactions = [],
  settings,
  setDeleteTxConfirmId
}: SupplierHistoryModalProps) {
  const { t } = useTranslation();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [activeTab, setActiveTab] = useState<'current' | 'archived'>('current');

  // Active transactions for current open cycle
  const currentCycleTx = useMemo(() => {
    if (!selectedSupplier) return [];
    return activeTransactions
      .filter(t => t.supplierId === selectedSupplier.id)
      .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
  }, [selectedSupplier, activeTransactions]);

  // Previous archived transactions
  const archivedTx = useMemo(() => {
    if (!selectedSupplier) return [];
    const activeIds = new Set(currentCycleTx.map(t => t.id));
    return transactions
      .filter(t => t.supplierId === selectedSupplier.id && !activeIds.has(t.id))
      .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
  }, [selectedSupplier, transactions, currentCycleTx]);

  // Default to current cycle when opening
  useEffect(() => {
    if (isHistoryModalOpen) {
      setActiveTab('current');
    }
  }, [isHistoryModalOpen, selectedSupplier?.id]);

  const displayedTx = activeTab === 'current' ? currentCycleTx : archivedTx;
  const currentTotal = currentCycleTx.reduce((acc, tx) => acc + (tx.amount || 0), 0);
  const archivedTotal = archivedTx.reduce((acc, tx) => acc + (tx.amount || 0), 0);

  return (
    <AnimatePresence>
      {isHistoryModalOpen && selectedSupplier && (
        <motion.div key="modal-history" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsHistoryModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-lg border shadow-2xl text-right overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            dir="rtl"
          >
            {/* Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                  style={{
                    color: theme.accent,
                    borderColor: `${theme.accent}45`,
                    backgroundColor: `${theme.accent}12`
                  }}
                >
                  01
                </span>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black truncate" style={{ color: theme.text }}>
                    {t('operations_log')}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs font-bold truncate" style={{ color: theme.textMuted }}>{selectedSupplier.name}</p>
                    <span
                      className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 border"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.textMuted
                      }}
                    >
                      {currentCycleTx.length} {t('operations')} (الدورة الحالية)
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1.5 border flex items-center justify-center transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 min-h-0 overflow-y-auto">
              {/* Tabs for Current Cycle vs Archived Cycles */}
              {archivedTx.length > 0 && (
                <div
                  className="flex border p-1 gap-1"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('current')}
                    className="flex-1 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                    style={
                      activeTab === 'current'
                        ? { backgroundColor: theme.accent, color: theme.accentText }
                        : { backgroundColor: 'transparent', color: theme.textMuted }
                    }
                  >
                    الدورة الحالية ({currentCycleTx.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('archived')}
                    className="flex-1 py-1.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    style={
                      activeTab === 'archived'
                        ? { backgroundColor: theme.accent, color: theme.accentText }
                        : { backgroundColor: 'transparent', color: theme.textMuted }
                    }
                  >
                    <Archive size={12} />
                    <span>السجل المؤرشف ({archivedTx.length})</span>
                  </button>
                </div>
              )}

              {/* List */}
              <div className="space-y-2.5">
                {displayedTx.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 border"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-9 w-9 border flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${theme.accent}12`,
                          borderColor: `${theme.accent}40`,
                          color: theme.accent
                        }}
                      >
                        <Calendar size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono font-black tabular-nums text-sm" style={{ color: theme.text }}>
                          {formatCurrency(tx.amount, settings.currency, settings.language)}
                        </div>
                        <div className="text-[10px] capitalize mt-0.5" style={{ color: theme.textMuted }}>
                          {formatAppDate(safeParseDate(tx.date), settings.language, t, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {tx.note && (
                            <span
                              className="text-[10px] border px-1.5 py-0.5"
                              style={{
                                backgroundColor: theme.surfaceMuted,
                                borderColor: theme.border,
                                color: theme.textMuted
                              }}
                            >
                              {tx.note === 'session_purchases_total' ? t('session_purchases_total') : tx.note}
                            </span>
                          )}
                          {activeTab === 'archived' && (
                            <span
                              className="text-[9px] font-bold border px-1.5 py-0.5"
                              style={{
                                color: theme.accent,
                                borderColor: `${theme.accent}45`,
                                backgroundColor: `${theme.accent}10`
                              }}
                            >
                              {tx.cycleName || 'دورة مؤرشفة'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTxConfirmId(tx.id!)}
                      className="p-2 border transition-colors cursor-pointer shrink-0"
                      style={{
                        backgroundColor: `${theme.negative}10`,
                        borderColor: `${theme.negative}35`,
                        color: theme.negative
                      }}
                      title={t('delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                {/* Empty State */}
                {displayedTx.length === 0 && (
                  <div
                    className="text-center py-10 px-4 border border-dashed"
                    style={{ borderColor: theme.border, color: theme.textMuted, backgroundColor: theme.surface }}
                  >
                    {activeTab === 'current' ? (
                      <div>
                        <p className="text-sm font-bold mb-1" style={{ color: theme.text }}>
                          لا توجد معاملات مسجلة في الدورة الحالية
                        </p>
                        <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
                          بدأت دورة جديدة بصفحة بيضاء نظيفة.
                        </p>
                        {archivedTx.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('archived')}
                            className="px-3 py-1.5 border text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            style={{
                              backgroundColor: theme.surfaceMuted,
                              borderColor: theme.border,
                              color: theme.text
                            }}
                          >
                            <Archive size={12} />
                            <span>تصفح المعاملات المؤرشفة السابقة ({archivedTx.length})</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm">{t('no_expenses_waiting')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 border-t flex justify-between items-center shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <span className="text-xs sm:text-sm font-bold" style={{ color: theme.textMuted }}>
                {activeTab === 'current' ? 'إجمالي معاملات الدورة الحالية' : 'إجمالي العمليات المؤرشفة'}
              </span>
              <span className="text-base sm:text-lg font-mono font-black tabular-nums" style={{ color: theme.text }}>
                {formatCurrency(activeTab === 'current' ? currentTotal : archivedTotal, settings.currency, settings.language)}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
