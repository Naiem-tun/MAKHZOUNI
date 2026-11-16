import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAppDate, safeParseDate, formatCurrency } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as xlsx from 'xlsx';
import { useFolioTheme, resolveFolioTheme } from '../folio/FolioPageChrome';

interface InventoryReportViewProps {
  report: any;
  products: any[];
  onClose: () => void;
}

export const InventoryReportView: React.FC<InventoryReportViewProps> = ({ report, products, onClose }) => {
  const { t } = useTranslation();
  const { settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const printTheme = theme.isDark ? resolveFolioTheme(false, 'folio-cobalt') : theme;
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

    if (report.damageItems && report.damageItems.length > 0) {
      wsData.push([]);
      wsData.push([]);
      wsData.push(['ملخص التالف والضائع']);
      wsData.push(['إجمالي خسائر التالف:', Number(report.totalDamageLoss) || 0]);
      wsData.push([]);
      wsData.push(['المنتج', 'الكمية التالفة', 'تكلفة الوحدة', 'إجمالي الخسارة', 'السبب']);
      
      report.damageItems.forEach((item: any) => {
        wsData.push([
          item.productName || '',
          Number(item.quantity) || 0,
          Number(item.unitCost) || 0,
          Number(item.totalLoss) || 0,
          item.reason || ''
        ]);
      });
    }
    
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
      
      let sortedItems = [...(report.items || [])].sort((a: any, b: any) => (b.salesCalculated || 0) - (a.salesCalculated || 0));
      
      const itemsSum = sortedItems.reduce((sum: number, item: any) => {
        const val = item.remainingValue !== undefined 
          ? item.remainingValue 
          : ((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0);
        return sum + (Number(val) || 0);
      }, 0);

      if (report.totalRemainingValue && (report.totalRemainingValue - itemsSum) > 1) {
        sortedItems.push({
          productName: 'منتجات أخرى لم تُباع (لتطابق المجموع)',
          salesCalculated: 0,
          profit: 0,
          quantityAfter: undefined,
          remainingValue: report.totalRemainingValue - itemsSum
        });
      }

      const reportItems = sortedItems;

      const storeName = settings.storeName || t('makhzouni');
      const reportDate = safeParseDate(report.date).toLocaleDateString('en-GB');
      const filename = `inventory-${reportDate.replace(/\//g, '-')}.pdf`;
      const formattedDate = formatAppDate(safeParseDate(report.date), settings.language, t);

      const totalProfitStr = formatCurrency(report.totalProfit || 0, settings.currency, settings.language);
      
      const totalRevenueVal = report.totalRevenue !== undefined 
        ? report.totalRevenue
        : reportItems.reduce((acc: number, it: any) => {
            if (it.salesCalculated && it.salesCalculated > 0) {
                const sp = it.sellingPrice !== undefined ? it.sellingPrice : (products.find(p => p.name === it.productName)?.sellingPrice || 0);
                return acc + (it.salesCalculated * sp);
            }
            return acc;
        }, 0);
      const totalRevenueStr = formatCurrency(totalRevenueVal, settings.currency, settings.language);

      const cogsVal = totalRevenueVal - (report.totalProfit || 0);
      const cogsStr = formatCurrency(cogsVal > 0 ? cogsVal : 0, settings.currency, settings.language);
      
      const operatingExpenses = report.totalExpenses || 0;
      const operatingExpensesStr = formatCurrency(operatingExpenses, settings.currency, settings.language);
      
      const totalDamageLoss = report.totalDamageLoss || 0;
      const totalDamageLossStr = formatCurrency(totalDamageLoss, settings.currency, settings.language);
      
      const netProfit = report.netProfit !== undefined ? report.netProfit : (report.totalProfit || 0) - operatingExpenses;
      const netProfitStr = formatCurrency(netProfit, settings.currency, settings.language);

      const totalRemainingVal = report.totalRemainingValue !== undefined 
        ? report.totalRemainingValue 
        : reportItems.reduce((sum: number, item: any) => {
            const prod = products.find(p => p.name === item.productName);
            const cost = prod?.purchasePrice || prod?.costPrice || 0;
            return sum + (cost * (item.quantityAfter || 0));
          }, 0) || 0;
      const totalRemainingStr = formatCurrency(totalRemainingVal, settings.currency, settings.language);

      const surplusItems = reportItems.filter((it: any) => it.isSurplus || (it.salesCalculated < 0));
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

      const ITEMS_PER_PAGE = 25;
      
      const totalPages = Math.ceil(reportItems.length / ITEMS_PER_PAGE) || 1;
      
      const pageChunks = [];
      for (let i = 0; i < reportItems.length; i += ITEMS_PER_PAGE) {
        pageChunks.push(reportItems.slice(i, i + ITEMS_PER_PAGE));
      }
      if (pageChunks.length === 0) pageChunks.push([]);

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const hiddenHost = document.createElement('div');
      hiddenHost.style.position = 'absolute';
      hiddenHost.style.top = '-9999px';
      hiddenHost.style.left = '-9999px';
      hiddenHost.style.width = '794px';
      hiddenHost.style.backgroundColor = '#ffffff';
      document.body.appendChild(hiddenHost);

      const pPaper = '#FFFFFF';
      const pBg = printTheme.bg;
      const pMuted = printTheme.surfaceMuted;
      const pBorder = printTheme.border;
      const pInk = printTheme.text;
      const pInkMuted = printTheme.textMuted;
      const pAccent = printTheme.accent;
      const pNegative = printTheme.negative;

      for (let pageIdx = 0; pageIdx < pageChunks.length; pageIdx++) {
        const chunk = pageChunks[pageIdx];
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === pageChunks.length - 1;
        
        let rowsHtml = '';
        chunk.forEach((item: any, i: number) => {
          const isItemSurplus = item.isSurplus || (item.salesCalculated < 0);
          const surplusQty = item.surplusQuantity || (isItemSurplus ? Math.abs(item.salesCalculated) : 0);
          const remainingVal = item.remainingValue !== undefined 
            ? item.remainingValue 
            : (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0));

          const rowBg = isItemSurplus ? '#FFFBEB' : (i % 2 === 1 ? pBg : pPaper);
          const profitCell = isItemSurplus 
            ? `<span style="color: ${pInkMuted}; font-family: monospace; font-size: 11px;">0.000</span>` 
            : `<span style="font-weight: 700; color: ${pInk}; font-variant-numeric: tabular-nums;">${formatCurrency(item.profit || 0, settings.currency, settings.language)}</span>`;

          const soldCell = isItemSurplus
            ? `<span style="display: inline-block; padding: 2px 6px; border-radius: 0; background-color: #FEF3C7; color: #78350F; border: 1px solid #F59E0B; font-weight: 800; font-size: 10.5px;">+${surplusQty} غير مفسَّر</span>`
            : `<span style="font-weight: 700; color: ${pInk}; font-variant-numeric: tabular-nums;">${item.salesCalculated}</span>`;

          const surplusNote = isItemSurplus 
            ? `<div style="font-size: 10.5px; color: #B45309; font-weight: 700; margin-top: 2px;">زيادة غير مفسَّرة: المسجل (${item.quantityBefore ?? '—'}) ➔ الفعلي (${item.quantityAfter ?? '—'})</div>`
            : '';

          rowsHtml += `
            <tr style="background-color: ${rowBg}; border-bottom: 1px solid ${pBorder}; page-break-inside: avoid; break-inside: avoid;">
              <td style="padding: 6px 10px; text-align: right; vertical-align: middle;">
                <div style="font-weight: 700; color: ${pInk}; font-size: 12.5px; line-height: 1.35;">${item.productName || '—'}</div>
                ${surplusNote}
              </td>
              <td style="padding: 6px 10px; text-align: center; vertical-align: middle; font-size: 12.5px;">
                ${soldCell}
              </td>
              <td style="padding: 6px 10px; text-align: left; vertical-align: middle; font-size: 12.5px;">
                ${profitCell}
              </td>
              <td style="padding: 6px 10px; text-align: center; vertical-align: middle; font-weight: 700; color: ${pInk}; font-size: 12.5px; font-variant-numeric: tabular-nums;">
                ${item.quantityAfter ?? '—'}
              </td>
              <td style="padding: 6px 10px; text-align: left; vertical-align: middle; font-weight: 700; color: ${pInk}; font-size: 12.5px; font-variant-numeric: tabular-nums;">
                ${formatCurrency(remainingVal, settings.currency, settings.language)}
              </td>
            </tr>
          `;
        });

        const surplusCardHtml = surplusCostTotal > 0 ? `
          <div style="flex: 1; min-width: 200px; padding: 10px 14px; border-radius: 0; background-color: #FFFBEB; color: #78350F; border: 1px solid #F59E0B; border-right: 4px solid #D97706;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 12.5px; font-weight: 800;">فائض مخزون غير مبرَّر</span>
              <span style="font-size: 10.5px; background-color: #FEF3C7; border: 1px solid #F59E0B; color: #78350F; padding: 1px 6px; border-radius: 0; font-weight: 800; font-variant-numeric: tabular-nums;">
                ${surplusCount} صنف (+${surplusTotalQty})
              </span>
            </div>
            <div style="font-size: 18px; font-weight: 900; color: #92400E; font-variant-numeric: tabular-nums;">
              ${formatCurrency(surplusCostTotal, settings.currency, settings.language)}
            </div>
            <div style="font-size: 9.5px; color: #92400E; margin-top: 2px;">
              قيمة تكلفة كميات ظهرت بالعد الفعلي وتزيد عن المسجل بالنظام
            </div>
          </div>
        ` : '';

        const damageTableHtml = (isLastPage && report.damageItems && report.damageItems.length > 0) ? `
          <div style="margin-top: 20px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid ${pInk}; padding-bottom: 6px; margin-bottom: 10px;">
              <span style="font-size: 11px; font-weight: 800; color: ${pNegative}; font-family: monospace;">03</span>
              <h3 style="font-size: 14px; font-weight: 900; color: ${pInk}; margin: 0;">ملخص التالف والضائع (تفصيلي)</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid ${pBorder};">
              <thead>
                <tr style="background-color: #FEF2F2; color: #7F1D1D; border-top: 2px solid ${pNegative}; border-bottom: 1.5px solid ${pNegative};">
                  <th style="padding: 8px 10px; text-align: right; font-weight: 800;">المنتج</th>
                  <th style="padding: 8px 10px; text-align: center; font-weight: 800;">الكمية التالفة</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: 800;">تكلفة الوحدة</th>
                  <th style="padding: 8px 10px; text-align: left; font-weight: 800;">إجمالي الخسارة</th>
                  <th style="padding: 8px 10px; text-align: right; font-weight: 800;">السبب</th>
                </tr>
              </thead>
              <tbody>
                ${report.damageItems.map((item: any, idx: number) => `
                  <tr style="background-color: ${idx % 2 === 1 ? pBg : pPaper}; border-bottom: 1px solid ${pBorder};">
                    <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: ${pInk};">${item.productName}</td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 700; color: ${pNegative}; font-variant-numeric: tabular-nums;">${item.quantity}</td>
                    <td style="padding: 7px 10px; text-align: left; color: ${pInkMuted}; font-variant-numeric: tabular-nums;">${formatCurrency(item.unitCost || 0, settings.currency, settings.language)}</td>
                    <td style="padding: 7px 10px; text-align: left; font-weight: 800; color: ${pNegative}; font-variant-numeric: tabular-nums;">${formatCurrency(item.totalLoss || 0, settings.currency, settings.language)}</td>
                    <td style="padding: 7px 10px; text-align: right; color: ${pInkMuted};">${item.reason || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '';

        const reportHtml = `
          <div style="padding: 20px 28px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif; background-color: ${pPaper}; color: ${pInk}; direction: rtl; width: 794px; min-height: 1123px; box-sizing: border-box;">
            
            <!-- Editorial Masthead -->
            <div style="border-top: 3px solid ${pAccent}; border-bottom: 2px solid ${pInk}; padding: 10px 0 12px 0; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 10px; font-weight: 800; color: ${pAccent}; margin-bottom: 2px;">${storeName}</div>
                <div style="font-size: 19px; font-weight: 900; color: ${pInk}; line-height: 1.2;">${t('sales_report')}</div>
              </div>
              <div style="text-align: left; background-color: ${pBg}; border: 1px solid ${pBorder}; padding: 6px 12px;">
                <div style="font-size: 9.5px; font-weight: 700; color: ${pInkMuted}; margin-bottom: 1px;">تاريخ الجرد</div>
                <div style="font-size: 13px; font-weight: 800; color: ${pInk}; font-variant-numeric: tabular-nums;" dir="ltr">${formattedDate}</div>
              </div>
            </div>

            <!-- Summary Cards (Page 1 Only) -->
            ${isFirstPage ? `
            <div style="border: 1px solid ${pBorder}; border-radius: 0; padding: 12px 14px; margin-bottom: 12px; background-color: ${pBg};">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid ${pBorder}; padding-bottom: 7px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 11px; font-weight: 800; color: ${pAccent}; font-family: monospace;">01</span>
                  <h2 style="font-size: 14px; font-weight: 900; color: ${pInk}; margin: 0;">التقرير المالي الشامل</h2>
                </div>
                <span style="font-size: 10px; font-weight: 700; color: ${pInkMuted};">${reportItems.length} صنف</span>
              </div>
              
              <div style="display: flex; gap: 16px;">
                <!-- Column 1: Sales & COGS -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 7px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${pBorder}; padding-bottom: 5px;">
                    <span style="font-size: 12px; font-weight: 700; color: ${pInkMuted};">إجمالي إيرادات المبيعات</span>
                    <span style="font-size: 13px; font-weight: 800; color: ${pInk}; font-variant-numeric: tabular-nums;">${totalRevenueStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${pBorder}; padding-bottom: 5px;">
                    <span style="font-size: 12px; font-weight: 700; color: ${pInkMuted};">تكلفة البضاعة المباعة (COGS)</span>
                    <span style="font-size: 13px; font-weight: 800; color: ${pNegative}; font-variant-numeric: tabular-nums;">- ${cogsStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; background-color: ${pPaper}; border: 1px solid ${pBorder}; border-right: 3px solid ${pInk}; padding: 7px 10px; border-radius: 0;">
                    <span style="font-size: 12.5px; font-weight: 800; color: ${pInk};">إجمالي الربح (المجمل)</span>
                    <span style="font-size: 14.5px; font-weight: 900; color: ${pInk}; font-variant-numeric: tabular-nums;">${totalProfitStr}</span>
                  </div>
                </div>

                <!-- Column 2: Expenses & Net Profit -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 7px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${pBorder}; padding-bottom: 5px;">
                    <span style="font-size: 12px; font-weight: 700; color: ${pInkMuted};">المصاريف التشغيلية النقدية</span>
                    <span style="font-size: 13px; font-weight: 800; color: ${pNegative}; font-variant-numeric: tabular-nums;">- ${operatingExpensesStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${pBorder}; padding-bottom: 5px;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                      <span style="font-size: 12px; font-weight: 700; color: ${pInkMuted};">قيمة التالف والعجز</span>
                      <span style="font-size: 9px; color: ${pInkMuted};">(مرجعي)</span>
                    </div>
                    <span style="font-size: 13px; font-weight: 800; color: #B45309; font-variant-numeric: tabular-nums;">${totalDamageLossStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; background-color: ${pMuted}; border: 1px solid ${pAccent}; border-right: 4px solid ${pAccent}; padding: 7px 10px; border-radius: 0;">
                    <span style="font-size: 12.5px; font-weight: 900; color: ${pInk};">صافي الربح الفعلي</span>
                    <span style="font-size: 16px; font-weight: 900; color: ${pAccent}; font-variant-numeric: tabular-nums;">${netProfitStr}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 12px;">
              <div style="flex: 1; min-width: 200px; padding: 10px 14px; border-radius: 0; background-color: ${pPaper}; color: ${pInk}; border: 1px solid ${pBorder}; border-right: 4px solid ${pInk};">
                <div style="font-size: 11.5px; font-weight: 700; color: ${pInkMuted}; margin-bottom: 3px;">قيمة المخزون المتبقي (بالتكلفة)</div>
                <div style="font-size: 18px; font-weight: 900; color: ${pInk}; font-variant-numeric: tabular-nums;">
                  ${totalRemainingStr}
                </div>
              </div>

              ${surplusCardHtml}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10.5px; font-weight: 800; color: ${pAccent}; font-family: monospace;">02</span>
                <span style="font-size: 12px; font-weight: 800; color: ${pInk};">تفاصيل حركة الأصناف</span>
              </div>
              <div style="font-size: 10.5px; color: ${pInkMuted}; font-weight: 600;">
                * ${t('sorted_by_sales_desc')}
              </div>
            </div>
            ` : ''}

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; border: 1px solid ${pBorder};">
              <thead>
                <tr style="background-color: ${pMuted}; color: ${pInk}; border-top: 2px solid ${pInk}; border-bottom: 1.5px solid ${pInk};">
                  <th style="padding: 7px 10px; text-align: right; font-weight: 800; font-size: 12px;">${t('product')}</th>
                  <th style="padding: 7px 10px; text-align: center; font-weight: 800; font-size: 12px;">${t('sold')}</th>
                  <th style="padding: 7px 10px; text-align: left; font-weight: 800; font-size: 12px;">${t('profit')}</th>
                  <th style="padding: 7px 10px; text-align: center; font-weight: 800; font-size: 12px;">${t('remaining_qty')}</th>
                  <th style="padding: 7px 10px; text-align: left; font-weight: 800; font-size: 12px;">${t('remaining_value')}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            
            ${damageTableHtml}
            
            <!-- Footer -->
            <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid ${pBorder}; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: ${pInkMuted}; font-weight: 700;">
              <span>${storeName} · ${t('sales_report')}</span>
              <span style="font-variant-numeric: tabular-nums;">صفحة ${pageIdx + 1} من ${totalPages}</span>
            </div>
          </div>
        `;

        const pageContainer = document.createElement('div');
        pageContainer.innerHTML = reportHtml;
        hiddenHost.appendChild(pageContainer);

        await new Promise((resolve) => setTimeout(resolve, 40));

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

  const uiTotalRevenueVal = report.totalRevenue !== undefined 
    ? report.totalRevenue
    : displayItems.reduce((acc: number, it: any) => {
        if (it.salesCalculated && it.salesCalculated > 0) {
            const sp = it.sellingPrice !== undefined ? it.sellingPrice : (products.find(p => p.name === it.productName)?.sellingPrice || 0);
            return acc + (it.salesCalculated * sp);
        }
        return acc;
    }, 0);
  
  const uiCogsVal = uiTotalRevenueVal - (report.totalProfit || 0);
  const uiTotalExpenses = report.totalExpenses || 0;
  const uiNetProfit = report.netProfit !== undefined ? report.netProfit : (report.totalProfit || 0) - uiTotalExpenses;

  return (
    <motion.div 
      id="pdf-report-content"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pb-40 min-h-[100dvh]"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        
        <div className="print-hidden mb-5 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center border rounded-none active:scale-95 transition-transform cursor-pointer"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
          >
            <ArrowRight size={20} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="h-10 px-4 border rounded-none active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm font-bold cursor-pointer"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
              title="تقارير"
            >
              <FileText size={16} style={{ color: theme.accent }} />
              <span className="hidden sm:inline">تقارير</span>
            </button>
            
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div
                  className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 border rounded-none shadow-xl z-50 overflow-hidden py-1"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <button
                    onClick={() => { setShowExportMenu(false); generatePDF(); }}
                    className="w-full justify-start px-4 py-3 flex items-center gap-3 transition-colors text-sm font-bold cursor-pointer"
                    style={{ color: theme.text }}
                  >
                    <Download size={16} style={{ color: theme.accent }} />
                    <span>{t('download')} PDF</span>
                  </button>
                  <button
                    onClick={() => { setShowExportMenu(false); exportToExcel(); }}
                    className="w-full justify-start px-4 py-3 flex items-center gap-3 transition-colors text-sm font-bold text-[#107C41] cursor-pointer"
                  >
                    <FileSpreadsheet size={16} />
                    <span>تصدير Excel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Masthead */}
        <div
          className="flex flex-wrap justify-between items-center gap-3 border-t-[3px] border-b-2 py-3.5 mb-5"
          style={{ borderTopColor: theme.accent, borderBottomColor: theme.text }}
        >
          <div>
            <div className="text-xs font-bold mb-0.5" style={{ color: theme.accent }}>{settings.storeName || t('makhzouni')}</div>
            <div className="text-xl sm:text-2xl font-black" style={{ color: theme.text }}>{t('sales_report')}</div>
          </div>
          <div
            className="px-3 py-1.5 border text-left"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>تاريخ الجرد</div>
            <div className="text-sm sm:text-base font-bold tabular-nums" dir="ltr" style={{ color: theme.text }}>
              {formatAppDate(safeParseDate(report.date), settings.language, t)}
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div
          className="mb-5 p-4 sm:p-5 border rounded-none"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="flex items-center justify-between border-b pb-3 mb-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold" style={{ color: theme.accent }}>01</span>
              <h2 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>التقرير المالي الشامل</h2>
            </div>
            <span className="text-xs font-bold tabular-nums" style={{ color: theme.textMuted }}>{displayItems.length} صنف</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Revenue and COGS */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: theme.border }}>
                <span className="font-semibold text-sm" style={{ color: theme.textMuted }}>إجمالي إيرادات المبيعات</span>
                <span className="font-bold text-base tabular-nums" style={{ color: theme.text }}>{formatCurrency(uiTotalRevenueVal, settings.currency, settings.language)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: theme.border }}>
                <span className="font-semibold text-sm" style={{ color: theme.textMuted }}>تكلفة البضاعة المباعة (COGS)</span>
                <span className="font-bold text-base tabular-nums" style={{ color: theme.negative }}>- {formatCurrency(uiCogsVal > 0 ? uiCogsVal : 0, settings.currency, settings.language)}</span>
              </div>
              <div
                className="flex justify-between items-center py-2.5 px-3 border border-r-[3px] rounded-none"
                style={{ backgroundColor: theme.bg, borderColor: theme.border, borderRightColor: theme.text }}
              >
                <span className="font-bold text-sm" style={{ color: theme.text }}>إجمالي الربح (المجمل)</span>
                <span className="font-black text-lg tabular-nums" style={{ color: theme.text }}>{formatCurrency(report.totalProfit || 0, settings.currency, settings.language)}</span>
              </div>
            </div>

            {/* Expenses, Damage, Net Profit */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: theme.border }}>
                <span className="font-semibold text-sm" style={{ color: theme.textMuted }}>المصاريف التشغيلية النقدية</span>
                <span className="font-bold text-base tabular-nums" style={{ color: theme.negative }}>- {formatCurrency(uiTotalExpenses, settings.currency, settings.language)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: theme.border }}>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm" style={{ color: theme.textMuted }}>قيمة التالف والعجز</span>
                  <span className="text-[10px]" style={{ color: theme.textMuted }}>مؤشر مرجعي فقط</span>
                </div>
                <span className="font-bold text-base text-amber-600 tabular-nums">{formatCurrency(report.totalDamageLoss || 0, settings.currency, settings.language)}</span>
              </div>
              <div
                className="flex justify-between items-center py-2.5 px-3 border border-r-4 rounded-none"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.accent, borderRightColor: theme.accent }}
              >
                <span className="font-black text-sm" style={{ color: theme.text }}>صافي الربح الفعلي</span>
                <span className="font-black text-xl tabular-nums" style={{ color: theme.accent }}>{formatCurrency(uiNetProfit, settings.currency, settings.language)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Remaining Stock, Damage & Surplus Strips */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div
            className="flex-1 p-4 border border-r-4 rounded-none"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRightColor: theme.text }}
          >
            <div className="text-xs sm:text-sm mb-1.5 font-bold" style={{ color: theme.textMuted }}>قيمة المخزون المتبقي (بالتكلفة)</div>
            <div className="text-2xl font-black tabular-nums inline-block" style={{ color: theme.text }}>
              {formatCurrency(report.totalRemainingValue !== undefined ? report.totalRemainingValue : report.items?.reduce((sum: number, item: any) => sum + (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0)), 0) || 0, settings.currency, settings.language)}
            </div>
          </div>
          
          {(report.totalDamageLoss > 0) && (
            <div
              className="flex-1 p-4 border border-r-4 rounded-none"
              style={{ backgroundColor: theme.surface, borderColor: theme.negative, borderRightColor: theme.negative }}
            >
              <div className="text-xs sm:text-sm font-bold mb-1.5" style={{ color: theme.negative }}>
                إجمالي خسائر التالف والعجز
              </div>
              <div className="text-2xl font-black tabular-nums inline-block" style={{ color: theme.negative }}>
                {formatCurrency(report.totalDamageLoss || 0, settings.currency, settings.language)}
              </div>
              <div className="text-[11px] mt-1 font-medium leading-tight" style={{ color: theme.textMuted }}>
                مؤشر مرجعي للخسائر، لم يُخصم مرتين من الأرباح
              </div>
            </div>
          )}

          {surplusCostTotal > 0 && (
            <div className="flex-1 p-4 border border-amber-500 border-r-4 rounded-none bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-300">
                  فائض مخزون غير مبرَّر
                </div>
                <span className="text-[11px] bg-amber-100 dark:bg-amber-900/50 border border-amber-400 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-none font-bold tabular-nums">
                  {surplusCount} صنف (+{surplusTotalQty})
                </span>
              </div>
              <div className="text-2xl font-black text-amber-800 dark:text-amber-300 tabular-nums inline-block">
                {formatCurrency(surplusCostTotal, settings.currency, settings.language)}
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1 font-medium leading-tight">
                قيمة تكلفة كميات ظهرت بالعد الفعلي وتزيد عن المسجل بالنظام
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold" style={{ color: theme.accent }}>02</span>
            <h3 className="text-sm font-black" style={{ color: theme.text }}>تفاصيل حركة الأصناف</h3>
          </div>
          <div className="text-xs font-medium" style={{ color: theme.textMuted }}>
            * {t('sorted_by_sales_desc')}
          </div>
        </div>

        <div className="overflow-x-auto mb-8 border" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="border-t-2 border-b-2"
                style={{ backgroundColor: theme.surfaceMuted, borderTopColor: theme.text, borderBottomColor: theme.text, color: theme.text }}
              >
                <th className="px-3 py-2.5 text-right font-extrabold text-xs sm:text-sm">{t('product')}</th>
                <th className="px-3 py-2.5 text-center font-extrabold text-xs sm:text-sm">{t('sold')}</th>
                <th className="px-3 py-2.5 text-left font-extrabold text-xs sm:text-sm">{t('profit')}</th>
                <th className="px-3 py-2.5 text-center font-extrabold text-xs sm:text-sm">{t('remaining_qty')}</th>
                <th className="px-3 py-2.5 text-left font-extrabold text-xs sm:text-sm">{t('remaining_value')}</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item: any, i: number) => {
                const isItemSurplus = item.isSurplus || (item.salesCalculated < 0);
                const surplusQty = item.surplusQuantity || (isItemSurplus ? Math.abs(item.salesCalculated) : 0);

                return (
                  <tr 
                    key={i} 
                    className={isItemSurplus ? "bg-amber-50/70 dark:bg-amber-950/20" : undefined}
                    style={{
                      pageBreakInside: 'avoid',
                      borderBottom: `1px solid ${theme.border}`,
                      backgroundColor: !isItemSurplus && i % 2 === 1 ? theme.bg : undefined
                    }}
                  >
                    <td className="px-3 py-2.5 text-right">
                      <div className="font-semibold" style={{ color: theme.text }}>{item.productName}</div>
                      {isItemSurplus && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                          زيادة غير مفسَّرة: المسجل ({item.quantityBefore ?? '—'}) ➔ الفعلي ({item.quantityAfter ?? '—'})
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isItemSurplus ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-none bg-amber-100 text-amber-900 border border-amber-400 font-black text-[11px] whitespace-nowrap">
                          +{surplusQty} غير مفسَّر
                        </span>
                      ) : (
                        <span className="font-semibold tabular-nums">{item.salesCalculated}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-left tabular-nums">
                      <div className="inline-block font-semibold">
                        {isItemSurplus ? (
                          <span className="font-mono text-xs" style={{ color: theme.textMuted }}>0.000</span>
                        ) : (
                          formatCurrency(item.profit || 0, settings.currency, settings.language)
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{item.quantityAfter ?? '—'}</td>
                    <td className="px-3 py-2.5 text-left tabular-nums">
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

        {report.damageItems && report.damageItems.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 border-b-2 pb-2 mb-3" style={{ borderColor: theme.text }}>
              <span className="text-xs font-mono font-bold" style={{ color: theme.negative }}>03</span>
              <h3 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>
                ملخص التالف والضائع (تفصيلي)
              </h3>
            </div>

            <div className="overflow-x-auto border" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr
                    className="border-t-2 border-b-2 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200"
                    style={{ borderTopColor: theme.negative, borderBottomColor: theme.negative }}
                  >
                    <th className="px-3 py-2.5 text-right font-extrabold text-xs sm:text-sm">المنتج</th>
                    <th className="px-3 py-2.5 text-center font-extrabold text-xs sm:text-sm">الكمية التالفة</th>
                    <th className="px-3 py-2.5 text-left font-extrabold text-xs sm:text-sm">تكلفة الوحدة</th>
                    <th className="px-3 py-2.5 text-left font-extrabold text-xs sm:text-sm">إجمالي الخسارة</th>
                    <th className="px-3 py-2.5 text-right font-extrabold text-xs sm:text-sm">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {report.damageItems.map((item: any, i: number) => (
                    <tr
                      key={`dmg-${i}`}
                      style={{
                        pageBreakInside: 'avoid',
                        borderBottom: `1px solid ${theme.border}`,
                        backgroundColor: i % 2 === 1 ? theme.bg : undefined
                      }}
                    >
                      <td className="px-3 py-2.5 text-right">
                        <div className="font-semibold" style={{ color: theme.text }}>{item.productName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums" style={{ color: theme.negative }}>
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-left tabular-nums" style={{ color: theme.textMuted }}>
                        <div className="inline-block">
                          {formatCurrency(item.unitCost || 0, settings.currency, settings.language)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-left font-bold tabular-nums" style={{ color: theme.negative }}>
                        <div className="inline-block">
                          {formatCurrency(item.totalLoss || 0, settings.currency, settings.language)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ color: theme.textMuted }}>
                        {item.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </motion.div>
  );
};
