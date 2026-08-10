import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, Eye, EyeOff, Filter, CheckSquare, Square, FileText, ChevronDown } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { cn } from '../../lib/utils';

interface InventoryPrintModalProps {
  show: boolean;
  onClose: () => void;
  products: any[];
  categories: any[];
}

export const InventoryPrintModal: React.FC<InventoryPrintModalProps> = ({
  show,
  onClose,
  products,
  categories
}) => {
  const { settings } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSystemQuantity, setShowSystemQuantity] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'barcode'>('category');

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

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

  if (!show) return null;

  // Filter & Sort Products
  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  }).sort((a, b) => {
    if (sortBy === 'category') {
      const catCompare = (a.category || '').localeCompare(b.category || '', 'ar');
      if (catCompare !== 0) return catCompare;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    }
    if (sortBy === 'barcode') {
      return (a.barcode || '').localeCompare(b.barcode || '');
    }
    return (a.name || '').localeCompare(b.name || '', 'ar');
  });

  const handlePrint = () => {
    window.print();
  };

  const currentDateStr = new Date().toLocaleDateString('ar-TN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-transparent print:static">
        {/* Printable Area Styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-inventory-sheet, #printable-inventory-sheet * {
              visibility: visible !important;
            }
            #printable-inventory-sheet {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 15mm !important;
              background: white !important;
              color: black !important;
              font-family: system-ui, -apple-system, sans-serif !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border: 1px solid #000 !important;
              padding: 6px 8px !important;
              font-size: 11pt !important;
            }
            th {
              background-color: #f1f5f9 !important;
              color: #000 !important;
              font-weight: bold !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}</style>

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none"
        >
          {/* Header Controls (Hidden during print) */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 no-print shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl">
                <Printer size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">طباعة كشف جرد المخزون الورقي</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">طباعة جدول بالمنتجات لكتابة الجرد اليدوي على الورق</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Printer size={16} />
                <span>طباعة الكشف</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Filter Bar (Hidden during print) */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print shrink-0 text-xs font-bold relative z-20">
            {/* Category Dropdown */}
            <div className="relative" ref={categoryRef}>
              <label className="block text-zinc-500 mb-1">القسم / التصنيف:</label>
              <button
                type="button"
                onClick={() => {
                  setCategoryDropdownOpen(!categoryDropdownOpen);
                  setSortDropdownOpen(false);
                }}
                className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-between outline-none cursor-pointer border border-transparent focus:border-brand-500/40"
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
            <div className="relative" ref={sortRef}>
              <label className="block text-zinc-500 mb-1">ترتيب القائمة حسب:</label>
              <button
                type="button"
                onClick={() => {
                  setSortDropdownOpen(!sortDropdownOpen);
                  setCategoryDropdownOpen(false);
                }}
                className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-between outline-none cursor-pointer border border-transparent focus:border-brand-500/40"
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

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setShowSystemQuantity(!showSystemQuantity)}
                className={`w-full h-10 px-3 rounded-xl flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  showSystemQuantity 
                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/40 dark:border-brand-800 dark:text-brand-300' 
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                }`}
              >
                {showSystemQuantity ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{showSystemQuantity ? 'إظهار كمية النظام الحالية' : 'جرد أعمى (إخفاء كمية النظام)'}</span>
              </button>
            </div>
          </div>

          {/* Printable Sheet View */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-100 dark:bg-zinc-950 print:bg-white print:p-0">
            <div 
              id="printable-inventory-sheet" 
              className="bg-white text-zinc-900 p-8 rounded-xl shadow-md border border-zinc-200 print:shadow-none print:border-none print:p-0 mx-auto max-w-3xl"
              dir="rtl"
            >
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4 mb-6">
                <div>
                  <h1 className="text-2xl font-black text-zinc-900 mb-1">{settings.storeName || 'المحل التجارية'}</h1>
                  <h2 className="text-lg font-bold text-zinc-700 flex items-center gap-2">
                    <FileText size={20} className="no-print" />
                    كشف جرد المخزون الفعلي (اليدوي)
                  </h2>
                </div>
                <div className="text-left text-xs font-semibold text-zinc-600 space-y-1">
                  <p>التاريخ: <span className="font-bold text-zinc-900">{currentDateStr}</span></p>
                  <p>عدد المنتجات: <span className="font-bold text-zinc-900">{filteredProducts.length}</span></p>
                  <p>القسم المحدد: <span className="font-bold text-zinc-900">{selectedCategory === 'all' ? 'جميع الأقسام' : selectedCategory}</span></p>
                </div>
              </div>

              {/* Products Table */}
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100 text-zinc-900 font-bold border-b-2 border-zinc-300">
                    <th className="py-2.5 px-2 text-center w-10 border border-zinc-300">#</th>
                    <th className="py-2.5 px-3 border border-zinc-300">اسم المنتج</th>
                    <th className="py-2.5 px-2 border border-zinc-300 w-28">الباركود</th>
                    <th className="py-2.5 px-2 border border-zinc-300 w-24">القسم</th>
                    {showSystemQuantity && (
                      <th className="py-2.5 px-2 text-center border border-zinc-300 w-20">الكمية بالسيستم</th>
                    )}
                    <th className="py-2.5 px-2 text-center border border-zinc-300 w-28 bg-amber-50/80">الكمية الفعلية (باليد)</th>
                    <th className="py-2.5 px-2 border border-zinc-300 w-28">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300">
                  {filteredProducts.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-zinc-50">
                      <td className="py-2 px-2 text-center font-bold text-zinc-500 border border-zinc-300">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-zinc-900 border border-zinc-300">{p.name}</td>
                      <td className="py-2 px-2 font-mono text-[11px] text-zinc-600 border border-zinc-300 dir-ltr text-right">{p.barcode || '-'}</td>
                      <td className="py-2 px-2 text-zinc-600 border border-zinc-300">{p.category || '-'}</td>
                      {showSystemQuantity && (
                        <td className="py-2 px-2 text-center font-bold text-zinc-800 border border-zinc-300">{p.quantity || 0}</td>
                      )}
                      <td className="py-2 px-2 border border-zinc-300 bg-amber-50/30">
                        {/* Empty printable space for writing with pen */}
                        <div className="h-6 w-full"></div>
                      </td>
                      <td className="py-2 px-2 border border-zinc-300">
                        <div className="h-6 w-full"></div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={showSystemQuantity ? 7 : 6} className="text-center py-8 text-zinc-400">
                        لا توجد منتجات في هذا القسم
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Sheet Footer */}
              <div className="mt-8 pt-4 border-t border-zinc-300 flex justify-between items-center text-xs text-zinc-700">
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
