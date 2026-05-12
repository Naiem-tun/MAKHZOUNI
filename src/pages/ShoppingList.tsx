import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { 
  Plus, 
  Trash2, 
  StickyNote,
  ListTodo,
  X,
  ScanLine,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../components/UI';
import { handleFirestoreError } from '../lib/utils';
import { OperationType, Product } from '../types';
import { Html5Qrcode } from 'html5-qrcode';

interface ListItem {
  id: string;
  text: string;
  type: 'product' | 'note';
  createdAt: any;
}

export default function ShoppingList() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'notes'>('products');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch Shopping/Smart list
    const path = `users/${user.uid}/smart_list`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    // Fetch Products for search suggestions
    const productsPath = `users/${user.uid}/products`;
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [user]);

  useEffect(() => {
    if (activeTab === 'products' && inputText.trim().length > 1) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(inputText.toLowerCase()) || 
        p.barcode?.includes(inputText) ||
        p.barcode2?.includes(inputText)
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, activeTab, products]);

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("scanner-region");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            const product = products.find(p => p.barcode === decodedText || p.barcode2 === decodedText);
            if (product) {
              addItem(product.name);
              showToast(`${t('found_label')}: ${product.name}`, 'success');
              stopScanner();
            } else {
              showToast(t('product_not_found_stock'), 'info');
              stopScanner();
              setInputText(decodedText);
            }
          },
          () => {} // error callback
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
        scannerRef.current = null;
      }).catch(err => {
        console.error(err);
        setIsScanning(false);
      });
    } else {
      setIsScanning(false);
    }
  };

  const addItem = async (textToUse?: string) => {
    const finalItemText = typeof textToUse === 'string' ? textToUse : inputText;
    if (!user || !finalItemText.trim()) return;

    try {
      const path = `users/${user.uid}/smart_list`;
      await addDoc(collection(db, path), {
        text: finalItemText.trim(),
        type: activeTab === 'products' ? 'product' : 'note',
        createdAt: serverTimestamp()
      });
      setInputText('');
      setSuggestions([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/smart_list`);
    }
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    try {
      const itemRef = doc(db, `users/${user.uid}/smart_list`, id);
      await deleteDoc(itemRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/smart_list`);
    }
  };

  const listToDisplay = activeTab === 'products' ? items.filter(i => i.type === 'product') : items.filter(i => i.type === 'note');

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-32 pt-6 px-4" dir="rtl">
      {/* Header matching screenshot style */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">{t('shopping_list')}</h1>
          <p className="text-xs text-zinc-500 font-medium">{t('needs_record_subtitle')}</p>
        </div>
        <button className="h-9 w-9 flex items-center justify-center text-zinc-300 hover:text-zinc-500 transition-all bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700">
          <X size={18} />
        </button>
      </div>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-sm aspect-square bg-zinc-900 rounded-2xl overflow-hidden relative border-2 border-brand-500 shadow-2xl">
              <div id="scanner-region" className="w-full h-full" />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full border-2 border-brand-400 rounded-xl animate-pulse" />
              </div>
            </div>
            <div className="mt-12 text-center space-y-6">
              <div className="space-y-1">
                <p className="text-white font-bold text-xl">{t('scanning_barcode')}</p>
                <p className="text-zinc-400 text-sm">{t('point_camera')}</p>
              </div>
              <button 
                onClick={stopScanner}
                className="h-16 w-16 bg-white/10 text-white rounded-full flex items-center justify-center backdrop-blur-xl border border-white/20 active:scale-95 transition-all"
              >
                <X size={32} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Tabs */}
      <div className="flex bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-2xl border border-zinc-100 dark:border-zinc-800">
        <button 
          onClick={() => { setActiveTab('products'); setInputText(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-white dark:bg-zinc-700 shadow-sm text-brand-600' : 'text-zinc-400'}`}
        >
          <ListTodo size={18} strokeWidth={2.5} />
          {t('purchases')}
        </button>
        <button 
          onClick={() => { setActiveTab('notes'); setInputText(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'notes' ? 'bg-white dark:bg-zinc-700 shadow-sm text-amber-600' : 'text-zinc-400'}`}
        >
          <StickyNote size={18} strokeWidth={2.5} />
          {t('notes')}
        </button>
      </div>

      {/* Unified Input Section - Icons inside box */}
      <div className="relative">
        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500/30 transition-all shadow-sm">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder={activeTab === 'products' ? t('what_to_buy') : t('add_private_note')}
            className="flex-1 h-12 bg-transparent px-3 text-base font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none w-full"
          />

          <div className="flex items-center gap-1.5 pl-1 shrink-0">
            {activeTab === 'products' && (
              <button 
                onClick={startScanner}
                className="h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-brand-600 transition-all rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <ScanLine size={20} />
              </button>
            )}
            <button 
              onClick={() => addItem()}
              disabled={!inputText.trim()}
              className="h-10 w-10 bg-brand-600 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 disabled:shadow-none"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-16 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden mt-1"
            >
              <div className="px-5 py-2 border-b border-zinc-50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('match_from_stock')}</span>
              </div>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p.name)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-right transition-colors border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{p.name}</span>
                    <span className="text-[10px] font-bold text-brand-500">{t('available')}: {p.quantity} {p.unit}</span>
                  </div>
                  <Plus size={16} className="text-zinc-300" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* List Items */}
      <div className="space-y-2 mt-6">
        <AnimatePresence initial={false}>
          {listToDisplay.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="group"
            >
              <div className="bg-white dark:bg-zinc-900 p-2.5 flex items-center justify-between rounded-2xl border border-zinc-100 dark:border-zinc-800 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-center gap-3 flex-1 px-1">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'products' ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'}`}>
                    {activeTab === 'products' ? <ListTodo size={16} /> : <StickyNote size={16} />}
                  </div>
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {item.text}
                  </span>
                </div>
                
                <button 
                  onClick={() => deleteItem(item.id)}
                  className="h-8 w-8 flex items-center justify-center text-zinc-300 hover:text-[#B34C36] hover:bg-[#B34C36]/5 rounded-xl transition-all"
                  title={t('delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty States */}
        {listToDisplay.length === 0 && (
          <div className="text-center py-16 opacity-30">
            <div className="mb-4 flex justify-center text-zinc-300">
              {activeTab === 'products' ? <ListTodo size={40} strokeWidth={1} /> : <StickyNote size={40} strokeWidth={1} />}
            </div>
            <p className="font-bold text-sm text-zinc-400">
              {activeTab === 'products' ? t('shopping_list_empty') : t('notes_empty')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

