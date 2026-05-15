import React, { useState, useMemo, memo, useEffect } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Wallet, 
  Plus, 
  ScanBarcode,
  Users,
  Truck,
  ChevronDown,
  ChevronUp,
  History,
  ShoppingCart,
  Receipt,
  ScanLine,
  Sun,
  Moon,
  Clock,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../components/UI';
import { cn, formatCurrency, safeParseFloat, safeDispatchEvent } from '../lib/utils';
import { Product, Transaction, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';

import { useTranslation } from 'react-i18next';
const Dashboard = memo(() => {
  const { user, settings } = useAppContext();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [allPurchases, setAllPurchases] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
  const [isMovementExpanded, setIsMovementExpanded] = useState(false);

  const groupedPurchases = useMemo(() => {
    if (!allPurchases) return [];
    
    const groupsMap = new Map<string, any>();

    allPurchases.slice(0, 100).forEach((p: any) => {
      const dateStr = new Date(p.date).toLocaleDateString(settings.language === 'ar' ? 'ar-TN' : 'en-GB');
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
    const purchasesQuery = query(
      collection(db, purchasesPath),
      orderBy('date', 'desc'),
      limit(1000)
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
        return { 
          id: doc.id, 
          productName: data.productName,
          quantityChange: data.qtyAdded,
          amount: data.amount || 0,
          price: data.qtyAdded > 0 ? (data.amount / data.qtyAdded) : 0,
          supplierId: data.supplierId || null,
          supplierName: data.supplierName || null,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date())
        } as any;
      }));
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
    const totalValue = products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.purchasePrice || 0)), 0);
    const lowStock = products.filter(p => (p.quantity || 0) < (p.minQuantity || 10)).length;
    
    const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    const totalCustomerDebts = debts.filter(d => d.type !== 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const totalSupplierDebts = debts.filter(d => d.type === 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

    const totalSupplierPurchasesValue = supplierTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

    const todayStr = new Date().toDateString();
    const todayPurchases = allPurchases.filter(p => new Date(p.date).toDateString() === todayStr);
    const todayPurchasesTotal = todayPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);

    // Group purchases by date for movement list
    const dailyMovements = allPurchases.reduce((acc: any, p) => {
      const dateKey = new Date(p.date).toDateString();
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

  const handleScannerOpen = () => {
    safeDispatchEvent('open-barcode-scanner');
  };

  return (
    <div className="pb-24" dir="rtl">
      {/* Premium Header Background Section */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 px-4 sm:px-6 lg:px-8 pt-8 pb-80 bg-gradient-to-br from-brand-900 via-brand-950 to-brand-900 rounded-b-[56px] mb-[-260px] relative overflow-hidden">
        {/* Abstract Decorative Elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4" />
        
        <header className="relative z-10 flex items-center justify-between mb-10 text-right">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-black tracking-tight text-white">{t('dashboard')}</h1>
            </div>
            <div className="flex items-center gap-2 text-brand-300/60">
              {greeting.icon}
              <p className="text-sm font-black tracking-tight">{greeting.text}</p>
            </div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/40">
            <Clock size={20} />
          </div>
        </header>

        {/* SECTION 1: COMPACT MASTER HERO */}
        <div className="relative z-10 p-7 rounded-[32px] bg-white/5 backdrop-blur-xl border border-white/10 text-white shadow-2xl shadow-black/20 overflow-hidden group">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1 text-right">
              <div className="flex items-center gap-2 opacity-60 justify-end">
                <TrendingUp size={12} className="text-emerald-400" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-100">{t('inventory_value')}</p>
              </div>
              <h2 className="text-4xl md:text-5xl font-black font-mono tracking-tighter leading-none">
                {formatPrivateValue(stats.totalValue)}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col items-center">
                <p className="text-[8px] font-black text-brand-200 uppercase mb-1">{t('total_products')}</p>
                <p className="text-xl font-black font-mono leading-none">{stats.totalProducts}</p>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md flex flex-col items-center text-amber-500">
                <p className="text-[8px] font-black opacity-60 uppercase mb-1">{t('low_stock')}</p>
                <p className="text-xl font-black font-mono leading-none">{stats.lowStock}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Dashboard Content */}
      <div className="space-y-6 relative z-20 px-0.5">
        {/* SECTION 2: FINANCIAL SUMMARY (COMPACT GRID) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('customer_debts'), value: stats.totalCustomerDebts, color: 'indigo', icon: Users },
            { label: t('supplier_debts'), value: stats.totalSupplierDebts, color: 'brand', icon: Truck },
            { label: t('expenses'), value: stats.totalExpenses, color: 'rose', icon: Coins },
            { label: t('total_supplier_purchases'), value: stats.totalSupplierPurchasesValue, color: 'emerald', icon: ShoppingCart },
          ].map((item, idx) => (
            <div key={idx} className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-[28px] p-5 border border-zinc-200/50 dark:border-zinc-800 shadow-xl shadow-black/5 relative overflow-hidden group hover:translate-y-[-2px] transition-all">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest leading-none">{item.label}</p>
                  <item.icon size={10} className="text-zinc-300" />
                </div>
                <h3 className="text-base font-black font-mono text-zinc-900 dark:text-white tracking-tight leading-none">
                  {formatPrivateValue(item.value)}
                </h3>
              </div>
              <div className={cn(
                "absolute bottom-0 right-0 h-1 w-full",
                item.color === 'indigo' && "bg-indigo-500/30",
                item.color === 'brand' && "bg-brand-500/30",
                item.color === 'rose' && "bg-rose-500/30",
                item.color === 'emerald' && "bg-emerald-500/30"
              )} />
            </div>
          ))}
        </div>

        {/* SECTION 3: PURCHASE MOVEMENT (COMPACT) */}
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all duration-300">
          <div 
            onClick={() => setIsMovementExpanded(!isMovementExpanded)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-xl bg-brand-50 dark:bg-brand-950/20 flex items-center justify-center text-brand-600">
                <History size={18} />
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-0.5">{t('purchase_movement')}</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black font-mono text-zinc-900 dark:text-white tracking-tighter">
                    {formatPrivateValue(stats.todayPurchasesTotal)}
                  </h3>
                  <div className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-[7px] font-black text-emerald-600 uppercase">
                    {t('today')}
                  </div>
                </div>
              </div>
            </div>
            
            <button className="h-9 w-9 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-600 transition-all">
              {isMovementExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>


          <AnimatePresence>
            {isMovementExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-10 pt-10 border-t border-zinc-50 dark:border-zinc-800 overflow-hidden"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                  {stats.movementHistory.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-zinc-400 font-bold bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border-2 border-dashed border-zinc-100 dark:border-zinc-800">{t('no_data_available')}</div>
                  ) : (
                    stats.movementHistory.slice(0, 14).map((day, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-transparent hover:border-zinc-100 dark:hover:border-brand-500/10 transition-colors">
                        <p className="text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-tight opacity-60">
                          {new Date(day.date).toLocaleDateString(settings.language === 'ar' ? 'ar-TN' : 'en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-sm font-black text-zinc-900 dark:text-white font-mono leading-none">{formatPrivateValue(day.total).split(' ')[0]}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* Recent Purchases List */}
      <div className="space-y-6 text-right mt-24 pb-12">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 pr-2">{t('last_purchases')}</h2>
        <div className="space-y-8">
          {groupedPurchases.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 font-bold text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-[32px] border-2 border-dashed border-zinc-100 dark:border-zinc-800">
              {t('no_data_available')}
            </div>
          ) : (
            groupedPurchases.map((group: any) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-brand-50 dark:bg-brand-900/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
                      <Truck size={14} />
                    </div>
                    <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                      {group.supplierName || t('unknown_supplier')}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-zinc-400 font-mono tracking-tighter">
                    {group.date}
                  </span>
                </div>
                
                <div className="bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-50 dark:divide-zinc-800 overflow-hidden shadow-sm">
                  {group.items.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-4 group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex flex-col text-right flex-1">
                        <span className="text-sm font-bold text-black dark:text-white mb-1">{p.productName}</span>
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                            <span className="text-black dark:text-white font-black">{p.quantityChange}</span>
                            <span className="text-zinc-500 font-bold">{t('piece')}</span>
                          </div>
                          <span className="text-zinc-300">|</span>
                          <span className="text-zinc-500 dark:text-zinc-400 font-medium">{formatCurrency(p.price, settings.currency, language)}</span>
                          <span className="text-zinc-300">|</span>
                          <span className="text-brand-600 dark:text-brand-400 font-bold">{formatCurrency(p.amount, settings.currency, language)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

export default Dashboard;
