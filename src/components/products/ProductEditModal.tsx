import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode } from 'lucide-react';
import { Product } from '../../types';

interface ProductEditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<void>;
  scannedBarcode: string;
  onScan: () => void;
}

export function ProductEditModal({ product, isOpen, onClose, onSave, scannedBarcode, onScan }: ProductEditModalProps) {
  const { t } = useTranslation();
  const [piecesPerBox, setPiecesPerBox] = useState(1);
  const [boxPrice, setBoxPrice] = useState(0);
  const [piecePrice, setPiecePrice] = useState(0);

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
    }
  }, [isOpen, product]);

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
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500">الباركود</label>
                <div className="relative group">
                  <input 
                    name="barcode" 
                    defaultValue={product?.barcode || scannedBarcode} 
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pl-12 text-right outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white" 
                    placeholder="امسح الباركود أو أدخله يدوياً"
                  />
                  <div className="absolute inset-y-0 left-1 flex items-center pl-1">
                    <button 
                      type="button" 
                      onClick={onScan}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400 group-focus-within:border-brand-500 group-focus-within:text-brand-500 dark:bg-zinc-950 dark:border-zinc-800 transition-all active:scale-90"
                    >
                      <QrCode size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500">{t('category')}</label>
                <input 
                  name="category" 
                  defaultValue={product?.category || "أخرى"} 
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                />
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
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
