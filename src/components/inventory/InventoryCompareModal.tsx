import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, X, Upload, TrendingUp, TrendingDown, Minus, Filter, Search, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as xlsx from 'xlsx';
import { formatCurrency, cn } from '../../lib/utils';
import { useAppContext } from '../../AppContext';

interface InventoryCompareModalProps {
  show: boolean;
  onClose: () => void;
  currentReportItems?: any[];
  products?: any[];
}

type CompareMode = 'quantity' | 'sold' | 'profit' | 'capital';

export const InventoryCompareModal: React.FC<InventoryCompareModalProps> = ({ show, onClose, products = [] }) => {
  const { t } = useTranslation();
  const { settings, showToast } = useAppContext();

  const calculateCapital = (item: any, qty: number) => {
    let cost = 0;
    if (products && products.length > 0) {
      const p = products.find((prod: any) => 
        (item.barcode && prod.barcode === item.barcode) || 
        (prod.name === item.name)
      );
      if (p) {
        cost = p.purchasePrice || p.costPrice || 0;
      }
    }
    return qty * cost;
  };
  
  const [file1Items, setFile1Items] = useState<any[] | null>(null);
  const [file1Name, setFile1Name] = useState('');
  
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>('sold');
  const [searchQuery, setSearchQuery] = useState('');

  const parseNum = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const extractItemsFromExcel = (excelRows: any[][]): any[] | null => {
    let headerRowIndex = -1;
    let barcodeColIndex = -1;
    let qtyColIndex = -1;
    let soldColIndex = -1;
    let profitColIndex = -1;
    let nameColIndex = -1;
    let capitalColIndex = -1;

    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      if (!row || !Array.isArray(row)) continue;
      
      const stringRow = row.map(cell => String(cell || '').trim().toLowerCase());
      
      const bCodeIndex = stringRow.findIndex(cell => cell.includes('باركود') || cell.includes('barcode'));
      const pNameIndex = stringRow.findIndex(cell => cell.includes('منتج') || cell.includes('product') || cell.includes('name') || cell.includes('الاسم'));
      const qIndex = stringRow.findIndex(cell => (cell.includes('متبقي') && cell.includes('كمية')) || cell.includes('quantity') || cell.includes('remaining_qty') || cell.includes('المخزون') || cell === 'الكمية' || cell === 'كمية');
      const sIndex = stringRow.findIndex(cell => cell.includes('مباع') || cell.includes('sold') || cell.includes('المباع'));
      const prIndex = stringRow.findIndex(cell => cell.includes('ربح') || cell.includes('profit') || cell.includes('الربح'));
      const cIndex = stringRow.findIndex(cell => (cell.includes('متبقي') && cell.includes('قيمة')) || cell.includes('value') || cell.includes('remaining_value'));
      
      if (pNameIndex !== -1 && (bCodeIndex !== -1 || qIndex !== -1 || sIndex !== -1)) {
        headerRowIndex = i;
        barcodeColIndex = bCodeIndex;
        qtyColIndex = qIndex !== -1 ? qIndex : stringRow.findIndex(cell => cell.includes('متبقي') || cell.includes('كمية') || cell.includes('quantity') || cell.includes('remaining_qty') || cell.includes('المخزون')); // fallback
        soldColIndex = sIndex;
        profitColIndex = prIndex;
        nameColIndex = pNameIndex;
        capitalColIndex = cIndex;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return null;
    }

    const items: any[] = [];
    
    for (let i = headerRowIndex + 1; i < excelRows.length; i++) {
      const row = excelRows[i];
      if (!row || row.length === 0) continue;
      
      const barcode = barcodeColIndex !== -1 ? String(row[barcodeColIndex] || '').trim() : '';
      const name = nameColIndex !== -1 ? String(row[nameColIndex] || '').trim() : '';
      const qty = parseNum(qtyColIndex !== -1 ? row[qtyColIndex] : 0);
      const sold = parseNum(soldColIndex !== -1 ? row[soldColIndex] : 0);
      const profit = parseNum(profitColIndex !== -1 ? row[profitColIndex] : 0);
      const capital = parseNum(capitalColIndex !== -1 ? row[capitalColIndex] : null);
      
      if (!name && !barcode) continue;
      
      const existing = items.find(o => (barcode && o.barcode === barcode) || (name && o.name === name));
      if (existing) {
        existing.qty += qty;
        existing.sold += sold;
        existing.profit += profit;
        if (capital !== null) existing.capital = (existing.capital || 0) + capital;
      } else {
        items.push({ barcode, name: name || 'منتج غير معروف', qty, sold, profit, capital, matched: false });
      }
    }
    
    return items;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileNumber: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setComparing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const extractedItems = extractItemsFromExcel(data);
        
        if (!extractedItems) {
          showToast('لم يتم العثور على أعمدة البيانات المطلوبة في الملف', 'error');
          setComparing(false);
          return;
        }

        if (fileNumber === 1) {
          setFile1Items(extractedItems);
          setFile1Name(file.name);
          setComparing(false);
        } else {
          processComparison(file1Items!, extractedItems);
        }
        
      } catch (err) {
        console.error(err);
        showToast('خطأ في قراءة ملف Excel', 'error');
        setComparing(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const processComparison = (oldItems: any[], newItems: any[]) => {
    try {
      const comparisonList = [];
      const oldItemsCopy = JSON.parse(JSON.stringify(oldItems)); // Clone to track matched
      
      // Match current against old
      for (const currData of newItems) {
        let oldData = oldItemsCopy.find((o: any) => !o.matched && o.barcode && currData.barcode && o.barcode === currData.barcode);
        if (!oldData) {
          oldData = oldItemsCopy.find((o: any) => !o.matched && o.name === currData.name);
        }
        
        if (oldData) {
          oldData.matched = true;
        }
        
        const oldCap = oldData ? (oldData.capital !== undefined && oldData.capital !== null ? oldData.capital : calculateCapital(oldData, oldData.qty)) : null;
        const newCap = currData.capital !== undefined && currData.capital !== null ? currData.capital : calculateCapital(currData, currData.qty);
        
        comparisonList.push({
          key: currData.barcode || currData.name,
          name: currData.name,
          barcode: currData.barcode,
          
          oldQty: oldData ? oldData.qty : null,
          newQty: currData.qty,
          qtyDiff: oldData ? (currData.qty - oldData.qty) : currData.qty,
          
          oldSold: oldData ? oldData.sold : null,
          newSold: currData.sold,
          soldDiff: oldData ? (currData.sold - oldData.sold) : currData.sold,
          
          oldProfit: oldData ? oldData.profit : null,
          newProfit: currData.profit,
          profitDiff: oldData ? (currData.profit - oldData.profit) : currData.profit,

          oldCapital: oldCap,
          newCapital: newCap,
          capitalDiff: oldCap !== null ? (newCap - oldCap) : newCap
        });
      }
      
      // Add missing from old
      for (const oldData of oldItemsCopy.filter((o: any) => !o.matched)) {
        const oldCap = oldData.capital !== undefined && oldData.capital !== null ? oldData.capital : calculateCapital(oldData, oldData.qty);

        comparisonList.push({
          key: oldData.barcode || oldData.name,
          name: oldData.name,
          barcode: oldData.barcode,
          
          oldQty: oldData.qty,
          newQty: 0,
          qtyDiff: -oldData.qty,
          
          oldSold: oldData.sold,
          newSold: 0,
          soldDiff: -oldData.sold,
          
          oldProfit: oldData.profit,
          newProfit: 0,
          profitDiff: -oldData.profit,
          
          oldCapital: oldCap,
          newCapital: 0,
          capitalDiff: -oldCap,

          deleted: true
        });
      }

      setComparisonResult(comparisonList);
      setComparing(false);
      showToast('تمت المقارنة بنجاح', 'success');
      
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء مقارنة البيانات', 'error');
      setComparing(false);
    }
  };

  const renderMetric = (item: any) => {
    let oldVal = 0, newVal = 0, diff = 0;
    let format = (v: number) => v.toString();

    switch (compareMode) {
      case 'sold':
        oldVal = item.oldSold;
        newVal = item.newSold;
        diff = item.soldDiff;
        break;
      case 'profit':
        oldVal = item.oldProfit;
        newVal = item.newProfit;
        diff = item.profitDiff;
        format = (v) => formatCurrency(v, settings.currency, settings.language);
        break;
      case 'capital':
        oldVal = item.oldCapital;
        newVal = item.newCapital;
        diff = item.capitalDiff;
        format = (v) => formatCurrency(v, settings.currency, settings.language);
        break;
      case 'quantity':
      default:
        oldVal = item.oldQty;
        newVal = item.newQty;
        diff = item.qtyDiff;
        break;
    }

    const isNew = oldVal === null;
    let pct = 0;
    if (oldVal > 0) {
      pct = (diff / oldVal) * 100;
    } else if (diff > 0) {
      pct = 100;
    }
    
    return { oldVal, newVal, diff, format, isNew, pct };
  };

  const resetState = () => {
    setFile1Items(null);
    setFile1Name('');
    setComparisonResult(null);
  };

  const overallSummary = useMemo(() => {
    if (!comparisonResult) return null;
    let totalOldProfit = 0;
    let totalNewProfit = 0;
    let totalOldCapital = 0;
    let totalNewCapital = 0;

    comparisonResult.forEach((item: any) => {
      totalOldProfit += item.oldProfit || 0;
      totalNewProfit += item.newProfit || 0;
      totalOldCapital += item.oldCapital || 0;
      totalNewCapital += item.newCapital || 0;
    });

    const profitDiff = totalNewProfit - totalOldProfit;
    const capitalDiff = totalNewCapital - totalOldCapital;
    
    const profitDiffPct = totalOldProfit > 0 ? (profitDiff / totalOldProfit) * 100 : (profitDiff > 0 ? 100 : 0);
    const capitalDiffPct = totalOldCapital > 0 ? (capitalDiff / totalOldCapital) * 100 : (capitalDiff > 0 ? 100 : 0);

    return {
      totalOldProfit,
      totalNewProfit,
      profitDiff,
      profitDiffPct,
      totalOldCapital,
      totalNewCapital,
      capitalDiff,
      capitalDiffPct
    };
  }, [comparisonResult]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col w-full h-full"
          >
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-white">مقارنة الجرد الذكية</h3>
                  <p className="text-xs text-zinc-500">مقارنة المبيعات، الأرباح، والكميات بين جردين</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!comparisonResult ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  {!file1Items ? (
                    <>
                      <div className="w-20 h-20 bg-brand-50 border border-brand-100 dark:bg-brand-900/20 dark:border-brand-800 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 mb-6 shadow-sm">
                        <Upload size={32} />
                      </div>
                      <h4 className="text-xl font-bold mb-2">استيراد الجرد 1 (القديم)</h4>
                      <p className="text-sm text-zinc-500 mb-8 max-w-sm">
                        قم برفع ملف Excel الخاص بالجرد الأول ليكون نقطة البداية للمقارنة.
                      </p>
                      
                      <div className="relative">
                        <input 
                          title="Upload First File"
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          onChange={(e) => handleFileUpload(e, 1)}
                          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                          disabled={comparing}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                        />
                        <button 
                          disabled={comparing}
                          className="px-8 py-3.5 bg-brand-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {comparing ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                          ) : (
                            <FileSpreadsheet size={20} />
                          )}
                          <span>اختيار ملف Excel الأول</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-4 mb-8 w-full max-w-md mx-auto">
                         <div className="flex-1 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3 flex flex-col items-center justify-center relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-8 h-8 bg-brand-100 dark:bg-brand-800/50 rounded-bl-lg flex items-center justify-center text-brand-600 dark:text-brand-400">
                             <CheckCircle2 size={16} />
                           </div>
                           <FileSpreadsheet size={24} className="text-brand-600 dark:text-brand-400 mb-2 opacity-50" />
                           <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate w-full text-center px-4" title={file1Name}>{file1Name}</span>
                           <span className="text-[10px] text-zinc-500 mt-1">الجرد 1 (تم الرفع)</span>
                         </div>
                         <div className="text-zinc-300 dark:text-zinc-700">
                           <Minus size={24} />
                         </div>
                         <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-3 flex flex-col items-center justify-center">
                           <Upload size={24} className="text-zinc-400 mb-2" />
                           <span className="text-sm font-bold text-zinc-500">جاري الانتظار...</span>
                           <span className="text-[10px] text-zinc-400 mt-1">الجرد 2</span>
                         </div>
                      </div>

                      <h4 className="text-xl font-bold mb-2">استيراد الجرد 2 (الحديث)</h4>
                      <p className="text-sm text-zinc-500 mb-8 max-w-sm">
                        قم برفع ملف Excel الخاص بالجرد الثاني لمقارنته مع الجرد الأول الذي قمت برفعه.
                      </p>
                      
                      <div className="relative">
                        <input 
                          title="Upload Second File"
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          onChange={(e) => handleFileUpload(e, 2)}
                          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                          disabled={comparing}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                        />
                        <button 
                          disabled={comparing}
                          className="px-8 py-3.5 bg-brand-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {comparing ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                          ) : (
                            <FileSpreadsheet size={20} />
                          )}
                          <span>اختيار ملف Excel الثاني</span>
                        </button>
                      </div>
                      
                      <button 
                        onClick={resetState}
                        className="mt-6 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                      >
                        إلغاء والبدء من جديد
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col h-full gap-4 pb-20">
                  
                  {/* Overall Summary Card */}
                  {overallSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                      {/* Profit Summary */}
                      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-brand-600/80 dark:text-brand-400/80 font-bold mb-1">الفرق الإجمالي في الأرباح</div>
                          <div className="flex items-center gap-2">
                            <div className={cn("font-black text-lg", overallSummary.profitDiff > 0 ? "text-emerald-600" : overallSummary.profitDiff < 0 ? "text-red-600" : "text-brand-700 dark:text-brand-300")}>
                              {overallSummary.profitDiff > 0 ? '+' : ''}{formatCurrency(overallSummary.profitDiff, settings.currency, settings.language)}
                            </div>
                            {overallSummary.profitDiff !== 0 && (
                              <div className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md flex items-center", overallSummary.profitDiff > 0 ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-red-100/50 text-red-700 dark:bg-red-500/20 dark:text-red-400")}>
                                {overallSummary.profitDiff > 0 ? '+' : ''}{overallSummary.profitDiffPct.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", overallSummary.profitDiff > 0 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20" : overallSummary.profitDiff < 0 ? "bg-red-100 text-red-600 dark:bg-red-500/20" : "bg-brand-100 text-brand-600 dark:bg-brand-500/20")}>
                          {overallSummary.profitDiff > 0 ? <TrendingUp size={20} /> : overallSummary.profitDiff < 0 ? <TrendingDown size={20} /> : <Minus size={20} />}
                        </div>
                      </div>

                      {/* Capital Summary */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-blue-600/80 dark:text-blue-400/80 font-bold mb-1">الفرق الإجمالي في رأس المال (القيمة المتبقية)</div>
                          <div className="flex items-center gap-2">
                            <div className={cn("font-black text-lg", overallSummary.capitalDiff > 0 ? "text-emerald-600" : overallSummary.capitalDiff < 0 ? "text-red-600" : "text-blue-700 dark:text-blue-300")}>
                              {overallSummary.capitalDiff > 0 ? '+' : ''}{formatCurrency(overallSummary.capitalDiff, settings.currency, settings.language)}
                            </div>
                            {overallSummary.capitalDiff !== 0 && (
                              <div className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md flex items-center", overallSummary.capitalDiff > 0 ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-red-100/50 text-red-700 dark:bg-red-500/20 dark:text-red-400")}>
                                {overallSummary.capitalDiff > 0 ? '+' : ''}{overallSummary.capitalDiffPct.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", overallSummary.capitalDiff > 0 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20" : overallSummary.capitalDiff < 0 ? "bg-red-100 text-red-600 dark:bg-red-500/20" : "bg-blue-100 text-blue-600 dark:bg-blue-500/20")}>
                          {overallSummary.capitalDiff > 0 ? <TrendingUp size={20} /> : overallSummary.capitalDiff < 0 ? <TrendingDown size={20} /> : <Minus size={20} />}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-1 sm:gap-2 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-x-auto w-full no-scrollbar">
                        <button 
                          onClick={() => setCompareMode('quantity')}
                          className={cn("px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'quantity' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          الكمية المتبقية
                        </button>
                        <button 
                          onClick={() => setCompareMode('sold')}
                          className={cn("px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'sold' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          المباع
                        </button>
                        <button 
                          onClick={() => setCompareMode('profit')}
                          className={cn("px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'profit' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          الربح
                        </button>
                        <button 
                          onClick={() => setCompareMode('capital')}
                          className={cn("px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'capital' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          القيمة المتبقية
                        </button>
                      </div>
                      
                      <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-400">
                          <Search size={16} />
                        </div>
                        <input
                          title="Search query"
                          type="text"
                          placeholder="بحث باسم المنتج أو الباركود..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg py-2 pl-3 pr-10 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all text-sm"
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={resetState}
                      className="text-xs font-bold text-brand-600 hover:underline px-2 py-1 whitespace-nowrap self-end sm:self-auto shrink-0"
                    >
                      مقارنة ملفات أخرى
                    </button>
                  </div>
                  
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-[500px]">
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                      <table className="w-full text-xs sm:text-sm text-right relative">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 sticky top-0 border-b border-zinc-200 dark:border-zinc-700 z-10 whitespace-nowrap shadow-sm">
                          <tr>
                            <th className="py-3 px-2 sm:px-4 font-bold text-right">المنتج</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الجرد 1</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الجرد 2</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الفرق</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {(() => {
                            let filteredResult = [...comparisonResult];
                            
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              filteredResult = filteredResult.filter(item => 
                                item.name?.toLowerCase().includes(q) || 
                                item.barcode?.toLowerCase().includes(q)
                              );
                            }

                            const sortedResult = filteredResult.sort((a, b) => {
                              if (compareMode === 'sold') {
                                return b.soldDiff - a.soldDiff || b.newSold - a.newSold;
                              } else if (compareMode === 'profit') {
                                return b.profitDiff - a.profitDiff || b.newProfit - a.newProfit;
                              } else if (compareMode === 'capital') {
                                return b.capitalDiff - a.capitalDiff || b.newCapital - a.newCapital;
                              } else {
                                return a.newQty - b.newQty || a.qtyDiff - b.qtyDiff;
                              }
                            });

                            if (sortedResult.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-zinc-500">
                                    لا توجد منتجات مطابقة للبحث
                                  </td>
                                </tr>
                              );
                            }

                            return sortedResult.map((item: any, idx: number) => {
                              const { oldVal, newVal, diff, format, isNew, pct } = renderMetric(item);
                            const isDeleted = item.deleted;
                            
                            return (
                              <tr key={idx} className={cn("hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors", isDeleted && "opacity-60")}>
                                <td className="py-3 px-2 sm:px-4">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                  <div className="text-[10px] text-zinc-400 mt-1 flex flex-wrap gap-1">
                                    {isNew && <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">منتج جديد</span>}
                                    {isDeleted && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">غير متوفر حالياً</span>}
                                    {compareMode === 'capital' && item.newQty > 0 && item.newSold === 0 && <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">منتج راكد</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-2 sm:px-4 text-center font-medium text-zinc-500">
                                  {isNew ? '—' : format(oldVal)}
                                </td>
                                <td className="py-3 px-2 sm:px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                                  {format(newVal)}
                                </td>
                                <td className="py-3 px-2 sm:px-4">
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <div className={cn(
                                      "flex items-center justify-center gap-1 font-bold rounded-lg py-1 px-2 mx-auto w-fit whitespace-nowrap",
                                      diff > 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" : 
                                      diff < 0 ? "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10" : 
                                      "text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800"
                                    )}>
                                      {diff > 0 ? <TrendingUp size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                                      <span dir="ltr">{diff > 0 ? '+' : ''}{format(diff)}</span>
                                    </div>
                                    {diff !== 0 && !isNew && !isDeleted && pct !== undefined && (
                                      <div className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center",
                                        diff > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10"
                                      )}>
                                        <span dir="ltr">{diff > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                        </tbody>
                      </table>
                      
                      {comparisonResult.length === 0 && (
                        <div className="p-8 text-center text-zinc-500">لم يتم العثور على منتجات للمقارنة</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
