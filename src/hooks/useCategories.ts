import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { Package } from 'lucide-react';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

export const defaultCategories = [
  { id: 'default_sweets', name: 'حلويات', icon: Package },
  { id: 'default_bread', name: 'خبز', icon: Package },
  { id: 'default_drinks', name: 'مشروبات', icon: Package },
  { id: 'default_dairy', name: 'ألبان', icon: Package },
  { id: 'default_other', name: 'أخرى', icon: Package },
  { id: 'default_canned', name: 'معلبات', icon: Package },
  { id: 'default_cleaning', name: 'مواد تنظيف', icon: Package },
  { id: 'default_gas', name: 'غاز', icon: Package },
  { id: 'default_general', name: 'مواد غذائية عامة', icon: Package },
  { id: 'default_legumes', name: 'بقوليات', icon: Package },
  { id: 'default_spices', name: 'توابل', icon: Package },
  { id: 'default_dry_fruits', name: 'فواكه جافة', icon: Package },
];

export function useCategories() {
  const { user, settings } = useAppContext();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/categories`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/categories`);
    });

    return unsubscribe;
  }, [user]);

  const activeDefaultCategories = defaultCategories.filter(
    c => !(settings.deletedCategories || []).includes(c.id)
  );

  const allCategories = [...categories, ...activeDefaultCategories];

  return { categories: allCategories, customCategories: categories, loading };
}
