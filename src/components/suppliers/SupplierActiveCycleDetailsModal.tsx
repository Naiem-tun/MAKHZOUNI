import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  X, ArrowLeftRight, FileSpreadsheet, Truck, 
  Calendar, Layers, Clock, TrendingUp, User
} from 'lucide-react';
import { Supplier, SupplierTransaction } from '../../types';
import { formatCurrency, formatAppDate, roundMoney } from '../../lib/utils';
import * as xlsx from 'xlsx';

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

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return activeTransactions;
    const q = searchTerm.toLowerCase();
    return activeTransactions.filter(tx => {
      const s = tx.supplierId ? supplierMap.get(tx.supplierId) : null;
      const sName = s?.name || '';
      const note = tx.note || '';
      return sName.toLowerCase().includes(q) || note.toLowerCase().includes(q);
    });
  }, [activeTransactions, supplierMap, searchTerm]);

  const activeSuppliersCount = supplierBreakdown.length;
  const avgTransaction = activeTransactions.length > 0 ? (grandTotal / activeTransactions.length) : 0;

  // Export to Excel
  const handleExportExcel = () => {
    const headers = ['المورد', 'نوع البضاعة', 'المبلغ', 'التاريخ', 'ملاحظات'];
    const rows = activeTransactions.map(tx => {
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
          className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 15 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.96, y: 15 }} 
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden z-10"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <ArrowLeftRight size={18} />
              </div>
              <div>
                <h2 className="text-base font-black text-zinc-900 dark:text-white leading-tight">
                  تفاصيل المعاملات مع الموردين
                </h2>
                <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                  الدورة الحالية النشطة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeTransactions.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                  title="تصدير إلى Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span className="hidden sm:inline">تصدير Excel</span>
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-850/40 border-b border-zinc-100 dark:border-zinc-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 block mb-1">إجمالي المبالغ</span>
                <span className="text-base sm:text-lg font-black text-brand-600 dark:text-brand-400 tracking-tight block">
                  {formatMoney(grandTotal)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 block mb-1">عدد العمليات</span>
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white block">
                  {activeTransactions.length} <span className="text-xs font-normal text-zinc-400">عملية</span>
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 block mb-1">الموردين النشطين</span>
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white block">
                  {activeSuppliersCount} <span className="text-xs font-normal text-zinc-400">/ {suppliers.length}</span>
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 block mb-1">متوسط العملية</span>
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white block">
                  {formatMoney(avgTransaction)}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Controls & Search */}
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 self-start">
              <button
                type="button"
                onClick={() => setActiveTab('suppliers')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'suppliers' 
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Truck size={14} />
                <span>حسب الموردين ({supplierBreakdown.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'transactions' 
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
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
                className="w-full sm:w-48 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Modal Body / Tab Contents */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {activeTransactions.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <ArrowLeftRight size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">لا توجد معاملات مسجلة في الدورة الحالية</p>
                <p className="text-[11px] text-zinc-500 mt-1">عند تسجيل أي عملية دفع أو شراء ستظهر تفاصيلها هنا تلقائياً.</p>
              </div>
            ) : activeTab === 'suppliers' ? (
              /* Breakdown by Supplier */
              <div className="space-y-2">
                {filteredSuppliers.map((item) => {
                  const percent = grandTotal > 0 ? Math.round((item.amount / grandTotal) * 100) : 0;
                  return (
                    <div 
                      key={item.supplierId} 
                      className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-brand-300 dark:hover:border-brand-700 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="min-w-0">
                          <span className="font-black text-sm text-zinc-900 dark:text-white block truncate">
                            {item.supplierName}
                          </span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {item.typeOfGoods || 'بضاعة عامة'} • {item.count} عمليات مسجلة
                          </span>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="font-black text-sm text-brand-600 dark:text-brand-400 block" dir="ltr">
                            {formatMoney(item.amount)}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400">
                            {percent}% من الإجمالي
                          </span>
                        </div>
                      </div>

                      {/* Percentage progress bar */}
                      <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div 
                          className="h-full bg-brand-500 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(percent, 100)}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Full Transactions List */
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200/80 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                {filteredTransactions.map((tx, idx) => {
                  const s = tx.supplierId ? supplierMap.get(tx.supplierId) : null;
                  return (
                    <div key={tx.id || idx} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white block truncate">
                          {s?.name || 'مورد غير محدد'}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatAppDate(tx.date || tx.updatedAt)}
                          </span>
                          {tx.note && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[160px] text-zinc-500">{tx.note}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-left shrink-0 font-black text-xs text-zinc-900 dark:text-white" dir="ltr">
                        {formatMoney(tx.amount || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-[11px] font-bold text-zinc-400">
              إجمالي {activeTransactions.length} عملية عبر {activeSuppliersCount} موردين
            </span>

            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-colors active:scale-95"
            >
              {t('close') || 'إغلاق'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
