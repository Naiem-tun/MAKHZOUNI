/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  WifiOff
} from 'lucide-react';
import { signInWithGoogle, auth } from './lib/firebase';

import { Login } from './components/auth/Login';
import { ProductEditModal } from './components/products/ProductEditModal';
import { BarcodeScanner } from './components/common/BarcodeScanner';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { handleFirestoreError, safeDispatchEvent } from './lib/utils';
import { OperationType } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Debts from './pages/Debts';
import Inventory from './pages/Inventory';
import SettingsPage from './pages/SettingsPage';
import Analytics from './pages/Analytics';
import Expenses from './pages/Expenses';
import ShoppingList from './pages/ShoppingList';

function AppContent() {
  const { user, loading, isOffline, isDataLoaded, settings, toggleDarkMode, setLanguage, updateSettings } = useAppContext();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('products');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      await addDoc(collection(db, path), {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsProductModalOpen(false);
      setGlobalScannedBarcode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/products`);
    }
  };

  const handleScannerResult = (barcode: string) => {
    setIsScannerOpen(false);
    setGlobalScannedBarcode(barcode);
    setIsProductModalOpen(true);
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

  const handleScannerClick = () => {
    if (activeTab === 'products') {
      safeDispatchEvent('open-barcode-scanner');
    } else {
      setIsScannerOpen(true);
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
                    {settings?.storeName || 'H.STORE'}
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
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans transition-colors duration-300">
      {/* Navbar to match screenshot */}
      <header className="sticky top-0 z-40 bg-white shadow-sm dark:bg-zinc-900">
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
              <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white ml-2">
                {settings.storeName || 'H.STORE'}
              </span>
            </div>

            {/* Left Icons Group */}
            <div className="flex items-center gap-4">
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
              <button onClick={toggleDarkMode} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                {settings.darkMode ? <Sun size={22} /> : <Moon size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation (Matches secondary nav style) */}
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-md dark:bg-zinc-900/80 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-1 py-2">
            {toolbarTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all relative ${
                   activeTab === tab.id 
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

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
                    className={`flex w-full items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
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
                  className="flex w-full items-center justify-between px-4 py-3 rounded-2xl transition-all text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'products' && <Products />}
            {activeTab === 'suppliers' && <Suppliers />}
            {activeTab === 'debts' && <Debts />}
            {activeTab === 'inventory' && <Inventory />}
            {activeTab === 'reports' && <Analytics />}
            {activeTab === 'expenses' && <Expenses />}
            {activeTab === 'shopping-list' && <ShoppingList />}
            {activeTab === 'settings' && <SettingsPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Action Buttons Unified (Matches Dashboard screenshot style) */}
      <AnimatePresence>
        {['dashboard', 'products'].includes(activeTab) && (
          <div className="fixed bottom-8 left-8 flex items-center gap-4 z-50 pointer-events-none">
            {/* Barcode Scanner Button - Primary style user liked */}
            <motion.button
              initial={{ scale: 0, x: -20 }}
              animate={{ scale: 1, x: 0 }}
              exit={{ scale: 0, x: -20 }}
              onClick={handleScannerClick}
              className="pointer-events-auto w-12 h-12 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 transition-all active:scale-95"
            >
              <ScanBarcode size={20} />
            </motion.button>

            {/* Add Button - Same size as Barcode button */}
            <motion.button
              initial={{ scale: 0, x: -20 }}
              animate={{ scale: 1, x: 0 }}
              exit={{ scale: 0, x: -20 }}
              transition={{ delay: 0.1 }}
              onClick={handlePlusClick}
              className="pointer-events-auto w-12 h-12 bg-[#4A6FA5] text-white rounded-2xl shadow-xl flex items-center justify-center transition-all active:scale-95 hover:bg-[#4A6FA5]/90"
            >
              <Plus size={24} />
            </motion.button>
          </div>
        )}
      </AnimatePresence>

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

