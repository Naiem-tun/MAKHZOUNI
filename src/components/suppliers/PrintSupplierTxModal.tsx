import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { SupplierTransaction } from '../../types';
import * as html2pdf from 'html2pdf.js';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PrintSupplierTxModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
}

export function PrintSupplierTxModal({
  isOpen,
  onClose,
  storeName
}: PrintSupplierTxModalProps) {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (!user) return;
    try {
      setIsPrinting(true);
      showToast('جاري تحضير التقرير...', 'info');

      // Fetch all supplier transactions directly from Firestore
      const txQuery = query(collection(db, `users/${user.uid}/supplierTransactions`), orderBy('date', 'desc'));
      const snap = await getDocs(txQuery);
      
      const allTx = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          supplierId: data.supplierId,
          amount: data.amount || 0,
          date: data.date,
          note: data.note || ''
        } as SupplierTransaction;
      });

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

      // Fetch suppliers to get their names
      const suppliersQuery = query(collection(db, `users/${user.uid}/suppliers`));
      const suppliersSnap = await getDocs(suppliersQuery);
      const suppliersMap = new Map();
      suppliersSnap.docs.forEach(doc => {
        suppliersMap.set(doc.id, doc.data().name);
      });

      const totalAmount = filteredTx.reduce((acc, t) => acc + (t.amount || 0), 0);

      // Generate HTML string
      const titleStr = period === 'today' ? 'اليوم' : 
                       period === 'week' ? 'أسبوع' : 
                       period === 'month' ? 'شهر' : 
                       period === 'custom' ? `من ${startDate} إلى ${endDate}` : 'الكل';
      const reportDate = formatAppDate(now, settings.language, t);

      let tableHtml = "";
      filteredTx.forEach((tx) => {
        const supplierName = suppliersMap.get(tx.supplierId) || 'مورد غير معروف';
        tableHtml += `
          <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
            <td style="padding: 10px;text-align: right;font-size: 13px;">${supplierName}</td>
            <td style="padding: 10px;text-align: right;font-size: 13px;">${tx.note === 'session_purchases_total' ? 'مشتريات الجلسة' : (tx.note || 'دفعة')}</td>
            <td style="padding: 10px;text-align: center;font-size: 13px;font-weight: 600;">${formatCurrency(tx.amount || 0, settings.currency)}</td>
            <td style="padding: 10px;text-align: left;font-size: 12px;color:#6b7280;" dir="ltr">${formatAppDate(safeParseDate(tx.date), settings.language, t)}</td>
          </tr>
        `;
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
              <th style="padding: 12px 10px;text-align: right;font-size: 13px;font-weight: 700;color: #52525b;">المورد</th>
              <th style="padding: 12px 10px;text-align: right;font-size: 13px;font-weight: 700;color: #52525b;">البيان</th>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden flex flex-col"
        dir={settings.language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">طباعة سجل العمليات</h2>
          <button onClick={onClose} disabled={isPrinting} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">الفترة الزمنية</label>
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
                  disabled={isPrinting}
                  onClick={() => setPeriod(opt.id as any)}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border-2 ${
                    period === opt.id 
                      ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400 shadow-sm'
                      : 'bg-white border-zinc-100 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400'
                  }`}
                  style={opt.id === 'custom' ? { gridColumn: 'span 2' } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    disabled={isPrinting}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    dir="ltr"
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    disabled={isPrinting}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    dir="ltr"
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handlePrint}
            disabled={isPrinting || (period === 'custom' && (!startDate || !endDate))}
            className="w-full py-4 rounded-xl font-black text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPrinting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                يتم التجهيز...
              </>
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
