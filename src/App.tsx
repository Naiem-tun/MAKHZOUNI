/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, Suspense, lazy, useRef } from "react";
import { AppProvider, useAppContext } from "./AppContext";
import { syncTracker } from "./lib/syncTracker";
import { AppHeader } from "./components/layout/AppHeader";
import { AppMobileMenu } from "./components/layout/AppMobileMenu";
import { AppBottomNav } from "./components/layout/AppBottomNav";
import { GuestModeBanner } from "./components/common/GuestModeBanner";

import { Logo } from "./components/UI";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
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
  Sparkles,
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
  CloudOff,
  Cloud,
  CloudLightning,
  CheckCircle2,
  UserCheck,
  Play,
  Calculator,
  Square,
  ChevronDown,
  TrendingUp,
  PieChart as PieChartIcon,
  History,
  LineChart,
  Store,
  Eye,
  EyeOff,
  PackagePlus,
  BookImage,
  RotateCcw,
  Activity,
  Coins,
} from "lucide-react";
import { signInWithGoogle, auth } from "./lib/firebase";

import { Login } from "./components/auth/Login";
import { ProductForm } from "./components/ProductForm";
import { SupplierSelector } from "./components/SupplierSelector";
import { SessionSummaryModal } from "./components/SessionSummaryModal";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "./lib/firebase";
import {
  handleFirestoreError,
  safeDispatchEvent,
  formatCurrency,
} from "./lib/utils";
import { OperationType, Supplier } from "./types";

// Fast/Core Pages (Static Import)
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import POSInvoice from "./pages/POSInvoice";
import MonitoredProducts from "./pages/MonitoredProducts";
import ShoppingList from "./pages/ShoppingList";
import Expenses from "./pages/Expenses";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import Debts from "./pages/Debts";
import InvoiceCalculator from "./pages/InvoiceCalculator";
import CatalogMode from "./pages/CatalogMode";
import DraftProducts from "./pages/DraftProducts";

