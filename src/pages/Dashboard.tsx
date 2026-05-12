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
  ScanBarcode 
} from 'lucide-react';
import { Card, Button, Modal, ProductIcon } from '../components/UI';
import { cn, formatCurrency, safeParseFloat, safeDispatchEvent } from '../lib/utils';
import { Product, Transaction, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';

import { useTranslation } from 'react-i18next';
const Dashboard = memo(() => {
  const { user, settings } = useAppContext();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [allPurchases, setAllPurchases] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) return;

    const productsPath = `users/${user.uid}/products`;
    const purchasesPath = `users/${user.uid}/purchases`;
    
    const productsQuery = collection(db, productsPath);
    const purchasesQuery = query(
      collection(db, purchasesPath),
      orderBy('date', 'desc'),
      limit(50)
    );

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

    return () => {
      unsubProducts();
      unsubPurchases();
    };
  }, [user]);

  const stats = useMemo(() => {
    if (!products.length) return { totalProducts: 0, lowStock: 0, totalValue: 0 };
    const totalValue = products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.purchasePrice || 0)), 0);
    const lowStock = products.filter(p => (p.quantity || 0) < (p.minQuantity || 10)).length;
    return { totalProducts: products.length, lowStock, totalValue };
  }, [products]);

  const language = settings.language || 'ar';
  const showFinancials = settings.showFinancials ?? true;

  const formatPrivateValue = (val: number) => !showFinancials ? '••••••' : formatCurrency(val, settings.currency, language);

  const onAddProduct = () => {
    safeDispatchEvent('open-product-modal');
  };

  const handleScannerOpen = () => {
    safeDispatchEvent('open-barcode-scanner');
  };

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      <header className="flex flex-col gap-1 text-right">
        <h1 className="text-3xl font-bold text-black dark:text-white">{t('dashboard')}</h1>
        <p className="text-neutral-500 text-xs font-medium">{t('welcome')}</p>
      </header>

      {/* Stats Section - Slim Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="white" className="flex items-center justify-between py-3 px-4 rounded-2xl border-neutral-100">
           <div className="flex items-center gap-2">
            <Package size={14} className="text-neutral-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('total_products')}</span>
          </div>
          <span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-100">{stats.totalProducts}</span>
        </Card>

        <Card variant="white" className="flex items-center justify-between py-3 px-4 rounded-2xl border-neutral-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('low_stock')}</span>
          </div>
          <span className="text-sm font-mono font-bold text-amber-600">{stats.lowStock}</span>
        </Card>

        <Card variant="white" className="flex items-center justify-between py-3 px-4 rounded-2xl border-neutral-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('inventory_value')}</span>
          </div>
          <span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-100">{formatPrivateValue(stats.totalValue)}</span>
        </Card>

        <Card variant="white" className="flex items-center justify-between py-3 px-4 rounded-2xl border-neutral-100">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t('expenses')}</span>
          </div>
          <span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-100">{formatPrivateValue(0)}</span>
        </Card>
      </div>

      {/* Recent Purchases List */}
      <div className="space-y-4 text-right">
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{t('last_purchases')}</h2>
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
