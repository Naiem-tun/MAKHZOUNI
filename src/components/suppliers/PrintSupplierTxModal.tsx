import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { SupplierTransaction } from '../../types';
import * as html2pdf from 'html2pdf.js';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface PrintSupplierTxModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  activeTransactions?: SupplierTransaction[];
  suppliers?: any[];
  archivedCycles?: any[];
}

export function PrintSupplierTxModal({
  isOpen,
  onClose,
  storeName,
  activeTransactions = [],
  suppliers = [],
  archivedCycles = []
}: PrintSupplierTxModalProps) {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [sourceScope, setSourceScope] = useState<'active_cycle' | 'archived_cycle' | 'all_history'>('active_cycle');
  const [selectedCycleId, setSelectedCycleId] = useState<string>(archivedCycles[0]?.id || '');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Sync selectedCycleId if archivedCycles changes
  React.useEffect(() => {
    if (!selectedCycleId && archivedCycles.length > 0) {
      setSelectedCycleId(archivedCycles[0].id || '');
    }
  }, [archivedCycles, selectedCycleId]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (!user) return;
    try {
      setIsPrinting(true);
      showToast('جاري تحضير التقرير...', 'info');

      let allTx: SupplierTransaction[] = [];
      const selectedArchivedCycle = archivedCycles.find(c => c.id === selectedCycleId);

      if (sourceScope === 'active_cycle') {
        // Use active transactions only
        allTx = [...activeTransactions];
      } else if (sourceScope === 'archived_cycle') {
        // Fetch transactions for the specific archived cycle
        if (selectedCycleId) {
          const txQuery = query(
            collection(db, `users/${user.uid}/supplierTransactions`),
            where('cycleId', '==', selectedCycleId)
          );
          const snap = await getDocs(txQuery);
          allTx = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              supplierId: data.supplierId,
              amount: data.amount || 0,
              date: data.date,
              note: data.note || ''
            } as SupplierTransaction;
          });
        }

        // If cycle was imported or has no separate transaction documents, reconstruct from breakdown
        if (allTx.length === 0 && selectedArchivedCycle?.supplierBreakdown) {
          allTx = selectedArchivedCycle.supplierBreakdown.map(item => ({
            id: item.supplierId || Math.random().toString(),
            supplierId: item.supplierId,
            amount: item.amount,
            date: selectedArchivedCycle.createdAt || selectedArchivedCycle.endDate,
            note: item.typeOfGoods || 'بضاعة'
          } as SupplierTransaction));
        }
      } else {
        // Fetch all supplier transactions directly from Firestore (including archived)
        const txQuery = query(collection(db, `users/${user.uid}/supplierTransactions`), orderBy('date', 'desc'));
        const snap = await getDocs(txQuery);
        allTx = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            supplierId: data.supplierId,
            amount: data.amount || 0,
            date: data.date,
            note: data.note || ''
          } as SupplierTransaction;
        });
      }

      if (allTx.length === 0) {
        showToast('لا توجد معاملات للطباعة في هذا النطاق', 'error');
        setIsPrinting(false);
        return;
      }

      // Filter based on period
      const now = new Date();
      let filteredTx = allTx;

      if (period === 'today') {
        const todayStr = safeParseDate(now).toDateString();
        filteredTx = allTx.filter(t => safeParseDate(t.date).toDateString() === todayStr);
      } else if (period === 'week') {
        const aWeekAgo = new Date();
        aWeekAgo.setDate(now.getDate() - 7);
        filteredTx = allTx.filter(t => safeParseDate(t.date) >= aWeekAgo);
      } else if (period === 'month') {
        const aMonthAgo = new Date();
        aMonthAgo.setMonth(now.getMonth() - 1);
        filteredTx = allTx.filter(t => safeParseDate(t.date) >= aMonthAgo);
      } else if (period === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredTx = allTx.filter(t => {
          const pd = safeParseDate(t.date);
          return pd >= start && pd <= end;
        });
      }

      if (filteredTx.length === 0) {
        showToast('لا توجد معاملات ضمن الفترة المحددة', 'error');
        setIsPrinting(false);
        return;
      }

      // Sort all transactions strictly chronologically descending
      filteredTx.sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());

      // Suppliers mapping
      const suppliersMap = new Map();
      if (suppliers && suppliers.length > 0) {
        suppliers.forEach(s => suppliersMap.set(s.id, s.name));
      } else {
        const suppliersQuery = query(collection(db, `users/${user.uid}/suppliers`));
        const suppliersSnap = await getDocs(suppliersQuery);
        suppliersSnap.docs.forEach(doc => {
          suppliersMap.set(doc.id, doc.data().name);
        });
      }

      // Group transactions by supplier
      const txBySupplier: Record<string, SupplierTransaction[]> = {};
      filteredTx.forEach(tx => {
        if (!txBySupplier[tx.supplierId]) {
          txBySupplier[tx.supplierId] = [];
        }
        txBySupplier[tx.supplierId].push(tx);
      });

      const totalAmount = filteredTx.reduce((acc, t) => acc + (t.amount || 0), 0);

      const scopeTitle = sourceScope === 'active_cycle' 
        ? 'الدورة الحالية النشطة' 
        : sourceScope === 'archived_cycle'
          ? (selectedArchivedCycle?.name || 'دورة مؤرشفة')
          : 'السجل الكامل (شامل المؤرشف)';
      const periodTitle = period === 'today' ? 'اليوم' : 
                          period === 'week' ? 'أسبوع' : 
                          period === 'month' ? 'شهر' : 
                          period === 'custom' ? `من ${startDate} إلى ${endDate}` : 'الكل';
      const titleStr = `${scopeTitle} - ${periodTitle}`;
      const reportDate = formatAppDate(now, settings.language, t);

      let tableHtml = "";
      Object.keys(txBySupplier).forEach(supplierId => {
        const supplierName = suppliersMap.get(supplierId) || 'مورد غير معروف';
        const supplierTxs = txBySupplier[supplierId];
        // Sort each supplier's transactions strictly chronologically descending
        supplierTxs.sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
        const supplierTotal = supplierTxs.reduce((sum, t) => sum + (t.amount || 0), 0);

        tableHtml += `
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; page-break-after: avoid;">
            <td colspan="3" style="padding: 12px 10px; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>المورد: <span style="color: #0284c7; margin-right: 8px;">${supplierName}</span></span>
                <span style="font-size: 13px; color: #334155;">إجمالي المدفوعات: <span style="font-weight: 900; color: #0f172a;">${formatCurrency(supplierTotal, settings.currency)}</span></span>
              </div>
            </td>
          </tr>
        `;

        supplierTxs.forEach((tx) => {
          tableHtml += `
            <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
              <td style="padding: 10px;text-align: right;font-size: 13px; padding-right: 20px;">${tx.note === 'session_purchases_total' ? 'مشتريات الجلسة' : (tx.note || 'دفعة')}</td>
              <td style="padding: 10px;text-align: center;font-size: 13px;font-weight: 600;">${formatCurrency(tx.amount || 0, settings.currency)}</td>
              <td style="padding: 10px;text-align: left;font-size: 12px;color:#6b7280;" dir="ltr">${formatAppDate(safeParseDate(tx.date), settings.language, t)}</td>
            </tr>
          `;
        });
      });

      const elementHtml = `
      <div id="print-suppliers-container" style="padding: 40px; font-family: 'Inter', sans-serif; background-color: white; color: #18181b; direction: rtl;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f4f4f5; padding-bottom: 20px;">
          <div>
            <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px 0; color: #18181b;">سجل عمليات الموردين</h1>
            <p style="font-size: 14px; font-weight: 500; color: #71717a; margin: 0;">الفترة: ${titleStr}</p>
          </div>
          <div style="text-align: left;">
            <p style="font-size: 20px; font-weight: 800; color: #0284c7; margin: 0 0 4px 0;">${storeName}</p>
            <p style="font-size: 12px; font-weight: 600; color: #71717a; margin: 0;">تاريخ التقرير: <span dir="ltr">${reportDate}</span></p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f4f4f5; border-radius: 8px;">
              <th style="padding: 12px 10px;text-align: right;font-size: 13px;font-weight: 700;color: #52525b; padding-right: 20px;">البيان</th>
              <th style="padding: 12px 10px;text-align: center;font-size: 13px;font-weight: 700;color: #52525b;">القيمة</th>
              <th style="padding: 12px 10px;text-align: left;font-size: 13px;font-weight: 700;color: #52525b;">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: flex-end; padding-top: 20px; border-top: 2px solid #f4f4f5;">
          <div style="background-color: #f0f9ff; padding: 16px 32px; border-radius: 12px; border: 1px solid #e0f2fe; text-align: center;">
            <p style="font-size: 13px; font-weight: 700; color: #0369a1; margin: 0 0 4px 0;">إجمالي الفواتير / الدفعات</p>
            <p style="font-size: 24px; font-weight: 900; color: #0284c7; margin: 0;">${formatCurrency(totalAmount, settings.currency)}</p>
          </div>
        </div>
      </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = elementHtml;
      
      const opt = {
        margin: [10, 10, 10, 10],   // top, left, bottom, right
        filename: `عمليات-الموردين-${titleStr.replace(/ /g, '_')}-${reportDate.replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      };

      // @ts-ignore
      const html2pdfModule: any = html2pdf.default || html2pdf;

      await html2pdfModule().set(opt).from(wrapper.firstElementChild).save();
      
      showToast('تم تحميل التقرير بنجاح', 'success');
      onClose();

    } catch (error) {
      console.error(error);
      showToast('حدث خطأ أثناء طباعة التقرير', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={() => !isPrinting && onClose()}
    >
      <div
        className="w-full max-w-sm border shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        dir={settings.language === 'ar' ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b flex justify-between items-center"
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
            <h2 className="text-base font-black" style={{ color: theme.text }}>
              طباعة سجل العمليات
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isPrinting}
            className="p-1.5 border transition-colors cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Scope Selector: Active Cycle vs Archived Cycle vs Full History */}
          <div className="space-y-2">
            <label className="text-xs font-bold block" style={{ color: theme.textMuted }}>نطاق التقرير</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={isPrinting}
                onClick={() => setSourceScope('active_cycle')}
                className="py-2 px-1.5 text-xs font-bold transition-colors border text-center cursor-pointer"
                style={
                  sourceScope === 'active_cycle'
                    ? { backgroundColor: `${theme.accent}14`, borderColor: theme.accent, color: theme.accent }
                    : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }
                }
              >
                الدورة الحالية ({activeTransactions.length})
              </button>
              <button
                type="button"
                disabled={isPrinting || archivedCycles.length === 0}
                onClick={() => setSourceScope('archived_cycle')}
                className="py-2 px-1.5 text-xs font-bold transition-colors border text-center disabled:opacity-40 cursor-pointer"
                style={
                  sourceScope === 'archived_cycle'
                    ? { backgroundColor: `${theme.accent}14`, borderColor: theme.accent, color: theme.accent }
                    : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }
                }
              >
                أرشيف الدورات ({archivedCycles.length})
              </button>
              <button
                type="button"
                disabled={isPrinting}
                onClick={() => setSourceScope('all_history')}
                className="py-2 px-1.5 text-xs font-bold transition-colors border text-center cursor-pointer"
                style={
                  sourceScope === 'all_history'
                    ? { backgroundColor: `${theme.accent}14`, borderColor: theme.accent, color: theme.accent }
                    : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }
                }
              >
                السجل الكامل
              </button>
            </div>

            {sourceScope === 'active_cycle' && activeTransactions.length === 0 && (
              <div
                className="p-3 border text-xs font-bold text-center leading-relaxed"
                style={{
                  backgroundColor: `${theme.neutral}12`,
                  borderColor: `${theme.neutral}45`,
                  color: theme.text
                }}
              >
                الدورة الحالية فارغة (0 معاملات مسجلة). لقد تم إغلاق الدورة وأرشفتها.
                {archivedCycles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSourceScope('archived_cycle')}
                    className="block mx-auto mt-2 font-black underline cursor-pointer"
                    style={{ color: theme.accent }}
                  >
                    اضغط هنا لاختيار الدورة المؤرشفة وتنزيل ملف PDF الخاص بها
                  </button>
                )}
              </div>
            )}

            {sourceScope === 'archived_cycle' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold block" style={{ color: theme.textMuted }}>اختر الدورة المؤرشفة:</label>
                <select
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="w-full p-2.5 border text-xs font-bold focus:outline-none"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  {archivedCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — ({c.transactionCount || c.supplierBreakdown?.length || 0} معاملة)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold block" style={{ color: theme.textMuted }}>الفترة الزمنية</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'today', label: 'عمليات اليوم' },
                { id: 'week', label: 'هذا الأسبوع' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'all', label: 'كل العمليات' },
                { id: 'custom', label: 'فترة مخصصة' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isPrinting}
                  onClick={() => setPeriod(opt.id as any)}
                  className="py-2.5 px-2 text-xs font-bold transition-colors border cursor-pointer"
                  style={{
                    ...(opt.id === 'custom' ? { gridColumn: 'span 2' } : {}),
                    ...(period === opt.id
                      ? { backgroundColor: `${theme.accent}14`, borderColor: theme.accent, color: theme.accent }
                      : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted })
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>من تاريخ</label>
                  <input
                    type="date"
                    disabled={isPrinting}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    dir="ltr"
                    className="w-full p-2 border text-sm font-mono outline-none"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>إلى تاريخ</label>
                  <input
                    type="date"
                    disabled={isPrinting}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    dir="ltr"
                    className="w-full p-2 border text-sm font-mono outline-none"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="px-5 py-4 border-t"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <button
            onClick={handlePrint}
            disabled={
              isPrinting ||
              (sourceScope === 'active_cycle' && activeTransactions.length === 0) ||
              (sourceScope === 'archived_cycle' && !selectedCycleId) ||
              (period === 'custom' && (!startDate || !endDate))
            }
            className="w-full py-3 font-black text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: theme.accent, color: theme.accentText }}
          >
            {isPrinting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                يتم التجهيز...
              </>
            ) : sourceScope === 'active_cycle' && activeTransactions.length === 0 ? (
              <span>لا توجد معاملات في الدورة الحالية (0)</span>
            ) : (
              <>
                <ExternalLink size={18} />
                توليد ملف PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
