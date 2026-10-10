import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { collection, query, orderBy, limit, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { safeParseDate } from '../lib/utils';
import { InventoryAnalytics } from '../components/inventory/InventoryAnalytics';
import { Supplier, SupplierTransaction, Debt } from '../types';

export default function Analytics() {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
  const [products, setProducts] = useState<any[]>([]);
  const [inventoryReports, setInventoryReports] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let unsubProducts: any;
    let unsubReports: any;
    let unsubSuppliers: any;
    let unsubSupplierTx: any;
    let unsubDebts: any;

    try {
      // Products Listener
      const productsPath = `users/${uid}/products`;
      unsubProducts = onSnapshot(collection(db, productsPath), (snap) => {
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Reports Listener
      const reportsPath = `users/${uid}/reports`;
      const reportsQuery = query(collection(db, reportsPath), where('type', '==', 'inventory'), orderBy('date', 'desc'), limit(15));
      unsubReports = onSnapshot(reportsQuery, (snap) => {
        setInventoryReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Suppliers Listener: for supplier names, goods category, etc.
      const suppliersPath = `users/${uid}/suppliers`;
      unsubSuppliers = onSnapshot(collection(db, suppliersPath), (snap) => {
        setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
      });

      // Debts Listener: for customer credit analysis & market exposure
      const debtsPath = `users/${uid}/debts`;
      unsubDebts = onSnapshot(collection(db, debtsPath), (snap) => {
        setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
      });

      // Supplier Transactions Listener: identical source as Suppliers page
      const txPath = `users/${uid}/supplierTransactions`;
      unsubSupplierTx = onSnapshot(collection(db, txPath), (snap) => {
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierTransaction));
        docs.sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime());
        setSupplierTransactions(docs);
        setLoading(false);
      });
    } catch(err) {
      console.error(err);
      setLoading(false);
    }

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubReports) unsubReports();
      if (unsubSuppliers) unsubSuppliers();
      if (unsubSupplierTx) unsubSupplierTx();
      if (unsubDebts) unsubDebts();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white">{t('reports') || 'التقارير والتحليلات'}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            تحليل الاستهلاك الحقيقي، سرعة نفاد الرفوف، حركة المشتريات اليومية، ومردودية الأقسام
          </p>
        </div>
      </header>

      {/* Main Intelligent Inventory & Daily Purchases View */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <InventoryAnalytics
          inventoryReports={inventoryReports}
          products={products}
          purchases={supplierTransactions}
          suppliers={suppliers}
          debts={debts}
          settings={settings}
        />
      </motion.div>
    </div>
  );
}
