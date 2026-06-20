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

type CompareMode = 'quantity' | 'sold' | 'profit';

export const InventoryCompareModal: React.FC<InventoryCompareModalProps> = ({ show, onClose }) => {
  const { t } = useTranslation();
  const { settings, showToast } = useAppContext();
  
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

    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      if (!row || !Array.isArray(row)) continue;
      
      const stringRow = row.map(cell => String(cell || '').trim().toLowerCase());
      
      const bCodeIndex = stringRow.findIndex(cell => cell.includes('باركود') || cell.includes('barcode'));
      const pNameIndex = stringRow.findIndex(cell => cell.includes('منتج') || cell.includes('product') || cell.includes('name') || cell.includes('الاسم'));
      const qIndex = stringRow.findIndex(cell => cell.includes('متبقي') || cell.includes('كمية') || cell.includes('quantity') || cell.includes('remaining_qty') || cell.includes('المخزون'));
      const sIndex = stringRow.findIndex(cell => cell.includes('مباع') || cell.includes('sold') || cell.includes('المباع'));
      const prIndex = stringRow.findIndex(cell => cell.includes('ربح') || cell.includes('profit') || cell.includes('الربح'));
      
      if (pNameIndex !== -1 && (bCodeIndex !== -1 || qIndex !== -1 || sIndex !== -1)) {
        headerRowIndex = i;
        barcodeColIndex = bCodeIndex;
        qtyColIndex = qIndex;
        soldColIndex = sIndex;
        profitColIndex = prIndex;
        nameColIndex = pNameIndex;
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
      
      if (!name && !barcode) continue;
      
      const existing = items.find(o => (barcode && o.barcode === barcode) || (name && o.name === name));
      if (existing) {
        existing.qty += qty;
        existing.sold += sold;
        existing.profit += profit;
      } else {
        items.push({ barcode, name: name || 'منتج غير معروف', qty, sold, profit, matched: false });
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
          profitDiff: oldData ? (currData.profit - oldData.profit) : currData.profit
        });
      }
      
      // Add missing from old
      for (const oldData of oldItemsCopy.filter((o: any) => !o.matched)) {
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
      case 'quantity':
      default:
        oldVal = item.oldQty;
        newVal = item.newQty;
        diff = item.qtyDiff;
        break;
    }

    const isNew = oldVal === null;
    return { oldVal, newVal, diff, format, isNew };
  };

  const resetState = () => {
    setFile1Items(null);
    setFile1Name('');
    setComparisonResult(null);
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
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
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-x-auto w-full sm:w-auto">
                        <button 
                          onClick={() => setCompareMode('quantity')}
                          className={cn("px-4 py-1.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'quantity' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          الكمية المتبقية
                        </button>
                        <button 
                          onClick={() => setCompareMode('sold')}
                          className={cn("px-4 py-1.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'sold' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          المباع
                        </button>
                        <button 
                          onClick={() => setCompareMode('profit')}
                          className={cn("px-4 py-1.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors", compareMode === 'profit' ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200")}
                        >
                          الربح
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
                  
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 sticky top-0 border-b border-zinc-200 dark:border-zinc-700 z-10 whitespace-nowrap">
                          <tr>
                            <th className="py-3 px-4 font-bold min-w-[140px]">المنتج</th>
                            <th className="py-3 px-4 text-center font-bold min-w-[100px]">الجرد 1</th>
                            <th className="py-3 px-4 text-center font-bold min-w-[100px]">الجرد 2</th>
                            <th className="py-3 px-4 text-center font-bold min-w-[100px]">الفرق</th>
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
                              const { oldVal, newVal, diff, format, isNew } = renderMetric(item);
                            const isDeleted = item.deleted;
                            
                            return (
                              <tr key={idx} className={cn("hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors", isDeleted && "opacity-60")}>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                  <div className="text-[10px] text-zinc-400 mt-0.5">
                                    {isNew && <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">منتج جديد</span>}
                                    {isDeleted && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-medium">غير متوفر حالياً</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center font-medium text-zinc-500">
                                  {isNew ? '—' : format(oldVal)}
                                </td>
                                <td className="py-3 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                                  {format(newVal)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className={cn(
                                    "flex items-center justify-center gap-1 font-bold rounded-lg py-1 px-2 mx-auto w-fit whitespace-nowrap",
                                    diff > 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10" : 
                                    diff < 0 ? "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/10" : 
                                    "text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800"
                                  )}>
                                    {diff > 0 ? <TrendingUp size={14} /> : diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                                    <span dir="ltr">{diff > 0 ? '+' : ''}{format(diff)}</span>
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
