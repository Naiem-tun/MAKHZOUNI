/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { AppProvider, useAppContext } from './AppContext';
import { Logo } from './components/UI';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  BookOpen, 
  ClipboardCheck, 
  Settings,
  LogOut,
  Moon,
  Sun,
  Globe,
  Bell,
  Wallet,
  Menu,
  X,
  Plus,
  BarChart3,
  Search,
  ShoppingCart,
  Home,
  QrCode,
  ScanBarcode,
  WifiOff,
  UserCheck,
  Play,
  Calculator,
  Square
} from 'lucide-react';
import { signInWithGoogle, auth } from './lib/firebase';

import { Login } from './components/auth/Login';
import { ProductEditModal } from './components/products/ProductEditModal';
import { BarcodeScanner } from './components/common/BarcodeScanner';
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import { handleFirestoreError, safeDispatchEvent, formatCurrency } from './lib/utils';
import { OperationType, Supplier } from './types';

// Fast/Core Pages (Static Import)
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ShoppingList from './pages/ShoppingList';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Debts from './pages/Debts';
import InvoiceCalculator from './pages/InvoiceCalculator';

// Heavy Pages (Lazy loaded)
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function AppContent() {
  const { user, loading, isOffline, isDataLoaded, settings, toggleDarkMode, setLanguage, updateSettings, activeSupplier, setActiveSupplier, showToast } = useAppContext();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('products');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['products']));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSupplierSelectorOpen, setIsSupplierSelectorOpen] = useState(false);
  const [isSessionSummaryOpen, setIsSessionSummaryOpen] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [sessionFinalTotal, setSessionFinalTotal] = useState(0);
  const [sessionDifference, setSessionDifference] = useState<string>('0');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  useEffect(() => {
    setMountedTabs(prev => {
      const newSet = new Set(prev);
      newSet.add(activeTab);
      return newSet;
    });
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `users/${user.uid}/suppliers`), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });
    return unsub;
  }, [user]);

  // Dark mode effect
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Global Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [globalScannedBarcode, setGlobalScannedBarcode] = useState('');

  const handleSaveProduct = async (productData: any) => {
    if (!user) return;
    try {
      const path = `users/${user.uid}/products`;
      
      // Close modal immediately for offline responsiveness
      setIsProductModalOpen(false);
      setGlobalScannedBarcode('');
      
      addDoc(collection(db, path), {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/products`);
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleScannerResult = (barcode: string) => {
    setIsScannerOpen(false);
    setGlobalScannedBarcode(barcode);
    setIsProductModalOpen(true);
  };

  const handleEndSessionConfirm = () => {
    if (!user || !activeSupplier) return;
    
    setIsSavingSession(true);
    
    try {
      const supplierId = activeSupplier.id;
      const amount = Number(sessionFinalTotal) || 0;
      
      // ✅ 1. أغلق الـ modal أولاً للحصول على استجابة فورية فائقة السرعة
      setIsSessionSummaryOpen(false);
      
      // ✅ 2. أخبر المستخدم فوراً بنجاح العملية محلياً
      showToast(t('session_saved_success') || 'تم حفظ الجلسة بنجاح ✅', 'success');
      
      // ✅ 3. تصفير وإكمال حالة الجلسة فوراً لمنع أي تأخير بالواجهة
      setActiveSupplier(null);
      setIsSavingSession(false);
      
      if (amount > 0) {
        const txPath = `users/${user.uid}/supplierTransactions`;
        
        // Use proper Timestamp to avoid offline/online mismatch with Suppliers page
        addDoc(collection(db, txPath), {
          supplierId: supplierId,
          amount: amount,
          date: Timestamp.now(),  // تضمن المزامنة وصحة التاريخ المحلي فوراً
          note: t('session_purchases_total') || 'إجمالي مشتريات الجلسة',
          updatedAt: serverTimestamp(),
        }).catch(err => {
          console.warn("Firestore offline write pending (will sync when online):", err);
        });
      }

    } catch (err) {
      console.error("Error ending supplier session:", err);
      setActiveSupplier(null);
      setIsSessionSummaryOpen(false);
      setIsSavingSession(false);
    }
  };



  const allTabs = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'products', label: t('products'), icon: Package },
    { id: 'suppliers', label: t('suppliers'), icon: Truck },
    { id: 'debts', label: t('debts'), icon: BookOpen },
    { id: 'inventory', label: t('inventory'), icon: ClipboardCheck },
    { id: 'reports', label: t('reports'), icon: BarChart3 },
    { id: 'expenses', label: t('expenses'), icon: Wallet },
    { id: 'shopping-list', label: t('shopping_list'), icon: ShoppingCart },
    { id: 'invoice-calculator', label: t('invoice_calculator'), icon: Calculator },
    { id: 'settings', label: t('settings'), icon: Settings },
  ];

  const toolbarTabs = allTabs.filter(tab => ['dashboard', 'products', 'suppliers', 'debts', 'inventory'].includes(tab.id));

  const handlePlusClick = () => {
    const eventMap: Record<string, string> = {
      'suppliers': 'open-supplier-modal',
      'debts': 'open-debt-modal',
      'inventory': 'save-inventory-jard'
    };
    
    if (activeTab === 'dashboard' || activeTab === 'products') {
      setIsProductModalOpen(true);
    } else if (eventMap[activeTab]) {
      safeDispatchEvent(eventMap[activeTab]);
    }
  };

  const isScannerTab = activeTab === 'products' || activeTab === 'invoice-calculator' || activeTab === 'inventory';

  const handleScannerClick = () => {
    if (isScannerTab) {
      safeDispatchEvent('open-barcode-scanner');
    } else {
      setActiveTab('invoice-calculator');
    }
  };

  const showSplash = loading || (!!user && !isDataLoaded);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-zinc-950"
          >
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            
            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-8"
              >
                <Logo className="h-32 w-32 shadow-2xl" />
                
                <div className="text-center space-y-2">
                  <h1 className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">
                    {settings?.storeName || t('makhzouni')}
                  </h1>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-16 flex flex-col items-center gap-4"
              >
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-12 w-12 rounded-full border-4 border-zinc-100 border-t-[#5B89BB] dark:border-zinc-800 dark:border-t-[#5B89BB]"
                />
                <span className="text-lg font-medium text-zinc-400 dark:text-zinc-500">{t('loading')}</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !user && <Login />}

      {!loading && user && (
        <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#0B1121] font-sans transition-colors duration-300">
      {/* Navbar to match screenshot */}
      <header className="sticky top-0 z-40 bg-white shadow-sm dark:bg-[#121A2F]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Right Branding and Home Group (Now first child for RTL right placement) */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                <Menu size={24} />
              </button>
              <div 
                onClick={() => setActiveTab('dashboard')}
                className="cursor-pointer"
              >
                <Logo className="w-10 h-10 shadow-lg active:scale-95 transition-transform" />
              </div>
            </div>

            {/* Icons Group */}
            <div className="flex items-center gap-4">
              {/* Supplier Session Icon Button */}
              <button 
                onClick={() => {
                  if (activeSupplier) {
                    setSessionFinalTotal(activeSupplier.sessionTotal || 0);
                    setSessionDifference('0');
                    setIsSessionSummaryOpen(true);
                  } else {
                    setIsSupplierSelectorOpen(true);
                  }
                }}
                className={`transition-all h-9 px-3 rounded-lg flex items-center justify-center ${activeSupplier ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-105' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 shadow-sm transition-all'}`}
                title={activeSupplier ? t('end_supplier_session') : t('start_supplier_session')}
              >
                {activeSupplier ? (
                  <div className="flex items-center gap-2">
                    <Square size={16} fill="currentColor" />
                    <span className="text-[10px] font-black leading-none">{activeSupplier.name}</span>
                  </div>
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
              </button>

              <button 
                onClick={() => setActiveTab('shopping-list')}
                className={`transition-colors ${activeTab === 'shopping-list' ? 'text-brand-600' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                title={t('shopping_list')}
              >
                <ShoppingCart size={22} />
              </button>
              <button 
                onClick={() => setActiveTab('expenses')}
                className={`transition-colors ${activeTab === 'expenses' ? 'text-warn-text' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
              >
                <Wallet size={22} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: settings.language === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: settings.language === 'ar' ? '100%' : '-100%' }}
              className={`absolute top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 shadow-2xl ${
                settings.language === 'ar' ? 'right-0' : 'left-0'
              }`}
            >
              <div className="flex h-18 items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xl font-bold text-zinc-900 dark:text-white">{t('menu')}</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X size={24} className="text-zinc-500" />
                </button>
              </div>
              <nav className="p-4 space-y-2">
                {allTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === tab.id
                      ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <tab.icon size={20} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}

                <button
                  onClick={() => updateSettings({ showFinancials: !settings.showFinancials })}
                  className="flex w-full items-center justify-between px-4 py-3 rounded-lg transition-all text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <Wallet size={20} className={settings.showFinancials ? 'text-brand-600' : 'text-zinc-400'} />
                    <span className="font-medium">{t('financial_stats')}</span>
                  </div>
                  <div className={`relative h-6 w-11 rounded-full transition-colors ${settings.showFinancials ? 'bg-zinc-950' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                    <motion.div 
                      animate={{ x: settings.showFinancials ? 22 : 4 }}
                      className="absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                    />
                  </div>
                </button>
              </nav>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 pt-4 pb-36 mb-safe sm:px-6 lg:px-8 min-h-[500px] relative">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-brand-500 mb-4" />
            <span className="text-sm font-medium">{t('loading')}</span>
          </div>
        }>
          <div className="w-full h-full relative">
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
              {mountedTabs.has('dashboard') && <Dashboard />}
            </div>
            <div className={activeTab === 'products' ? 'block' : 'hidden'}>
              {mountedTabs.has('products') && <Products />}
            </div>
            <div className={activeTab === 'suppliers' ? 'block' : 'hidden'}>
              {mountedTabs.has('suppliers') && <Suppliers />}
            </div>
            <div className={activeTab === 'debts' ? 'block' : 'hidden'}>
              {mountedTabs.has('debts') && <Debts />}
            </div>
            <div className={activeTab === 'inventory' ? 'block' : 'hidden'}>
              {mountedTabs.has('inventory') && <Inventory />}
            </div>
            <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
              {mountedTabs.has('reports') && <Analytics />}
            </div>
            <div className={activeTab === 'expenses' ? 'block' : 'hidden'}>
              {mountedTabs.has('expenses') && <Expenses />}
            </div>
            <div className={activeTab === 'shopping-list' ? 'block' : 'hidden'}>
              {mountedTabs.has('shopping-list') && <ShoppingList />}
            </div>
            <div className={activeTab === 'invoice-calculator' ? 'block' : 'hidden'}>
              {mountedTabs.has('invoice-calculator') && <InvoiceCalculator />}
            </div>
            <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
              {mountedTabs.has('settings') && <SettingsPage />}
            </div>
          </div>
        </Suspense>
      </main>

      {/* Bottom Navigation Navbar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl pb-6 pt-3 px-4 border-t border-zinc-200/60 dark:border-zinc-800/60 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          {/* Fixed Barcode Scanner */}
          <button 
            onClick={handleScannerClick} 
            className="flex-shrink-0 w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg shadow-sm flex items-center justify-center relative active:scale-95 transition-all"
            aria-label={t('scan_barcode') || 'Scan Barcode'}
          >
            {isScannerTab ? <ScanBarcode size={24} /> : <Calculator size={24} />}
          </button>

          {/* Scrollable Tabs */}
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm w-max">
            {toolbarTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                   activeTab === tab.id 
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Global Modals */}
      <ProductEditModal 
        isOpen={isProductModalOpen}
        product={null}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        scannedBarcode={globalScannedBarcode}
        onScan={() => {
          setIsProductModalOpen(false);
          setIsScannerOpen(true);
        }}
      />

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScannerResult}
      />

      {/* Supplier Selector Modal */}
      <AnimatePresence>
        {isSupplierSelectorOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsSupplierSelectorOpen(false)} 
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-sm rounded-lg bg-white p-8 dark:bg-zinc-900 shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('select_supplier')}</h2>
                <button 
                  onClick={() => setIsSupplierSelectorOpen(false)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4 relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center pointer-events-none">
                  <Search size={16} className="text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder={t('search')}
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 rounded-lg py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                {suppliers.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 font-bold">{t('no_suppliers_found')}</div>
                ) : (
                  suppliers
                    .filter(s => s.name?.toLowerCase().includes(supplierSearchQuery.toLowerCase()) || s.typeOfGoods?.toLowerCase().includes(supplierSearchQuery.toLowerCase()) || s.phone?.includes(supplierSearchQuery))
                    .sort((a, b) => {
                      const today = new Date().getDay();
                      const aIsToday = !!a.visitDays?.includes(today);
                      const bIsToday = !!b.visitDays?.includes(today);
                      if (aIsToday && !bIsToday) return -1;
                      if (!aIsToday && bIsToday) return 1;
                      return a.name.localeCompare(b.name, 'ar');
                    })
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveSupplier({ id: s.id!, name: s.name });
                          setIsSupplierSelectorOpen(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/10 hover:text-brand-600 transition-all text-right border border-transparent hover:border-brand-100 group"
                      >
                        <div className="h-12 w-12 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-brand-600 group-hover:scale-110 transition-all">
                          <Truck size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-zinc-900 dark:text-white group-hover:text-brand-600">{s.name}</p>
                            {s.visitDays?.includes(new Date().getDay()) && (
                              <span className="text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/40 px-1.5 py-0.5 rounded-lg">{t('visits_today')}</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 font-mono">{s.typeOfGoods}</p>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSessionSummaryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsSessionSummaryOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-lg bg-white p-8 dark:bg-zinc-900 shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('session_details')}</h2>
                <button 
                  onClick={() => setIsSessionSummaryOpen(false)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('total_purchases_auto')}</label>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-2xl font-black text-zinc-900 dark:text-white text-center">
                    {formatCurrency(activeSupplier?.sessionTotal || 0, settings.currency)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('session_difference')}</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={sessionDifference}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      setSessionDifference(valStr);
                      const valNum = parseFloat(valStr) || 0;
                      const autoTotal = activeSupplier?.sessionTotal || 0;
                      const newTotal = parseFloat((autoTotal + valNum).toFixed(3));
                      setSessionFinalTotal(newTotal);
                    }}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg p-4 font-black text-lg focus:ring-2 focus:ring-brand-500 text-center transition-all focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-zinc-500 text-center">{t('session_difference_hint')}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">{t('final_amount_to_record')}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    value={sessionFinalTotal || ''}
                    onChange={(e) => {
                      const totalValStr = e.target.value;
                      const totalValNum = parseFloat(totalValStr) || 0;
                      setSessionFinalTotal(totalValNum);
                      const autoTotal = activeSupplier?.sessionTotal || 0;
                      const newDiff = parseFloat((totalValNum - autoTotal).toFixed(3));
                      setSessionDifference(newDiff.toString());
                    }}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg p-4 font-black text-lg focus:ring-2 focus:ring-brand-500 text-center transition-all focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-zinc-500 text-center">{t('edit_amount_hint')}</p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleEndSessionConfirm}
                    disabled={isSavingSession}
                    className="w-full py-4 rounded-lg bg-brand-600 text-white font-black text-sm tracking-widest shadow-lg shadow-brand-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSavingSession ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent mx-auto"></div> : t('save_and_end_session')}
                  </button>
                    {(!sessionFinalTotal || sessionFinalTotal <= 0) && (
                      <button
                        onClick={() => {
                           setActiveSupplier(null);
                           setIsSessionSummaryOpen(false);
                        }}
                        className="w-full mt-2 py-4 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-sm transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                         {t('end_session_without_saving') || 'إنهاء الجلسة بدون حفظ'}
                      </button>
                    )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

