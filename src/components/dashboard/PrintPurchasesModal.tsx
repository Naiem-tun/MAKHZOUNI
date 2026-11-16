import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency, formatQuantity, cleanQuantity } from '../../lib/utils';
import { Transaction } from '../../types';
import * as html2pdf from 'html2pdf.js';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useFolioTheme, resolveFolioTheme } from '../folio/FolioPageChrome';

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

      const printTheme = theme.isDark ? resolveFolioTheme(false, 'folio-cobalt') : theme;
      const pPaper = '#FFFFFF';
      const pBg = printTheme.bg;
      const pMuted = printTheme.surfaceMuted;
      const pBorder = printTheme.border;
      const pInk = printTheme.text;
      const pInkMuted = printTheme.textMuted;
      const pAccent = printTheme.accent;

      let tableHtml = "";
      Object.keys(pBySupplier).forEach(supplierName => {
        const supplierPurchases = pBySupplier[supplierName];
        const supplierTotal = supplierPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

        tableHtml += `
          <tr style="background-color: ${pMuted}; border-top: 1.5px solid ${pInk}; border-bottom: 1px solid ${pBorder}; page-break-after: avoid; break-after: avoid;">
            <td colspan="4" style="padding: 9px 12px; text-align: right; font-size: 13px; font-weight: 800; color: ${pInk}; border-right: 4px solid ${pAccent};">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>المورد: <span style="color: ${pAccent}; margin-right: 6px; font-weight: 900;">${supplierName}</span> <span style="font-size: 11px; color: ${pInkMuted}; font-weight: 700; margin-right: 6px;">(${supplierPurchases.length} صنف)</span></span>
                <span style="font-size: 12.5px; color: ${pInkMuted};">إجمالي المشتريات: <span style="font-weight: 900; color: ${pInk}; font-variant-numeric: tabular-nums;">${formatCurrency(supplierTotal, settings.currency)}</span></span>
              </div>
            </td>
          </tr>
        `;

        supplierPurchases.forEach((p, idx) => {
          const rowBg = idx % 2 === 1 ? pBg : pPaper;
          tableHtml += `
            <tr style="background-color: ${rowBg}; border-bottom: 1px solid ${pBorder}; page-break-inside: avoid; break-inside: avoid;">
              <td style="padding: 8px 12px; text-align: right; font-size: 12.5px; font-weight: 600; color: ${pInk}; padding-right: 18px;">${p.productName || 'غير معروف'}</td>
              <td style="padding: 8px 10px; text-align: center; font-size: 12.5px; font-weight: 700; color: ${pInk}; font-variant-numeric: tabular-nums;">${formatQuantity(p.quantityChange)}</td>
              <td style="padding: 8px 10px; text-align: center; font-size: 12.5px; font-weight: 700; color: ${pInk}; font-variant-numeric: tabular-nums;">${formatCurrency(p.amount || 0, settings.currency)}</td>
              <td style="padding: 8px 10px; text-align: left; font-size: 11.5px; color: ${pInkMuted}; font-variant-numeric: tabular-nums;" dir="ltr">${formatAppDate(safeParseDate(p.date), settings.language, t)}</td>
            </tr>
          `;
        });
      });

      const elementHtml = `
      <div id="print-purchases-container" style="padding: 18px 22px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif; background-color: ${pPaper}; color: ${pInk}; direction: rtl; box-sizing: border-box;">
        <div style="border-top: 3px solid ${pAccent}; border-bottom: 2px solid ${pInk}; padding: 12px 0 14px 0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10.5px; font-weight: 800; color: ${pAccent}; margin-bottom: 3px;">${storeName} · 01 سجل التوريد</div>
            <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 4px 0; color: ${pInk}; line-height: 1.2;">تقرير المشتريات</h1>
            <p style="font-size: 12.5px; font-weight: 700; color: ${pInkMuted}; margin: 0;">الفترة: ${titleStr}${selectedSupplier !== 'all' ? ` · المورد: ${selectedSupplier}` : ''}</p>
          </div>
          <div style="text-align: left; background-color: ${pBg}; border: 1px solid ${pBorder}; padding: 8px 14px;">
            <p style="font-size: 10px; font-weight: 700; color: ${pInkMuted}; margin: 0 0 2px 0;">تاريخ التقرير</p>
            <p style="font-size: 13px; font-weight: 800; color: ${pInk}; margin: 0; font-variant-numeric: tabular-nums;" dir="ltr">${reportDate}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; border: 1px solid ${pBorder};">
          <thead>
            <tr style="background-color: ${pMuted}; border-top: 2px solid ${pInk}; border-bottom: 1.5px solid ${pInk}; color: ${pInk};">
              <th style="padding: 9px 12px; text-align: right; font-size: 12.5px; font-weight: 800; padding-right: 18px;">المنتج</th>
              <th style="padding: 9px 10px; text-align: center; font-size: 12.5px; font-weight: 800;">الكمية</th>
              <th style="padding: 9px 10px; text-align: center; font-size: 12.5px; font-weight: 800;">القيمة</th>
              <th style="padding: 9px 10px; text-align: left; font-size: 12.5px; font-weight: 800;">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1.5px solid ${pBorder}; page-break-inside: avoid; break-inside: avoid;">
          <div style="font-size: 11px; font-weight: 700; color: ${pInkMuted};">
            إجمالي العمليات المسجلة: <span style="color: ${pInk}; font-weight: 900; font-variant-numeric: tabular-nums;">${filteredPurchases.length}</span>
          </div>
          <div style="background-color: ${pMuted}; padding: 12px 24px; border-radius: 0; border: 1px solid ${pAccent}; border-right: 4px solid ${pAccent}; text-align: left;">
            <p style="font-size: 11.5px; font-weight: 800; color: ${pInkMuted}; margin: 0 0 3px 0;">إجمالي مشتريات الفترة</p>
            <p style="font-size: 20px; font-weight: 900; color: ${pAccent}; margin: 0; font-variant-numeric: tabular-nums;">${formatCurrency(totalAmount, settings.currency)}</p>
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
