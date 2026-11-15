import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  X, ArrowLeftRight, FileSpreadsheet, Truck, 
  Calendar, Layers, Clock, TrendingUp, User
} from 'lucide-react';
import { Supplier, SupplierTransaction } from '../../types';
import { formatCurrency, formatAppDate, roundMoney, safeParseDate } from '../../lib/utils';
import * as xlsx from 'xlsx';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface SupplierActiveCycleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  activeTransactions: SupplierTransaction[];
  suppliers: Supplier[];
  settings: any;
}

export function SupplierActiveCycleDetailsModal({
  isOpen,
  onClose,
  grandTotal,
  activeTransactions,
  suppliers,
  settings,
}: SupplierActiveCycleDetailsModalProps) {
  const { t } = useTranslation();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'transactions'>('suppliers');
  const [searchTerm, setSearchTerm] = useState('');

  const formatMoney = (val: number) => {
    return formatCurrency(roundMoney(val), settings.currency, settings.language);
  };

  // Map of supplier lookup
  const supplierMap = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliers.forEach(s => {
      if (s.id) map.set(s.id, s);
    });
    return map;
  }, [suppliers]);

  // Group transactions by supplier
  const supplierBreakdown = useMemo(() => {
    const breakdown = new Map<string, {
      supplierId: string;
      supplierName: string;
      typeOfGoods?: string;
      phone?: string;
      count: number;
      amount: number;
    }>();

    activeTransactions.forEach(tx => {
      const s = tx.supplierId ? supplierMap.get(tx.supplierId) : null;
      const sId = tx.supplierId || 'unknown';
      const sName = s?.name || 'مورد غير محدد';
      const typeOfGoods = s?.typeOfGoods;
      const phone = s?.phone;

      const current = breakdown.get(sId) || {
        supplierId: sId,
        supplierName: sName,
        typeOfGoods,
        phone,
        count: 0,
        amount: 0
      };

      current.count += 1;
      current.amount += (tx.amount || 0);
      breakdown.set(sId, current);
    });

    return Array.from(breakdown.values()).sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, supplierMap]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return supplierBreakdown;
    const q = searchTerm.toLowerCase();
    return supplierBreakdown.filter(item => 
      item.supplierName.toLowerCase().includes(q) || 
      (item.typeOfGoods && item.typeOfGoods.toLowerCase().includes(q))
    );
  }, [supplierBreakdown, searchTerm]);

  // Filtered transactions - strictly sorted chronologically descending (newest first)
  const filteredTransactions = useMemo(() => {
    let list = activeTransactions;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(tx => {
        const s = tx.supplierId ? supplierMap.get(tx.supplierId) : null;
        const sName = s?.name || '';
        const note = tx.note || '';
        return sName.toLowerCase().includes(q) || note.toLowerCase().includes(q);
      });
    }

    return [...list].sort((a, b) => {
      const timeA = safeParseDate(a.date || a.updatedAt).getTime();
      const timeB = safeParseDate(b.date || b.updatedAt).getTime();
      return timeB - timeA;
    });
  }, [activeTransactions, supplierMap, searchTerm]);

  // Group filtered transactions chronologically by day
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, { dateLabel: string; dayTotal: number; txs: SupplierTransaction[] }>();

    filteredTransactions.forEach(tx => {
      const parsedDate = safeParseDate(tx.date || tx.updatedAt);
      const isMissingDate = parsedDate.getTime() === 0;
      const dateKey = isMissingDate ? 'unknown' : `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
      
      let dateLabel = 'تاريخ غير محدد';
      if (!isMissingDate) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const isToday = parsedDate.toDateString() === today.toDateString();
        const isYesterday = parsedDate.toDateString() === yesterday.toDateString();

        const formattedDate = formatAppDate(parsedDate, settings.language || 'ar', t, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        if (isToday) {
          dateLabel = `اليوم (${formattedDate})`;
        } else if (isYesterday) {
          dateLabel = `أمس (${formattedDate})`;
        } else {
          dateLabel = formattedDate;
        }
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, { dateLabel, dayTotal: 0, txs: [] });
      }

      const grp = map.get(dateKey)!;
      grp.dayTotal += (tx.amount || 0);
      grp.txs.push(tx);
    });

    return Array.from(map.entries()).map(([key, val]) => ({
      dateKey: key,
      dateLabel: val.dateLabel,
      dayTotal: val.dayTotal,
      txs: val.txs
    }));
  }, [filteredTransactions, settings.language, t]);

  const activeSuppliersCount = supplierBreakdown.length;
  const avgTransaction = activeTransactions.length > 0 ? (grandTotal / activeTransactions.length) : 0;

  // Export to Excel
  const handleExportExcel = () => {
    const headers = ['المورد', 'نوع البضاعة', 'المبلغ', 'التاريخ', 'ملاحظات'];
    const sortedTxs = [...activeTransactions].sort((a, b) => {
      const timeA = safeParseDate(a.date || a.updatedAt).getTime();
      const timeB = safeParseDate(b.date || b.updatedAt).getTime();
      return timeB - timeA;
    });

    const rows = sortedTxs.map(tx => {
      const s = tx.supplierId ? supplierMap.get(tx.supplierId) : null;
      return [
        s?.name || 'مورد غير محدد',
        s?.typeOfGoods || '-',
        tx.amount || 0,
        formatAppDate(tx.date || tx.updatedAt),
        tx.note || '-'
      ];
    });

    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    if (settings.language === 'ar') {
      ws['!dir'] = 'rtl';
    }
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "المعاملات النشطة");
    xlsx.writeFile(wb, `تفاصيل_معاملات_الموردين_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 12 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.96, y: 12 }} 
          className="relative w-full max-w-2xl max-h-[90vh] border shadow-2xl flex flex-col overflow-hidden z-10"
          style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          dir="rtl"
        >
          {/* Header */}
          <div
            className="p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0"
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
                <h2 className="text-base font-black leading-tight truncate" style={{ color: theme.text }}>
                  تفاصيل المعاملات مع الموردين
                </h2>
                <p className="text-[11px] font-bold mt-0.5 truncate" style={{ color: theme.textMuted }}>
                  الدورة الحالية النشطة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeTransactions.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: theme.positive, color: '#FFFFFF' }}
                  title="تصدير إلى Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span className="hidden sm:inline">تصدير Excel</span>
                </button>
              )}
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
          </div>

          {/* Quick Metrics Bar */}
          <div className="border-b shrink-0" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-y sm:divide-y-0" style={{ borderColor: theme.border }}>
              <div className="p-3" style={{ borderColor: theme.border }}>
                <span className="text-[10px] font-bold block mb-0.5" style={{ color: theme.textMuted }}>إجمالي المبالغ</span>
                <span className="text-sm sm:text-base font-mono font-black tabular-nums block" style={{ color: theme.accent }}>
                  {formatMoney(grandTotal)}
                </span>
              </div>

              <div className="p-3" style={{ borderColor: theme.border }}>
                <span className="text-[10px] font-bold block mb-0.5" style={{ color: theme.textMuted }}>عدد العمليات</span>
                <span className="text-sm sm:text-base font-mono font-black tabular-nums block" style={{ color: theme.text }}>
                  {activeTransactions.length}{' '}
                  <span className="text-xs font-sans font-normal" style={{ color: theme.textMuted }}>عملية</span>
                </span>
              </div>

              <div className="p-3" style={{ borderColor: theme.border }}>
                <span className="text-[10px] font-bold block mb-0.5" style={{ color: theme.textMuted }}>الموردين النشطين</span>
                <span className="text-sm sm:text-base font-mono font-black tabular-nums block" style={{ color: theme.text }}>
                  {activeSuppliersCount}{' '}
                  <span className="text-xs font-normal" style={{ color: theme.textMuted }}>/ {suppliers.length}</span>
                </span>
              </div>

              <div className="p-3" style={{ borderColor: theme.border }}>
                <span className="text-[10px] font-bold block mb-0.5" style={{ color: theme.textMuted }}>متوسط العملية</span>
                <span className="text-sm sm:text-base font-mono font-black tabular-nums block" style={{ color: theme.text }}>
                  {formatMoney(avgTransaction)}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Controls & Search */}
          <div
            className="p-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0"
            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
          >
            <div
              className="flex border p-0.5 self-start gap-0.5"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('suppliers')}
                className="px-3 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                style={
                  activeTab === 'suppliers'
                    ? { backgroundColor: theme.accent, color: theme.accentText }
                    : { backgroundColor: 'transparent', color: theme.textMuted }
                }
              >
                <Truck size={14} />
                <span>حسب الموردين ({supplierBreakdown.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                className="px-3 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                style={
                  activeTab === 'transactions'
                    ? { backgroundColor: theme.accent, color: theme.accentText }
                    : { backgroundColor: 'transparent', color: theme.textMuted }
                }
              >
                <Layers size={14} />
                <span>سجل العمليات ({activeTransactions.length})</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في التفاصيل..."
                className="w-full sm:w-52 px-3 py-1.5 text-xs border outline-none"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: theme.textMuted }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Modal Body / Tab Contents */}
          <div className="p-4 min-h-0 overflow-y-auto space-y-3">
            {activeTransactions.length === 0 ? (
              <div className="text-center py-12" style={{ color: theme.textMuted }}>
                <ArrowLeftRight size={34} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold" style={{ color: theme.text }}>لا توجد معاملات مسجلة في الدورة الحالية</p>
                <p className="text-[11px] mt-1">عند تسجيل أي عملية دفع أو شراء ستظهر تفاصيلها هنا تلقائياً.</p>
              </div>
            ) : activeTab === 'suppliers' ? (
              /* Breakdown by Supplier */
              <div className="space-y-2">
                {filteredSuppliers.map((item) => {
                  const percent = grandTotal > 0 ? Math.round((item.amount / grandTotal) * 100) : 0;
                  return (
                    <div 
                      key={item.supplierId} 
                      className="p-3 border transition-colors"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <span className="font-black text-sm block truncate" style={{ color: theme.text }}>
                            {item.supplierName}
                          </span>
                          <span className="text-[10px]" style={{ color: theme.textMuted }}>
                            {item.typeOfGoods || 'بضاعة عامة'} • {item.count} عمليات مسجلة
                          </span>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="font-mono font-black text-sm tabular-nums block" style={{ color: theme.accent }} dir="ltr">
                            {formatMoney(item.amount)}
                          </span>
                          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: theme.textMuted }}>
                            {percent}% من الإجمالي
                          </span>
                        </div>
                      </div>

                      {/* Percentage progress bar */}
                      <div className="w-full h-1.5 overflow-hidden" style={{ backgroundColor: theme.surfaceMuted }}>
                        <div 
                          className="h-full transition-all duration-300" 
                          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: theme.accent }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Full Transactions List Organized By Day */
              <div className="space-y-3">
                {groupedTransactions.map((group) => (
                  <div 
                    key={group.dateKey} 
                    className="border overflow-hidden"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    {/* Date Header */}
                    <div
                      className="px-3.5 py-2 border-b flex items-center justify-between text-xs"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                    >
                      <div className="flex items-center gap-1.5 font-black" style={{ color: theme.text }}>
                        <Calendar size={13} style={{ color: theme.accent }} />
                        <span>{group.dateLabel}</span>
                        <span
                          className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 border mr-1"
                          style={{
                            backgroundColor: theme.bg,
                            borderColor: theme.border,
                            color: theme.textMuted
                          }}
                        >
                          {group.txs.length}
                        </span>
                      </div>
                      <div className="font-mono font-black tabular-nums" style={{ color: theme.accent }} dir="ltr">
                        {formatMoney(group.dayTotal)}
                      </div>
                    </div>

                    {/* Transactions for this day */}
                    <div className="divide-y" style={{ borderColor: theme.border }}>
                      {group.txs.map((tx, idx) => {
                        const s = tx.supplierId ? supplierMap.get(tx.supplierId) : null;
                        const parsedDate = safeParseDate(tx.date || tx.updatedAt);
                        const timeStr = parsedDate.getTime() > 0 
                          ? parsedDate.toLocaleTimeString(settings.language === 'ar' ? 'ar-TN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                          : '';

                        return (
                          <div
                            key={tx.id || idx}
                            className="p-3 flex items-center justify-between gap-3 transition-colors"
                            style={{ borderColor: theme.border }}
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-xs block truncate" style={{ color: theme.text }}>
                                {s?.name || 'مورد غير محدد'}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: theme.textMuted }}>
                                {timeStr && (
                                  <span className="flex items-center gap-1 font-mono tabular-nums">
                                    <Clock size={10} />
                                    {timeStr}
                                  </span>
                                )}
                                {tx.note && (
                                  <>
                                    <span>•</span>
                                    <span
                                      className="truncate max-w-[180px] border px-1.5 py-0.5"
                                      style={{
                                        backgroundColor: theme.surfaceMuted,
                                        borderColor: theme.border,
                                        color: theme.textMuted
                                      }}
                                    >
                                      {tx.note}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-left shrink-0 font-mono font-black tabular-nums text-xs" style={{ color: theme.text }} dir="ltr">
                              {formatMoney(tx.amount || 0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="p-3 sm:p-4 border-t flex items-center justify-between gap-3 shrink-0"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: theme.textMuted }}>
              إجمالي {activeTransactions.length} عملية عبر {activeSuppliersCount} موردين
            </span>

            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text
              }}
            >
              {t('close') || 'إغلاق'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
