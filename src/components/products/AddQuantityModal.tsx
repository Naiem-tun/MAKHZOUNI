import React, { useState, useEffect } from 'react';
import { X, History, TrendingUp, TrendingDown, Minus, AlertCircle, ShieldAlert, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { formatCurrency, cn, cleanQuantity, formatQuantity } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { useStaffAuth } from '../../contexts/StaffAuthContext';

interface AddQuantityModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (numBoxes: number, extraPieces: number, boxPrice: number, piecePrice: number) => Promise<void>;
  lastPurchase?: any;
}

export function AddQuantityModal({ product, isOpen, onClose, onConfirm, lastPurchase }: AddQuantityModalProps) {
  const { t } = useTranslation();
  const { settings, activeSupplier } = useAppContext();
  const { checkPermission } = useStaffAuth();
  const canViewCostPrices = checkPermission('canViewCostPrices');

  const [numBoxes, setNumBoxes] = useState(0);
  const [extraPieces, setExtraPieces] = useState(0);
  const [boxPrice, setBoxPrice] = useState(0);
  const [piecePrice, setPiecePrice] = useState(0);

  const unitMap: Record<string, string> = {
    piece: 'قطعة',
    carton: 'كرتونة',
    kg: 'كغ',
    gram: 'غرام',
    liter: 'لتر',
    box: 'صندوق',
    meter: 'متر'
  };
  const unitText = product?.unit ? (unitMap[product.unit] || t(product.unit) || 'قطعة') : t('piece');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setBoxPrice(product.boxPurchasePrice ? parseFloat(Number(product.boxPurchasePrice).toFixed(3)) : 0);
      setPiecePrice(product.purchasePrice ? parseFloat(Number(product.purchasePrice).toFixed(3)) : 0);
      setNumBoxes(0);
      setExtraPieces(0);
      setIsSaving(false);
    }
  }, [product, isOpen]);

  const handleQtyBoxPriceChange = (val: number) => {
    setBoxPrice(val);
    if (product?.piecesPerBox && product.piecesPerBox > 0) {
      setPiecePrice(parseFloat((val / product.piecesPerBox).toFixed(3)));
    }
  };

  const handleQtyPiecePriceChange = (val: number) => {
    setPiecePrice(val);
    if (product?.piecesPerBox) {
      setBoxPrice(parseFloat((val * product.piecesPerBox).toFixed(3)));
    }
  };

  const addedQty = cleanQuantity((numBoxes * (product?.piecesPerBox || 1)) + extraPieces);
  const currentStock = cleanQuantity(product?.quantity);
  const newTotalQty = cleanQuantity(currentStock + addedQty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addedQty <= 0 || isSaving) return;
    setIsSaving(true);
    const finalBoxPrice = parseFloat((boxPrice || 0).toFixed(3));
    const finalPiecePrice = parseFloat((piecePrice || 0).toFixed(3));
    try {
      await onConfirm(numBoxes, extraPieces, finalBoxPrice, finalPiecePrice);
    } catch (err) {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      if (addedQty <= 0 || isSaving) return;
      setIsSaving(true);
      const finalBoxPrice = parseFloat((boxPrice || 0).toFixed(3));
      const finalPiecePrice = parseFloat((piecePrice || 0).toFixed(3));
      onConfirm(numBoxes, extraPieces, finalBoxPrice, finalPiecePrice).catch(() => setIsSaving(false));
    }
  };

  return (
    <>
      {isOpen && product && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900"
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

              {!activeSupplier && !settings.requireSupplierSession && (
                <div className="mx-8 -mt-2 rounded-lg bg-amber-50 p-3 flex gap-3 items-start border border-amber-200/60 dark:bg-amber-500/10 dark:border-amber-500/20 shadow-sm" dir="rtl">
                  <div className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 mb-0.5">تنبيه المورد</h4>
                    <p className="text-[10px] sm:text-xs font-bold text-amber-700/90 dark:text-amber-400/80 leading-relaxed">
                      لا توجد حصة مورد نشطة حالياً. هذه المشتريات ستُسجل كـ <span className="underline decoration-amber-300/50 decoration-2 underline-offset-2">"مورد غير معروف"</span> ولن تُضاف لسجل مشتريات أي مورد.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                    <div className="text-center border-r border-zinc-200 dark:border-zinc-700">
                      <p className="text-[10px] font-bold text-zinc-400 mb-1">{t('current_stock')}</p>
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-baseline justify-center gap-1">
                          {settings.defaultStockView === 'boxes' && product.piecesPerBox && product.piecesPerBox > 1 ? (
                            <>
                              <span className="text-lg font-bold text-zinc-900 dark:text-white">{(cleanQuantity(product.quantity) / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                              <span className="text-[8px] font-bold text-zinc-400">كرتونة</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold text-zinc-900 dark:text-white">{formatQuantity(product.quantity)}</span>
                              <span className="text-[8px] font-bold text-zinc-400">{unitText}</span>
                            </>
                          )}
                        </div>
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
                          step="any"
                          name="num_boxes_input"
                          autoComplete="off"
                          autoCorrect="off"
                          data-lpignore="true"
                          data-form-type="other"
                          value={numBoxes || ''}
                          onChange={(e) => setNumBoxes(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          className="w-full rounded-lg border border-zinc-200 bg-white py-4 text-center text-xl font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
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
                          step="any"
                          name="extra_pieces_input"
                          autoComplete="off"
                          autoCorrect="off"
                          data-lpignore="true"
                          data-form-type="other"
                          value={extraPieces || ''}
                          onChange={(e) => setExtraPieces(parseFloat(e.target.value.replace(',', '.')) || 0)}
                          className="w-full rounded-lg border border-zinc-200 bg-white py-4 text-center text-xl font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
                          placeholder="0"
                          enterKeyHint="done"
                          inputMode="decimal"
                          onKeyDown={handleKeyDown}
                        />
                      </div>
                    </div>

                    {canViewCostPrices ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1 text-right">
                            <label className="text-[10px] font-bold text-zinc-400 pr-1">{t('box_purchase_price')}</label>
                            <input 
                              type="number" 
                              step="0.001"
                              name="box_price_input"
                              autoComplete="off"
                              autoCorrect="off"
                              data-lpignore="true"
                              data-form-type="other"
                              value={boxPrice || ''}
                              onChange={(e) => handleQtyBoxPriceChange(parseFloat(e.target.value.replace(',', '.')) || 0)}
                              className="w-full rounded-lg border border-zinc-200 bg-white py-3 text-center font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white"
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
                              name="piece_price_input"
                              autoComplete="off"
                              autoCorrect="off"
                              data-lpignore="true"
                              data-form-type="other"
                              value={piecePrice || ''}
                              onChange={(e) => handleQtyPiecePriceChange(parseFloat(e.target.value.replace(',', '.')) || 0)}
                              className={`w-full rounded-lg border py-3 text-center font-bold outline-none focus:ring-2 transition-colors ${
                                (product?.sellingPrice && piecePrice > 0 && piecePrice >= product.sellingPrice)
                                  ? 'border-red-500 bg-red-50/50 text-red-600 focus:ring-red-500 dark:bg-red-950/20 dark:border-red-500 dark:text-red-400'
                                  : 'border-zinc-200 bg-white text-zinc-900 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white'
                              }`}
                              enterKeyHint="done"
                              inputMode="decimal"
                              onKeyDown={handleKeyDown}
                            />
                          </div>
                        </div>

                        {product?.sellingPrice && piecePrice > 0 && piecePrice >= product.sellingPrice && (
                          <p className="text-[11px] font-bold text-red-500 text-right flex items-center justify-end gap-1">
                            <span>تنبيه: سعر الشراء الجديد ({piecePrice.toFixed(3)}) يجب أن يكون أقل من سعر البيع ({product.sellingPrice.toFixed(3)})</span>
                            <AlertCircle size={13} className="shrink-0" />
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/40 p-3 border border-blue-200/70 dark:border-blue-800/60 flex items-center gap-2 text-right">
                        <Lock size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        <p className="text-xs text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
                          <span className="font-bold">وضع استلام كميات للمخزن:</span> يتم توريد الكميات المدخلة للمخزون، بينما تبقى أسعار التكلفة والتسعير المالي محفوظة لدى الإدارة.
                        </p>
                      </div>
                    )}

                    <div className="rounded-lg border-2 border-dashed border-zinc-100 p-4 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          {settings.defaultStockView === 'boxes' && product?.piecesPerBox && product.piecesPerBox > 1 ? (
                            <>
                              <span className="text-sm font-bold text-zinc-900 dark:text-white">{(addedQty / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                              <span className="text-[10px] font-bold text-zinc-400">كرتونة</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatQuantity(addedQty)}</span>
                              <span className="text-[10px] font-bold text-zinc-400">{unitText}</span>
                            </>
                          )}
                        </div>
                        <span className="text-xs font-bold text-zinc-500">{t('will_be_added')}</span>
                      </div>
                      <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          {settings.defaultStockView === 'boxes' && product?.piecesPerBox && product.piecesPerBox > 1 ? (
                            <>
                              <span className="text-lg font-bold text-brand-600">{(newTotalQty / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                              <span className="text-[10px] font-bold text-zinc-400">كرتونة</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold text-brand-600">{formatQuantity(newTotalQty)}</span>
                              <span className="text-[10px] font-bold text-zinc-400">{unitText}</span>
                            </>
                          )}
                        </div>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{t('new_total_stock')}</span>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={addedQty <= 0 || isSaving}
                      className="w-full rounded-lg bg-brand-600 py-4 font-bold text-white transition-all hover:bg-brand-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-600 dark:hover:bg-brand-700"
                    >
                      {isSaving ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent mx-auto"></div> : t('confirm_purchase')}
                    </button>
                  </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
