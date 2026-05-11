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

import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
      showToast(`${t('found')}: ${foundProduct.name}`, 'success');
    } else {
      showToast(t('product_not_found_inventory'), 'error');
    }
  };
  
  // Persistence: Save inventory data to localStorage
  useEffect(() => {
    localStorage.setItem('current_inventory_data', JSON.stringify(inventoryData));
  }, [inventoryData]);

  const handleClearInventory = () => {
    if (Object.keys(inventoryData).length === 0) return;
    showConfirm(t('confirm_clear_quantities'), () => {
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
    const filtered = products.filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(s) || p.barcode?.includes(s) || p.barcode2?.includes(s);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });

    return [...filtered].sort((a, b) => {
      // أولاً حسب الفئة
      const categoryCompare = (a.category || '').localeCompare(b.category || '', 'ar');
      if (categoryCompare !== 0) return categoryCompare;
      // ثم حسب الاسم
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [products, searchTerm, categoryFilter]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const sortedProducts = filteredProducts.slice(
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
      showAlert(t('enter_inventory_data_first'));
      return;
    }
    
    showConfirm(t('confirm_save_inventory'), async () => {
      try {
        const batch = writeBatch(db);
        const auditTime = serverTimestamp();
        const localNow = new Date();
        
        let totalRevenue = 0;
        let totalProfit = 0;
        let totalRemainingValue = 0;
        const items: any[] = [];

        // calculate remaining value for ALL products
        products.forEach(p => {
          const actualQty = inventoryData[p.id];
          const finalQty = actualQty !== undefined ? Number(actualQty) : Number(p.quantity || 0);
          totalRemainingValue += finalQty * (Number(p.purchasePrice || p.costPrice) || 0);
        });

        for (const [pid, actualQty] of Object.entries(inventoryData)) {
          const p = products.find(prod => prod.id === pid);
          if (p) {
            const sold = Number(p.quantity || 0) - Number(actualQty);
            const remainingValue = Number(actualQty) * (Number(p.purchasePrice || p.costPrice) || 0);
            
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
                profit,
                remainingValue 
              });
            } else if (sold <= 0) {
              // Store items with no sales too if you want them in the table. 
              // Wait, the prompt says sort descending by qty sold, does it mean include all? 
              // Usually inventory report lists only what moved, but lets add the remaining ones if they have stock?
              // The original logic only did `if (sold > 0)`. I'll stick to original logic but ensure the remainingValue is calculated.
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
          totalRemainingValue,
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
          totalRemainingValue,
          totalExpenses: finalExpensesAmount,
          netProfit,
          items,
          expensesDeducted: shouldDeductExpenses
        };
        
        setInventoryData({});
        setExpensesAmount(0);
        setCurrentReport(newReport);
        setShowReportView(true);
        showToast(t('inventory_saved_success'));
        
        // Clear localStorage
        localStorage.removeItem('current_inventory_data');
        
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/inventory`);
      }
    });
  };

  const generatePDF = async (report: any) => {
    try {
      showToast(t('preparing_pdf'));
      
      // Allow DOM to update before printing
      setTimeout(() => {
        window.print();
        showToast(t('pdf_download_success'), 'success');
      }, 500);
      
    } catch (err) {
      console.error(err);
      showToast(t('pdf_download_error'), 'error');
    }
  };

  if (showReportView && currentReport) {
    const sortedItems = [...(currentReport.items || [])].sort((a: any, b: any) => (b.salesCalculated || 0) - (a.salesCalculated || 0));

    return (
      <motion.div 
        id="pdf-report-content"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="pb-40 min-h-screen bg-white" dir="rtl"
      >
        <div className="p-4 sm:p-6 text-black" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, system-ui" }}>
          
          <div className="print-hidden mb-6">
            <button 
              onClick={() => setShowReportView(false)}
              className="w-10 h-10 flex items-center justify-center bg-zinc-100 border border-zinc-200 rounded-2xl text-zinc-600"
            >
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="flex justify-between items-center border-b-2 border-[#e0e0e0] pb-4 mb-6 sm:mb-8">
            <div className="text-[18px] sm:text-[22px] font-bold text-[#021024]">{settings.shopName || 'متجر حميدة'}</div>
            <div className="text-[20px] sm:text-[24px] font-bold text-center flex-grow">{t('sales_report')}</div>
            <div className="text-[16px] sm:text-[18px] text-[#555555]" dir="ltr">
              {currentReport.date?.toDate ? currentReport.date.toDate().toLocaleDateString('ar-TN') : (currentReport.date ? new Date(currentReport.date).toLocaleDateString('ar-TN') : '—')}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-6 sm:mb-8">
            <div className="flex-1 p-5 rounded-[12px] bg-[#004eff] text-white shadow-sm">
              <div className="text-[18px] mb-2 opacity-90">{t('total_profits')}</div>
              <div className="text-[24px] sm:text-[28px] font-bold inline-block" dir="ltr">
                {formatCurrency(currentReport.totalProfit || 0, settings.currency, settings.language)}
              </div>
            </div>
            <div className="flex-1 p-5 rounded-[12px] bg-[#021024] text-white shadow-sm">
              <div className="text-[18px] mb-2 opacity-90">{t('total_remaining_value')}</div>
              <div className="text-[24px] sm:text-[28px] font-bold inline-block" dir="ltr">
                {formatCurrency(currentReport.totalRemainingValue !== undefined ? currentReport.totalRemainingValue : currentReport.items?.reduce((sum: number, item: any) => sum + (((products.find(p => p.name === item.productName)?.purchasePrice || products.find(p => p.name === item.productName)?.costPrice) || 0) * (item.quantityAfter || 0)), 0) || 0, settings.currency, settings.language)}
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
                {sortedItems.map((item: any, i: number) => (
                  <tr key={i} className="even:bg-[#fafbfc]">
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
            onClick={() => generatePDF(currentReport)}
            className="w-full py-4 shadow-2xl rounded-2xl text-base font-black bg-[#4A6FA5] text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <Download size={20} />
            <span>{t('download_pdf_report')}</span>
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
                    <h3 className="font-bold text-lg">{t('expenses_month')}</h3>
                  </div>
                  <button onClick={() => setShowExpensesModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-2 text-center py-4 bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl border border-amber-50 dark:border-amber-950/20">
                  <div className="text-4xl font-black text-zinc-900 dark:text-white">
                    {loadingExpenses ? "..." : formatCurrency(expensesAmount, settings.currency, settings.language)}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('total_expenses_recorded')}</div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('deduct_from_inventory_profit')}</span>
                      <span className="text-[10px] text-zinc-400 font-medium leading-tight">{t('deduct_expenses_profit_desc')}</span>
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
                  {t('expenses_auto_fetched_desc')}
                </p>

                <button 
                  onClick={() => setShowExpensesModal(false)}
                  className="w-full py-4 bg-zinc-900 dark:bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-zinc-500/20 active:scale-95 transition-all"
                >
                  {t('close')}
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
                    <h3 className="font-bold text-lg">{t('inventory_log')}</h3>
                  </div>
                  <button onClick={() => setShowHistoryModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="py-12 flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent animate-spin rounded-full" />
                      <span className="text-xs text-zinc-400 font-bold">{t('loading_history')}</span>
                    </div>
                  ) : historyReports.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs font-bold">{t('no_inventory_records')}</div>
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
                            <div className="text-[8px] text-zinc-400 font-medium whitespace-nowrap leading-none">{t('net_profit')}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-700/50">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-zinc-400 font-bold">{t('total_sales')}</span>
                            <span className="text-[11px] font-black">{formatCurrency(report.totalRevenue || 0, settings.currency, settings.language)}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-right">
                            <span className="text-[9px] text-zinc-400 font-bold">{t('expenses')}</span>
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
        <h1 className="text-3xl font-bold text-black dark:text-white leading-tight">{t('jard_monthly')}</h1>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">{t('enter_actual_quantity')}</p>
      </div>

      <div className="flex justify-start gap-2 px-4">
        <button 
          onClick={() => setShowHistoryModal(true)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
          title={t('inventory_log')}
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
          <span>{t('overall_progress')}</span>
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
              placeholder={t('search_product_inventory_placeholder')} 
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
            <option value="all">{t('all_categories_filter')}</option>
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
          {sortedProducts.map((p) => (
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
                  <h3 className="text-[13px] font-medium truncate text-black dark:text-white leading-tight mb-0.5">{p.name || t('product')}</h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{t('stock')}:</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">{p.quantity || 0} {t('piece')}</span>
                  </div>
                </div>
              </div>

              {/* Controls (Left) */}
              <div className="flex items-center gap-2 shrink-0 mr-auto">
                {p.piecesPerCarton > 1 && (
                  <button 
                    onClick={() => handleAddCarton(p.id, p.piecesPerCarton)} 
                    className="w-9 h-9 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-400 active:scale-95 transition-transform"
                    title={`${t('add_carton')} (${p.piecesPerCarton} ${t('piece')})`}
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
                    placeholder={t('quantity')}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-20 text-zinc-300 text-sm">
            {t('no_products_found')}
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
