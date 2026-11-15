import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, X, Upload, TrendingUp, TrendingDown, Minus, Filter, Search, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as xlsx from 'xlsx';
import { formatCurrency, cn } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

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
        <div
          className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
          style={{ backgroundColor: theme.bg, color: theme.text }}
          dir="rtl"
        >
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="flex flex-col w-full h-full"
          >
            {/* Header */}
            <div
              className="px-4 py-3 sm:px-6 sm:py-4 border-b flex justify-between items-center z-10 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                  style={{
                    color: theme.accent,
                    borderColor: `${theme.accent}45`,
                    backgroundColor: `${theme.accent}12`
                  }}
                >
                  01
                </span>
                <div className="min-w-0">
                  <h3 className="font-black text-base sm:text-lg truncate" style={{ color: theme.text }}>
                    مقارنة الجرد الذكية
                  </h3>
                  <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                    مقارنة المبيعات، الأرباح، والكميات بين جردين
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 border transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {!comparisonResult ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center max-w-lg mx-auto">
                  {!file1Items ? (
                    <>
                      <div
                        className="w-16 h-16 border flex items-center justify-center mb-5"
                        style={{
                          backgroundColor: `${theme.accent}12`,
                          borderColor: `${theme.accent}45`,
                          color: theme.accent
                        }}
                      >
                        <Upload size={28} />
                      </div>
                      <h4 className="text-lg font-black mb-2" style={{ color: theme.text }}>
                        استيراد الجرد 1 (القديم)
                      </h4>
                      <p className="text-xs sm:text-sm mb-6 max-w-sm" style={{ color: theme.textMuted }}>
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
                          className="px-7 py-3 font-bold text-xs sm:text-sm flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                          style={{ backgroundColor: theme.accent, color: theme.accentText }}
                        >
                          {comparing ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                          ) : (
                            <FileSpreadsheet size={18} />
                          )}
                          <span>اختيار ملف Excel الأول</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-7 w-full">
                        <div
                          className="flex-1 border p-3 flex flex-col items-center justify-center relative overflow-hidden"
                          style={{
                            backgroundColor: `${theme.positive}10`,
                            borderColor: `${theme.positive}45`
                          }}
                        >
                          <div
                            className="absolute top-0 right-0 w-7 h-7 flex items-center justify-center"
                            style={{ backgroundColor: `${theme.positive}20`, color: theme.positive }}
                          >
                            <CheckCircle2 size={15} />
                          </div>
                          <FileSpreadsheet size={22} className="mb-1.5 opacity-70" style={{ color: theme.positive }} />
                          <span className="text-xs sm:text-sm font-bold truncate w-full text-center px-3" title={file1Name} style={{ color: theme.text }}>
                            {file1Name}
                          </span>
                          <span className="text-[10px] mt-1" style={{ color: theme.textMuted }}>الجرد 1 (تم الرفع)</span>
                        </div>
                        <div style={{ color: theme.textMuted }}>
                          <Minus size={20} />
                        </div>
                        <div
                          className="flex-1 border border-dashed p-3 flex flex-col items-center justify-center"
                          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                        >
                          <Upload size={22} className="mb-1.5" style={{ color: theme.textMuted }} />
                          <span className="text-xs sm:text-sm font-bold" style={{ color: theme.textMuted }}>جاري الانتظار...</span>
                          <span className="text-[10px] mt-1" style={{ color: theme.textMuted }}>الجرد 2</span>
                        </div>
                      </div>

                      <h4 className="text-lg font-black mb-2" style={{ color: theme.text }}>
                        استيراد الجرد 2 (الحديث)
                      </h4>
                      <p className="text-xs sm:text-sm mb-6 max-w-sm" style={{ color: theme.textMuted }}>
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
                          className="px-7 py-3 font-bold text-xs sm:text-sm flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                          style={{ backgroundColor: theme.accent, color: theme.accentText }}
                        >
                          {comparing ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                          ) : (
                            <FileSpreadsheet size={18} />
                          )}
                          <span>اختيار ملف Excel الثاني</span>
                        </button>
                      </div>
                      
                      <button 
                        onClick={resetState}
                        className="mt-5 text-xs font-bold underline cursor-pointer"
                        style={{ color: theme.textMuted }}
                      >
                        إلغاء والبدء من جديد
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col h-full gap-4 pb-10">
                  
                  {/* Overall Summary Strip */}
                  {overallSummary && (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 border divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                    >
                      {/* Profit Summary */}
                      <div className="p-4 flex items-center justify-between" style={{ borderColor: theme.border }}>
                        <div>
                          <div className="text-[11px] font-bold mb-1" style={{ color: theme.textMuted }}>
                            الفرق الإجمالي في الأرباح
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="font-mono font-black text-base sm:text-lg tabular-nums"
                              style={{
                                color: overallSummary.profitDiff > 0
                                  ? theme.positive
                                  : overallSummary.profitDiff < 0
                                  ? theme.negative
                                  : theme.accent
                              }}
                              dir="ltr"
                            >
                              {overallSummary.profitDiff > 0 ? '+' : ''}
                              {formatCurrency(overallSummary.profitDiff, settings.currency, settings.language)}
                            </div>
                            {overallSummary.profitDiff !== 0 && (
                              <span
                                className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 border"
                                style={{
                                  color: overallSummary.profitDiff > 0 ? theme.positive : theme.negative,
                                  borderColor: overallSummary.profitDiff > 0 ? `${theme.positive}45` : `${theme.negative}45`,
                                  backgroundColor: overallSummary.profitDiff > 0 ? `${theme.positive}12` : `${theme.negative}12`
                                }}
                                dir="ltr"
                              >
                                {overallSummary.profitDiff > 0 ? '+' : ''}{overallSummary.profitDiffPct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className="w-9 h-9 border flex items-center justify-center shrink-0"
                          style={{
                            borderColor: theme.border,
                            backgroundColor: theme.surfaceMuted,
                            color: overallSummary.profitDiff > 0
                              ? theme.positive
                              : overallSummary.profitDiff < 0
                              ? theme.negative
                              : theme.accent
                          }}
                        >
                          {overallSummary.profitDiff > 0 ? <TrendingUp size={18} /> : overallSummary.profitDiff < 0 ? <TrendingDown size={18} /> : <Minus size={18} />}
                        </div>
                      </div>

                      {/* Capital Summary */}
                      <div className="p-4 flex items-center justify-between" style={{ borderColor: theme.border }}>
                        <div>
                          <div className="text-[11px] font-bold mb-1" style={{ color: theme.textMuted }}>
                            الفرق الإجمالي في رأس المال (القيمة المتبقية)
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="font-mono font-black text-base sm:text-lg tabular-nums"
                              style={{
                                color: overallSummary.capitalDiff > 0
                                  ? theme.positive
                                  : overallSummary.capitalDiff < 0
                                  ? theme.negative
                                  : theme.accent
                              }}
                              dir="ltr"
                            >
                              {overallSummary.capitalDiff > 0 ? '+' : ''}
                              {formatCurrency(overallSummary.capitalDiff, settings.currency, settings.language)}
                            </div>
                            {overallSummary.capitalDiff !== 0 && (
                              <span
                                className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 border"
                                style={{
                                  color: overallSummary.capitalDiff > 0 ? theme.positive : theme.negative,
                                  borderColor: overallSummary.capitalDiff > 0 ? `${theme.positive}45` : `${theme.negative}45`,
                                  backgroundColor: overallSummary.capitalDiff > 0 ? `${theme.positive}12` : `${theme.negative}12`
                                }}
                                dir="ltr"
                              >
                                {overallSummary.capitalDiff > 0 ? '+' : ''}{overallSummary.capitalDiffPct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className="w-9 h-9 border flex items-center justify-center shrink-0"
                          style={{
                            borderColor: theme.border,
                            backgroundColor: theme.surfaceMuted,
                            color: overallSummary.capitalDiff > 0
                              ? theme.positive
                              : overallSummary.capitalDiff < 0
                              ? theme.negative
                              : theme.accent
                          }}
                        >
                          {overallSummary.capitalDiff > 0 ? <TrendingUp size={18} /> : overallSummary.capitalDiff < 0 ? <TrendingDown size={18} /> : <Minus size={18} />}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Toolbar */}
                  <div
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 border"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                      <div
                        className="flex items-center gap-1 p-1 border overflow-x-auto w-full sm:w-auto no-scrollbar"
                        style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
                      >
                        {(
                          [
                            { id: 'quantity', label: 'الكمية المتبقية' },
                            { id: 'sold', label: 'المباع' },
                            { id: 'profit', label: 'الربح' },
                            { id: 'capital', label: 'القيمة المتبقية' }
                          ] as const
                        ).map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCompareMode(tab.id)}
                            className="px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                            style={
                              compareMode === tab.id
                                ? { backgroundColor: theme.accent, color: theme.accentText }
                                : { backgroundColor: 'transparent', color: theme.textMuted }
                            }
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      
                      <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none" style={{ color: theme.textMuted }}>
                          <Search size={15} />
                        </div>
                        <input
                          title="Search query"
                          type="text"
                          placeholder="بحث باسم المنتج أو الباركود..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full border py-2 pl-3 pr-9 outline-none transition-colors text-xs sm:text-sm"
                          style={{
                            backgroundColor: theme.bg,
                            borderColor: theme.border,
                            color: theme.text
                          }}
                        />
                      </div>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={resetState}
                      className="text-xs font-bold px-3 py-1.5 border whitespace-nowrap self-end sm:self-auto shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.accent
                      }}
                    >
                      مقارنة ملفات أخرى
                    </button>
                  </div>
                  
                  {/* Table */}
                  <div
                    className="border overflow-hidden flex-1 flex flex-col min-h-[420px]"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <div className="overflow-x-auto overflow-y-auto flex-1">
                      <table className="w-full text-xs sm:text-sm text-right relative">
                        <thead
                          className="sticky top-0 border-b z-10 whitespace-nowrap"
                          style={{
                            backgroundColor: theme.surfaceMuted,
                            borderColor: theme.border,
                            color: theme.textMuted
                          }}
                        >
                          <tr>
                            <th className="py-3 px-3 sm:px-4 font-bold text-right">المنتج</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الجرد 1</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الجرد 2</th>
                            <th className="py-3 px-2 sm:px-4 text-center font-bold">الفرق</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: theme.border }}>
                          {(() => {
                            let filteredResult = [...comparisonResult];
                            
                            if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              filteredResult = filteredResult.filter(item => 
                                (item.name || "").toLowerCase().includes(q) || 
                                (item.barcode || "").toLowerCase().includes(q)
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
                                  <td colSpan={4} className="py-8 text-center" style={{ color: theme.textMuted }}>
                                    لا توجد منتجات مطابقة للبحث
                                  </td>
                                </tr>
                              );
                            }

                            return sortedResult.map((item: any, idx: number) => {
                              const { oldVal, newVal, diff, format, isNew, pct } = renderMetric(item);
                              const isDeleted = item.deleted;
                              const diffColor = diff > 0 ? theme.positive : diff < 0 ? theme.negative : theme.textMuted;
                              
                              return (
                                <tr
                                  key={idx}
                                  className={cn("transition-colors", isDeleted && "opacity-60")}
                                  style={{ borderColor: theme.border }}
                                >
                                  <td className="py-3 px-3 sm:px-4">
                                    <div className="font-bold" style={{ color: theme.text }}>{item.name}</div>
                                    <div className="text-[10px] mt-1 flex flex-wrap gap-1">
                                      {isNew && (
                                        <span
                                          className="px-1.5 py-0.5 border font-bold"
                                          style={{
                                            color: theme.accent,
                                            borderColor: `${theme.accent}40`,
                                            backgroundColor: `${theme.accent}10`
                                          }}
                                        >
                                          منتج جديد
                                        </span>
                                      )}
                                      {isDeleted && (
                                        <span
                                          className="px-1.5 py-0.5 border font-bold"
                                          style={{
                                            color: theme.negative,
                                            borderColor: `${theme.negative}40`,
                                            backgroundColor: `${theme.negative}10`
                                          }}
                                        >
                                          غير متوفر حالياً
                                        </span>
                                      )}
                                      {compareMode === 'capital' && item.newQty > 0 && item.newSold === 0 && (
                                        <span
                                          className="px-1.5 py-0.5 border font-bold"
                                          style={{
                                            color: theme.neutral,
                                            borderColor: `${theme.neutral}40`,
                                            backgroundColor: `${theme.neutral}10`
                                          }}
                                        >
                                          منتج راكد
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 sm:px-4 text-center font-mono tabular-nums font-medium" style={{ color: theme.textMuted }}>
                                    {isNew ? '—' : format(oldVal)}
                                  </td>
                                  <td className="py-3 px-2 sm:px-4 text-center font-mono tabular-nums font-bold" style={{ color: theme.text }}>
                                    {format(newVal)}
                                  </td>
                                  <td className="py-3 px-2 sm:px-4">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <div
                                        className="flex items-center justify-center gap-1 font-mono font-bold tabular-nums border py-1 px-2 mx-auto w-fit whitespace-nowrap"
                                        style={{
                                          color: diffColor,
                                          borderColor: diff === 0 ? theme.border : `${diffColor}45`,
                                          backgroundColor: diff === 0 ? theme.surfaceMuted : `${diffColor}12`
                                        }}
                                      >
                                        {diff > 0 ? <TrendingUp size={13} /> : diff < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                                        <span dir="ltr">{diff > 0 ? '+' : ''}{format(diff)}</span>
                                      </div>
                                      {diff !== 0 && !isNew && !isDeleted && pct !== undefined && (
                                        <span
                                          className="text-[10px] font-mono font-bold tabular-nums"
                                          style={{ color: diffColor }}
                                          dir="ltr"
                                        >
                                          {diff > 0 ? '+' : ''}{pct.toFixed(1)}%
                                        </span>
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
                        <div className="p-8 text-center" style={{ color: theme.textMuted }}>
                          لم يتم العثور على منتجات للمقارنة
                        </div>
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
};
