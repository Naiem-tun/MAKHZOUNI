import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { cleanQuantity, formatQuantity } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface AddQuantityModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (numBoxes: number, extraPieces: number, boxPrice: number, piecePrice: number) => Promise<void>;
  lastPurchase?: any;
}

export function AddQuantityModal({ product, isOpen, onClose, onConfirm }: AddQuantityModalProps) {
  const { t } = useTranslation();
  const { settings, activeSupplier } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
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

  const hasPriceWarning = Boolean(product?.sellingPrice && piecePrice > 0 && piecePrice >= product.sellingPrice);

  return (
    <>
      {isOpen && product && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs" dir="rtl" onClick={onClose}>
          <div
            className="relative w-full max-w-md border flex flex-col max-h-[92vh] shadow-2xl overflow-hidden transition-colors"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-4 py-3.5 sm:px-5 sm:py-4 border-b flex items-center justify-between gap-3 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="font-mono tabular-nums" style={{ color: theme.accent }}>01</span>
                  <span style={{ color: theme.textMuted }}>{t('add_quantity')}</span>
                </div>
                <h2 className="text-base sm:text-lg font-black tracking-tight truncate" style={{ color: theme.text }}>
                  {product.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="p-1.5 border transition-colors cursor-pointer shrink-0"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {!activeSupplier && !settings.requireSupplierSession && (
                <div
                  className="p-3 border flex gap-3 items-start"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderRight: `3px solid ${theme.neutral}`,
                  }}
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" style={{ color: theme.neutral }} />
                  <div>
                    <h4 className="text-xs font-black mb-0.5" style={{ color: theme.text }}>تنبيه المورد</h4>
                    <p className="text-[11px] font-bold leading-relaxed" style={{ color: theme.textMuted }}>
                      لا توجد حصة مورد نشطة حالياً. هذه المشتريات ستُسجل كـ <span className="underline">"مورد غير معروف"</span> ولن تُضاف لسجل مشتريات أي مورد.
                    </p>
                  </div>
                </div>
              )}

              {/* Current Stock KPI Strip */}
              <div
                className="grid grid-cols-2 border divide-x divide-x-reverse"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="p-3 text-center" style={{ borderColor: theme.border }}>
                  <p className="text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>{t('current_stock')}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    {settings.defaultStockView === 'boxes' && product.piecesPerBox && product.piecesPerBox > 1 ? (
                      <>
                        <span className="text-lg font-black font-mono tabular-nums" style={{ color: theme.text }}>
                          {(cleanQuantity(product.quantity) / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>كرتونة</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-black font-mono tabular-nums" style={{ color: theme.text }}>
                          {formatQuantity(product.quantity)}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>{unitText}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3 text-center" style={{ borderColor: theme.border }}>
                  <p className="text-[10px] font-bold mb-1" style={{ color: theme.textMuted }}>{t('pieces_in_box')}</p>
                  <span className="text-lg font-black font-mono tabular-nums" style={{ color: theme.accent }}>
                    {product.piecesPerBox}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>{t('num_boxes')}</label>
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
                      className="w-full border py-3.5 text-center text-xl font-black font-mono tabular-nums outline-none"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                      placeholder="0"
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>{t('extra_pieces')}</label>
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
                      className="w-full border py-3.5 text-center text-xl font-black font-mono tabular-nums outline-none"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                      placeholder="0"
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>{t('box_purchase_price')}</label>
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
                      className="w-full border py-2.5 text-center font-black font-mono tabular-nums outline-none"
                      style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="text-[11px] font-bold block" style={{ color: theme.textMuted }}>{t('piece_purchase_price')}</label>
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
                      className="w-full border py-2.5 text-center font-black font-mono tabular-nums outline-none transition-colors"
                      style={{
                        backgroundColor: theme.surface,
                        borderColor: hasPriceWarning ? theme.negative : theme.border,
                        color: hasPriceWarning ? theme.negative : theme.text,
                      }}
                      enterKeyHint="done"
                      inputMode="decimal"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>

                {hasPriceWarning && (
                  <p className="text-[11px] font-bold text-right flex items-center justify-end gap-1" style={{ color: theme.negative }}>
                    <span>تنبيه: سعر الشراء الجديد ({piecePrice.toFixed(3)}) يجب أن يكون أقل من سعر البيع ({product.sellingPrice.toFixed(3)})</span>
                    <AlertCircle size={13} className="shrink-0" />
                  </p>
                )}

                <div
                  className="border border-dashed p-3.5 space-y-2.5"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: theme.textMuted }}>{t('will_be_added')}</span>
                    <div className="flex items-baseline gap-1 font-mono tabular-nums">
                      {settings.defaultStockView === 'boxes' && product?.piecesPerBox && product.piecesPerBox > 1 ? (
                        <>
                          <span className="text-sm font-black" style={{ color: theme.text }}>
                            {(addedQty / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>كرتونة</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-black" style={{ color: theme.text }}>{formatQuantity(addedQty)}</span>
                          <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>{unitText}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-px" style={{ backgroundColor: theme.border }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black" style={{ color: theme.text }}>{t('new_total_stock')}</span>
                    <div className="flex items-baseline gap-1 font-mono tabular-nums">
                      {settings.defaultStockView === 'boxes' && product?.piecesPerBox && product.piecesPerBox > 1 ? (
                        <>
                          <span className="text-lg font-black" style={{ color: theme.accent }}>
                            {(newTotalQty / product.piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>كرتونة</span>
                        </>
                      ) : (
                        <>
                          <span className="text-lg font-black" style={{ color: theme.accent }}>{formatQuantity(newTotalQty)}</span>
                          <span className="text-[10px] font-bold" style={{ color: theme.textMuted }}>{unitText}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addedQty <= 0 || isSaving}
                  className="w-full py-3.5 border font-black text-sm transition-opacity hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
                >
                  {isSaving ? <div className="animate-spin w-5 h-5 border-2 border-current rounded-full border-t-transparent mx-auto" /> : t('confirm_purchase')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
