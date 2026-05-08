import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, Trash2 } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { Product } from '../../types';

interface ProductEditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<void>;
  onDelete?: (product: Product) => void;
  scannedBarcode: string;
  scannedBarcode2?: string;
  onScan: (target: 'barcode' | 'barcode2') => void;
}

export function ProductEditModal({ product, isOpen, onClose, onSave, onDelete, scannedBarcode, scannedBarcode2 = '', onScan }: ProductEditModalProps) {
  const { t } = useTranslation();
  const { categories } = useCategories();
  const [piecesPerBox, setPiecesPerBox] = useState(1);
  const [boxPrice, setBoxPrice] = useState(0);
  const [piecePrice, setPiecePrice] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [barcode2, setBarcode2] = useState('');
  const [showBarcode2, setShowBarcode2] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setPiecesPerBox(product.piecesPerBox || 1);
        setBoxPrice(product.boxPurchasePrice || 0);
        setPiecePrice(product.purchasePrice || 0);
      } else {
        setPiecesPerBox(1);
        setBoxPrice(0);
        setPiecePrice(0);
      }
      setBarcode(product?.barcode || scannedBarcode || '');
      setBarcode2(product?.barcode2 || scannedBarcode2 || '');
      setShowBarcode2(!!product?.barcode2 || !!scannedBarcode2);
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (isOpen && scannedBarcode) setBarcode(scannedBarcode);
  }, [scannedBarcode, isOpen]);

  useEffect(() => {
    if (isOpen && scannedBarcode2) {
      setBarcode2(scannedBarcode2);
      setShowBarcode2(true);
    }
  }, [scannedBarcode2, isOpen]);

  const handleBoxPriceChange = (val: number) => {
    setBoxPrice(val);
    if (piecesPerBox > 0) {
      setPiecePrice(val / piecesPerBox);
    }
  };

  const handlePiecePriceChange = (val: number) => {
    setPiecePrice(val);
    setBoxPrice(val * piecesPerBox);
  };

  const handlePiecesChange = (val: number) => {
    setPiecesPerBox(val);
    if (val > 0) {
      setPiecePrice(boxPrice / val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      // The form submission will be handled by the form's submit button or we can trigger it
      const form = e.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      purchasePrice: parseFloat(formData.get('purchasePrice') as string) || 0,
      sellingPrice: parseFloat(formData.get('sellingPrice') as string) || 0,
      barcode: formData.get('barcode') as string,
      barcode2: formData.get('barcode2') as string,
      piecesPerBox: parseFloat(formData.get('piecesPerBox') as string) || 1,
      boxPurchasePrice: parseFloat(formData.get('boxPurchasePrice') as string) || 0,
      // Keep existing stock values if editing, or default to 0 for new products
      quantity: product?.quantity ?? 0,
      minQuantity: product?.minQuantity ?? 0,
    };
    await onSave(productData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 left-6 text-zinc-400 hover:text-zinc-600"
            >
              <X size={24} />
            </button>
            <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
              {product ? t('edit') : t('add_product')}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              {/* 1. Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500">{t('name')}</label>
                <input 
                  name="name" 
                  defaultValue={product?.name} 
                  required 
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                />
              </div>

              {/* 2. Barcode */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    {!showBarcode2 && (
                      <button 
                        type="button" 
                        onClick={() => setShowBarcode2(true)}
                        className="text-xs font-bold text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        + باركود إضافي
                      </button>
                    )}
                    <label className="text-xs font-bold text-zinc-500">الباركود</label>
                  </div>
                  <div className="relative group">
                    <input 
                      name="barcode" 
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pl-12 text-right outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white block" 
                      placeholder="امسح الباركود أو أدخله يدوياً"
                    />
                    <div className="absolute inset-y-0 left-1 flex items-center pl-1">
                      <button 
                        type="button" 
                        onClick={() => onScan('barcode')}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400 group-focus-within:border-brand-500 group-focus-within:text-brand-500 dark:bg-zinc-950 dark:border-zinc-800 transition-all active:scale-90"
                      >
                        <QrCode size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {showBarcode2 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 flex justify-end">الباركود الإضافي</label>
                    <div className="relative group">
                      <input 
                        name="barcode2" 
                        value={barcode2}
                        onChange={(e) => setBarcode2(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pl-12 text-right outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white block" 
                        placeholder="امسح الباركود الإضافي"
                      />
                      <div className="absolute inset-y-0 left-1 flex items-center pl-1">
                        <button 
                          type="button" 
                          onClick={() => onScan('barcode2')}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400 group-focus-within:border-brand-500 group-focus-within:text-brand-500 dark:bg-zinc-950 dark:border-zinc-800 transition-all active:scale-90"
                        >
                          <QrCode size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500">{t('category')}</label>
                <div className="relative">
                  <select 
                    name="category" 
                    defaultValue={product?.category || "أخرى"} 
                    className="w-full appearance-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right font-medium outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-zinc-400">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                  </div>
                </div>
              </div>

              {/* 4. Box Info Row */}
              <div className="grid grid-cols-2 gap-4 text-right">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500">القطع في الكرتونة</label>
                  <input 
                    name="piecesPerBox" 
                    type="number" 
                    value={piecesPerBox}
                    onChange={(e) => handlePiecesChange(parseFloat(e.target.value) || 0)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500">سعر الكرتونة (شراء)</label>
                  <input 
                    name="boxPurchasePrice" 
                    type="number" 
                    step="0.001"
                    value={boxPrice}
                    onChange={(e) => handleBoxPriceChange(parseFloat(e.target.value) || 0)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
              </div>

              {/* 5. Prices Row */}
              <div className="grid grid-cols-2 gap-4 text-right">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500">سعر شراء القطعة</label>
                  <input 
                    name="purchasePrice" 
                    type="number" 
                    step="0.001" 
                    value={piecePrice}
                    onChange={(e) => handlePiecePriceChange(parseFloat(e.target.value) || 0)}
                    required 
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500">سعر البيع</label>
                  <input 
                    name="sellingPrice" 
                    type="number" 
                    step="0.001" 
                    defaultValue={product?.sellingPrice} 
                    required 
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 rounded-2xl bg-zinc-950 py-4 font-bold text-white transition-all hover:bg-zinc-900 active:scale-95 shadow-xl shadow-zinc-500/10 dark:bg-brand-600 dark:hover:bg-brand-700"
                >
                  {t('save')}
                </button>
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white py-4 font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                >
                  {t('cancel')}
                </button>
              </div>

              {product && onDelete && (
                <>
                  <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800 my-2"></div>
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-rose-500 border-2 border-rose-100 bg-rose-50/50 transition-all hover:bg-rose-50 active:scale-95 dark:border-rose-900/30 dark:bg-rose-950/20 dark:hover:bg-rose-900/40"
                  >
                    <Trash2 size={20} />
                    <span>حذف المنتج</span>
                  </button>
                </>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
