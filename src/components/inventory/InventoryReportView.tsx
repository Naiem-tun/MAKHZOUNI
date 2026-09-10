import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
      
      const storeName = settings.storeName || t('makhzouni');
      const reportDate = safeParseDate(report.date).toLocaleDateString('en-GB');
      const filename = `inventory-${reportDate.replace(/\//g, '-')}.pdf`;
      const formattedDate = formatAppDate(safeParseDate(report.date), settings.language, t);

      const totalProfitStr = formatCurrency(report.totalProfit || 0, settings.currency, settings.language);
      const totalRemainingVal = report.totalRemainingValue !== undefined 
        ? report.totalRemainingValue 
        : report.items?.reduce((sum: number, item: any) => {
            const prod = products.find(p => p.name === item.productName);
            const cost = prod?.purchasePrice || prod?.costPrice || 0;
            return sum + (cost * (item.quantityAfter || 0));
          }, 0) || 0;
      const totalRemainingStr = formatCurrency(totalRemainingVal, settings.currency, settings.language);

      const surplusItems = displayItems.filter((it: any) => it.isSurplus || (it.salesCalculated < 0));
      const surplusCount = report.surplusCount !== undefined ? report.surplusCount : surplusItems.length;
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

      // Safe page chunking: 15 rows on page 1 (with header & cards), 22 rows on subsequent pages
      const PAGE_1_MAX = 15;
      const OTHER_PAGE_MAX = 22;
      const pageChunks: any[][] = [];
      
      if (displayItems.length === 0) {
        pageChunks.push([]);
      } else {
        pageChunks.push(displayItems.slice(0, PAGE_1_MAX));
        let offset = PAGE_1_MAX;
        while (offset < displayItems.length) {
          pageChunks.push(displayItems.slice(offset, offset + OTHER_PAGE_MAX));
          offset += OTHER_PAGE_MAX;
        }
      }

      const totalPages = pageChunks.length;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Temporary hidden host to render pages at exact A4 pixel width (794px)
      const hiddenHost = document.createElement('div');
      hiddenHost.style.position = 'fixed';
      hiddenHost.style.top = '-99999px';
      hiddenHost.style.left = '0';
      hiddenHost.style.width = '794px';
      hiddenHost.style.zIndex = '-9999';
      hiddenHost.style.background = '#ffffff';
      document.body.appendChild(hiddenHost);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const items = pageChunks[pageIdx];
        const isFirstPage = pageIdx === 0;

        let rowsHtml = '';
        items.forEach((item: any, i: number) => {
          const isItemSurplus = item.isSurplus || (item.salesCalculated < 0);
          const surplusQty = item.surplusQuantity || (isItemSurplus ? Math.abs(item.salesCalculated) : 0);
          const remainingVal = item.remainingValue !== undefined 
            ? item.remainingValue 
            : (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0));

          const rowBg = isItemSurplus ? '#fffbeb' : (i % 2 === 1 ? '#f8fafc' : '#ffffff');
          const profitCell = isItemSurplus 
            ? `<span style="color: #94a3b8; font-family: monospace; font-size: 11px;">0.000</span>` 
            : `<span style="font-weight: 700; color: #0f172a;" dir="ltr">${formatCurrency(item.profit || 0, settings.currency, settings.language)}</span>`;

          const soldCell = isItemSurplus
            ? `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: #fef3c7; color: #78350f; border: 1px solid #fcd34d; font-weight: bold; font-size: 10.5px;">+${surplusQty} غير مفسَّر</span>`
            : `<span style="font-weight: 700; color: #0f172a;">${item.salesCalculated}</span>`;

          const surplusNote = isItemSurplus 
            ? `<div style="font-size: 10px; color: #b45309; font-weight: bold; margin-top: 2px;">زيادة غير مفسَّرة: المسجل (${item.quantityBefore ?? '—'}) ➔ الفعلي (${item.quantityAfter ?? '—'})</div>`
            : '';

          rowsHtml += `
            <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0; height: 38px;">
              <td style="padding: 6px 10px; text-align: right; vertical-align: middle; width: 38%;">
                <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${item.productName || '—'}</div>
                ${surplusNote}
              </td>
              <td style="padding: 6px 6px; text-align: center; vertical-align: middle; width: 14%; font-size: 12px;">
                ${soldCell}
              </td>
              <td style="padding: 6px 10px; text-align: left; vertical-align: middle; width: 16%; font-size: 12px;" dir="ltr">
                ${profitCell}
              </td>
              <td style="padding: 6px 6px; text-align: center; vertical-align: middle; width: 14%; font-weight: 700; color: #0f172a; font-size: 12px;">
                ${item.quantityAfter ?? '—'}
              </td>
              <td style="padding: 6px 10px; text-align: left; vertical-align: middle; width: 18%; font-weight: 700; color: #0f172a; font-size: 12px;" dir="ltr">
                ${formatCurrency(remainingVal, settings.currency, settings.language)}
              </td>
            </tr>
          `;
        });

        const headerHtml = isFirstPage ? `
          <!-- Main First Page Header Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 2px solid #021024; padding-bottom: 12px;">
            <tr>
              <td style="width: 32%; text-align: right; vertical-align: middle;">
                <div style="font-size: 19px; font-weight: 900; color: #021024;">${storeName}</div>
              </td>
              <td style="width: 36%; text-align: center; vertical-align: middle;">
                <div style="font-size: 21px; font-weight: 900; color: #0f172a;">${t('sales_report')}</div>
              </td>
              <td style="width: 32%; text-align: left; vertical-align: middle;" dir="ltr">
                <div style="font-size: 13px; color: #64748b; font-weight: 600;">${formattedDate}</div>
              </td>
            </tr>
          </table>

          <!-- Summary Cards on First Page -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 16px;">
            <tr>
              <td style="width: ${surplusCostTotal > 0 ? '33.33%' : '50%'}; vertical-align: top; background-color: #004eff; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">${t('total_profits')}</div>
                <div style="font-size: 20px; font-weight: 900;" dir="ltr">${totalProfitStr}</div>
              </td>
              <td style="width: ${surplusCostTotal > 0 ? '33.33%' : '50%'}; vertical-align: top; background-color: #021024; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">${t('total_remaining_value')}</div>
                <div style="font-size: 20px; font-weight: 900;" dir="ltr">${totalRemainingStr}</div>
              </td>
              ${surplusCostTotal > 0 ? `
              <td style="width: 33.33%; vertical-align: top; background-color: #d97706; color: #ffffff; padding: 12px 14px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 12px; font-weight: bold;">فائض غير مبرَّر</span>
                  <span style="font-size: 10px; background-color: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 4px; font-weight: bold;">
                    ${surplusCount} صنف (+${surplusTotalQty})
                  </span>
                </div>
                <div style="font-size: 18px; font-weight: 900;" dir="ltr">${formatCurrency(surplusCostTotal, settings.currency, settings.language)}</div>
                <div style="font-size: 9.5px; opacity: 0.9; margin-top: 2px;">كميات فعلية زائدة عن المسجل</div>
              </td>
              ` : ''}
            </tr>
          </table>

          <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
            * ${t('sorted_by_sales_desc')}
          </div>
        ` : `
          <!-- Subsequent Pages Header Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px;">
            <tr>
              <td style="width: 33%; text-align: right; font-size: 14px; font-weight: 800; color: #021024;">${storeName}</td>
              <td style="width: 34%; text-align: center; font-size: 15px; font-weight: 800; color: #0f172a;">${t('sales_report')} (تابع)</td>
              <td style="width: 33%; text-align: left; font-size: 12px; color: #64748b;" dir="ltr">${formattedDate}</td>
            </tr>
          </table>
        `;

        const pageHtml = `
          <div style="width: 794px; min-height: 1120px; max-height: 1120px; box-sizing: border-box; padding: 25px 30px; background: #ffffff; color: #0f172a; direction: rtl; font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Roboto, sans-serif; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              ${headerHtml}

              <!-- Table -->
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background-color: #e6f0ff; color: #021024; border-bottom: 2px solid #94a3b8; height: 34px;">
                    <th style="padding: 6px 10px; text-align: right; font-weight: 800; width: 38%;">${t('product')}</th>
                    <th style="padding: 6px 6px; text-align: center; font-weight: 800; width: 14%;">${t('sold')}</th>
                    <th style="padding: 6px 10px; text-align: left; font-weight: 800; width: 16%;">${t('profit')}</th>
                    <th style="padding: 6px 6px; text-align: center; font-weight: 800; width: 14%;">${t('remaining_qty')}</th>
                    <th style="padding: 6px 10px; text-align: left; font-weight: 800; width: 18%;">${t('remaining_value')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 25px; font-size: 13px;">لا توجد عناصر</td></tr>'}
                </tbody>
              </table>
            </div>

            <!-- Page Footer -->
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: #64748b;">
              <div>${storeName} — ${t('sales_report')}</div>
              <div>صفحة <strong style="color: #021024;">${pageIdx + 1}</strong> من <strong style="color: #021024;">${totalPages}</strong></div>
              <div dir="ltr">${formattedDate}</div>
            </div>
          </div>
        `;

        const pageContainer = document.createElement('div');
        pageContainer.innerHTML = pageHtml;
        hiddenHost.appendChild(pageContainer);

        await new Promise((resolve) => setTimeout(resolve, 30));

        const pageElem = pageContainer.firstElementChild as HTMLElement;
        const canvas = await html2canvas(pageElem, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          windowWidth: 794
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        if (pageIdx < totalPages - 1) {
          pdf.addPage('a4', 'p');
        }

        hiddenHost.removeChild(pageContainer);
      }

      if (document.body.contains(hiddenHost)) {
        document.body.removeChild(hiddenHost);
      }

      pdf.save(filename);
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
            <div className="p-5 rounded-lg bg-[#d97706] text-white shadow-sm border border-[#b45309] sm:col-span-2 lg:col-span-1">
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
                    className={isItemSurplus ? "bg-[#fffbeb] hover:bg-[#fef3c7]" : "even:bg-[#fafbfc]"} 
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]">
                      <div className="font-semibold text-[#0f172a]">{item.productName}</div>
                      {isItemSurplus && (
                        <div className="text-[11px] text-[#b45309] font-bold mt-0.5">
                          زيادة غير مفسَّرة: المسجل ({item.quantityBefore ?? '—'}) ➔ الفعلي ({item.quantityAfter ?? '—'})
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]">
                      {isItemSurplus ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#78350f] border border-[#fcd34d] font-black text-[11px] whitespace-nowrap shadow-xs">
                          +{surplusQty} غير مفسَّر
                        </span>
                      ) : (
                        <span className="font-medium">{item.salesCalculated}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right border-b border-[#eeeeee]" dir="ltr">
                      <div className="inline-block">
                        {isItemSurplus ? (
                          <span className="text-[#94a3b8] font-mono text-xs">0.000</span>
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
