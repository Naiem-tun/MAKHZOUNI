import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import * as html2pdf from 'html2pdf.js';
import * as xlsx from 'xlsx';

interface InventoryReportViewProps {
  report: any;
  products: any[];
  onClose: () => void;
}

export const InventoryReportView: React.FC<InventoryReportViewProps> = ({ report, products, onClose }) => {
  const { t } = useTranslation();
  const { settings, showToast } = useAppContext();
  const [showExportMenu, setShowExportMenu] = useState(false);

  let displayItems = [...(report.items || [])].sort((a: any, b: any) => (b.salesCalculated || 0) - (a.salesCalculated || 0));

  // Fix for older reports: Calculate the sum of item remaining values.
  const itemsSum = displayItems.reduce((sum, item) => {
    const val = item.remainingValue !== undefined 
      ? item.remainingValue 
      : ((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0);
    return sum + (Number(val) || 0);
  }, 0);

  // If there is a noticeable difference (due to old reports excluding 0-sale items), append an aggregated row.
  if (report.totalRemainingValue && (report.totalRemainingValue - itemsSum) > 1) {
    displayItems.push({
      productName: 'منتجات أخرى لم تُباع (لتطابق المجموع)',
      salesCalculated: 0,
      profit: 0,
      quantityAfter: undefined,
      remainingValue: report.totalRemainingValue - itemsSum
    });
  }

  // Calculate surplus statistics
  const surplusItems = displayItems.filter((it: any) => it.isSurplus || (it.salesCalculated < 0));
  const surplusCount = report.surplusItemsCount !== undefined 
    ? report.surplusItemsCount 
    : surplusItems.length;
  const surplusTotalQty = report.surplusTotalQuantity !== undefined 
    ? report.surplusTotalQuantity 
    : surplusItems.reduce((acc: number, it: any) => acc + (it.surplusQuantity || Math.abs(it.salesCalculated || 0)), 0);
  const surplusCostTotal = report.surplusValueUnverified !== undefined 
    ? report.surplusValueUnverified 
    : surplusItems.reduce((acc: number, it: any) => {
        if (it.surplusCostValue !== undefined) return acc + it.surplusCostValue;
        const prod = products.find(p => p.name === it.productName);
        const cost = it.purchasePrice || prod?.purchasePrice || prod?.costPrice || 0;
        const qty = it.surplusQuantity || Math.abs(it.salesCalculated || 0);
        return acc + (qty * cost);
      }, 0);

  const exportToExcel = () => {
    if (!displayItems || displayItems.length === 0) return;
    
    const wsData = [];
    
    // Title
    wsData.push([`${t('sales_report')} - ${formatAppDate(safeParseDate(report.date), settings.language, t)}`]);
    wsData.push([]);
    
    // Summary
    wsData.push([t('profits_revenue') + " :"]);
    wsData.push([t('total_profit') + " :", Number(report.totalProfit) || 0]);
    wsData.push([t('total_remaining_value') + " :", Number(report.totalRemainingValue) || 0]);
    if (surplusCostTotal > 0) {
      wsData.push(["فائض مخزون غير مبرَّر (بسعر التكلفة) :", Number(surplusCostTotal) || 0]);
      wsData.push(["عدد الأصناف الفائضة :", Number(surplusCount) || 0]);
      wsData.push(["إجمالي الكمية الفائضة :", Number(surplusTotalQty) || 0]);
    }
    wsData.push([]);
    
    // Table Headers
    wsData.push([
      t('product'),
      'الباركود',
      t('sold'),
      t('profit'),
      t('remaining_qty'),
      t('remaining_value'),
      'ملاحظات / حالة الصنف'
    ]);
    
    // Rows
    displayItems.forEach((item: any) => {
      const remainingValue = item.remainingValue !== undefined ? item.remainingValue : ((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0);
      const productBarcode = products.find(p => p.name === item.productName)?.barcode || '';
      const isItemSurplus = item.isSurplus || (item.salesCalculated < 0);
      const surplusQty = item.surplusQuantity || (isItemSurplus ? Math.abs(item.salesCalculated) : 0);
      
      wsData.push([
        item.productName || '',
        productBarcode,
        isItemSurplus ? `+${surplusQty} (فائض)` : (Number(item.salesCalculated) || 0),
        Number(item.profit) || 0,
        item.quantityAfter !== undefined ? Number(item.quantityAfter) : '',
        Number(remainingValue) || 0,
        isItemSurplus ? `فائض مخزون غير مفسر (+${surplusQty})` : ''
      ]);
    });
    
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    
    // Keep Right-to-Left for Arabic
    if (settings.language === 'ar') {
      ws['!dir'] = 'rtl';
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Inventory Report");
    
    const reportDate = safeParseDate(report.date).toISOString().split('T')[0];
    xlsx.writeFile(wb, `inventory_report_${reportDate}.xlsx`);
    
    showToast('تم تصدير Excel بنجاح', 'success');
  };

  const generatePDF = async () => {
    try {
      showToast(t('preparing_pdf'));
      
      const element = document.getElementById('pdf-report-content');
      if (!element) throw new Error("Report element not found");
      
      // Temporarily hide buttons
      const hiddenElements = element.querySelectorAll('.print-hidden');
      hiddenElements.forEach((el: any) => {
         el.setAttribute('data-original-display', el.style.display);
         el.style.display = 'none';
      });

      const storeName = settings.storeName || 'Store';
      const reportDate = safeParseDate(report.date).toLocaleDateString('en-GB');
      const filename = `inventory-${reportDate.replace(/\//g, '-')}.pdf`;
      
      const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'avoid-all' }
      };

      // @ts-ignore
      const html2pdfModule = html2pdf.default || html2pdf;

      // @ts-ignore
      await html2pdfModule().set(opt).from(element).save();

      // Restore
      hiddenElements.forEach((el: any) => {
         el.style.display = el.getAttribute('data-original-display') || '';
      });
      
      showToast(t('pdf_download_success'), 'success');
      
    } catch (err) {
      console.error("PDF generation error:", err);
      showToast(t('pdf_download_error') + ': ' + String(err), 'error');
    }
  };

  return (
    <motion.div 
      id="pdf-report-content"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pb-40 min-h-[100dvh] bg-white" dir="rtl"
    >
      <div className="p-4 sm:p-6 text-black" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, system-ui" }}>
        
        <div className="print-hidden mb-6 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-600 active:scale-95 transition-transform"
          >
            <ArrowRight size={20} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="h-10 px-4 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg text-zinc-700 active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-sm text-sm font-bold"
              title="تقارير"
            >
              <FileText size={16} />
              <span className="hidden sm:inline">تقارير</span>
            </button>
            
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                  <button
                    onClick={() => { setShowExportMenu(false); generatePDF(); }}
                    className="w-full justify-start px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-bold text-zinc-700 dark:text-zinc-300"
                  >
                    <Download size={16} />
                    <span>{t('download')} PDF</span>
                  </button>
                  <button
                    onClick={() => { setShowExportMenu(false); exportToExcel(); }}
                    className="w-full justify-start px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-bold text-[#107C41]"
                  >
                    <FileSpreadsheet size={16} />
                    <span>تصدير Excel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center border-b-2 border-[#e0e0e0] pb-4 mb-6 sm:mb-8">
          <div className="text-[18px] sm:text-[22px] font-bold text-[#021024]">{settings.storeName || t('makhzouni')}</div>
          <div className="text-[20px] sm:text-[24px] font-bold text-center flex-grow">{t('sales_report')}</div>
          <div className="text-[16px] sm:text-[18px] text-[#555555]" dir="ltr">
            {formatAppDate(safeParseDate(report.date), settings.language, t)}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
          <div className="p-5 rounded-lg bg-[#004eff] text-white shadow-sm">
            <div className="text-[16px] mb-2 opacity-90">{t('total_profits')}</div>
            <div className="text-[24px] sm:text-[28px] font-bold inline-block" dir="ltr">
              {formatCurrency(report.totalProfit || 0, settings.currency, settings.language)}
            </div>
          </div>
          
          <div className="p-5 rounded-lg bg-[#021024] text-white shadow-sm">
            <div className="text-[16px] mb-2 opacity-90">{t('total_remaining_value')}</div>
            <div className="text-[24px] sm:text-[28px] font-bold inline-block" dir="ltr">
              {formatCurrency(report.totalRemainingValue !== undefined ? report.totalRemainingValue : report.items?.reduce((sum: number, item: any) => sum + (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0)), 0) || 0, settings.currency, settings.language)}
            </div>
          </div>

          {surplusCostTotal > 0 && (
            <div className="p-5 rounded-lg bg-amber-500 text-white shadow-sm border border-amber-600 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[15px] font-black flex items-center gap-1.5">
                  <span>فائض مخزون غير مبرَّر</span>
                </div>
                <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded-full font-bold">
                  {surplusCount} صنف (+{surplusTotalQty})
                </span>
              </div>
              <div className="text-[22px] sm:text-[26px] font-black inline-block" dir="ltr">
                {formatCurrency(surplusCostTotal, settings.currency, settings.language)}
              </div>
              <div className="text-[10.5px] opacity-90 mt-1 font-medium leading-tight">
                قيمة تكلفة كميات ظهرت بالعد الفعلي وتزيد عن المسجل بالنظام
              </div>
            </div>
          )}
        </div>

        <div className="text-[14px] text-[#666666] mb-3">
          * {t('sorted_by_sales_desc')}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <th className="px-3 py-3 text-right border-b border-[#eeeeee] bg-[#e6f0ff] text-[#021024] font-bold text-[16px]">{t('product')}</th>
                <th className="px-3 py-3 text-right border-b border-[#eeeeee] bg-[#e6f0ff] text-[#021024] font-bold text-[16px]">{t('sold')}</th>
                <th className="px-3 py-3 text-right border-b border-[#eeeeee] bg-[#e6f0ff] text-[#021024] font-bold text-[16px]">{t('profit')}</th>
                <th className="px-3 py-3 text-right border-b border-[#eeeeee] bg-[#e6f0ff] text-[#021024] font-bold text-[16px]">{t('remaining_qty')}</th>
                <th className="px-3 py-3 text-right border-b border-[#eeeeee] bg-[#e6f0ff] text-[#021024] font-bold text-[16px]">{t('remaining_value')}</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item: any, i: number) => {
                const isItemSurplus = item.isSurplus || (item.salesCalculated < 0);
                const surplusQty = item.surplusQuantity || (isItemSurplus ? Math.abs(item.salesCalculated) : 0);

                return (
                  <tr 
                    key={i} 
                    className={isItemSurplus ? "bg-amber-50/50 hover:bg-amber-50" : "even:bg-[#fafbfc]"} 
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]">
                      <div className="font-semibold text-zinc-900">{item.productName}</div>
                      {isItemSurplus && (
                        <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                          زيادة غير مفسَّرة: المسجل ({item.quantityBefore ?? '—'}) ➔ الفعلي ({item.quantityAfter ?? '—'})
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]">
                      {isItemSurplus ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px] whitespace-nowrap shadow-xs">
                          +{surplusQty} غير مفسَّر
                        </span>
                      ) : (
                        <span className="font-medium">{item.salesCalculated}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]" dir="ltr">
                      <div className="inline-block">
                        {isItemSurplus ? (
                          <span className="text-zinc-400 font-mono text-xs">0.000</span>
                        ) : (
                          formatCurrency(item.profit || 0, settings.currency, settings.language)
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee] font-semibold">{item.quantityAfter ?? '—'}</td>
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]" dir="ltr">
                      <div className="inline-block font-semibold">
                        {formatCurrency(item.remainingValue !== undefined ? item.remainingValue : ((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0), settings.currency, settings.language)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </motion.div>
  );
};
