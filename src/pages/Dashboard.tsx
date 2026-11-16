import React, { useState, useMemo, memo, useEffect } from 'react';
import { collection, onSnapshot, query, limit, orderBy, where, doc, deleteDoc, updateDoc, getDoc, addDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { syncTracker } from '../lib/syncTracker';
import { 
  Plus, 
  Truck,
  CreditCard,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  FileDown,
  Sun,
  Moon,
  Trash2,
  Check,
  X,
  Wallet,
  Search,
  ArrowUpLeft
} from 'lucide-react';
import { cn, formatCurrency, safeDispatchEvent, safeParseDate, formatAppDate, cleanQuantity, formatQuantity, sanitizeProduct } from '../lib/utils';
import { Product, Transaction, OperationType, Supplier } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { PrintPurchasesModal } from '../components/dashboard/PrintPurchasesModal';
import { PurchaseVarianceModal, matchesQuery } from '../components/dashboard/PurchaseVarianceModal';
import { PurchaseVarianceFolioCard } from '../components/dashboard/PurchaseVarianceFolioCard';
import {
  FolioCategoriesAndSuppliers,
  FolioPurchaseCurveChart,
} from '../components/dashboard/DashboardFolioWidgets';
import { useFolioTheme } from '../components/folio/FolioPageChrome';
import { calculatePurchaseVariance } from '../lib/purchaseVarianceCalculator';

import { useTranslation } from 'react-i18next';
const Dashboard = memo(() => {
  const { user, settings, showToast, setActiveTab } = useAppContext();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [allPurchases, setAllPurchases] = useState<Transaction[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`dashboard_purchases_${user.uid}`);
      return cached ? JSON.parse(cached).map((p: any) => ({ ...p, date: safeParseDate(p.date) })) : [];
    } catch { return []; }
  });
  const [expenses, setExpenses] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`dashboard_expenses_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [debts, setDebts] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`dashboard_debts_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`dashboard_suptx_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`dashboard_suppliers_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [showDeletePurchases, setShowDeletePurchases] = useState(false);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isVarianceModalOpen, setIsVarianceModalOpen] = useState(false);
  const [isVarianceCardCollapsed, setIsVarianceCardCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('variance_card_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [expandedPurchaseGroups, setExpandedPurchaseGroups] = useState<Record<string, boolean>>({});
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const toggleVarianceCardCollapsed = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsVarianceCardCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('variance_card_collapsed', String(next)); } catch {}
      return next;
    });
  };

  const purchaseVarianceAnalysis = useMemo(() => {
    return calculatePurchaseVariance(products, allPurchases);
  }, [products, allPurchases]);

  const togglePurchaseGroup = (groupKey: string) => {
    setExpandedPurchaseGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const groupedPurchases = useMemo(() => {
    if (!allPurchases) return [];
    
    const groupsMap = new Map<string, any>();

    allPurchases.forEach((p: any) => {
      const parsedDate = safeParseDate(p.date);
      const dateStr = formatAppDate(parsedDate, settings.language, t);
      const supplierName = p.supplierName || t('unknown_supplier');
      const invoiceSuffix = p.invoiceNumber ? ` #${p.invoiceNumber}` : '';
      const groupKey = `${supplierName}-${dateStr}${invoiceSuffix}`;

      if (groupsMap.has(groupKey)) {
        groupsMap.get(groupKey).items.push(p);
        groupsMap.get(groupKey).totalAmount += (p.amount || 0);
      } else {
        groupsMap.set(groupKey, {
          key: groupKey,
          supplierName: p.supplierName,
          date: dateStr,
          invoiceNumber: p.invoiceNumber,
          items: [p],
          totalAmount: p.amount || 0
        });
      }
    });

    // Return the latest 50 purchase groups (without truncating items inside each group)
    return Array.from(groupsMap.values()).slice(0, 50);
  }, [allPurchases, settings.language, t]);

  const filteredPurchaseGroups = useMemo(() => {
    const q = purchaseSearch.trim();
    if (!q) return groupedPurchases;
    return groupedPurchases.filter((g: any) => {
      if (matchesQuery(g.supplierName, q)) return true;
      if (g.invoiceNumber && matchesQuery(String(g.invoiceNumber), q)) return true;
      return (g.items || []).some((item: any) => matchesQuery(item.productName, q));
    });
  }, [groupedPurchases, purchaseSearch]);

  useEffect(() => {
    if (!user) return;

    const productsPath = `users/${user.uid}/products`;
    const purchasesPath = `users/${user.uid}/purchases`;
    const expensesPath = `users/${user.uid}/expenses`;
    const debtsPath = `users/${user.uid}/debts`;
    const supplierTxPath = `users/${user.uid}/supplierTransactions`;
    const suppliersPath = `users/${user.uid}/suppliers`;
    
    const productsQuery = collection(db, productsPath);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const purchasesQuery = collection(db, purchasesPath);
    const expensesQuery = collection(db, expensesPath);
    const debtsQuery = collection(db, debtsPath);
    const supplierTxQuery = collection(db, supplierTxPath);
    const suppliersQuery = collection(db, suppliersPath);

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      const fetched = snap.docs.map(doc => sanitizeProduct({ id: doc.id, ...doc.data() } as Product));
      setProducts(fetched);
      try { localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(fetched)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, productsPath);
    });

    const unsubPurchases = onSnapshot(purchasesQuery, (snap) => {
      const fetched = snap.docs.map(doc => {
        const data = doc.data();
        const parsedDate = safeParseDate(data.date || data.createdAt);
        const cleanQtyAdded = cleanQuantity(data.qtyAdded);
        
        return { 
          id: doc.id, 
          productId: data.productId,
          productName: data.productName,
          quantityChange: cleanQtyAdded,
          amount: data.amount || 0,
          price: cleanQtyAdded > 0 ? (data.amount / cleanQtyAdded) : 0,
          supplierId: data.supplierId || null,
          supplierName: data.supplierName || null,
          date: parsedDate,
          unit: data.unit || 'piece',
          piecesPerBox: data.piecesPerBox || 1,
          invoiceNumber: data.invoiceNumber || null,
          createdAt: data.createdAt ? safeParseDate(data.createdAt) : parsedDate,
        } as any;
      }).sort((a, b) => b.date.getTime() - a.date.getTime());
      setAllPurchases(fetched);
      try { localStorage.setItem(`dashboard_purchases_${user.uid}`, JSON.stringify(fetched)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, purchasesPath);
    });

    const unsubExpenses = onSnapshot(expensesQuery, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(fetched);
      try { localStorage.setItem(`dashboard_expenses_${user.uid}`, JSON.stringify(fetched)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, expensesPath);
    });

    const unsubDebts = onSnapshot(debtsQuery, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDebts(fetched);
      try { localStorage.setItem(`dashboard_debts_${user.uid}`, JSON.stringify(fetched)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, debtsPath);
    });

    const unsubSupplierTx = onSnapshot(supplierTxQuery, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupplierTransactions(fetched);
      try { localStorage.setItem(`dashboard_suptx_${user.uid}`, JSON.stringify(fetched)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, supplierTxPath);
    });

    const unsubSuppliers = onSnapshot(suppliersQuery, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(fetched);
      try { localStorage.setItem(`dashboard_suppliers_${user.uid}`, JSON.stringify(fetched)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, suppliersPath);
    });

    return () => {
      unsubProducts();
      unsubPurchases();
      unsubExpenses();
      unsubDebts();
      unsubSupplierTx();
      unsubSuppliers();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.purchasePrice || p.costPrice) || 0)), 0);
    const lowStock = products.filter(p => (Number(p.quantity) || 0) < (Number(p.minQuantity) || 10)).length;
    
    // Calculate category breakdown & Expected Profit
    let totalSalesValue = 0;
    const cats: Record<string, { count: number, totalPurchase: number, totalQuantity: number }> = {};
    
    products.forEach(p => {
      const q = Number(p.quantity) || 0;
      const pp = Number(p.purchasePrice || p.costPrice) || 0;
      const sp = Number(p.sellingPrice) || 0;
      
      totalSalesValue += q * sp;
      
      const cat = p.category || 'other_cat';
      if (!cats[cat]) {
        cats[cat] = { count: 0, totalPurchase: 0, totalQuantity: 0 };
      }
      cats[cat].count += 1;
      cats[cat].totalQuantity += q;
      cats[cat].totalPurchase += q * pp;
    });

    const categoryAnalysis = Object.entries(cats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalPurchase - a.totalPurchase)
      .slice(0, 4); // Top 4 categories

    const expectedProfit = totalSalesValue - totalValue;

    // Only calculate pending expenses (not yet audited in inventory)
    const pendingExpenses = expenses.filter(e => !e.audited);
    const totalExpenses = pendingExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    const totalCustomerDebts = debts.filter(d => d.type !== 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const totalSupplierDebts = debts.filter(d => d.type === 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

    // Active cycle tracking start date: aligned with Suppliers cycle clear date
    const trackingStartDate = settings?.lastSuppliersClearDate 
      ? new Date(settings.lastSuppliersClearDate)
      : (supplierTransactions.length > 0 
          ? new Date(Math.min(...supplierTransactions.map((t: any) => safeParseDate(t.date).getTime()))) 
          : new Date(0));

    // Active transactions for current open cycle (resets when a cycle is archived)
    const activeSupplierTransactions = supplierTransactions.filter(t => {
      // 1. If explicitly marked as archived, it belongs to an archived cycle
      if (t.archived === true) return false;

      // 2. Check if dated/created before last clear/archive date
      if (settings?.lastSuppliersClearDate) {
        const clearTime = new Date(settings.lastSuppliersClearDate).getTime();
        const txTime = safeParseDate(t.date).getTime();
        const updatedTime = t.updatedAt ? safeParseDate(t.updatedAt).getTime() : 0;
        const createdTime = t.createdAt ? safeParseDate(t.createdAt).getTime() : 0;
        if (txTime < clearTime && createdTime < clearTime && updatedTime < clearTime) {
          return false;
        }
      }

      // 3. If explicitly marked as not archived, it belongs to active cycle
      if (t.archived === false) return true;

      // 4. Legacy records fallback without boolean archived field
      const txTime = safeParseDate(t.date).getTime();
      const updatedTime = t.updatedAt ? safeParseDate(t.updatedAt).getTime() : 0;
      const createdTime = t.createdAt ? safeParseDate(t.createdAt).getTime() : 0;

      if (updatedTime >= trackingStartDate.getTime() || createdTime >= trackingStartDate.getTime()) {
        return true;
      }

      const startOfDayTracking = new Date(trackingStartDate);
      startOfDayTracking.setHours(0, 0, 0, 0);
      return txTime >= startOfDayTracking.getTime();
    });

    const totalSupplierPurchasesValue = activeSupplierTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const allTimeSupplierPurchasesValue = supplierTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalAllPurchasesValue = allPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);
    const unregisteredPurchasesValue = Math.max(0, totalAllPurchasesValue - totalSupplierPurchasesValue);

    const todayStr = safeParseDate(new Date()).toDateString();
    const todayPurchases = allPurchases.filter(p => {
      const pDate = safeParseDate(p.date).toDateString();
      const pCreated = (p as any).createdAt ? safeParseDate((p as any).createdAt).toDateString() : pDate;
      return pDate === todayStr || pCreated === todayStr;
    });
    const todayPurchasesTotal = todayPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);

    // Group purchases by date for movement list
    const dailyMovements = allPurchases.reduce((acc: any, p) => {
      const dateKey = safeParseDate(p.date).toDateString();
      if (!acc[dateKey]) acc[dateKey] = 0;
      acc[dateKey] += p.amount || 0;
      return acc;
    }, {});

    const movementHistory = Object.entries(dailyMovements)
      .map(([date, total]) => ({ date, total: total as number }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Top Suppliers Analysis based on active cycle purchases
    const suppliersData: Record<string, { name: string, debt: number, purchaseVolume: number }> = {};
    
    // Initialize with actual active suppliers
    suppliers.forEach(s => {
      if (s.name) {
        suppliersData[s.name] = { name: s.name, debt: 0, purchaseVolume: 0 };
      }
    });

    debts.filter(d => d.type === 'payable').forEach(d => {
      const name = d.customerName || 'غير معروف';
      if (!suppliersData[name]) {
        suppliersData[name] = { name, debt: 0, purchaseVolume: 0 };
      }
      suppliersData[name].debt += Number(d.totalAmount) || 0;
    });

    activeSupplierTransactions.forEach(t => {
      const supplier = suppliers.find(s => s.id === t.supplierId);
      const name = supplier?.name || 'غير معروف';
      
      if (name && name !== 'غير معروف') {
        if (!suppliersData[name]) {
          suppliersData[name] = { name, debt: 0, purchaseVolume: 0 };
        }
        suppliersData[name].purchaseVolume += Number(t.amount) || 0;
      }
    });

    const topSuppliers = Object.values(suppliersData)
      .sort((a, b) => b.purchaseVolume - a.purchaseVolume) // Sort by volume
      .slice(0, 4); // Top 4

    return { 
      totalProducts: products.length, 
      lowStock, 
      totalValue,
      totalSalesValue,
      expectedProfit,
      categoryAnalysis,
      topSuppliers,
      totalExpenses,
      totalCustomerDebts,
      totalSupplierDebts,
      totalSupplierPurchasesValue,
      allTimeSupplierPurchasesValue,
      totalAllPurchasesValue,
      unregisteredPurchasesValue,
      todayPurchasesTotal,
      movementHistory
    };
  }, [products, expenses, debts, supplierTransactions, allPurchases, suppliers, settings?.lastSuppliersClearDate]);

  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: t('good_morning') || 'صباح الخير', icon: <Sun size={20} className="text-amber-400" /> };
    if (hour < 18) return { text: t('good_afternoon') || 'مساء الخير', icon: <Sun size={20} className="text-orange-400" /> };
    return { text: t('good_evening') || 'مساء الخير', icon: <Moon size={20} className="text-brand-300" /> };
  };

  const greeting = getGreeting();

  const formatPrivateValue = (val: number) => !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  const onAddProduct = () => {
    safeDispatchEvent('open-product-modal');
  };

  const handleDeletePurchase = async (purchase: any) => {
    if (!user) return;
    setDeletingPurchaseId(null);

    try {
      const batch = writeBatch(db);

      // 1. Delete purchase
      const purchaseRef = doc(db, `users/${user.uid}/purchases`, purchase.id);
      batch.delete(purchaseRef);
      
      // 2. Update product quantity
      if (purchase.productId) {
        const productRef = doc(db, `users/${user.uid}/products`, purchase.productId);
        // نستخدم set مع merge لتجنب الحاجة للاتصال بالإنترنت لفحص وجود المنتج (getDoc)
        batch.set(productRef, { quantity: increment(-(purchase.quantityChange || 0)) }, { merge: true });
      }

      // 3. Add supplier refund transaction
      if (purchase.supplierId && purchase.amount > 0) {
        const supplierTxRef = doc(collection(db, `users/${user.uid}/supplierTransactions`));
        batch.set(supplierTxRef, {
          supplierId: purchase.supplierId,
          amount: -(purchase.amount),
          date: new Date(),
          note: t('purchase_deleted_refund') || 'استرجاع بسبب حذف مشتريات',
          updatedAt: new Date(),
        });
      }
      
      // 4. Log audit
      const auditRef = doc(collection(db, `users/${user.uid}/auditLogs`));
      batch.set(auditRef, {
        action: 'delete',
        entityType: 'purchase',
        entityId: purchase.id,
        entityName: purchase.productName || 'منتج غير معروف',
        details: `حذف عملية شراء بقيمة: ${purchase.amount || 0}`,
        timestamp: new Date(),
      });
      
      // Commit the transaction
      await syncTracker.track(batch.commit());
      
      showToast(t('item_deleted_success') || 'تم الحذف وتحديث الكمية بنجاح', 'success');
    } catch (error) {
      console.error('Error deleting purchase:', error);
      showToast(t('error_deleting') || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  return (
    <div
      className="min-h-screen -mx-2.5 sm:mx-0 pt-1 pb-24 transition-colors"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto space-y-4">
        {/* FOLIO EDITORIAL HEADER */}
        <header
          className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
              <span>لوحة المتابعة اليومية</span>
              <span aria-hidden="true">·</span>
              <span>{settings.storeName || 'مخزوني'}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight"
              style={{ color: theme.text }}
            >
              {t('dashboard')}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
              <span className="inline-flex items-center gap-1.5">
                {greeting.icon}
                <span>{greeting.text}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                مشتريات اليوم:{' '}
                <strong className="font-mono tabular-nums" style={{ color: theme.text }}>
                  {formatPrivateValue(stats.todayPurchasesTotal)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onAddProduct}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              <Plus size={14} />
              <span>منتج جديد</span>
            </button>
          </div>
        </header>

        {/* SECTION 01: MASTER INVENTORY VALUATION HERO (FOLIO BORDERED) */}
        <section
          className="border transition-colors text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="p-4 sm:p-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  01
                </span>
                <span style={{ color: theme.textMuted }}>{t('inventory_value')}</span>
              </div>
              <span className="text-[11px] font-bold" style={{ color: theme.textMuted }}>
                بسعر البيع المتوقع:{' '}
                <strong className="font-mono tabular-nums" style={{ color: theme.text }}>
                  {formatPrivateValue(stats.totalSalesValue)}
                </strong>
              </span>
            </div>

            <div
              className="text-3xl sm:text-5xl font-black font-mono tabular-nums tracking-tight pt-1"
              style={{ color: theme.text }}
            >
              {formatPrivateValue(stats.totalValue)}
            </div>
          </div>

          <div
            className="grid grid-cols-3 border-t divide-x divide-x-reverse"
            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
          >
            <div
              onClick={() => setActiveTab('products')}
              className="p-3.5 sm:p-4 space-y-1 cursor-pointer transition-colors"
              style={{ borderColor: theme.border }}
            >
              <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
                {t('total_products')}
              </div>
              <div
                className="text-lg sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.text }}
              >
                {stats.totalProducts.toLocaleString('en-US')}
              </div>
            </div>

            <div
              onClick={() => setActiveTab('products')}
              className="p-3.5 sm:p-4 space-y-1 cursor-pointer transition-colors"
              style={{ borderColor: theme.border }}
            >
              <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
                {t('low_stock')}
              </div>
              <div
                className="text-lg sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: stats.lowStock > 0 ? theme.negative : theme.text }}
              >
                {stats.lowStock.toLocaleString('en-US')}
              </div>
            </div>

            <div
              onClick={() => setActiveTab('reports')}
              className="p-3.5 sm:p-4 space-y-1 cursor-pointer transition-colors"
              style={{ borderColor: theme.border }}
            >
              <div className="text-[11px] font-bold truncate" style={{ color: theme.textMuted }}>
                الربح المتوقع
              </div>
              <div
                className="text-lg sm:text-2xl font-black font-mono tabular-nums"
                style={{ color: theme.positive }}
              >
                {formatPrivateValue(stats.expectedProfit)}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 02: FINANCIAL SUMMARY (4-CELL FOLIO MATRIX) */}
        <section
          className="border"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                02
              </span>
              <span style={{ color: theme.text }}>الحسابات والالتزامات المالية</span>
            </div>
            <span className="text-[11px]" style={{ color: theme.textMuted }}>
              انقر لفتح القسم
            </span>
          </div>

          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-px"
            style={{ backgroundColor: theme.border }}
          >
            {[
              {
                label: t('customer_debts'),
                sub: 'ديون مستحقة التحصيل',
                value: stats.totalCustomerDebts,
                icon: CreditCard,
                tone: theme.positive,
                onClick: () => setActiveTab('debts'),
              },
              {
                label: t('supplier_debts'),
                sub: 'مستحقات للموردين',
                value: stats.totalSupplierDebts,
                icon: Truck,
                tone: stats.totalSupplierDebts > 0 ? theme.negative : theme.text,
                onClick: () => setActiveTab('suppliers'),
              },
              {
                label: t('expenses'),
                sub: t('waiting_label', 'بانتظار الجرد'),
                value: stats.totalExpenses,
                icon: Wallet,
                tone: theme.text,
                onClick: () => setActiveTab('expenses'),
              },
              {
                label: t('total_supplier_purchases'),
                sub: 'مشتريات الدورة المفتوحة',
                value: stats.totalSupplierPurchasesValue,
                icon: ShoppingCart,
                tone: theme.accent,
                onClick: () => setActiveTab('suppliers'),
              },
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={item.onClick}
                className="p-4 text-right flex flex-col justify-between gap-3 transition-colors cursor-pointer"
                style={{ backgroundColor: theme.surface, color: theme.text }}
              >
                <div className="flex items-center justify-between w-full">
                  <item.icon size={15} style={{ color: theme.accent }} />
                  <ArrowUpLeft size={13} style={{ color: theme.textMuted }} />
                </div>
                <div className="space-y-1">
                  <div
                    className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight"
                    style={{ color: item.tone }}
                  >
                    {formatPrivateValue(item.value)}
                  </div>
                  <div className="text-xs font-bold leading-snug" style={{ color: theme.text }}>
                    {item.label}
                  </div>
                  <div className="text-[10px]" style={{ color: theme.textMuted }}>
                    {item.sub}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 03: SMOOTH CURVED PURCHASE MOVEMENT CHART */}
        <FolioPurchaseCurveChart
          purchases={allPurchases}
          theme={theme}
          language={language}
          formatPrivateValue={formatPrivateValue}
          t={t}
        />

        {/* SECTION 04: PURCHASE PRICE VARIANCE FOLIO ENTRY PANEL */}
        <PurchaseVarianceFolioCard
          analysis={purchaseVarianceAnalysis}
          currency={settings.currency}
          language={language}
          showFinancials={showFinancials}
          darkMode={Boolean(settings.darkMode)}
          isCollapsed={isVarianceCardCollapsed}
          onToggleCollapse={toggleVarianceCardCollapsed}
          onOpenModal={() => setIsVarianceModalOpen(true)}
          themeOverride={theme}
          sectionIndex="04"
        />

        {/* SECTION 05: CATEGORIES & TOP SUPPLIERS FOLIO TABLES */}
        <FolioCategoriesAndSuppliers
          categoryAnalysis={stats.categoryAnalysis}
          topSuppliers={stats.topSuppliers}
          totalInventoryValue={stats.totalValue}
          theme={theme}
          formatPrivateValue={formatPrivateValue}
          onNavigateTab={setActiveTab}
          t={t}
        />

        {/* SECTION 06: RECENT PURCHASES LEDGER (FOLIO ACCORDION + TABLE) */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ borderColor: theme.border }}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  06
                </span>
                <span style={{ color: theme.textMuted }}>سجل التوريد والفواتير</span>
              </div>
              <h2 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>
                {t('last_purchases')}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 border w-full sm:w-56"
                style={{ backgroundColor: theme.bg, borderColor: theme.border }}
              >
                <Search size={13} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                  placeholder="ابحث بالمورد أو الصنف..."
                  className="bg-transparent text-xs w-full focus:outline-none"
                  style={{ color: theme.text }}
                />
                {purchaseSearch && (
                  <button
                    type="button"
                    onClick={() => setPurchaseSearch('')}
                    aria-label="مسح البحث"
                    className="cursor-pointer"
                    style={{ color: theme.textMuted }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {settings.enablePurchasesReports && (
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                  title="طباعة التقرير"
                >
                  <FileDown size={14} style={{ color: theme.accent }} />
                  <span className="font-mono">PDF</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDeletePurchases(!showDeletePurchases)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: showDeletePurchases ? theme.negative : theme.surfaceMuted,
                  borderColor: showDeletePurchases ? theme.negative : theme.border,
                  color: showDeletePurchases ? '#FFFFFF' : theme.textMuted,
                }}
                title={t('edit_purchases')}
              >
                <Trash2 size={14} />
                <span>{showDeletePurchases ? 'إنهاء الحذف' : 'إدارة'}</span>
              </button>
            </div>
          </div>

          <div className="p-2.5 sm:p-4 space-y-3">
            {filteredPurchaseGroups.length === 0 ? (
              <div
                className="py-10 text-center text-xs font-bold border border-dashed"
                style={{ borderColor: theme.border, color: theme.textMuted }}
              >
                {purchaseSearch ? 'لا توجد فواتير شراء مطابقة للبحث.' : t('no_data_available')}
              </div>
            ) : (
              filteredPurchaseGroups.map((group: any, groupIndex: number) => {
                const isExpanded = expandedPurchaseGroups[group.key] ?? (groupIndex === 0);

                return (
                  <div
                    key={`group-${group.key}-${groupIndex}`}
                    className="border"
                    style={{ borderColor: theme.border, backgroundColor: theme.bg }}
                  >
                    <button
                      type="button"
                      onClick={() => togglePurchaseGroup(group.key)}
                      className="w-full px-2.5 sm:px-3.5 py-3 flex items-center justify-between gap-2 text-right cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isExpanded ? theme.surfaceMuted : theme.surface,
                        color: theme.text,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Truck size={14} style={{ color: theme.accent }} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold truncate">
                            {group.supplierName || t('unknown_supplier')}
                            {group.invoiceNumber ? ` · #${group.invoiceNumber}` : ''}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                            {group.date} · {group.items.length} صنف
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className="text-xs sm:text-sm font-black font-mono tabular-nums"
                          style={{ color: theme.positive }}
                        >
                          {formatPrivateValue(group.totalAmount)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={15} style={{ color: theme.textMuted }} />
                        ) : (
                          <ChevronDown size={15} style={{ color: theme.textMuted }} />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div
                        className="border-t overflow-x-auto"
                        style={{ borderColor: theme.border, backgroundColor: theme.surface }}
                      >
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr
                              className="border-b font-bold"
                              style={{
                                borderColor: theme.border,
                                backgroundColor: theme.bg,
                                color: theme.textMuted,
                              }}
                            >
                              <th className="py-2 px-3">الصنف</th>
                              <th className="py-2 px-3">الكمية</th>
                              <th className="py-2 px-3">سعر الوحدة</th>
                              <th className="py-2 px-3">الإجمالي</th>
                              {showDeletePurchases && <th className="py-2 px-3 w-20">إجراء</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((p: any, itemIndex: number) => {
                              const qtyDisplay =
                                settings.defaultStockView === 'boxes' && p.piecesPerBox && p.piecesPerBox > 1
                                  ? `${(cleanQuantity(p.quantityChange) / p.piecesPerBox).toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })} كرتونة`
                                  : `${formatQuantity(p.quantityChange)} ${
                                      p.unit ? t(p.unit) || 'قطعة' : t('piece')
                                    }`;

                              return (
                                <tr
                                  key={`${p.id}-${itemIndex}`}
                                  className="border-b last:border-b-0"
                                  style={{ borderColor: theme.border, color: theme.text }}
                                >
                                  <td className="py-2.5 px-3 font-bold leading-snug">
                                    {p.productName}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                                    {qtyDisplay}
                                  </td>
                                  <td
                                    className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap"
                                    style={{ color: theme.textMuted }}
                                  >
                                    {formatPrivateValue(p.price)}
                                  </td>
                                  <td
                                    className="py-2.5 px-3 font-mono tabular-nums font-black whitespace-nowrap"
                                    style={{ color: theme.positive }}
                                  >
                                    {formatPrivateValue(p.amount)}
                                  </td>
                                  {showDeletePurchases && (
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      {deletingPurchaseId === p.id ? (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeletingPurchaseId(null);
                                            }}
                                            className="p-1 border cursor-pointer"
                                            style={{
                                              borderColor: theme.border,
                                              color: theme.textMuted,
                                            }}
                                          >
                                            <X size={13} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePurchase(p);
                                            }}
                                            className="px-2 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer text-white"
                                            style={{ backgroundColor: theme.negative }}
                                          >
                                            <Check size={12} />
                                            <span>{t('confirm')}</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingPurchaseId(p.id);
                                          }}
                                          className="p-1.5 border cursor-pointer"
                                          style={{
                                            borderColor: theme.border,
                                            color: theme.negative,
                                          }}
                                          title={t('delete')}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <PrintPurchasesModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        purchases={allPurchases}
        storeName={settings.storeName || 'مخزوني'}
      />
      <PurchaseVarianceModal
        isOpen={isVarianceModalOpen}
        onClose={() => setIsVarianceModalOpen(false)}
        analysis={purchaseVarianceAnalysis}
        currency={settings.currency}
        language={language}
        darkMode={Boolean(settings.darkMode)}
        showFinancials={showFinancials}
        activeThemeId={theme.id}
      />
    </div>
  );
});

export default Dashboard;
