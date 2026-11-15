import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Archive, Download, Upload, Calendar, 
  Trash2, ChevronLeft, FileSpreadsheet, Eye, 
  CheckCircle, Plus, FileText
} from 'lucide-react';
import { SupplierCycle, Supplier } from '../../types';
import { formatCurrency, formatAppDate, roundMoney } from '../../lib/utils';
import * as xlsx from 'xlsx';
import * as html2pdf from 'html2pdf.js';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [selectedCycle, setSelectedCycle] = useState<SupplierCycle | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formatMoney = (val: number) => {
    return formatCurrency(roundMoney(val), settings.currency, settings.language);
  };

  const handleExportCycleToExcel = (cycle: SupplierCycle) => {
    const headers = ['المورد', 'نوع البضاعة', 'عدد الفواتير', 'إجمالي المشتريات'];
    const wsData: any[][] = [headers];

    (cycle.supplierBreakdown || []).forEach(item => {
      wsData.push([
        item.supplierName,
        item.typeOfGoods || '-',
        item.count || 1,
        roundMoney(item.amount || 0)
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

  const handleExportCycleToPDF = async (cycle: SupplierCycle) => {
    try {
      const safeName = (cycle.name || 'تقرير_دورة_الموردين').replace(/[\/\\?%*:|"<>]/g, '_');
      const storeName = settings.storeName || 'مخزوني';
      const archiveDate = formatAppDate(cycle.createdAt || cycle.endDate, settings.language || 'ar');

      let tableHtml = '';
      (cycle.supplierBreakdown || []).forEach(item => {
        tableHtml += `
          <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
            <td style="padding: 10px; text-align: right; font-size: 13px; font-weight: 700; color: #0f172a;">${item.supplierName}</td>
            <td style="padding: 10px; text-align: center; font-size: 12px; color: #475569;">${item.typeOfGoods || '-'}</td>
            <td style="padding: 10px; text-align: center; font-size: 12px; font-weight: 600;">${item.count || 1}</td>
            <td style="padding: 10px; text-align: left; font-size: 13px; font-weight: 800; color: #0f172a;" dir="ltr">${formatMoney(item.amount)}</td>
          </tr>
        `;
      });

      const elementHtml = `
      <div id="print-cycle-container" style="padding: 35px; font-family: 'Inter', sans-serif; background-color: white; color: #18181b; direction: rtl;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; border-bottom: 2px solid #f4f4f5; padding-bottom: 18px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 6px 0; color: #18181b;">تقرير دورة الموردين (أرشيف)</h1>
            <p style="font-size: 14px; font-weight: 700; color: #0284c7; margin: 0;">${cycle.name}</p>
          </div>
          <div style="text-align: left;">
            <p style="font-size: 18px; font-weight: 800; color: #0284c7; margin: 0 0 4px 0;">${storeName}</p>
            <p style="font-size: 12px; font-weight: 600; color: #71717a; margin: 0;">تاريخ الأرشفة: <span dir="ltr">${archiveDate}</span></p>
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 25px;">
          <div style="flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
            <span style="font-size: 11px; color: #64748b; display: block;">إجمالي المشتريات</span>
            <span style="font-size: 18px; font-weight: 900; color: #0f172a; display: block; margin-top: 4px;" dir="ltr">${formatMoney(cycle.totalAmount)}</span>
          </div>
          <div style="flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
            <span style="font-size: 11px; color: #64748b; display: block;">عدد المعاملات</span>
            <span style="font-size: 18px; font-weight: 900; color: #0f172a; display: block; margin-top: 4px;">${cycle.transactionCount}</span>
          </div>
          <div style="flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
            <span style="font-size: 11px; color: #64748b; display: block;">عدد الموردين</span>
            <span style="font-size: 18px; font-weight: 900; color: #0f172a; display: block; margin-top: 4px;">${cycle.supplierBreakdown?.length || 0}</span>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <thead>
            <tr style="background-color: #f4f4f5;">
              <th style="padding: 10px; text-align: right; font-size: 13px; font-weight: 700; color: #52525b;">المورد</th>
              <th style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; color: #52525b;">نوع البضاعة</th>
              <th style="padding: 10px; text-align: center; font-size: 13px; font-weight: 700; color: #52525b;">عدد الدفعات</th>
              <th style="padding: 10px; text-align: left; font-size: 13px; font-weight: 700; color: #52525b;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
      </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = elementHtml;
      
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${safeName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      };

      // @ts-ignore
      const html2pdfModule: any = html2pdf.default || html2pdf;
      await html2pdfModule().set(opt).from(wrapper.firstElementChild).save();
    } catch (e) {
      console.error("Export cycle to PDF error:", e);
    }
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
          className="absolute inset-0 bg-black/60 backdrop-blur-xs" 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 12 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.96, y: 12 }} 
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col border shadow-2xl overflow-hidden text-right"
          style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
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
          <div
            className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0"
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
                  أرشيف الدورات السابقة للموردين
                </h2>
                <p className="text-[11px] truncate mt-0.5" style={{ color: theme.textMuted }}>
                  حفظ تاريخ المعاملات السابقة لتغذية ذكاء المتجر دون التأثير على نظافة شاشتك الحالية
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
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

          {/* Action Toolbar */}
          <div
            className="p-3 border-b flex flex-wrap items-center justify-between gap-2 shrink-0"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-3 py-2 border text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text
                }}
              >
                <Upload size={14} />
                <span>{isImporting ? 'جاري الاستيراد...' : 'استيراد دورة من ملف Excel على الهاتف'}</span>
              </button>
            </div>

            {currentCycleCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onArchiveCurrentCycle();
                }}
                className="px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: theme.accent, color: theme.accentText }}
              >
                <Archive size={14} />
                <span>أرشفة الدورة الحالية الآن ({currentCycleCount} معاملة)</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {selectedCycle ? (
              /* Detail View of a single cycle */
              <div className="space-y-4">
                <div
                  className="flex items-center justify-between pb-3 border-b"
                  style={{ borderColor: theme.border }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCycle(null)}
                    className="flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                    style={{ color: theme.accent }}
                  >
                    <ChevronLeft size={16} />
                    <span>العودة لقائمة الدورات</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportCycleToPDF(selectedCycle)}
                      className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: theme.accent, color: theme.accentText }}
                    >
                      <FileText size={14} />
                      <span>تنزيل PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportCycleToExcel(selectedCycle)}
                      className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer"
                      style={{ backgroundColor: theme.positive, color: '#FFFFFF' }}
                    >
                      <FileSpreadsheet size={14} />
                      <span>تنزيل Excel</span>
                    </button>
                  </div>
                </div>

                <div
                  className="p-4 border"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <h3 className="text-base font-black mb-2" style={{ color: theme.text }}>
                    {selectedCycle.name}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="block" style={{ color: theme.textMuted }}>إجمالي مشتريات الدورة:</span>
                      <span className="font-mono font-black tabular-nums text-sm mt-0.5 block" style={{ color: theme.accent }}>
                        {formatMoney(selectedCycle.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="block" style={{ color: theme.textMuted }}>عدد المعاملات:</span>
                      <span className="font-mono font-bold tabular-nums text-sm mt-0.5 block" style={{ color: theme.text }}>
                        {selectedCycle.transactionCount} معاملة
                      </span>
                    </div>
                    <div>
                      <span className="block" style={{ color: theme.textMuted }}>تاريخ الأرشفة:</span>
                      <span className="font-mono font-medium tabular-nums mt-0.5 block" style={{ color: theme.textMuted }}>
                        {formatAppDate(selectedCycle.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supplier breakdown list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold" style={{ color: theme.text }}>
                    توزيع المشتريات على الموردين في هذه الدورة:
                  </h4>
                  <div
                    className="divide-y border overflow-hidden"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    {(selectedCycle.supplierBreakdown || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 flex items-center justify-between text-xs"
                        style={{ borderColor: theme.border }}
                      >
                        <div>
                          <span className="font-black block" style={{ color: theme.text }}>{item.supplierName}</span>
                          <span className="text-[10px]" style={{ color: theme.textMuted }}>
                            {item.typeOfGoods || 'بضاعة عامة'} • {item.count} دفعات
                          </span>
                        </div>
                        <span className="font-mono font-black tabular-nums text-sm" style={{ color: theme.text }}>
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
                    className="p-4 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm" style={{ color: theme.text }}>
                          {cycle.name}
                        </span>
                        <span
                          className="text-[10px] border px-2 py-0.5 font-mono font-bold tabular-nums"
                          style={{
                            backgroundColor: theme.surfaceMuted,
                            borderColor: theme.border,
                            color: theme.textMuted
                          }}
                        >
                          {cycle.transactionCount} معاملة
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: theme.textMuted }}>
                        <span className="flex items-center gap-1 font-mono tabular-nums">
                          <Calendar size={12} />
                          {formatAppDate(cycle.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="font-mono font-black tabular-nums" style={{ color: theme.accent }}>
                          {formatMoney(cycle.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedCycle(cycle)}
                        className="px-3 py-1.5 border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.border,
                          color: theme.text
                        }}
                      >
                        <Eye size={14} />
                        <span>عرض التفاصيل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportCycleToPDF(cycle)}
                        className="p-1.5 border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: `${theme.accent}12`,
                          borderColor: `${theme.accent}40`,
                          color: theme.accent
                        }}
                        title="تنزيل PDF"
                      >
                        <FileText size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportCycleToExcel(cycle)}
                        className="p-1.5 border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: `${theme.positive}12`,
                          borderColor: `${theme.positive}40`,
                          color: theme.positive
                        }}
                        title="تنزيل Excel"
                      >
                        <FileSpreadsheet size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(cycle.id || null)}
                        className="p-1.5 border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: `${theme.negative}10`,
                          borderColor: `${theme.negative}35`,
                          color: theme.negative
                        }}
                        title="حذف من الأرشيف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="text-center py-12 space-y-3 border border-dashed p-6"
                style={{ borderColor: theme.border, backgroundColor: theme.surface }}
              >
                <div
                  className="w-12 h-12 mx-auto border flex items-center justify-center"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
                >
                  <Archive size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black" style={{ color: theme.text }}>
                    لا توجد دورات مؤرشفة بعد
                  </h3>
                  <p className="text-xs max-w-sm mx-auto mt-1" style={{ color: theme.textMuted }}>
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
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDeleteConfirmId(null)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="relative p-6 max-w-xs w-full text-center shadow-xl border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
                >
                  <p className="text-xs font-bold mb-5" style={{ color: theme.text }}>
                    هل أنت متأكد من حذف هذه الدورة من الأرشيف نهائياً؟
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const id = deleteConfirmId;
                        setDeleteConfirmId(null);
                        if (id) await onDeleteCycle(id);
                      }}
                      className="flex-1 py-2 text-white text-xs font-bold cursor-pointer"
                      style={{ backgroundColor: theme.negative }}
                    >
                      حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 py-2 border text-xs font-bold cursor-pointer"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.text
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div
            className="p-4 border-t flex items-center justify-between shrink-0"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <span className="text-[11px]" style={{ color: theme.textMuted }}>
              الدورات المؤرشفة تُمكّن الوكيل من حساب متوسطات الحليب والخبز تلقائياً
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text
              }}
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
