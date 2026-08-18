import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  X, 
  Eye, 
  EyeOff, 
  FileText, 
  ChevronDown, 
  Download, 
  ExternalLink, 
  Loader2, 
  Search,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { cn } from '../../lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as xlsx from 'xlsx';

interface InventoryPrintModalProps {
  show: boolean;
  onClose: () => void;
  products: any[];
  categories: any[];
}

const ITEMS_PER_PAGE = 25;

export const InventoryPrintModal: React.FC<InventoryPrintModalProps> = ({
  show,
  onClose,
  products,
  categories
}) => {
  const { settings, showToast } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSystemQuantity, setShowSystemQuantity] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'category' | 'name' | 'barcode'>('category');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchCat) return false;
      
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      if (sortBy === 'category') {
        const catCompare = (a.category || '').localeCompare(b.category || '', 'ar');
        if (catCompare !== 0) return catCompare;
        return (a.name || '').localeCompare(b.name || '', 'ar');
      }
      if (sortBy === 'barcode') {
        return String(a.barcode || '').localeCompare(String(b.barcode || ''));
      }
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [products, selectedCategory, sortBy, searchQuery]);

  const currentDateStr = useMemo(() => {
    return new Date().toLocaleDateString('ar-TN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  // Divide into chunks for paginated PDF & Print
  const pageChunks = useMemo(() => {
    const chunks: any[][] = [];
    if (filteredProducts.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < filteredProducts.length; i += ITEMS_PER_PAGE) {
        chunks.push(filteredProducts.slice(i, i + ITEMS_PER_PAGE));
      }
    }
    return chunks;
  }, [filteredProducts]);

  const totalPages = pageChunks.length;

  // Helper to render HTML string for a single A4 page
  const renderSinglePageHtml = (
    items: any[], 
    pageNumber: number, 
    totalPagesCount: number, 
    startIdx: number
  ) => {
    const rowsHtml = items.map((p, i) => {
      const globalIdx = startIdx + i + 1;
      return `
        <tr style="height: 31px;">
          <td style="border: 1px solid #334155; padding: 4px 2px; text-align: center; font-weight: 800; background-color: #f8fafc; width: 34px; font-size: 11px;">${globalIdx}</td>
          <td style="border: 1px solid #334155; padding: 4px 6px; font-weight: 800; color: #0f172a; font-size: 11.5px; word-break: break-word;">${p.name || ''}</td>
          <td style="border: 1px solid #334155; padding: 4px 4px; font-family: monospace; direction: ltr; text-align: right; color: #334155; width: 115px; font-size: 11px; font-weight: 600;">${p.barcode || '-'}</td>
          <td style="border: 1px solid #334155; padding: 4px 4px; color: #475569; width: 90px; font-size: 10.5px;">${p.category || '-'}</td>
          ${showSystemQuantity ? `<td style="border: 1px solid #334155; padding: 4px 2px; text-align: center; font-weight: 800; color: #0f172a; background-color: #f8fafc; width: 70px; font-size: 11.5px;">${p.quantity ?? 0}</td>` : ''}
          <td style="border: 1.5px solid #1e293b; padding: 2px; background-color: #fefce8; width: 95px; height: 29px;"></td>
          <td style="border: 1px solid #334155; padding: 2px; width: 105px; height: 29px;"></td>
        </tr>
      `;
    }).join('');

    return `
      <div style="width: 794px; min-height: 1120px; box-sizing: border-box; padding: 25px 30px; background: #ffffff; color: #0f172a; direction: rtl; font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Roboto, sans-serif; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
            <div>
              <h1 style="font-size: 19px; font-weight: 900; color: #0f172a; margin: 0 0 3px 0;">${settings.storeName || 'المحل التجاري'}</h1>
              <h2 style="font-size: 13px; font-weight: 800; color: #334155; margin: 0;">كشف جرد المخزون الفعلي (اليدوي)</h2>
            </div>
            <div style="text-align: left; font-size: 11px; line-height: 1.5; color: #334155;">
              <div>التاريخ: <strong style="color: #0f172a;">${currentDateStr}</strong></div>
              <div>القسم: <strong style="color: #0f172a;">${selectedCategory === 'all' ? 'جميع الأقسام' : selectedCategory}</strong></div>
              <div>الصفحة: <strong style="color: #2563eb; font-size: 12px;">${pageNumber} من ${totalPagesCount}</strong> (${filteredProducts.length} منتج)</div>
            </div>
          </div>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 5px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 1.5px solid #0f172a; padding: 6px 2px; text-align: center; width: 34px; font-weight: 900; color: #0f172a;">#</th>
                <th style="border: 1.5px solid #0f172a; padding: 6px 6px; text-align: right; font-weight: 900; color: #0f172a;">اسم المنتج</th>
                <th style="border: 1.5px solid #0f172a; padding: 6px 4px; text-align: right; width: 115px; font-weight: 900; color: #0f172a;">الباركود</th>
                <th style="border: 1.5px solid #0f172a; padding: 6px 4px; text-align: right; width: 90px; font-weight: 900; color: #0f172a;">القسم</th>
                ${showSystemQuantity ? `<th style="border: 1.5px solid #0f172a; padding: 6px 2px; text-align: center; width: 70px; font-weight: 900; color: #0f172a;">السيستم</th>` : ''}
                <th style="border: 1.5px solid #0f172a; padding: 6px 2px; text-align: center; width: 95px; font-weight: 900; background-color: #fef08a; color: #0f172a;">الكمية الفعلية</th>
                <th style="border: 1.5px solid #0f172a; padding: 6px 4px; text-align: right; width: 105px; font-weight: 900; color: #0f172a;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 30px; font-size: 13px;">لا توجد منتجات</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 15px; padding-top: 8px; border-top: 1.5px solid #94a3b8; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 700; color: #334155;">
          <div>اسم المكلف بالجرد: ________________________</div>
          <div>التوقيع: ________________________</div>
          <div style="font-size: 10.5px; color: #64748b;">صفحة ${pageNumber} / ${totalPagesCount}</div>
        </div>
      </div>
    `;
  };

  // 1. BULLETPROOF MULTI-PAGE PDF GENERATOR (Guaranteed No Blank Pages)
  const handleDownloadPDF = async () => {
    if (filteredProducts.length === 0) {
      showToast('لا توجد منتجات لتوليد ملف PDF', 'error');
      return;
    }

    try {
      setIsExportingPDF(true);
      setPdfProgress({ current: 1, total: totalPages });
      showToast(`جاري إنشاء ملف PDF وتنسيق ${totalPages} صفحة...`, 'info');

      // Create a jsPDF document (A4 Portrait, millimeters)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Temporary hidden container strictly styled
      const hiddenHost = document.createElement('div');
      hiddenHost.style.position = 'fixed';
      hiddenHost.style.top = '-99999px';
      hiddenHost.style.left = '0';
      hiddenHost.style.width = '794px';
      hiddenHost.style.zIndex = '-9999';
      hiddenHost.style.background = '#ffffff';
      document.body.appendChild(hiddenHost);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        setPdfProgress({ current: pageIdx + 1, total: totalPages });

        const items = pageChunks[pageIdx];
        const startIdx = pageIdx * ITEMS_PER_PAGE;
        
        const pageContainer = document.createElement('div');
        pageContainer.innerHTML = renderSinglePageHtml(items, pageIdx + 1, totalPages, startIdx);
        hiddenHost.appendChild(pageContainer);

        // Small delay to guarantee fonts and layout settle
        await new Promise((resolve) => setTimeout(resolve, 40));

        const pageElem = pageContainer.firstElementChild as HTMLElement;

        const canvas = await html2canvas(pageElem, {
          scale: 2, // High resolution (300 DPI equivalent)
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          windowWidth: 794
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Add image to A4 (210mm x 297mm)
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        // If more pages remain, add new A4 page
        if (pageIdx < totalPages - 1) {
          pdf.addPage('a4', 'p');
        }

        hiddenHost.removeChild(pageContainer);
      }

      // Cleanup host
      if (document.body.contains(hiddenHost)) {
        document.body.removeChild(hiddenHost);
      }

      const storeSanitized = (settings.storeName || 'المخزون').replace(/\s+/g, '_');
      const catSanitized = (selectedCategory === 'all' ? 'جميع_الأقسام' : selectedCategory).replace(/\s+/g, '_');
      const filename = `كشف_جرد_${storeSanitized}_${catSanitized}_${new Date().toISOString().split('T')[0]}.pdf`;

      pdf.save(filename);
      showToast(`تم تنزيل ملف PDF بنجاح (${totalPages} صفحة)!`, 'success');
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('حدث خطأ أثناء إنشاء ملف PDF', 'error');
    } finally {
      setIsExportingPDF(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  // 2. Direct Print / Print Window (Fallback for instant hardware printing)
  const handleDirectPrint = () => {
    setIsPrintingDirect(true);
    showToast('جاري فتح نافذة الطباعة...', 'info');

    try {
      let fullPagesHtml = '';
      pageChunks.forEach((items, idx) => {
        const startIdx = idx * ITEMS_PER_PAGE;
        fullPagesHtml += `
          <div class="print-page">
            ${renderSinglePageHtml(items, idx + 1, totalPages, startIdx)}
          </div>
        `;
      });

      const printHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كشف جرد المخزون - ${settings.storeName || 'المتجر'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              direction: rtl;
              font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif;
            }
            .print-page {
              page-break-after: always;
              page-break-inside: avoid;
              width: 100%;
              display: flex;
              justify-content: center;
              padding: 10mm 12mm;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                padding: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          ${fullPagesHtml}
        </body>
        </html>
      `;

      let printIframe = document.getElementById('inventory-print-frame') as HTMLIFrameElement;
      if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'inventory-print-frame';
        printIframe.style.position = 'fixed';
        printIframe.style.top = '-9999px';
        printIframe.style.left = '-9999px';
        printIframe.style.width = '1024px';
        printIframe.style.height = '1024px';
        printIframe.style.border = 'none';
        document.body.appendChild(printIframe);
      }

      const doc = printIframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();

        setTimeout(() => {
          try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
          } catch (e) {
            console.error('Print iframe error, opening in new tab:', e);
            handleOpenInNewTab();
          } finally {
            setIsPrintingDirect(false);
          }
        }, 500);
      } else {
        handleOpenInNewTab();
        setIsPrintingDirect(false);
      }
    } catch (err) {
      console.error('Print error:', err);
      handleOpenInNewTab();
      setIsPrintingDirect(false);
    }
  };

  // 3. Open Standalone Tab for direct preview/print
  const handleOpenInNewTab = () => {
    try {
      let fullPagesHtml = '';
      pageChunks.forEach((items, idx) => {
        const startIdx = idx * ITEMS_PER_PAGE;
        fullPagesHtml += `
          <div class="page-wrapper">
            ${renderSinglePageHtml(items, idx + 1, totalPages, startIdx)}
          </div>
        `;
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كشف جرد المخزون - ${settings.storeName || 'المتجر'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 70px 10px 40px;
              background: #f1f5f9;
              direction: rtl;
              font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif;
            }
            .floating-header {
              position: fixed;
              top: 12px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 9999;
              display: flex;
              gap: 12px;
              background: #0f172a;
              color: #ffffff;
              padding: 10px 24px;
              border-radius: 999px;
              box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
              align-items: center;
            }
            .floating-header button {
              background: #2563eb;
              color: #ffffff;
              border: none;
              padding: 8px 20px;
              border-radius: 999px;
              font-weight: bold;
              font-size: 13px;
              cursor: pointer;
            }
            .page-wrapper {
              width: 794px;
              margin: 0 auto 30px;
              background: #ffffff;
              box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            @media print {
              body {
                padding: 0 !important;
                background: #ffffff !important;
              }
              .no-print {
                display: none !important;
              }
              .page-wrapper {
                box-shadow: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
                page-break-after: always;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="floating-header no-print">
            <span style="font-weight: bold; font-size: 13px;">كشف الجرد (${filteredProducts.length} منتج - ${totalPages} صفحة)</span>
            <button onclick="window.print()">🖨️ طباعة الآن</button>
          </div>
          ${fullPagesHtml}
        </body>
        </html>
      `;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      showToast('تم فتح كشف الجرد في صفحة مستقلة', 'success');
    } catch (e) {
      console.error(e);
      showToast('تعذر فتح الصفحة المنبثقة', 'error');
    }
  };

  // 4. Excel (XLSX) Export Handler
  const handleExportExcel = () => {
    try {
      const wsData: any[][] = [];

      wsData.push([settings.storeName || 'المحل التجاري']);
      wsData.push(['كشف جرد المخزون الفعلي (اليدوي)']);
      wsData.push([
        `التاريخ: ${currentDateStr}`,
        `عدد المنتجات: ${filteredProducts.length}`,
        `القسم: ${selectedCategory === 'all' ? 'جميع الأقسام' : selectedCategory}`
      ]);
      wsData.push([]);

      const headers = ['#', 'اسم المنتج', 'الباركود', 'القسم'];
      if (showSystemQuantity) headers.push('الكمية الحالية بالسيستم');
      headers.push('الكمية الفعلية (جرد يدوي)');
      headers.push('ملاحظات');
      wsData.push(headers);

      filteredProducts.forEach((p, idx) => {
        const row: any[] = [
          idx + 1,
          p.name || '',
          p.barcode ? String(p.barcode) : '',
          p.category || 'عام'
        ];
        if (showSystemQuantity) row.push(p.quantity ?? 0);
        row.push('');
        row.push('');
        wsData.push(row);
      });

      const ws = xlsx.utils.aoa_to_sheet(wsData);
      ws['!dir'] = 'rtl';

      ws['!cols'] = [
        { wch: 6 },
        { wch: 38 },
        { wch: 20 },
        { wch: 18 },
        ...(showSystemQuantity ? [{ wch: 22 }] : []),
        { wch: 26 },
        { wch: 26 }
      ];

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "كشف الجرد");

      const catSanitized = (selectedCategory === 'all' ? 'الكل' : selectedCategory).replace(/\s+/g, '_');
      xlsx.writeFile(wb, `كشف_جرد_${catSanitized}_${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast('تم تصدير كشف Excel بنجاح', 'success');
    } catch (error) {
      console.error('Excel export error:', error);
      showToast('حدث خطأ أثناء تصدير ملف Excel', 'error');
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
        
        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>استخراج كشف جرد المخزون الورقي (PDF)</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    {filteredProducts.length} منتج • {totalPages} صفحة
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  توليد وتحميل ملف PDF فوري يحتوي على كافة الصفحات والجداول بدقة ووضوح تام
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* PRIMARY ACTION: Download PDF directly */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExportingPDF || isPrintingDirect}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-brand-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>جاري توليد PDF ({pdfProgress.current} من {pdfProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>تحميل ملف PDF ({totalPages} صفحة)</span>
                  </>
                )}
              </button>

              {/* Direct Print Button */}
              <button
                type="button"
                onClick={handleDirectPrint}
                disabled={isExportingPDF || isPrintingDirect}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 border border-zinc-200 dark:border-zinc-700"
              >
                {isPrintingDirect ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Printer size={16} className="text-zinc-600 dark:text-zinc-300" />
                )}
                <span>طباعة فورية</span>
              </button>

              {/* Excel Export Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingPDF || isPrintingDirect}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold transition-all border border-zinc-200 dark:border-zinc-700"
                title="تصدير كجدول Excel"
              >
                <FileSpreadsheet size={15} />
                <span>Excel</span>
              </button>
            </div>

            {/* Standalone Tab Link */}
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              <ExternalLink size={15} />
              <span>فتح في صفحة مستقلة</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 grid grid-cols-1 sm:grid-cols-12 gap-2.5 shrink-0 text-xs font-bold relative z-20">
            {/* Category Dropdown */}
            <div className="sm:col-span-4 relative" ref={categoryRef}>
              <label className="block text-zinc-500 mb-1">القسم / التصنيف:</label>
              <button
                type="button"
                onClick={() => {
                  setCategoryDropdownOpen(!categoryDropdownOpen);
                  setSortDropdownOpen(false);
                }}
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-between outline-none cursor-pointer border border-zinc-200 dark:border-zinc-700 shadow-sm focus:border-brand-500"
              >
                <span className="truncate">
                  {selectedCategory === 'all'
                    ? `كل الأقسام (${products.length} منتج)`
                    : selectedCategory}
                </span>
                <ChevronDown size={16} className={cn("transition-transform duration-200 text-zinc-400 shrink-0 mr-1", categoryDropdownOpen && "rotate-180")} />
              </button>

              {categoryDropdownOpen && (
                <div className="absolute top-full right-0 left-0 mt-1 z-50 max-h-56 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setCategoryDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-right px-3 py-2 text-xs font-bold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 truncate cursor-pointer",
                      selectedCategory === 'all' ? "text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/10" : "text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    كل الأقسام ({products.length} منتج)
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id || c.name}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.name);
                        setCategoryDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-right px-3 py-2 text-xs font-bold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 truncate cursor-pointer",
                        selectedCategory === c.name ? "text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/10" : "text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="sm:col-span-4 relative" ref={sortRef}>
              <label className="block text-zinc-500 mb-1">الترتيب:</label>
              <button
                type="button"
                onClick={() => {
                  setSortDropdownOpen(!sortDropdownOpen);
                  setCategoryDropdownOpen(false);
                }}
                className="w-full h-10 px-3 rounded-xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-between outline-none cursor-pointer border border-zinc-200 dark:border-zinc-700 shadow-sm focus:border-brand-500"
              >
                <span className="truncate">
                  {sortBy === 'category' && 'حسب القسم ثم اسم المنتج'}
                  {sortBy === 'name' && 'حسب اسم المنتج أبجدياً'}
                  {sortBy === 'barcode' && 'حسب رقم الباركود'}
                </span>
                <ChevronDown size={16} className={cn("transition-transform duration-200 text-zinc-400 shrink-0 mr-1", sortDropdownOpen && "rotate-180")} />
              </button>

              {sortDropdownOpen && (
                <div className="absolute top-full right-0 left-0 mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1">
                  {[
                    { value: 'category', label: 'حسب القسم ثم اسم المنتج' },
                    { value: 'name', label: 'حسب اسم المنتج أبجدياً' },
                    { value: 'barcode', label: 'حسب رقم الباركود' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value as any);
                        setSortDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-right px-3 py-2 text-xs font-bold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 truncate cursor-pointer",
                        sortBy === opt.value ? "text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/10" : "text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Blind Inventory Toggle */}
            <div className="sm:col-span-4 flex items-end">
              <button
                type="button"
                onClick={() => setShowSystemQuantity(!showSystemQuantity)}
                className={`w-full h-10 px-3 rounded-xl flex items-center justify-center gap-2 border shadow-sm transition-all cursor-pointer ${
                  showSystemQuantity 
                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/40 dark:border-brand-800 dark:text-brand-300' 
                    : 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                {showSystemQuantity ? <Eye size={16} /> : <EyeOff size={16} />}
                <span className="truncate">{showSystemQuantity ? 'إظهار كمية النظام' : 'جرد أعمى (إخفاء السيستم)'}</span>
              </button>
            </div>
          </div>

          {/* Quick Search & Summary Tip */}
          <div className="px-4 py-2 bg-zinc-100/60 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input
                type="text"
                placeholder="تصفية سريعة بالاسم أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pr-8 pl-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:border-brand-500 text-zinc-900 dark:text-zinc-100"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              <span>إجمالي الصفحات: <strong className="text-zinc-900 dark:text-white">{totalPages} صفحة A4</strong></span>
              <span>•</span>
              <span>عدد المنتجات: <strong className="text-brand-600 dark:text-brand-400">{filteredProducts.length}</strong></span>
            </div>
          </div>

          {/* Printable Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-100 dark:bg-zinc-950">
            <div 
              id="printable-inventory-sheet" 
              className="bg-white text-zinc-900 p-6 sm:p-8 rounded-xl shadow-lg border border-zinc-200 mx-auto max-w-3xl"
              dir="rtl"
            >
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-zinc-900 mb-1">{settings.storeName || 'المحل التجاري'}</h1>
                  <h2 className="text-sm sm:text-base font-bold text-zinc-700 flex items-center gap-2">
                    <FileText size={18} />
                    كشف جرد المخزون الفعلي (اليدوي)
                  </h2>
                </div>
                <div className="text-left text-xs font-semibold text-zinc-600 space-y-1">
                  <p>التاريخ: <span className="font-bold text-zinc-900">{currentDateStr}</span></p>
                  <p>عدد المنتجات: <span className="font-bold text-zinc-900">{filteredProducts.length}</span></p>
                  <p>القسم المحدد: <span className="font-bold text-zinc-900">{selectedCategory === 'all' ? 'جميع الأقسام' : selectedCategory}</span></p>
                  <p>الصفحات: <span className="font-bold text-brand-600">{totalPages} صفحة A4</span></p>
                </div>
              </div>

              {/* Products Table (Preview of page 1) */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-900 font-bold border-b-2 border-zinc-400">
                      <th className="py-2 px-2 text-center w-10 border border-zinc-400 font-black">#</th>
                      <th className="py-2 px-3 border border-zinc-400 font-black">اسم المنتج</th>
                      <th className="py-2 px-2 border border-zinc-400 w-28 font-black">الباركود</th>
                      <th className="py-2 px-2 border border-zinc-400 w-24 font-black">القسم</th>
                      {showSystemQuantity && (
                        <th className="py-2 px-2 text-center border border-zinc-400 w-20 font-black">السيستم</th>
                      )}
                      <th className="py-2 px-2 text-center border border-zinc-400 w-28 bg-yellow-100 font-black text-zinc-900">الكمية الفعلية (باليد)</th>
                      <th className="py-2 px-2 border border-zinc-400 w-28 font-black">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-300">
                    {filteredProducts.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-zinc-50">
                        <td className="py-2 px-2 text-center font-bold text-zinc-600 border border-zinc-300 bg-zinc-50">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-zinc-900 border border-zinc-300">{p.name}</td>
                        <td className="py-2 px-2 font-mono text-[11px] text-zinc-700 border border-zinc-300 dir-ltr text-right">{p.barcode || '-'}</td>
                        <td className="py-2 px-2 text-zinc-600 border border-zinc-300">{p.category || '-'}</td>
                        {showSystemQuantity && (
                          <td className="py-2 px-2 text-center font-bold text-zinc-900 border border-zinc-300 bg-zinc-50/50">{p.quantity ?? 0}</td>
                        )}
                        <td className="py-2 px-2 border border-zinc-300 bg-yellow-50/40">
                          <div className="h-6 w-full"></div>
                        </td>
                        <td className="py-2 px-2 border border-zinc-300">
                          <div className="h-6 w-full"></div>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={showSystemQuantity ? 7 : 6} className="text-center py-10 text-zinc-400 font-bold">
                          لا توجد منتجات مطابقة لخيارات البحث المحددة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sheet Footer */}
              <div className="mt-8 pt-4 border-t-2 border-zinc-300 flex justify-between items-center text-xs font-bold text-zinc-700">
                <div>
                  <span>اسم الشخص المكلف بالجرد: ________________________</span>
                </div>
                <div>
                  <span>التوقيع: ________________________</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
