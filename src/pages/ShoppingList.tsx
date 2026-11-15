import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { formatQuantity, handleFirestoreError } from '../lib/utils';
import { Plus, Trash2, StickyNote, ListTodo, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OperationType, Product } from '../types';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

interface ListItem {
  id: string;
  text: string;
  type: 'product' | 'note';
  barcode?: string;
  createdAt: any;
}

export default function ShoppingList() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'notes'>('products');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/smart_list`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ListItem)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    const productsPath = `users/${user.uid}/products`;
    const unsubscribeProducts = onSnapshot(collection(db, productsPath), (snap) => {
      setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product)));
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
    };
  }, [user]);

  useEffect(() => {
    if (activeTab === 'products' && inputText.trim().length > 1) {
      const filtered = products
        .filter(
          (p) =>
            (p.name || '').toLowerCase().includes((inputText || '').toLowerCase()) ||
            p.barcode?.includes(inputText) ||
            p.barcode2?.includes(inputText),
        )
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [inputText, activeTab, products]);

  const handleScan = (decodedText: string) => {
    const product = products.find((p) => p.barcode === decodedText || p.barcode2 === decodedText);
    if (product) {
      addItem(product.name);
      showToast(`${t('found_label')}: ${product.name}`, 'success');
    } else {
      showToast(t('product_not_found_stock'), 'info');
      setInputText(decodedText);
    }
  };

  const addItem = (textToUse?: string) => {
    const finalItemText = typeof textToUse === 'string' ? textToUse : inputText;
    if (!user || !finalItemText.trim()) return;

    const path = `users/${user.uid}/smart_list`;
    const data = {
      text: finalItemText.trim(),
      type: activeTab === 'products' ? 'product' : 'note',
      createdAt: serverTimestamp(),
    };

    setInputText('');
    setSuggestions([]);

    addDoc(collection(db, path), data).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, path);
    });
  };

  const deleteItem = (id: string) => {
    if (!user) return;
    const itemRef = doc(db, `users/${user.uid}/smart_list`, id);
    deleteDoc(itemRef).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/smart_list`);
    });
  };

  const listToDisplay =
    activeTab === 'products'
      ? items.filter((i) => i.type === 'product')
      : items.filter((i) => i.type === 'note');

  return (
    <div
      className="max-w-lg mx-auto space-y-5 pb-32 pt-4 sm:pt-6"
      style={{ color: theme.text }}
      dir="rtl"
    >
      {/* Editorial Header */}
      <header className="pb-4 border-b space-y-1" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
            01
          </span>
          <span className="tracking-wider uppercase font-mono" style={{ color: theme.textMuted }}>
            NEEDS · NOTES
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t('shopping_list')}</h1>
        <p className="text-xs sm:text-sm" style={{ color: theme.textMuted }}>
          {t('needs_record_subtitle')}
        </p>
      </header>

      <BarcodeScanner
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
        onScan={handleScan}
        tabId="shopping-list"
      />

      {/* Tabs */}
      <div
        className="grid grid-cols-2 border divide-x divide-x-reverse"
        style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('products');
            setInputText('');
          }}
          className="flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors cursor-pointer"
          style={{
            backgroundColor: activeTab === 'products' ? theme.text : 'transparent',
            color: activeTab === 'products' ? theme.surface : theme.textMuted,
            borderColor: theme.border,
          }}
        >
          <ListTodo size={16} strokeWidth={2.2} />
          <span>{t('purchases')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('notes');
            setInputText('');
          }}
          className="flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors cursor-pointer"
          style={{
            backgroundColor: activeTab === 'notes' ? theme.text : 'transparent',
            color: activeTab === 'notes' ? theme.surface : theme.textMuted,
            borderColor: theme.border,
          }}
        >
          <StickyNote size={16} strokeWidth={2.2} />
          <span>{t('notes')}</span>
        </button>
      </div>

      {/* Unified Input Section */}
      <div className="relative z-30">
        <div
          className="flex items-center border p-1 transition-colors"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <input
            type="text"
            name="shopping_item_text"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-protonpass-ignore="true"
            data-form-type="other"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder={activeTab === 'products' ? t('what_to_buy') : t('add_private_note')}
            className="flex-1 h-11 bg-transparent px-3 text-sm sm:text-base font-medium outline-none w-full"
            style={{ color: theme.text }}
          />

          <div className="flex items-center gap-1 pl-1 shrink-0">
            {activeTab === 'products' && (
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="h-10 w-10 flex items-center justify-center border transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              >
                <ScanLine size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => addItem()}
              disabled={!inputText.trim()}
              className="h-10 w-10 text-white flex items-center justify-center transition-opacity disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: theme.accent }}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-0 right-0 top-14 z-50 border shadow-lg overflow-hidden mt-1"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div
                className="px-4 py-2 border-b text-[10px] font-bold uppercase tracking-widest"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                {t('match_from_stock')}
              </div>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItem(p.name)}
                  className="w-full flex items-center justify-between p-3.5 text-right border-b last:border-0 transition-colors cursor-pointer"
                  style={{ borderColor: theme.border }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">{p.name}</span>
                    <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.accent }}>
                      {t('available')}: {formatQuantity(p.quantity)} {p.unit}
                    </span>
                  </div>
                  <Plus size={16} style={{ color: theme.textMuted }} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items List */}
      <div className="border divide-y" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
        <AnimatePresence initial={false}>
          {listToDisplay.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="p-3 flex items-center justify-between gap-3"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="h-8 w-8 border flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: activeTab === 'products' ? theme.accent : theme.positive,
                  }}
                >
                  {activeTab === 'products' ? <ListTodo size={15} /> : <StickyNote size={15} />}
                </div>
                <span className="text-sm font-bold break-words">{item.text}</span>
              </div>

              <button
                type="button"
                onClick={() => deleteItem(item.id)}
                className="h-8 w-8 flex items-center justify-center border transition-colors shrink-0 cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.negative,
                }}
                title={t('delete')}
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {listToDisplay.length === 0 && (
          <div className="text-center py-14">
            <div className="mb-3 flex justify-center opacity-30">
              {activeTab === 'products' ? (
                <ListTodo size={36} strokeWidth={1.2} />
              ) : (
                <StickyNote size={36} strokeWidth={1.2} />
              )}
            </div>
            <p className="font-bold text-xs" style={{ color: theme.textMuted }}>
              {activeTab === 'products' ? t('shopping_list_empty') : t('notes_empty')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
