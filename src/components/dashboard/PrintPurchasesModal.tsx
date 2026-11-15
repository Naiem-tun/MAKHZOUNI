import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency, formatQuantity, cleanQuantity } from '../../lib/utils';
import { Transaction } from '../../types';
import * as html2pdf from 'html2pdf.js';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface PrintPurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases: Transaction[];
  storeName: string;
}

export function PrintPurchasesModal({
  isOpen,
  onClose,
  purchases, // keeping for fallback or types
  storeName
}: PrintPurchasesModalProps) {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (!user) return;
    try {
      setIsPrinting(true);
      showToast('جاري تحضير التقرير...', 'info');

      // Fetch all purchases directly from Firestore instead of relying on the limited prop
      const purchasesQuery = collection(db, `users/${user.uid}/purchases`);
      const snap = await getDocs(purchasesQuery);
      
      const allPurchases = snap.docs.map(doc => {
        const data = doc.data();
        const parsedDate = safeParseDate(data.date || data.createdAt);
        return {
          id: doc.id,
          productId: data.productId,
          productName: data.productName,
          quantityChange: data.qtyAdded,
          supplierName: data.supplierName,
          amount: data.amount || 0,
          price: data.qtyAdded > 0 ? (data.amount / data.qtyAdded) : 0,
          date: parsedDate
        } as Transaction;
      }).sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());

      // Filter purchases based on period
      const now = new Date();
      let filteredPurchases = allPurchases;

      if (period === 'today') {
        const todayStr = safeParseDate(now).toDateString();
        filteredPurchases = allPurchases.filter(p => safeParseDate(p.date).toDateString() === todayStr);
      } else if (period === 'week') {
        const aWeekAgo = new Date();
        aWeekAgo.setDate(now.getDate() - 7);
        filteredPurchases = allPurchases.filter(p => safeParseDate(p.date) >= aWeekAgo);
      } else if (period === 'month') {
        const aMonthAgo = new Date();
        aMonthAgo.setMonth(now.getMonth() - 1);
        filteredPurchases = allPurchases.filter(p => safeParseDate(p.date) >= aMonthAgo);
      } else if (period === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredPurchases = allPurchases.filter(p => {
          const pd = safeParseDate(p.date);
          return pd >= start && pd <= end;
        });
      }

      // Filter by supplier if a specific supplier is selected
      if (selectedSupplier !== 'all') {
        filteredPurchases = filteredPurchases.filter(p => {
          const sName = p.supplierName || 'مورد غير معروف';
          return sName === selectedSupplier;
        });
      }

      const totalAmount = filteredPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);

      // Group purchases by supplier name
      const pBySupplier: Record<string, Transaction[]> = {};
      filteredPurchases.forEach(p => {
        const sName = p.supplierName || 'مورد غير معروف';
        if (!pBySupplier[sName]) pBySupplier[sName] = [];
        pBySupplier[sName].push(p);
      });

      // Generate HTML string
      const titleStr = period === 'today' ? 'اليوم' : 
                       period === 'week' ? 'أسبوع' : 
                       period === 'month' ? 'شهر' : 
                       period === 'custom' ? `من ${startDate} إلى ${endDate}` : 'الكل';
      const reportDate = formatAppDate(now, settings.language, t);

      let tableHtml = "";
      Object.keys(pBySupplier).forEach(supplierName => {
        const supplierPurchases = pBySupplier[supplierName];
        const supplierTotal = supplierPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

        tableHtml += `
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; page-break-after: avoid;">
            <td colspan="4" style="padding: 12px 10px; text-align: right; font-size: 14px; font-weight: 800; color: #0f172a;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>المورد: <span style="color: #0284c7; margin-right: 8px;">${supplierName}</span></span>
                <span style="font-size: 13px; color: #334155;">إجمالي المشتريات: <span style="font-weight: 900; color: #0f172a;">${formatCurrency(supplierTotal, settings.currency)}</span></span>
              </div>
            </td>
          </tr>
        `;

        supplierPurchases.forEach((p) => {
          tableHtml += `
            <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
              <td style="padding: 10px;text-align: right;font-size: 13px; padding-right: 20px;">${p.productName || 'غير معروف'}</td>
              <td style="padding: 10px;text-align: center;font-size: 13px;">${formatQuantity(p.quantityChange)}</td>
              <td style="padding: 10px;text-align: center;font-size: 13px;font-weight: 600;">${formatCurrency(p.amount || 0, settings.currency)}</td>
              <td style="padding: 10px;text-align: left;font-size: 12px;color:#6b7280;" dir="ltr">${formatAppDate(safeParseDate(p.date), settings.language, t)}</td>
            </tr>
          `;
        });
      });

      const elementHtml = `
      <div id="print-purchases-container" style="padding: 40px; font-family: 'Inter', sans-serif; background-color: white; color: #18181b; direction: rtl;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f4f4f5; padding-bottom: 20px;">
          <div>
            <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px 0; color: #18181b;">تقرير المشتريات</h1>
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
              <th style="padding: 12px 10px;text-align: right;font-size: 13px;font-weight: 700;color: #52525b; padding-right: 20px;">المنتج</th>
              <th style="padding: 12px 10px;text-align: center;font-size: 13px;font-weight: 700;color: #52525b;">الكمية</th>
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
            <p style="font-size: 13px; font-weight: 700; color: #0369a1; margin: 0 0 4px 0;">إجمالي مشتريات الفترة</p>
            <p style="font-size: 24px; font-weight: 900; color: #0284c7; margin: 0;">${formatCurrency(totalAmount, settings.currency)}</p>
          </div>
        </div>
      </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = elementHtml;
      
      const opt = {
        margin: [10, 10, 10, 10],   // top, left, bottom, right
        filename: `مشتريات-${titleStr.replace(/ /g, '_')}-${reportDate.replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all', before: '#page2el' }
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
      onClick={onClose}
      dir={settings.language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div
        className="w-full max-w-sm border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3.5 border-b flex justify-between items-center shrink-0"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold font-mono tabular-nums" style={{ color: theme.accent }}>
              01 · تصدير PDF
            </div>
            <h2 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>
              طباعة تقرير المشتريات
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPrinting}
            aria-label="إغلاق"
            className="p-1.5 border cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-black block" style={{ color: theme.textMuted }}>الفترة الزمنية</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'today', label: 'مشتريات اليوم' },
                { id: 'week', label: 'هذا الأسبوع' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'all', label: 'كل المشتريات' },
                { id: 'custom', label: 'فترة مخصصة' }
              ].map((opt) => {
                const active = period === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isPrinting}
                    onClick={() => setPeriod(opt.id as any)}
                    className="py-2.5 px-2 text-xs font-bold border transition-colors cursor-pointer"
                    style={{
                      gridColumn: opt.id === 'custom' ? 'span 2' : undefined,
                      backgroundColor: active ? theme.accent : theme.surface,
                      borderColor: active ? theme.accent : theme.border,
                      color: active ? theme.accentText : theme.text,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
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
                    className="w-full p-2 border text-xs font-mono outline-none"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
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
                    className="w-full p-2 border text-xs font-mono outline-none"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-4 border-t" style={{ borderColor: theme.border }}>
            <label className="text-xs font-black block" style={{ color: theme.textMuted }}>تصفية حسب المورد</label>
            <div
              className="max-h-44 overflow-y-auto border divide-y"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <label className="flex items-center justify-between p-3 cursor-pointer transition-colors" style={{ borderColor: theme.border }}>
                <span className="text-xs sm:text-sm font-bold" style={{ color: theme.text }}>كل الموردين</span>
                <input
                  type="radio"
                  name="supplier"
                  value="all"
                  checked={selectedSupplier === 'all'}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  disabled={isPrinting}
                  className="w-4 h-4 cursor-pointer"
                  style={{ accentColor: theme.accent }}
                />
              </label>
              {Array.from(new Set(purchases.map(p => p.supplierName || 'مورد غير معروف'))).map(s => (
                <label key={s} className="flex items-center justify-between p-3 cursor-pointer transition-colors" style={{ borderColor: theme.border }}>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: theme.text }}>{s}</span>
                  <input
                    type="radio"
                    name="supplier"
                    value={s}
                    checked={selectedSupplier === s}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    disabled={isPrinting}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: theme.accent }}
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting || (period === 'custom' && (!startDate || !endDate))}
            className="w-full py-3 border font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
          >
            {isPrinting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>يتم التجهيز...</span>
              </>
            ) : (
              <>
                <ExternalLink size={16} />
                <span>توليد ملف PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
