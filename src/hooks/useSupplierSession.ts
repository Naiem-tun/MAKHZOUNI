import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Supplier } from '../types';

export function useSupplierSession(user: any) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierSelectorOpen, setIsSupplierSelectorOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `users/${user.uid}/suppliers`), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });
    return unsub;
  }, [user]);

  const filteredSuppliers = suppliers
    .filter(s => 
      s.name?.toLowerCase().includes(supplierSearchQuery.toLowerCase()) || 
      s.typeOfGoods?.toLowerCase().includes(supplierSearchQuery.toLowerCase()) || 
      s.phone?.includes(supplierSearchQuery)
    )
    .sort((a, b) => {
      const today = new Date().getDay();
      const aIsToday = !!a.visitDays?.includes(today);
      const bIsToday = !!b.visitDays?.includes(today);
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      return a.name.localeCompare(b.name, 'ar');
    });

  return {
    suppliers,
    supplierSearchQuery,
    setSupplierSearchQuery,
    isSupplierSelectorOpen,
    setIsSupplierSelectorOpen,
    filteredSuppliers
  };
}
