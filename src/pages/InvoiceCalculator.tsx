import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Trash2, 
  Plus, 
  Search,
  ChevronDown
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';

interface InvoiceItem {
  id: string; // unique instance ID
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export default function InvoiceCalculator() {
  const { t } = useTranslation();
  const { user } = useAppContext();
  
  const [products, setProducts] = useState<Product[]>(() => {
    if (!user) return [];
    try {
      const cached = localStorage.getItem(`products_cache_${user.uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/products`;
    const q = collection(db, path);
    return onSnapshot(q, (snap) => {
      const fetchedProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(fetchedProducts);
      localStorage.setItem(`products_cache_${user.uid}`, JSON.stringify(fetchedProducts));
    }, (error) => {
      console.error(error);
    });
  }, [user]);

  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (inputText.trim().length > 1) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(inputText.toLowerCase()) ||
        p.barcode?.includes(inputText) ||
        p.barcode2?.includes(inputText)
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, products]);

  const addItem = (product: any) => {
    const newItem: InvoiceItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      productId: product.id,
      name: product.name,
      price: product.boxPurchasePrice || product.purchasePrice || 0,
      quantity: 1,
    };
    setItems([newItem, ...items]);
    setInputText('');
    setSuggestions([]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: 'price' | 'quantity', value: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 pt-6 px-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
          <Calculator size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">{t('invoice_calculator')}</h1>
          <p className="text-xs text-zinc-500 font-medium">{t('invoice_desc')}</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="relative z-30">
        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-center pl-2 pr-3 text-zinc-400">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('what_to_buy') || 'ماذا تريد أن تشتري؟'}
            className="flex-1 h-12 bg-transparent px-2 text-base font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none w-full"
          />
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden mt-2"
            >
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-right transition-colors border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{p.name}</span>
                    <span className="text-xs font-medium text-zinc-500">
                      {t('purchase_price')}: {(p.boxPurchasePrice || p.purchasePrice || 0).toFixed(3)}
                    </span>
                  </div>
                  <Plus size={18} className="text-brand-500" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items List */}
      <div className="space-y-4 mt-6">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
            >
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{item.name}</h3>
              </div>
              
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {/* Price */}
                  <div className="w-24">
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1">{t('purchase_price')}</label>
                    <input
                      type="number"
                      value={item.price || ''}
                      onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl py-2 px-3 text-sm font-bold text-zinc-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="w-20">
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1">{t('quantity')} ({t('box')})</label>
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl py-2 px-3 text-sm font-bold text-zinc-900 dark:text-white text-center focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Total */}
                  <div className="px-2 flex-1 text-left">
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1">المجموع</label>
                    <div className="text-base font-black text-brand-600 dark:text-brand-400">
                      {(item.price * item.quantity).toFixed(3)}
                    </div>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center justify-center opacity-50">
            <Calculator size={48} className="text-zinc-300 mb-4" strokeWidth={1} />
            <p className="text-zinc-500 font-medium">ابدأ بالبحث عن منتجات لإضافتها</p>
          </div>
        )}
      </div>

      {/* Floating Total */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-4 right-4 max-w-2xl mx-auto z-40 block"
          >
            <div className="bg-brand-600 text-white rounded-2xl p-5 shadow-2xl flex items-center justify-between border-2 border-brand-500/50 backdrop-blur-xl">
              <div>
                <span className="block text-brand-200 text-sm font-bold mb-1">المجموع الكلي</span>
                <span className="text-xs text-brand-300 opacity-80">{items.length} منتجات مضافة</span>
              </div>
              <div className="text-3xl font-black">
                {calculateTotal().toFixed(3)} <span className="text-lg text-brand-200 ml-1">د.ت</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
