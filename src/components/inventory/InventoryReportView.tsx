import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Download, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import * as html2pdf from 'html2pdf.js';

interface InventoryReportViewProps {
  report: any;
  products: any[];
  onClose: () => void;
}

export const InventoryReportView: React.FC<InventoryReportViewProps> = ({ report, products, onClose }) => {
  const { t } = useTranslation();
  const { settings, showToast } = useAppContext();

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

  const exportToCSV = () => {
    if (!displayItems || displayItems.length === 0) return;
    
    const summaryHeaders = [
      `"${t('profits_revenue').replace(/"/g, '""')} :"`,
      `"${t('total_profit').replace(/"/g, '""')} : ${formatCurrency(report.totalProfit || 0).replace(/"/g, '""')}"`,
      `"${t('total_remaining_value').replace(/"/g, '""')} : ${formatCurrency(report.totalRemainingValue || 0).replace(/"/g, '""')}"`
    ];

    // Define headers
    const headers = [
      t('product'),
      t('sold'),
      t('profit'),
      t('remaining_qty'),
      t('remaining_value')
    ];

    // Create CSV rows
    const rows = displayItems.map((item: any) => {
      const remainingValue = item.remainingValue !== undefined ? item.remainingValue : ((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0);
      
      return [
        `"${(item.productName || '').replace(/"/g, '""')}"`,
        item.salesCalculated || 0,
        item.profit || 0,
        item.quantityAfter ?? 0,
        remainingValue || 0
      ].join(',');
    });

    const csvContent = [
      '\uFEFF' + `"${t('sales_report')} - ${formatAppDate(safeParseDate(report.date), settings.language, t)}"`,
      '',
      summaryHeaders.join(','),
      '',
      headers.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const reportDate = safeParseDate(report.date).toISOString().split('T')[0];
    // Notice we're getting the report date nicely to differentiate exports
    link.setAttribute('download', `inventory_report_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير Excel/CSV بنجاح', 'success');
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
      className="pb-40 min-h-screen bg-white" dir="rtl"
    >
      <div className="p-4 sm:p-6 text-black" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, system-ui" }}>
        
        <div className="print-hidden mb-6 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-600 active:scale-95 transition-transform"
          >
            <ArrowRight size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToCSV}
              className="h-10 px-4 bg-[#107C41] text-white rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm font-bold shadow-sm"
              title="تصدير Excel/CSV"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button 
              onClick={generatePDF}
              className="h-10 px-4 bg-[#4A6FA5] text-white rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm font-bold shadow-sm"
            >
              <Download size={16} />
              <span className="hidden sm:inline">{t('download')} PDF</span>
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center border-b-2 border-[#e0e0e0] pb-4 mb-6 sm:mb-8">
          <div className="text-[18px] sm:text-[22px] font-bold text-[#021024]">{settings.storeName || t('makhzouni')}</div>
          <div className="text-[20px] sm:text-[24px] font-bold text-center flex-grow">{t('sales_report')}</div>
          <div className="text-[16px] sm:text-[18px] text-[#555555]" dir="ltr">
            {formatAppDate(safeParseDate(report.date), settings.language, t)}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-6 sm:mb-8">
          <div className="flex-1 p-5 rounded-lg bg-[#004eff] text-white shadow-sm">
            <div className="text-[18px] mb-2 opacity-90">{t('total_profits')}</div>
            <div className="text-[24px] sm:text-[28px] font-bold inline-block" dir="ltr">
              {formatCurrency(report.totalProfit || 0, settings.currency, settings.language)}
            </div>
          </div>
          <div className="flex-1 p-5 rounded-lg bg-[#021024] text-white shadow-sm">
            <div className="text-[18px] mb-2 opacity-90">{t('total_remaining_value')}</div>
            <div className="text-[24px] sm:text-[28px] font-bold inline-block" dir="ltr">
              {formatCurrency(report.totalRemainingValue !== undefined ? report.totalRemainingValue : report.items?.reduce((sum: number, item: any) => sum + (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0)), 0) || 0, settings.currency, settings.language)}
            </div>
          </div>
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
              {displayItems.map((item: any, i: number) => (
                <tr key={i} className="even:bg-[#fafbfc]" style={{ pageBreakInside: 'avoid' }}>
                  <td className="px-3 py-3 text-right border-b border-[#eeeeee]">{item.productName}</td>
                  <td className="px-3 py-3 text-right border-b border-[#eeeeee]">{item.salesCalculated}</td>
                  <td className="px-3 py-3 text-right border-b border-[#eeeeee]" dir="ltr">
                    <div className="inline-block">{formatCurrency(item.profit || 0, settings.currency, settings.language)}</div>
                  </td>
                  <td className="px-3 py-3 text-right border-b border-[#eeeeee]">{item.quantityAfter ?? '—'}</td>
                  <td className="px-3 py-3 text-right border-b border-[#eeeeee]" dir="ltr">
                    <div className="inline-block">{formatCurrency(item.remainingValue !== undefined ? item.remainingValue : ((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0), settings.currency, settings.language)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Button */}
      <div className="print-hidden fixed bottom-6 left-6 right-6 z-40">
        <button 
          onClick={generatePDF}
          className="w-full py-4 shadow-2xl rounded-lg text-base font-black bg-[#4A6FA5] text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
        >
          <Download size={20} />
          <span>{t('download_pdf_report')}</span>
        </button>
      </div>
    </motion.div>
  );
}
