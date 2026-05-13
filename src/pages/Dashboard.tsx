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
  Truck
} from 'lucide-react';
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

  useEffect(() => {
    if (!user) return;

    const productsPath = `users/${user.uid}/products`;
    const purchasesPath = `users/${user.uid}/purchases`;
    const expensesPath = `users/${user.uid}/expenses`;
    const debtsPath = `users/${user.uid}/debts`;
    
    const productsQuery = collection(db, productsPath);
    const purchasesQuery = query(
      collection(db, purchasesPath),
      orderBy('date', 'desc'),
      limit(50)
    );
    const expensesQuery = collection(db, expensesPath);
    const debtsQuery = collection(db, debtsPath);

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
          price: data.qtyAdded > 0 ? (data.amount / data.qtyAdded) : 0,
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

    return () => {
      unsubProducts();
      unsubPurchases();
      unsubExpenses();
      unsubDebts();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.purchasePrice || 0)), 0);
    const lowStock = products.filter(p => (p.quantity || 0) < (p.minQuantity || 10)).length;
    
    const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    const totalCustomerDebts = debts.filter(d => d.type !== 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const totalSupplierDebts = debts.filter(d => d.type === 'payable').reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

    return { 
      totalProducts: products.length, 
      lowStock, 
      totalValue,
      totalExpenses,
      totalCustomerDebts,
      totalSupplierDebts
    };
  }, [products, expenses, debts]);

  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  const formatPrivateValue = (val: number) => !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  const onAddProduct = () => {
    safeDispatchEvent('open-product-modal');
  };

  const handleScannerOpen = () => {
    safeDispatchEvent('open-barcode-scanner');
  };

  const statsCards = [
    {
      title: t('total_products'),
      value: stats.totalProducts,
      icon: Package,
      iconColor: 'text-zinc-400 dark:text-zinc-500',
    },
    {
      title: t('low_stock'),
      value: stats.lowStock,
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    {
      title: t('inventory_value'),
      value: formatPrivateValue(stats.totalValue),
      icon: TrendingUp,
      iconColor: 'text-emerald-500',
    },
    {
      title: t('expenses'),
      value: formatPrivateValue(stats.totalExpenses),
      icon: Wallet,
      iconColor: 'text-rose-500',
    },
    {
      title: t('customer_debts'),
      value: formatPrivateValue(stats.totalCustomerDebts),
      icon: Users,
      iconColor: 'text-indigo-500',
    },
    {
      title: t('supplier_debts'),
      value: formatPrivateValue(stats.totalSupplierDebts),
      icon: Truck,
      iconColor: 'text-[#B34C36]',
    }
  ];

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      <header className="flex flex-col gap-1 text-right mb-4">
        <h1 className="text-3xl font-bold text-black dark:text-white">{t('dashboard')}</h1>
        <p className="text-neutral-500 text-xs font-medium">{t('welcome')}</p>
      </header>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {statsCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx} 
              className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-[28px] p-6 shadow-sm border border-zinc-100 dark:border-zinc-800 transition-all hover:shadow-md"
            >
              <h3 className="text-[20px] font-bold text-zinc-900 dark:text-white font-mono leading-none">
                {card.value}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-zinc-500 dark:text-zinc-400">
                  {card.title}
                </span>
                <Icon size={20} className={card.iconColor} strokeWidth={2} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Purchases List */}
      <div className="space-y-4 text-right mt-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 pr-2">{t('last_purchases')}</h2>
        <div className="grid grid-cols-1 gap-2">
          {allPurchases?.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-sm">{t('no_data_available')}</div>
          ) : (
            allPurchases?.map((p: any) => (
              <div key={p.id} className="flex justify-between items-center py-3 border-b border-neutral-50 dark:border-neutral-800">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-bold text-black dark:text-white">{p.productName}</span>
                  <div className="flex flex-row-reverse items-center gap-1 text-[10px] text-neutral-400 font-mono">
                    <span>{formatCurrency(p.price, settings.currency, language)}</span>
                    <span className="px-1 text-neutral-300">×</span>
                    <span>{p.quantityChange}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-300">
                  {new Date(p.date).toLocaleDateString(settings.language === 'ar' ? 'ar-TN' : 'en-GB')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

export default Dashboard;
