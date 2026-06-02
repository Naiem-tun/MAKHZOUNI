import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ScanBarcode, CheckCircle2, Check,
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
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { cn, safeParseFloat, handleFirestoreError, formatCurrency, safeParseDate, formatAppDate } from '../lib/utils';
import { OperationType } from '../types';
import { ProductPagination } from '../components/products/ProductPagination';
import { useCategories, categoryIcons } from '../hooks/useCategories';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { Logo } from '../components/UI';
import { InventoryReportView } from '../components/inventory/InventoryReportView';
import { HistoryModal } from '../components/inventory/HistoryModal';
import { ExpensesModal } from '../components/inventory/ExpensesModal';

import { InventoryItem } from '../components/inventory/InventoryItem';
import { useTranslation } from 'react-i18next';



export default function Inventory() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { categories } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUninventoriedOnly, setShowUninventoriedOnly] = useState(false);
  const [inventoryData, setInventoryData] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('current_inventory_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [checkedProducts, setCheckedProducts] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('checked_inventory_products');
    return saved ? JSON.parse(saved) : {};
  });
  const [products, setProducts] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(products.length === 0);
  
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
  const [showDetailedControls, setShowDetailedControls] = useState(() => {
    return localStorage.getItem('detailed_inventory_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('detailed_inventory_mode', String(showDetailedControls));
  }, [showDetailedControls]);

  useEffect(() => {
    const scannerHandler = () => {
      setIsScannerOpen(true);
    };
    window.addEventListener('open-barcode-scanner-inventory', scannerHandler);
    return () => window.removeEventListener('open-barcode-scanner-inventory', scannerHandler);
  }, []);

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

  useEffect(() => {
    localStorage.setItem('checked_inventory_products', JSON.stringify(checkedProducts));
  }, [checkedProducts]);

  const toggleChecked = useCallback((id: string) => {
    setCheckedProducts(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleClearInventory = () => {
    if (Object.keys(inventoryData).length === 0 && Object.keys(checkedProducts).length === 0) return;
    showConfirm(t('confirm_clear_quantities'), () => {
      setInventoryData({});
      setCheckedProducts({});
      localStorage.removeItem('current_inventory_data');
      localStorage.removeItem('checked_inventory_products');
    });
  };

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
      localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(prods));
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
      const matchUninventoried = !showUninventoriedOnly || !checkedProducts[p.id];
      return matchSearch && matchCat && matchUninventoried;
    });

    return [...filtered].sort((a, b) => {
      const categoryCompare = (a.category || '').localeCompare(b.category || '', settings.language);
      if (categoryCompare !== 0) return categoryCompare;
      return (a.name || '').localeCompare(b.name || '', settings.language);
    });
  }, [products, searchTerm, categoryFilter, showUninventoriedOnly, inventoryData]);

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

  const getCountBreakdown = (total: number, piecesPerBox: number) => {
    if (!total || total <= 0) return null;
    if (!piecesPerBox || piecesPerBox <= 1) return `${total} ${t('piece')}`;
    
    const cartons = Math.floor(total / piecesPerBox);
    const pieces = total % piecesPerBox;
    
    const parts = [];
    if (cartons > 0) parts.push(`${cartons} ${t('box')}`);
    if (pieces > 0) parts.push(`${pieces} ${t('piece')}`);
    
    return parts.join(' + ');
  };

  const handleMatch = useCallback((id: string, qty: number) => {
    setInventoryData(prev => ({ ...prev, [id]: qty }));
  }, []);

  const handleAddCarton = useCallback((id: string, pieces: number) => {
    setInventoryData(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + pieces }));
  }, []);

  const handleAddPiece = useCallback((id: string) => {
    setInventoryData(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + 1 }));
  }, []);

  const handleChangeQuantity = useCallback((id: string, val: string) => {
    if (val === '') {
      setInventoryData(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setInventoryData(prev => ({ ...prev, [id]: parseFloat(val) }));
    }
  }, []);

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
        setCheckedProducts({});
        setExpensesAmount(0);
        setCurrentReport(newReport);
        setShowReportView(true);
        showToast(t('inventory_saved_success'));
        
        // Clear localStorage
        localStorage.removeItem('current_inventory_data');
        localStorage.removeItem('checked_inventory_products');
        
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/inventory`);
      }
    });
  };

  const generatePDF = async (report: any) => {
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
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-ignore - html2pdf might have different default export signature depending on version
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

  if (showReportView && currentReport) {
    return (
      <InventoryReportView
        report={currentReport}
        products={products}
        onClose={() => setShowReportView(false)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-40 min-h-screen -mx-2 sm:mx-0 relative" dir="rtl">
      <ExpensesModal
        show={showExpensesModal}
        onClose={() => setShowExpensesModal(false)}
        loading={loadingExpenses}
        amount={expensesAmount}
        shouldDeduct={shouldDeductExpenses}
        onToggleDeduct={() => setShouldDeductExpenses(!shouldDeductExpenses)}
      />

      <HistoryModal
        show={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        loading={loadingHistory}
        reports={historyReports}
        showConfirm={showConfirm}
        onSelectReport={(report) => {
          setCurrentReport(report);
          setShowReportView(true);
          setShowHistoryModal(false);
        }}
        onDeleteReport={(reportId) => {
          if (!user) return;
          setHistoryReports(prev => prev.filter(r => r.id !== reportId));
          showToast(t('report_deleted_successfully') || 'Report deleted successfully', 'success');
          
          deleteDoc(doc(db, `users/${user.uid}/reports`, reportId)).catch((error) => {
            console.error("Error deleting report", error);
            showToast(t('error_deleting_report') || 'Error deleting report', 'error');
            // We could optionally revert the deletion in state here, but letting it be is okay.
          });
        }}
      />
      {/* Header Section */}
      <div className="flex items-center justify-between pt-2 px-4 gap-4 min-w-0">
        <div className="text-right space-y-1 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white leading-tight">{t('jard_monthly')}</h1>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">{t('enter_actual_quantity')}</p>
        </div>
        <button 
          onClick={handleCompleteInventory} 
          className="h-11 px-4 shadow-xl shadow-[#4A6FA5]/20 rounded-lg text-sm font-black bg-[#4A6FA5] text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <ClipboardCheck size={20} />
          <span className="hidden sm:inline">{t('save_inventory')}</span>
          <span className="sm:hidden">{t('save')}</span>
        </button>
      </div>

      <div className="flex justify-start gap-2 px-4">
        <button 
          onClick={() => setShowHistoryModal(true)}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform"
          title={t('inventory_log')}
        >
          <FileText size={18} />
        </button>
        <button 
          onClick={() => setShowExpensesModal(true)}
          className={cn(
            "h-10 px-3 flex items-center gap-2 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm active:scale-95 transition-all text-xs font-bold",
            expensesAmount > 0 ? "border-[#B34C36]/20 text-[#B34C36] bg-[#B34C36]/5" : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 w-10 justify-center px-0"
          )}
          title={t('expenses')}
        >
          <Wallet size={18} />
          {expensesAmount > 0 && <span>{formatCurrency(expensesAmount, settings.currency, settings.language)}</span>}
        </button>
        <button 
          onClick={() => setShowDetailedControls(!showDetailedControls)}
          className={cn(
            "w-10 h-10 flex items-center justify-center border rounded-lg shadow-sm active:scale-95 transition-all",
            showDetailedControls 
              ? "bg-brand-600 border-brand-600 text-white shadow-brand-500/20" 
              : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400"
          )}
          title={t('detailed_inventory_mode')}
        >
          <PlusCircle size={18} />
        </button>
        <button 
          onClick={handleClearInventory}
          className={cn(
            "w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-900 border rounded-lg shadow-sm active:scale-95 transition-transform",
            Object.keys(inventoryData).length > 0 
              ? "text-white shadow-lg shadow-[#B34C36]/20" 
              : "border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700"
          )}
          style={Object.keys(inventoryData).length > 0 ? { backgroundColor: '#B34C36', borderColor: '#B34C36' } : {}}
          title={t('confirm_clear_quantities')}
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 px-4">
        <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase tracking-widest">
          <span className="text-brand-500">{progress}%</span>
          <span>{t('overall_progress')}</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-brand-500 rounded-full" 
          />
        </div>
      </div>

      {/* Search Bar & Categories */}
      <div className="space-y-3 px-4">
        <div className="flex gap-2">
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="w-11 h-11 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm active:scale-95"
          >
            <ScanBarcode size={20} className="text-zinc-400" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
            <input 
              className="w-full h-11 pr-10 pl-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none text-[13px] placeholder:text-zinc-300"
              placeholder={t('search_product_inventory_placeholder')} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative group/filter flex-1">
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full appearance-none py-2.5 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[13px] font-bold text-zinc-600 dark:text-zinc-400 text-center outline-none hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm focus:border-brand-500/50"
            >
              <option value="all">{t('all_categories_filter')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{t(c.key || c.name)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-zinc-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
            </div>
          </div>
          <button
            onClick={() => setShowUninventoriedOnly(!showUninventoriedOnly)}
            className={cn(
              "px-4 py-2.5 rounded-lg border text-[13px] font-bold transition-all whitespace-nowrap",
              showUninventoriedOnly 
                ? "bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-500/20" 
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
          >
            {t('not_inventoried')}
          </button>
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 gap-2 px-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {sortedProducts.map((p) => (
              <InventoryItem
                key={p.id}
                product={p}
                inventoryQuantity={inventoryData[p.id]}
                isChecked={!!checkedProducts[p.id]}
                showDetailedControls={showDetailedControls}
                onToggleCheck={toggleChecked}
                onAddPiece={handleAddPiece}
                onAddCarton={handleAddCarton}
                onChangeQuantity={handleChangeQuantity}
              />
            ))}
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-20 text-zinc-300 text-sm">
                {t('no_products_found')}
              </div>
            )}
          </>
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
              className="relative w-full max-w-[280px] bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 text-center"
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
                      className="flex-1 py-2.5 text-white rounded-lg text-[12px] font-black active:scale-95 transition-all shadow-lg shadow-[#B34C36]/20"
                      style={{ backgroundColor: '#B34C36' }}
                    >
                      {t('confirm')}
                    </button>
                    <button 
                      onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                      className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-[12px] font-bold active:scale-95 transition-all"
                    >
                      {t('cancel')}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                    className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-[12px] font-black active:scale-95 transition-all"
                  >
                    {t('ok')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
}
