import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Archive, Download, Upload, Calendar, 
  Trash2, ChevronLeft, FileSpreadsheet, Eye, 
  CheckCircle, Plus
} from 'lucide-react';
import { SupplierCycle, Supplier } from '../../types';
import { formatCurrency, formatAppDate, roundMoney } from '../../lib/utils';
import * as xlsx from 'xlsx';

interface SupplierCyclesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycles: SupplierCycle[];
  suppliers: Supplier[];
  settings: any;
  onDeleteCycle: (cycleId: string) => Promise<void>;
  onImportCycleFromExcel: (file: File) => Promise<void>;
  onArchiveCurrentCycle: () => void;
  currentCycleCount: number;
}

export function SupplierCyclesModal({
  isOpen,
  onClose,
  cycles,
  suppliers,
  settings,
  onDeleteCycle,
  onImportCycleFromExcel,
  onArchiveCurrentCycle,
  currentCycleCount
}: SupplierCyclesModalProps) {
  const [selectedCycle, setSelectedCycle] = useState<SupplierCycle | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formatMoney = (val: number) => {
    return formatCurrency(roundMoney(val), settings.currency, settings.language);
  };

  const handleExportCycleToExcel = (cycle: SupplierCycle) => {
    const headers = ['المورد', 'نوع البضاعة', 'عدد الفواتير', 'إجمالي المشتريات'];
    const wsData = [headers];

    (cycle.supplierBreakdown || []).forEach(item => {
      wsData.push([
        item.supplierName,
        item.typeOfGoods || '-',
        item.count?.toString() || '1',
        item.amount?.toString() || '0'
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    if (settings.language === 'ar') {
      ws['!dir'] = 'rtl';
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "تقرير الدورة");

    const safeName = (cycle.name || 'cycle').replace(/[\/\\?%*:|"<>]/g, '_');
    xlsx.writeFile(wb, `${safeName}.xlsx`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await onImportCycleFromExcel(file);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden text-right"
          dir="rtl"
        >
          {/* Hidden File Input for Excel Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Archive size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  أرشيف الدورات السابقة للموردين
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  حفظ تاريخ المعاملات السابقة لتغذية ذكاء المتجر دون التأثير على نظافة شاشتك الحالية
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="p-3 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <Upload size={14} />
                <span>{isImporting ? 'جاري الاستيراد...' : 'استيراد دورة من ملف Excel على الهاتف'}</span>
              </button>
            </div>

            {currentCycleCount > 0 && (
              <button
                onClick={() => {
                  onClose();
                  onArchiveCurrentCycle();
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm hover:bg-amber-600 active:scale-95 transition-all"
              >
                <Archive size={14} />
                <span>أرشفة الدورة الحالية الآن ({currentCycleCount} معاملة)</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {selectedCycle ? (
              /* Detail View of a single cycle */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => setSelectedCycle(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  >
                    <ChevronLeft size={16} />
                    <span>العودة لقائمة الدورات</span>
                  </button>

                  <button
                    onClick={() => handleExportCycleToExcel(selectedCycle)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <FileSpreadsheet size={14} />
                    <span>تنزيل Excel</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-700/60">
                  <h3 className="text-base font-black text-zinc-900 dark:text-white mb-2">
                    {selectedCycle.name}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-400 block">إجمالي مشتريات الدورة:</span>
                      <span className="font-black text-brand-600 text-sm mt-0.5 block">
                        {formatMoney(selectedCycle.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">عدد المعاملات:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm mt-0.5 block">
                        {selectedCycle.transactionCount} معاملة
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">تاريخ الأرشفة:</span>
                      <span className="font-medium text-zinc-600 dark:text-zinc-400 mt-0.5 block">
                        {formatAppDate(selectedCycle.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supplier breakdown list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    توزيع المشتريات على الموردين في هذه الدورة:
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                    {(selectedCycle.supplierBreakdown || []).map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <div>
                          <span className="font-black text-zinc-900 dark:text-white block">{item.supplierName}</span>
                          <span className="text-[10px] text-zinc-400">{item.typeOfGoods || 'بضاعة عامة'} • {item.count} دفعات</span>
                        </div>
                        <span className="font-black text-zinc-900 dark:text-white text-sm">
                          {formatMoney(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : cycles.length > 0 ? (
              /* List of cycles */
              <div className="space-y-3">
                {cycles.map((cycle) => (
                  <div 
                    key={cycle.id}
                    className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-zinc-900 dark:text-white">
                          {cycle.name}
                        </span>
                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                          {cycle.transactionCount} معاملة
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatAppDate(cycle.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="font-black text-brand-600 dark:text-brand-400">
                          {formatMoney(cycle.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => setSelectedCycle(cycle)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Eye size={14} />
                        <span>عرض التفاصيل</span>
                      </button>

                      <button
                        onClick={() => handleExportCycleToExcel(cycle)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        title="تنزيل Excel"
                      >
                        <FileSpreadsheet size={18} />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmId(cycle.id || null)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="حذف من الأرشيف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center">
                  <Archive size={28} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                    لا توجد دورات مؤرشفة بعد
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                    عند انتهاء الجرد، استخدم خيار «أرشفة الدورة وبدء دورة جديدة» ليتم تصفير الشاشة وحفظ التقرير هنا وتنزيله على هاتفك، أو قم برفع ملف دورة قديم من هاتفك الآن.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Delete Confirm Modal inside */}
          <AnimatePresence>
            {deleteConfirmId && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-zinc-950/60" onClick={() => setDeleteConfirmId(null)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-white dark:bg-zinc-900 p-6 rounded-2xl max-w-xs w-full text-center shadow-xl border border-zinc-200 dark:border-zinc-800"
                >
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-5">
                    هل أنت متأكد من حذف هذه الدورة من الأرشيف نهائياً؟
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const id = deleteConfirmId;
                        setDeleteConfirmId(null);
                        if (id) await onDeleteCycle(id);
                      }}
                      className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-600/20"
                    >
                      حذف
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              الدورات المؤرشفة تُمكّن الوكيل من حساب متوسطات الحليب والخبز تلقائياً
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold active:scale-95 transition-transform"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