// Heavy Pages (Lazy loaded)
const Analytics = lazy(() => import("./pages/Analytics"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Invoices = lazy(() => import("./pages/Invoices"));
const CustomerTracking = lazy(() => import("./pages/CustomerTracking"));


function AppContent() {
  const {
    user,
    loading,
    isGuest,
    setIsGuest,
    isOffline,
    isDataLoaded,
    settings,
    toggleDarkMode,
    setLanguage,
    updateSettings,
    activeSupplier,
    setActiveSupplier,
    showToast,
    isSessionSummaryOpen,
    setIsSessionSummaryOpen,
    isCatalogMode,
    setIsCatalogMode,
    activeTab,
    setActiveTab,
  } = useAppContext();
  const { t } = useTranslation();
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    new Set(["products"]),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMainPagesOpen, setIsMainPagesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isFinancialsOpen, setIsFinancialsOpen] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowSyncMenu(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    setMountedTabs((prev) => {
      const newSet = new Set(prev);
      newSet.add(activeTab);
      return newSet;
    });
  }, [activeTab]);

  // Back button handling logic
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (activeTab !== prevTabRef.current) {
      if (activeTab === "products") {
        if (window.history.state?.isInnerTab) {
          window.history.back();
        }
      } else if (prevTabRef.current === "products") {
        window.history.pushState({ isInnerTab: true }, "");
      } else {
        window.history.replaceState({ isInnerTab: true }, "");
      }
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      if (activeTab !== "products") {
        setActiveTab("products");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeTab]);

  // Dark mode effect
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  const allTabs = [
    { id: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { id: "products", label: t("products"), icon: Package },
    { id: "customer-tracking", label: "حساب الحرفاء", icon: UserCheck },
    { id: "suppliers", label: t("suppliers"), icon: Truck },
    { id: "debts", label: t("debts"), icon: BookOpen },
    { id: "inventory", label: t("inventory"), icon: ClipboardCheck },
    { id: "invoices", label: t("sales_reports") || "تقارير المبيعات", icon: Coins },
    { id: "reports", label: t("reports"), icon: BarChart3 },
    { id: "expenses", label: t("expenses"), icon: Wallet },

    // Top standalone tabs
    ...(settings.showShoppingList !== false
      ? [{ id: "shopping-list", label: t("shopping_list"), icon: ShoppingCart }]
      : []),
    ...(settings.enablePOS === true
      ? [{ id: "pos", label: "نقاط البيع", icon: Calculator }]
      : []),
    {
      id: "invoice-calculator",
      label: t("invoice_calculator"),
      icon: Calculator,
    },

    // Bottom standalone tabs
    { id: "settings", label: t("settings"), icon: Settings },
    { id: "draft-products", label: "قائمة النقل", icon: PackagePlus },
    { id: "monitored-products", label: "المنتجات تحت المراقبة", icon: Eye },
    { id: "audit-logs", label: t("audit_logs") || "سجل النشاطات", icon: Activity },
    {
      id: "catalog-mode",
      label: t("catalog_mode") || "وضع الكتالوج",
      icon: BookImage,
    },
  ];

  const mainPagesTabs = allTabs.filter((tab) =>
    [
      "dashboard",
      "products",
      "customer-tracking",
      "suppliers",
      "debts",
      "inventory",
      "invoices",
      "expenses",
    ].includes(tab.id),
  );
  const toolbarTabs = allTabs.filter((tab) =>
    ["dashboard", "products", "suppliers", "debts", "inventory"].includes(
      tab.id,
    ),
  );
  const otherTabs = allTabs.filter(
    (tab) =>
      ![
        "dashboard",
        "products",
        "customer-tracking",
        "suppliers",
        "debts",
        "inventory",
        "invoices",
        "expenses",
        "reports",
      ].includes(tab.id),
  );

  const reportsSubpages = [
    {
      id: "financial",
      label: t("analytics_financial") || "إحصائيات المال",
      icon: LineChart,
    },
    {
      id: "rankings",
      label: t("analytics_rankings") || "المنتجات الأفضل",
      icon: TrendingUp,
    },
    {
      id: "categories",
      label: t("category_analysis") || "تحليل الفئات الاستراتيجي",
      icon: PieChartIcon,
    },
    {
      id: "purchases",
      label: t("analytics_purchases") || "حركة المشتريات",
      icon: History,
    },
  ];

  const handlePlusClick = () => {
    const eventMap: Record<string, string> = {
      suppliers: "open-supplier-modal",
      debts: "open-debt-modal",
      inventory: "save-inventory-jard",
    };

    if (activeTab === "dashboard" || activeTab === "products") {
      safeDispatchEvent("open-product-modal");
    } else if (eventMap[activeTab]) {
      safeDispatchEvent(eventMap[activeTab]);
    }
  };

  const isScannerTab =
    activeTab === "products" ||
    activeTab === "invoice-calculator" ||
    activeTab === "pos" ||
    activeTab === "inventory";

  const handleScannerClick = () => {
    if (isScannerTab) {
      safeDispatchEvent(`open-barcode-scanner-${activeTab}`);
    } else {
      if (settings.enablePOS) {
        setShowQuickActionModal(true);
      } else {
        setActiveTab("invoice-calculator");
      }
    }
  };

  const showSplash = loading || (!!user && !isDataLoaded);

  if (user && isCatalogMode) {
    return <CatalogMode />;
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950"
          >
            {/* Soft Ambient Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-100/60 via-white to-zinc-50 dark:from-brand-900/30 dark:via-zinc-950 dark:to-zinc-950"></div>

            {/* Animated Soft Glowing Orbs */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -left-10 w-[500px] h-[500px] bg-brand-300/50 dark:bg-brand-700/30 rounded-full blur-[120px] pointer-events-none"
            />
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
              className="absolute top-1/4 -right-20 w-[400px] h-[400px] bg-blue-300/40 dark:bg-blue-700/20 rounded-full blur-[120px] pointer-events-none"
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-brand-200/50 via-transparent to-transparent dark:from-brand-800/20 scale-150 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="p-4 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-100 dark:border-zinc-800">
                  <Logo className="h-16 w-16" />
                </div>

                <div className="text-center space-y-1">
                  <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
                    {settings?.storeName || t("makhzouni")}
                  </h1>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-12 w-full flex flex-col gap-6"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="flex flex-col items-center gap-1.5 px-4 mb-2">
                    <span className="text-[15px] font-bold text-zinc-800 dark:text-zinc-200 text-center leading-relaxed">
                      «كنت أعالج وأنمي، ولا أزدري ربحاً،
                      <br />
                      ولا أشتري شيخاً، وأجعل الرأس رأسين»
                    </span>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500 text-center">
                      — عثمان بن عفان رضي الله عنه
                    </span>
                  </div>
                  <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 text-center animate-pulse">
                    نقوم بتجهيز سجلاتك ومزامنة البيانات...
                  </span>
                </div>

                {/* Skeleton UI Pattern */}
                <div className="flex flex-col gap-3 w-full mt-2">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0.3 }}
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "easeInOut",
                        delay: i * 0.2,
                      }}
                      className="flex items-center gap-4 w-full p-4 bg-white/60 dark:bg-zinc-900/60 rounded-2xl border border-zinc-100 dark:border-zinc-800/50"
                    >
                      <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="h-2.5 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                        <div className="h-2.5 w-1/4 bg-zinc-100 dark:bg-zinc-800/50 rounded-full" />
                      </div>
                      <div className="w-16 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full shrink-0" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !user && !isGuest && <Login />}

      {!loading && (user || isGuest) && (
        <div
          className={`flex flex-col bg-[#F4F7FB] dark:bg-[#0B1121] font-sans transition-colors duration-300 relative min-h-[100dvh]`}
        >
          {isGuest && (
            <GuestModeBanner onExitGuestMode={() => setIsGuest(false)} />
          )}
          <AppHeader setMobileMenuOpen={setMobileMenuOpen} activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Mobile Menu */}
          <AppMobileMenu
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mainPagesTabs={mainPagesTabs}
            reportsSubpages={reportsSubpages}
            otherTabs={otherTabs}
          />

          {/* Main Content */}
          <main
            className={`mx-auto max-w-7xl relative w-full flex-1 flex flex-col px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 min-h-[500px]`}
          >
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center p-12 text-zinc-400 flex-1">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                    className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-brand-500 mb-4"
                  />
                  <span className="text-sm font-medium">{t("loading")}</span>
                </div>
              }
            >
              <div className="w-full h-full relative flex-1 flex flex-col">
                <div className={activeTab === "dashboard" ? "block" : "hidden"}>
                  {mountedTabs.has("dashboard") && <Dashboard />}
                </div>
                <div className={activeTab === "products" ? "block" : "hidden"}>
                  {mountedTabs.has("products") && <Products />}
                </div>
                <div className={activeTab === "customer-tracking" ? "block" : "hidden"}>
                  {mountedTabs.has("customer-tracking") && <CustomerTracking />}
                </div>
                <div className={activeTab === "suppliers" ? "block" : "hidden"}>
                  {mountedTabs.has("suppliers") && <Suppliers />}
                </div>
                <div className={activeTab === "debts" ? "block" : "hidden"}>
                  {mountedTabs.has("debts") && <Debts />}
                </div>
                <div className={activeTab === "inventory" ? "block" : "hidden"}>
                  {mountedTabs.has("inventory") && <Inventory />}
                </div>
                <div className={activeTab === "reports" ? "block" : "hidden"}>
                  {mountedTabs.has("reports") && <Analytics />}
                </div>
                <div className={activeTab === "expenses" ? "block" : "hidden"}>
                  {mountedTabs.has("expenses") && <Expenses />}
                </div>
                <div className={activeTab === "invoices" ? "block" : "hidden"}>
                  {mountedTabs.has("invoices") && <Invoices />}
                </div>
                <div
                  className={activeTab === "shopping-list" ? "block" : "hidden"}
                >
                  {mountedTabs.has("shopping-list") && <ShoppingList />}
                </div>
                <div
                  className={
                    activeTab === "draft-products" ? "block" : "hidden"
                  }
                >
                  {mountedTabs.has("draft-products") && <DraftProducts />}
                </div>
                <div
                  className={
                    activeTab === "monitored-products" ? "block" : "hidden"
                  }
                >
                  {mountedTabs.has("monitored-products") && (
                    <MonitoredProducts />
                  )}
                </div>
                <div
                  className={
                    activeTab === "pos" ? "block" : "hidden"
                  }
                >
                  {mountedTabs.has("pos") && (
                    <POSInvoice />
                  )}
                </div>

                <div
                  className={
                    activeTab === "invoice-calculator" ? "block" : "hidden"
                  }
                >
                  {mountedTabs.has("invoice-calculator") && (
                    <InvoiceCalculator />
                  )}
                </div>
                <div className={activeTab === "settings" ? "block" : "hidden"}>
                  {mountedTabs.has("settings") && <SettingsPage />}
                </div>
                <div className={activeTab === "audit-logs" ? "block" : "hidden"}>
                  {mountedTabs.has("audit-logs") && <AuditLogs />}
                </div>
              </div>
            </Suspense>
          </main>

          {/* Bottom Navigation Navbar */}
          <AppBottomNav
            isScannerTab={isScannerTab}
            handleScannerClick={handleScannerClick}
            toolbarTabs={toolbarTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <ProductForm user={user} />
          <SupplierSelector />

          <AnimatePresence>
            {showQuickActionModal && (
              <div id="quick-action-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                {/* Backdrop */}
                <motion.div
                  id="quick-action-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setShowQuickActionModal(false)}
                  className="absolute inset-0 bg-black/60"
                />

                {/* Modal Container */}
                <motion.div
                  id="quick-action-modal"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                  className="relative w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border-t sm:border border-zinc-100 dark:border-zinc-800 z-10 select-none pb-10 sm:pb-6"
                >
                  {/* Pull bar for mobile */}
                  <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-5 sm:hidden" />

                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                      {t("choose_operation") || "اختيار نوع العملية"}
                    </h3>
                    <button
                      id="quick-action-close-btn"
                      onClick={() => setShowQuickActionModal(false)}
                      className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Quick Options */}
                  <div className="grid grid-cols-1 gap-3.5">
                    {/* Option 1: POS (Retail Sale) */}
                    <button
                      id="quick-action-pos-btn"
                      onClick={() => {
                        setActiveTab("pos");
                        setShowQuickActionModal(false);
                      }}
                      className="flex items-center gap-4 p-4 text-right rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 hover:bg-brand-50/40 dark:bg-zinc-900/50 dark:hover:bg-brand-950/10 hover:border-brand-100 dark:hover:border-brand-900/30 transition-all duration-75 group active:scale-[0.98]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-all duration-75">
                        <Store size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-zinc-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {t("pos_quick") || "شاشة البيع بالتجزئة (الكاشير POS)"}
                        </h4>
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                          {t("pos_quick_desc") || "تسجيل مبيعات جديدة للزبائن مع خصم فوري من المخزون وتحديث الكاشير."}
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Invoice Calculator (Purchase) */}
                    <button
                      id="quick-action-invoice-btn"
                      onClick={() => {
                        setActiveTab("invoice-calculator");
                        setShowQuickActionModal(false);
                      }}
                      className="flex items-center gap-4 p-4 text-right rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 hover:bg-blue-50/40 dark:bg-zinc-900/50 dark:hover:bg-blue-950/10 hover:border-blue-100 dark:hover:border-blue-900/30 transition-all duration-75 group active:scale-[0.98]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all duration-75">
                        <Calculator size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {t("invoice_calc_quick") || "فاتورة مشتريات (حاسبة الفواتير)"}
                        </h4>
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                          {t("invoice_calc_quick_desc") || "إضافة سلع جديدة، حساب الأرباح، وضبط تكلفة المشتريات ومزامنة المخازن."}
                        </p>
                      </div>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <SessionSummaryModal />
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
