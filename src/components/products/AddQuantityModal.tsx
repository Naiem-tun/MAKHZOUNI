import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';

interface AddQuantityModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (numBoxes: number, extraPieces: number, boxPrice: number, piecePrice: number) => Promise<void>;
}

export function AddQuantityModal({ product, isOpen, onClose, onConfirm }: AddQuantityModalProps) {
  const { t } = useTranslation();
  const [numBoxes, setNumBoxes] = useState(0);
  const [extraPieces, setExtraPieces] = useState(0);
  const [boxPrice, setBoxPrice] = useState(0);
  const [piecePrice, setPiecePrice] = useState(0);

  useEffect(() => {
    if (product) {
      setBoxPrice(product.boxPurchasePrice || 0);
      setPiecePrice(product.purchasePrice || 0);
      setNumBoxes(0);
      setExtraPieces(0);
    }
  }, [product]);

  const handleQtyBoxPriceChange = (val: number) => {
    setBoxPrice(val);
    if (product?.piecesPerBox && product.piecesPerBox > 0) {
      setPiecePrice(val / product.piecesPerBox);
    }
  };

  const handleQtyPiecePriceChange = (val: number) => {
    setPiecePrice(val);
    if (product?.piecesPerBox) {
      setBoxPrice(val * product.piecesPerBox);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(numBoxes, extraPieces, boxPrice, piecePrice);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      onConfirm(numBoxes, extraPieces, boxPrice, piecePrice);
    }
  };

  const addedQty = (numBoxes * (product?.piecesPerBox || 1)) + extraPieces;
  const newTotalQty = (product?.quantity || 0) + addedQty;

  return (
    <AnimatePresence>
      {isOpen && product && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 left-6 text-zinc-400 hover:text-zinc-600 shadow-sm"
            >
              <X size={20} />
            </button>
            
            <h2 className="mb-6 text-center text-lg font-medium text-zinc-900 dark:text-white px-8">
              {t('add_quantity')} - {product.name}
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                <div className="text-center border-r border-zinc-200 dark:border-zinc-700">
                  <p className="text-[10px] font-bold text-zinc-400 mb-1">{t('current_stock')}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-lg font-bold text-zinc-900 dark:text-white">{product.quantity}</span>
                    <span className="text-[8px] font-bold text-zinc-400">{t('piece')}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-zinc-400 mb-1">{t('pieces_in_box')}</p>
                  <span className="text-lg font-black text-zinc-900 dark:text-white">{product.piecesPerBox}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-zinc-400 pr-1">{t('num_boxes')}</label>
                    <input 
                      type="number" 
                      value={numBoxes || ''}
                      onChange={(e) => setNumBoxes(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white py-4 text-center text-xl font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                      placeholder="0"
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-zinc-400 pr-1">{t('extra_pieces')}</label>
                    <input 
                      type="number" 
                      value={extraPieces || ''}
                      onChange={(e) => setExtraPieces(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white py-4 text-center text-xl font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                      placeholder="0"
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-zinc-400 pr-1">{t('box_purchase_price')}</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={boxPrice || ''}
                      onChange={(e) => handleQtyBoxPriceChange(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white py-3 text-center font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[10px] font-bold text-zinc-400 pr-1">{t('piece_purchase_price')}</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={piecePrice || ''}
                      onChange={(e) => handleQtyPiecePriceChange(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white py-3 text-center font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-dashed border-zinc-100 p-4 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{addedQty}</span>
                      <span className="text-[10px] font-bold text-zinc-400">{t('piece')}</span>
                    </div>
                    <span className="text-xs font-bold text-zinc-500">{t('will_be_added')}</span>
                  </div>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-brand-600">{newTotalQty}</span>
                      <span className="text-[10px] font-bold text-zinc-400">{t('piece')}</span>
                    </div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{t('new_total_stock')}</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full rounded-2xl bg-brand-600 py-4 font-bold text-white transition-all hover:bg-brand-700 active:scale-95 dark:bg-brand-600 dark:hover:bg-brand-700"
                >
                  {t('confirm_purchase')}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
