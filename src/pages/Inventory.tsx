import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ScanBarcode, CheckCircle2, 
  Package, Wallet, FileText, ClipboardCheck, Trash2, History,
  X, PlusCircle, MinusCircle, ArrowRight, Download, Receipt, FileBarChart, TrendingUp
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { cn, safeParseFloat, handleFirestoreError, formatCurrency } from '../lib/utils';
import { OperationType } from '../types';
import { ProductPagination } from '../components/products/ProductPagination';
import { useCategories } from '../hooks/useCategories';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import jsPDF from 'jspdf';

// Updated ProductIcon component to match ProductCard's style (w-9 h-9)
const ProductIcon = ({ className }: { className?: string }) => (
  <div className={cn(
    "w-9 h-9 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center shrink-0 shadow-sm", 
    className
  )}>
    <Package size={16} className="text-neutral-400 dark:text-neutral-500" />
  </div>
);

export default function Inventory() {
  const { settings, showToast } = useAppContext();
  const { categories } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [inventoryData, setInventoryData] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('current_inventory_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({ show: false, message: '', type: 'alert' });

  const showAlert = (message: string) => {
    setModalConfig({ show: true, message, type: 'alert' });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ show: true, message, type: 'confirm', onConfirm });
  };

  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [expensesAmount, setExpensesAmount] = useState(0);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [shouldDeductExpenses, setShouldDeductExpenses] = useState(true);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [showReportView, setShowReportView] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    
    const foundProduct = products.find(p => p.barcode === decodedText || p.barcode2 === decodedText);
    
    if (foundProduct) {
      setSearchTerm(decodedText);
      showToast(`تم العثور على: ${foundProduct.name}`, 'success');
    } else {
      showToast('المنتج غير موجود في المخزن', 'error');
    }
  };
  
  // Persistence: Save inventory data to localStorage
  useEffect(() => {
    localStorage.setItem('current_inventory_data', JSON.stringify(inventoryData));
  }, [inventoryData]);

  const handleClearInventory = () => {
    if (Object.keys(inventoryData).length === 0) return;
    showConfirm("هل أنت متأكد من مسح جميع الكميات المدرجة؟", () => {
      setInventoryData({});
      localStorage.removeItem('current_inventory_data');
    });
  };

  const user = auth.currentUser;

  const fetchCurrentMonthExpenses = async () => {
    if (!user) return;
    setLoadingExpenses(true);
    try {
      const expensesPath = `users/${user.uid}/expenses`;
      const expensesQuery = query(
        collection(db, expensesPath),
        where("audited", "==", false)
      );
      
      const snapshot = await getDocs(expensesQuery);
      const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setExpensesAmount(total);
    } catch (err) {
      console.error("Fetch expenses failed:", err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCurrentMonthExpenses();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const reportsPath = `users/${user.uid}/reports`;
      const q = query(
        collection(db, reportsPath), 
        where("type", "==", "inventory")
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setHistoryReports(reports);
    } catch (err) {
      console.error("Fetch history failed:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistoryModal) {
      fetchHistory();
    }
  }, [showHistoryModal]);

  // Real-time fetch from Firebase
  useEffect(() => {
    if (!user) return;
    
    const productsPath = `users/${user.uid}/products`;
    const q = collection(db, productsPath);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      console.error("Fetch products failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Reset to first page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const s = searchTerm.toLowerCase();
    return products.filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(s) || p.barcode?.includes(s) || p.barcode2?.includes(s);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, categoryFilter]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const progress = useMemo(() => {
    if (!products || products.length === 0) return 0;
    const completed = Object.keys(inventoryData).length;
    return Math.round((completed / products.length) * 100);
  }, [products, inventoryData]);

  const handleMatch = (id: string, qty: number) => {
    setInventoryData(prev => ({ ...prev, [id]: qty }));
  };

  const handleAddCarton = (id: string, pieces: number) => {
    setInventoryData(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + pieces }));
  };

  const handleCompleteInventory = async () => {
    if (!user) return;
    if (Object.keys(inventoryData).length === 0) {
      showAlert('أدخل بيانات الجرد أولاً');
      return;
    }
    
    showConfirm("هل تريد حفظ الجرد وتحديث المخزون؟", async () => {
      try {
        const batch = writeBatch(db);
        const auditTime = serverTimestamp();
        const localNow = new Date();
        
        let totalRevenue = 0;
        let totalProfit = 0;
        const items: any[] = [];

        for (const [pid, actualQty] of Object.entries(inventoryData)) {
          const p = products.find(prod => prod.id === pid);
          if (p) {
            const sold = Number(p.quantity || 0) - Number(actualQty);
            if (sold > 0) {
              const revenue = sold * Number(p.sellingPrice || 0);
              const profit = revenue - (sold * (Number(p.purchasePrice || p.costPrice) || 0));
              totalRevenue += revenue;
              totalProfit += profit;
              items.push({ 
                productName: p.name, 
                quantityBefore: p.quantity, 
                quantityAfter: actualQty, 
                salesCalculated: sold, 
                profit 
              });
            }
            
            const productRef = doc(db, `users/${user.uid}/products`, pid);
            batch.update(productRef, {
              quantity: Number(actualQty),
              updatedAt: auditTime,
              lastInventoryDate: auditTime
            });
          }
        }

        // Fetch expenses (cached if offline)
        const expensesPath = `users/${user.uid}/expenses`;
        const expensesQuery = query(
          collection(db, expensesPath),
          where("audited", "==", false)
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        const actualExpensesAmount = expensesSnapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
        const finalExpensesAmount = shouldDeductExpenses ? actualExpensesAmount : 0;
        const netProfit = totalProfit - finalExpensesAmount;

        // Prepare Report
        const reportsPath = `users/${user.uid}/reports`;
        const reportRef = doc(collection(db, reportsPath));
        batch.set(reportRef, {
          date: auditTime,
          totalRevenue,
          totalProfit,
          totalExpenses: finalExpensesAmount, 
          netProfit: netProfit,
          items,
          type: 'inventory',
          expensesDeducted: shouldDeductExpenses
        });

        // Mark expenses as audited
        if (shouldDeductExpenses) {
          expensesSnapshot.docs.forEach(expenseDoc => {
            batch.update(doc(db, expensesPath, expenseDoc.id), {
              audited: true,
              reportId: reportRef.id,
              auditedAt: auditTime
            });
          });
        }

        // Update meta
        const profilePath = `users/${user.uid}/profile`;
        const finalMetaDocs = await getDocs(query(collection(db, profilePath), where("type", "==", "inventory_metadata")));
        if (finalMetaDocs.empty) {
          batch.set(doc(collection(db, profilePath)), { type: 'inventory_metadata', lastAuditDate: auditTime });
        } else {
          batch.update(doc(db, profilePath, finalMetaDocs.docs[0].id), { lastAuditDate: auditTime });
        }

        // Commit in the background
        batch.commit().catch(err => {
          console.error("Inventory background sync failed:", err);
        });

        // UI SUCCESS: Show report immediately
        const newReport = {
          id: reportRef.id,
          date: localNow,
          totalRevenue,
          totalProfit,
          totalExpenses: finalExpensesAmount,
          netProfit,
          items,
          expensesDeducted: shouldDeductExpenses
        };
        
        setInventoryData({});
        setExpensesAmount(0);
        setCurrentReport(newReport);
        setShowReportView(true);
        showToast('تم حفظ الجرد بنجاح');
        
        // Clear localStorage
        localStorage.removeItem('current_inventory_data');
        
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/inventory`);
      }
    });
  };

  const generatePDF = async (report: any) => {
    try {
      showToast('جاري تحضير ملف PDF...');
      
      // Allow DOM to update before printing
      setTimeout(() => {
        window.print();
        showToast('تم تحميل التقرير بنجاح', 'success');
      }, 500);
      
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تحميل التقرير', 'error');
    }
  };

  if (showReportView && currentReport) {
    return (
      <motion.div 
        id="pdf-report-content"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6 pb-40 min-h-screen relative" dir="rtl"
      >
        {/* Report Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <button 
            onClick={() => setShowReportView(false)}
            className="print-hidden w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-400"
          >
            <ArrowRight size={20} />
          </button>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center text-brand-600 mb-1">
              <ClipboardCheck size={20} />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">تقرير الجرد النهائي</h1>
            <p className="text-[10px] font-bold text-zinc-400">
              {currentReport.date?.toDate ? currentReport.date.toDate().toLocaleDateString('ar-TN') : (currentReport.date ? new Date(currentReport.date).toLocaleDateString('ar-TN') : '—')}
            </p>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Summary Bars - Slim Horizontal Geometry */}
        <div className="px-4 space-y-2">
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: 'إجمالي المبيعات', value: currentReport?.totalRevenue || 0, color: 'zinc' },
              { label: 'إجمالي الأرباح', value: currentReport?.totalProfit || 0, color: 'emerald' },
              { label: 'إجمالي المصاريف', value: currentReport?.totalExpenses || 0, color: 'brick-red' },
              { label: 'صافي الربح', value: currentReport?.netProfit || 0, color: 'brand', highlighted: true },
            ].map((bar, i) => (
              <div 
                key={i}
                className={cn(
                  "flex items-center justify-between px-5 py-4 rounded-2xl border transition-all",
                  bar.highlighted 
                    ? "bg-zinc-900 dark:bg-brand-600 border-zinc-800 dark:border-brand-500 text-white shadow-xl shadow-zinc-500/10" 
                    : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-400"
                )}
              >
                <div className="flex flex-col">
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", bar.highlighted ? "text-zinc-400 dark:text-brand-200" : "text-zinc-400")}>
                    {bar.label}
                  </span>
                  <span className={cn("text-lg font-black", bar.highlighted ? "text-white" : "text-inherit dark:text-white")}>
                    {formatCurrency(bar.value, settings.currency, settings.language)}
                  </span>
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center",
                  bar.highlighted ? "bg-white/10" : "bg-zinc-50 dark:bg-zinc-800"
                )}>
                  {i === 0 && <Receipt size={18} className={bar.highlighted ? "text-white" : "text-zinc-400"} />}
                  {i === 1 && <CheckCircle2 size={18} className="text-emerald-500" />}
                  {i === 2 && <Wallet size={18} className="text-[#B34C36]" />}
                  {i === 3 && <ClipboardCheck size={18} className="text-white" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Details - High Density Table Layout */}
        <div className="px-4 space-y-2">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="w-44 text-right text-[10px] font-bold text-zinc-400 uppercase">المنتج</div>
            <div className="flex-1 text-center text-[10px] font-bold text-zinc-400 uppercase">الكمية</div>
            <div className="w-32 text-left text-[10px] font-bold text-zinc-400 uppercase">الربح</div>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
            {(currentReport.items || []).map((item: any, i: number) => (
              <div 
                key={i} 
                className="flex items-center justify-between py-3 px-4 border-b border-zinc-50 dark:border-zinc-800/40 last:border-0"
              >
                {/* Product Name (Far Right) */}
                <div className="w-44 text-right">
                  <h3 className="text-[12px] font-medium text-zinc-900 dark:text-white truncate">
                    {item.productName}
                  </h3>
                </div>

                {/* Sold Qty (Center) */}
                <div className="flex-1 text-center">
                  <span className="text-[12px] font-black text-zinc-700 dark:text-zinc-300">
                    {item.salesCalculated}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-bold mr-1">قطعة</span>
                </div>

                {/* Profit (Far Left) */}
                <div className="w-32 text-left">
                  <div className="text-[13px] font-black text-emerald-600">
                    {formatCurrency(item.profit || 0, settings.currency, settings.language)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PDF Button */}
        <div className="print-hidden fixed bottom-10 left-6 right-6 z-40">
          <button 
            onClick={() => generatePDF(currentReport)}
            className="w-full py-4 shadow-2xl rounded-2xl text-base font-black bg-[#4A6FA5] dark:bg-[#4A6FA5] text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <Download size={20} />
            <span>تحميل التقرير PDF</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 pb-40 min-h-screen -mx-2 sm:mx-0 relative" dir="rtl">
      {/* Expenses Modal */}
      <AnimatePresence>
        {showExpensesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExpensesModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
                      <Wallet size={20} />
                    </div>
                    <h3 className="font-bold text-lg">مصاريف هذا الشهر</h3>
                  </div>
                  <button onClick={() => setShowExpensesModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-2 text-center py-4 bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl border border-amber-50 dark:border-amber-950/20">
                  <div className="text-4xl font-black text-zinc-900 dark:text-white">
                    {loadingExpenses ? "..." : formatCurrency(expensesAmount, settings.currency, settings.language)}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">إجمالي المصاريف المسجلة</div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">طرح من أرباح الجرد</span>
                      <span className="text-[10px] text-zinc-400 font-medium leading-tight">سيتم حساب الربح الصافي بعد خصم هذا المبلغ</span>
                    </div>
                    <button 
                      onClick={() => setShouldDeductExpenses(!shouldDeductExpenses)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        shouldDeductExpenses ? "bg-[#B34C36]" : "bg-zinc-300 dark:bg-zinc-700"
                      )}
                    >
                      <motion.div 
                        animate={{ x: shouldDeductExpenses ? 24 : 4 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>
                
                <p className="text-[10px] text-zinc-400 text-center px-4 leading-relaxed font-medium">
                  * يتم جلب هذا المبلغ تلقائياً من قسم المصاريف. يمكنك تغييره من هناك.
                </p>

                <button 
                  onClick={() => setShowExpensesModal(false)}
                  className="w-full py-4 bg-zinc-900 dark:bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-zinc-500/20 active:scale-95 transition-all"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-50 dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center sticky top-0 bg-inherit pt-2 pb-4 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600">
                      <History size={20} />
                    </div>
                    <h3 className="font-bold text-lg">سجل الجرد</h3>
                  </div>
                  <button onClick={() => setShowHistoryModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="py-12 flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent animate-spin rounded-full" />
                      <span className="text-xs text-zinc-400 font-bold">جاري تحميل السجل...</span>
                    </div>
                  ) : historyReports.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs font-bold">لا يوجد سجل جرد مسبق</div>
                  ) : (
                    historyReports.map((report) => (
                      <div 
                        key={report.id} 
                        onClick={() => {
                          setCurrentReport(report);
                          setShowReportView(true);
                          setShowHistoryModal(false);
                        }}
                        className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 space-y-3 cursor-pointer active:scale-[0.98] transition-all hover:border-brand-500/50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-black text-brand-600 uppercase tracking-widest leading-none mb-1">
                              {report.date?.toDate ? report.date.toDate().toLocaleDateString('ar-TN', { day: 'numeric', month: 'long', year: 'numeric' }) : (report.date ? new Date(report.date).toLocaleDateString('ar-TN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')}
                            </div>
                            <div className="text-[8px] text-zinc-400 font-bold">
                              {report.date?.toDate ? report.date.toDate().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' }) : (report.date ? new Date(report.date).toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' }) : '')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-emerald-600">+{formatCurrency(report.netProfit || 0, settings.currency, settings.language)}</div>
                            <div className="text-[8px] text-zinc-400 font-medium whitespace-nowrap leading-none">الربح الصافي</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-700/50">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-zinc-400 font-bold">إجمالي المبيعات</span>
                            <span className="text-[11px] font-black">{formatCurrency(report.totalRevenue || 0, settings.currency, settings.language)}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-right">
                            <span className="text-[9px] text-zinc-400 font-bold">المصاريف</span>
                            <span className={cn("text-[11px] font-black", report.totalExpenses > 0 ? "text-amber-600" : "")}>
                              {formatCurrency(report.totalExpenses || 0, settings.currency, settings.language)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header Section */}
      <div className="text-right pt-2 space-y-1 px-4">
        <h1 className="text-3xl font-bold text-black dark:text-white leading-tight">الجرد الشهري</h1>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">أدخل الكمية الفعلية المتبقية في المخزن</p>
      </div>

      <div className="flex justify-start gap-2 px-4">
        <button 
          onClick={() => setShowHistoryModal(true)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
          title="سجل الجرد"
        >
          <FileText size={18} />
        </button>
        <button 
          onClick={() => setShowExpensesModal(true)}
          className={cn(
            "h-10 px-3 flex items-center gap-2 bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm active:scale-95 transition-all text-xs font-bold",
            expensesAmount > 0 ? "border-[#B34C36]/20 text-[#B34C36] bg-[#B34C36]/5" : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 w-10 justify-center px-0"
          )}
          title="المصاريف"
        >
          <Wallet size={18} />
          {expensesAmount > 0 && <span>{formatCurrency(expensesAmount, settings.currency, settings.language)}</span>}
        </button>
        <button 
          onClick={handleClearInventory}
          className={cn(
            "w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm active:scale-95 transition-transform",
            Object.keys(inventoryData).length > 0 
              ? "text-white shadow-lg shadow-[#B34C36]/20" 
              : "border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700"
          )}
          style={Object.keys(inventoryData).length > 0 ? { backgroundColor: '#B34C36', borderColor: '#B34C36' } : {}}
          title="مسح الأرقام المدرجة"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 px-4">
        <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest">
          <span className="text-zinc-300 dark:text-zinc-800">{progress}%</span>
          <span>التقدم الإجمالي</span>
        </div>
        <div className="h-1 w-full bg-zinc-50 dark:bg-zinc-900 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-zinc-200 dark:bg-zinc-700" 
          />
        </div>
      </div>

      {/* Search Bar & Categories */}
      <div className="space-y-3 px-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="w-11 h-11 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm active:scale-95"
          >
            <ScanBarcode size={20} className="text-zinc-400" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
            <input 
              className="w-full h-11 pr-10 pl-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none text-[13px] placeholder:text-zinc-300"
              placeholder="بحث عن منتج للجرد..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="relative group/filter">
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full appearance-none py-2.5 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] font-bold text-zinc-600 dark:text-zinc-400 text-center outline-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm focus:border-brand-500/50"
          >
            <option value="all">كل الفئات للبحث</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-zinc-400">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 gap-2 px-2">
        <AnimatePresence mode="popLayout">
          {paginatedProducts.map((p) => (
            <motion.div 
              layout
              key={p.id} 
              className={cn(
                "flex items-center justify-between gap-3 py-2.5 px-3.5 bg-white dark:bg-zinc-900 border rounded-2xl min-h-[70px] transition-all",
                inventoryData[p.id] !== undefined ? "border-brand-500/20 bg-brand-50/5 shadow-sm" : "border-neutral-100 dark:border-neutral-800"
              )}
            >
              {/* Product Info (Right) */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <ProductIcon />
                <div className="flex flex-col text-right truncate">
                  <h3 className="text-[13px] font-medium truncate text-black dark:text-white leading-tight mb-0.5">{p.name || 'منتج'}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">المخزون:</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">{p.quantity || 0} قطعة</span>
                  </div>
                </div>
              </div>

              {/* Controls (Left) */}
              <div className="flex items-center gap-2 shrink-0 mr-auto">
                {p.piecesPerCarton > 1 && (
                  <button 
                    onClick={() => handleAddCarton(p.id, p.piecesPerCarton)} 
                    className="w-9 h-9 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-400 active:scale-95 transition-transform"
                    title={`إضافة كرتونة (${p.piecesPerCarton} قطعة)`}
                  >
                    <div className="flex flex-col items-center">
                      <Package size={14} className="mb-0" />
                      <span className="text-[8px] font-black leading-none mt-0.5">+{p.piecesPerCarton}</span>
                    </div>
                  </button>
                )}

                <div className="relative">
                  <input 
                    type="number" 
                    inputMode="decimal"
                    value={inventoryData[p.id] ?? ''}
                    onChange={(e) => setInventoryData({ ...inventoryData, [p.id]: safeParseFloat(e.target.value) })}
                    className="w-16 h-9 text-center text-sm font-black bg-zinc-100/50 dark:bg-zinc-800 border border-zinc-100 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white placeholder:text-zinc-300 transition-all font-mono"
                    placeholder="الكمية"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-20 text-zinc-300 text-sm">
            لا توجد نتائج بحث
          </div>
        )}
      </div>

      {/* Pagination */}
      <ProductPagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Custom Alert/Confirm Modal */}
      <AnimatePresence>
        {modalConfig.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-[280px] bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {modalConfig.message}
              </p>
              
              <div className="flex gap-2">
                {modalConfig.type === 'confirm' ? (
                  <>
                    <button 
                      onClick={() => {
                        setModalConfig(prev => ({ ...prev, show: false }));
                        modalConfig.onConfirm?.();
                      }}
                      className="flex-1 py-2.5 text-white rounded-2xl text-[12px] font-black active:scale-95 transition-all shadow-lg shadow-[#B34C36]/20"
                      style={{ backgroundColor: '#B34C36' }}
                    >
                      تأكيد
                    </button>
                    <button 
                      onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                      className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl text-[12px] font-bold active:scale-95 transition-all"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                    className="w-full py-2.5 bg-brand-600 text-white rounded-2xl text-[12px] font-black active:scale-95 transition-all"
                  >
                    حسناً
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <div className="fixed bottom-6 left-6 right-6 z-40 flex justify-center">
        <motion.button 
          onClick={handleCompleteInventory} 
          className="w-full py-4 shadow-2xl rounded-2xl text-base font-black bg-[#4A6FA5] dark:bg-[#4A6FA5] text-white flex items-center justify-center gap-3"
        >
          <ClipboardCheck size={22} />
          <span>حفظ الجرد وحساب النتائج</span>
        </motion.button>
      </div>

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
}
