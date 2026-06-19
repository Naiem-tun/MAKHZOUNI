import React, { useState, useMemo, memo, useEffect } from 'react';
import { collection, onSnapshot, query, limit, orderBy, where, doc, deleteDoc, updateDoc, getDoc, addDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Wallet, 
  Plus, 
  ScanBarcode,
  Truck,
  Store,
  CreditCard,
  ChevronDown,
  ChevronUp,
  History,
  ShoppingCart,
  Receipt,
  FileDown,
  ScanLine,
  Sun,
  Moon,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  Check,
  X,
  CopyPlus,
  Ghost
} from 'lucide-react';
import { Card } from '../components/UI';
import { cn, formatCurrency, safeParseFloat, safeDispatchEvent, safeParseDate, formatAppDate } from '../lib/utils';
import { Product, Transaction, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { PrintPurchasesModal } from '../components/dashboard/PrintPurchasesModal';
import { CashRegisterCard } from '../components/dashboard/CashRegisterCard';

import { useTranslation } from 'react-i18next';
const Dashboard = memo(() => {
  const { user, settings, showToast } = useAppContext();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [allPurchases, setAllPurchases] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
  const [isMovementExpanded, setIsMovementExpanded] = useState(false);
  const [showDeletePurchases, setShowDeletePurchases] = useState(false);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const groupedPurchases = useMemo(() => {
    if (!allPurchases) return [];
    
    const groupsMap = new Map<string, any>();

    allPurchases.slice(0, 100).forEach((p: any) => {
      const parsedDate = safeParseDate(p.date);
      const dateStr = formatAppDate(parsedDate, settings.language, t);
      const supplierName = p.supplierName || t('unknown_supplier');
      const groupKey = `${supplierName}-${dateStr}`;

      if (groupsMap.has(groupKey)) {
        groupsMap.get(groupKey).items.push(p);
      } else {
        groupsMap.set(groupKey, {
          key: groupKey,
          supplierName: p.supplierName,
          date: dateStr,
          items: [p]
        });
      }
    });

    return Array.from(groupsMap.values());
  }, [allPurchases, settings.language, t]);

  useEffect(() => {
    if (!user) return;

    const productsPath = `users/${user.uid}/products`;
    const purchasesPath = `users/${user.uid}/purchases`;
    const expensesPath = `users/${user.uid}/expenses`;
    const debtsPath = `users/${user.uid}/debts`;
    const supplierTxPath = `users/${user.uid}/supplierTransactions`;
    
    const productsQuery = collection(db, productsPath);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const purchasesQuery = query(
      collection(db, purchasesPath),
      orderBy('date', 'desc'),
      limit(300)
    );
    const expensesQuery = collection(db, expensesPath);
    const debtsQuery = collection(db, debtsPath);
    const supplierTxQuery = collection(db, supplierTxPath);

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, productsPath);
    });

    const unsubPurchases = onSnapshot(purchasesQuery, (snap) => {
      setAllPurchases(snap.docs.map(doc => {
        const data = doc.data();
        const parsedDate = safeParseDate(data.date);
        
        return { 
          id: doc.id, 
          productId: data.productId,
          productName: data.productName,
          quantityChange: data.qtyAdded,
          amount: data.amount || 0,
          price: data.qtyAdded > 0 ? (data.amount / data.qtyAdded) : 0,
          supplierId: data.supplierId || null,
          supplierName: data.supplierName || null,
          date: parsedDate
        } as any;
      }).sort((a, b) => b.date.getTime() - a.date.getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, purchasesPath);
    });

    const unsubExpenses = onSnapshot(expensesQuery, (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, expensesPath);
    });

    const unsubDebts = onSnapshot(debtsQuery, (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, debtsPath);
    });

    const unsubSupplierTx = onSnapshot(supplierTxQuery, (snap) => {
      setSupplierTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, supplierTxPath);
    });

    return () => {
      unsubProducts();
      unsubPurchases();
      unsubExpenses();
      unsubDebts();
      unsubSupplierTx();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.purchasePrice || p.costPrice) || 0)), 0);
    const lowStock = products.filter(p => (Number(p.quantity) || 0) < (Number(p.minQuantity) || 10)).length;
    
    // Only calculate pending expenses (not yet audited in inventory)
    const pendingExpenses = expenses.filter(e => !e.audited);
    const totalExpenses = pendingExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    const totalCustomerDebts = debts.filter(d => d.type !== 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const totalSupplierDebts = debts.filter(d => d.type === 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

    const totalSupplierPurchasesValue = supplierTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalAllPurchasesValue = allPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);
    const unregisteredPurchasesValue = Math.max(0, totalAllPurchasesValue - totalSupplierPurchasesValue);

    const todayStr = safeParseDate(new Date()).toDateString();
    const todayPurchases = allPurchases.filter(p => safeParseDate(p.date).toDateString() === todayStr);
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

    return { 
      totalProducts: products.length, 
      lowStock, 
      totalValue,
      totalExpenses,
      totalCustomerDebts,
      totalSupplierDebts,
      totalSupplierPurchasesValue,
      totalAllPurchasesValue,
      unregisteredPurchasesValue,
      todayPurchasesTotal,
      movementHistory
    };
  }, [products, expenses, debts, supplierTransactions, allPurchases]);

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
      await deleteDoc(doc(db, `users/${user.uid}/purchases`, purchase.id));
      
      if (purchase.productId) {
        const productRef = doc(db, `users/${user.uid}/products`, purchase.productId);
        await updateDoc(productRef, { quantity: increment(-(purchase.quantityChange || 0)) });
      }

      if (purchase.supplierId && purchase.amount > 0) {
        await addDoc(collection(db, `users/${user.uid}/supplierTransactions`), {
          supplierId: purchase.supplierId,
          amount: -(purchase.amount),
          date: new Date(),
          note: t('purchase_deleted_refund') || 'استرجاع بسبب حذف مشتريات',
          updatedAt: new Date(),
        });
      }
      
      showToast(t('item_deleted_success') || 'تم الحذف وتحديث الكمية بنجاح', 'success');
    } catch (error) {
      console.error('Error deleting purchase:', error);
      showToast(t('error_deleting') || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  return (
    <div className="pb-24 space-y-6" dir="rtl">
      <header className="flex items-center justify-between mb-4 pt-2 text-right">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{t('dashboard')}</h1>
          <div className="flex items-center gap-2 text-zinc-500">
            {greeting.icon}
            <p className="text-sm font-bold tracking-tight">{greeting.text}</p>
          </div>
        </div>
        <div className="h-12 w-12 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm flex items-center justify-center text-brand-600 dark:text-brand-400">
          <Clock size={20} />
        </div>
      </header>

      {/* SECTION 1: MASTER HERO CARD (Modeled after screenshot dark blue cards) */}
      <div className="relative p-7 rounded-lg bg-brand-800 dark:bg-zinc-900 text-white shadow-xl shadow-brand-900/10 dark:shadow-none overflow-hidden">
        {/* Soft geometric background details */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-400/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
        
        <div className="relative z-10 flex items-center gap-2 mb-2 text-brand-200 opacity-90 justify-start">
          <TrendingUp size={16} className="text-emerald-400" />
          <p className="text-xs font-bold uppercase tracking-wider">{t('inventory_value')}</p>
        </div>
        
        <h2 className="relative z-10 text-4xl md:text-5xl font-black tracking-tight mb-8 text-right text-white">
          {formatPrivateValue(stats.totalValue)}
        </h2>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-md flex flex-col items-center">
            <p className="text-2xl font-black tracking-tight mb-1">{stats.totalProducts}</p>
            <p className="text-xs font-bold text-brand-200">{t('total_products')}</p>
          </div>
          <div className="p-4 rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-md flex flex-col items-center">
            <p className="text-2xl font-black tracking-tight mb-1">{stats.lowStock}</p>
            <p className="text-xs font-bold text-amber-300">{t('low_stock')}</p>
          </div>
        </div>
      </div>

      <div className="px-0.5 space-y-6 mt-6">
        {settings.enableCashRegister && <CashRegisterCard />}

        {/* SECTION 2: FINANCIAL SUMMARY (COMPACT GRID) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('customer_debts'), value: stats.totalCustomerDebts, color: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400', icon: CreditCard },
            { label: t('supplier_debts'), value: stats.totalSupplierDebts, color: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400', icon: Truck },
            { label: t('expenses'), value: stats.totalExpenses, color: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400', icon: Wallet },
            { label: t('total_supplier_purchases'), value: stats.totalSupplierPurchasesValue, color: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400', icon: ShoppingCart },
          ].map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-zinc-800/80 rounded-lg p-5 border border-zinc-100/80 dark:border-zinc-700/50 shadow-sm relative overflow-hidden group flex flex-col items-start">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-4", item.color)}>
                <item.icon size={18} />
              </div>
              <h3 className="text-lg font-black font-sans text-zinc-900 dark:text-white tracking-tight leading-none mb-1 text-right">
                {formatPrivateValue(item.value)}
              </h3>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider leading-none text-right">{item.label}</p>
            </div>
          ))}
        </div>

        {/* SECTION 3: PURCHASE MOVEMENT */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white pr-2">{t('purchase_movement')}</h2>
            <div className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full dark:bg-brand-500/10 dark:text-brand-400">
               {formatPrivateValue(stats.todayPurchasesTotal)} {t('today')}
            </div>
          </div>

          <div className="flex overflow-x-auto gap-3 pb-4 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {stats.movementHistory.length === 0 ? (
              <div className="w-full py-10 text-center text-zinc-400 font-bold bg-white dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 shadow-sm">
                {t('no_data_available')}
              </div>
            ) : (
              stats.movementHistory.slice(0, 14).map((day, idx) => (
                <div key={idx} className="min-w-[110px] flex-shrink-0 snap-start p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center flex flex-col items-center justify-center gap-2 group">
                  <div className="h-8 w-8 rounded-full bg-zinc-50 dark:bg-zinc-700 flex items-center justify-center">
                    <History size={14} className="text-zinc-400 group-hover:text-brand-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 mb-1">
                      {formatAppDate(new Date(day.date), settings.language, t, { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-sm font-black text-brand-800 dark:text-white font-sans leading-none">
                      {formatPrivateValue(day.total).split(' ')[0]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>


      {/* Recent Purchases List */}
      <div className="space-y-4 text-right mt-8 pb-12">
        <div className="flex items-center justify-between pr-2 mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">{t('last_purchases')}</h2>
          <div className="flex items-center gap-1">
            {settings.enablePurchasesReports && (
              <button 
                onClick={() => setIsPrintModalOpen(true)}
                className="p-2 rounded-lg transition-colors text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:text-brand-400 dark:hover:bg-brand-500/10 ml-2 shadow-sm border border-brand-100 dark:border-brand-500/20"
                title="طباعة التقرير"
              >
                <i className="pl-1 text-xs font-bold font-sans not-italic">PDF</i>
                <FileDown size={16} className="inline-block" />
              </button>
            )}
            <button 
              onClick={() => setShowDeletePurchases(!showDeletePurchases)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showDeletePurchases 
                  ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400" 
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              )}
              title={t('edit_purchases')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-6">
          {groupedPurchases.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 font-bold text-sm bg-white dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 shadow-sm">
              {t('no_data_available')}
            </div>
          ) : (
            groupedPurchases.map((group: any, groupIndex: number) => (
              <div key={`group-${group.key}-${groupIndex}`} className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400">
                      <Store size={12} />
                    </div>
                    <span className="text-sm font-bold text-brand-800 dark:text-brand-400">
                      {group.supplierName || t('unknown_supplier')}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400 font-sans tracking-tight">
                    {group.date}
                  </span>
                </div>
                
                <div className="bg-white dark:bg-zinc-800/80 rounded-lg border border-zinc-100/80 dark:border-zinc-700/50 overflow-hidden shadow-sm flex flex-col gap-px bg-zinc-100 dark:bg-zinc-700/50">
                  {group.items.map((p: any, itemIndex: number) => (
                    <div key={`${p.id}-${itemIndex}`} className="flex justify-between items-center p-4 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                      <div className="flex flex-col text-right flex-1">
                        <span className="text-sm font-bold text-zinc-900 dark:text-white mb-2">{p.productName}</span>
                        <div className="flex items-center justify-start gap-2 text-[11px] font-sans font-bold text-zinc-500">
                          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-md">
                            <span className="text-zinc-900 dark:text-white">{p.quantityChange}</span>
                            <span>{t('piece')}</span>
                          </div>
                          <span className="text-zinc-300 dark:text-zinc-600">|</span>
                          <span>{formatCurrency(p.price, settings.currency, language)}</span>
                          <span className="text-zinc-300 dark:text-zinc-600">|</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount, settings.currency, language)}</span>
                        </div>
                      </div>
                      
                      {showDeletePurchases && (
                        deletingPurchaseId === p.id ? (
                          <div className="flex items-center gap-2 mr-2">
                            <button
                              onClick={() => setDeletingPurchaseId(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                              <X size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(p)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                            >
                              <Check size={16} />
                              <span>{t('confirm')}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingPurchaseId(p.id)}
                            className="p-2 mr-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                            title={t('delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <PrintPurchasesModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        purchases={allPurchases}
        storeName={settings.storeName || 'مخزوني'}
      />
    </div>
  );
});

export default Dashboard;
