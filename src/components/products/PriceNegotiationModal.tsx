import React from 'react';
import { X, Shield, History, TrendingDown, Truck, Calendar, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { formatCurrency, safeParseDate } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { query, collection, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface PriceNegotiationModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
}

export function PriceNegotiationModal({ products, isOpen, onClose }: PriceNegotiationModalProps) {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [history, setHistory] = React.useState<any[]>([]);
  const [, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && products && products.length > 0 && user) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const allHistory: any[] = [];
          for (const p of products) {
            const q = query(
              collection(db, `users/${user.uid}/purchases`),
              where('productId', '==', p.id),
              limit(20)
            );
            const snap = await getDocs(q);
            allHistory.push(...snap.docs.map(doc => doc.data()));
          }
          allHistory.sort((a, b) => safeParseDate(b.date || b.createdAt).getTime() - safeParseDate(a.date || a.createdAt).getTime());
          setHistory(allHistory);
        } catch (err) {
          console.error("Error fetching price history:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, products, user]);

  if (!products || products.length === 0) return null;
  const mainProduct = products[0];

  // Aggregate all prices to find the absolute best box price
  const allPrices: number[] = [];
  products.forEach(p => {
    if (p.boxPurchasePrice && p.boxPurchasePrice > 0) {
      allPrices.push(p.boxPurchasePrice);
    } else if (p.purchasePrice) {
      allPrices.push(p.purchasePrice * (p.piecesPerBox || 1));
    }
  });
  
  history.forEach(h => {
    const relatedProduct = products.find(p => p.id === h.productId) || mainProduct;
    const boxQty = relatedProduct.piecesPerBox || 1;
    const unitPrice = h.price || (h.amount && h.qtyAdded ? h.amount / h.qtyAdded : 0);
    // If the history has a boxPrice explicitly saved, use it, otherwise unit * boxQty
    const historyBoxPrice = h.boxPurchasePrice || (unitPrice * boxQty);
    if (historyBoxPrice > 0) allPrices.push(historyBoxPrice);
  });

  const absoluteBestPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;

  // Calculate price points from both products and history
  const pricePointsMap: Record<string, { price: number, lastDate: any, supplierName: string, boxQty: number, isCurrent?: boolean }> = {};
  
  // 1. Add current prices from the products themselves
  products.forEach(p => {
    const boxQty = p.piecesPerBox || 1;
    const unitPrice = (p.boxPurchasePrice && p.boxPurchasePrice > 0) ? (p.boxPurchasePrice / boxQty) : (p.purchasePrice || 0);

    if (unitPrice > 0) {
      const sName = p.name || t('unknown_supplier');
      const key = `${sName}_${unitPrice.toFixed(3)}`;
      pricePointsMap[key] = {
        price: unitPrice,
        lastDate: { seconds: Date.now() / 1000 },
        supplierName: sName,
        boxQty: boxQty,
        isCurrent: true
      };
    }
  });

  // 2. Add prices from history (overwriting or adding if better/newer)
  history.forEach(h => {
    const relatedProduct = products.find(p => p.id === h.productId) || mainProduct;
    const boxQty = relatedProduct.piecesPerBox || 1;
    let unitPrice = h.price || (h.amount && h.qtyAdded ? h.amount / h.qtyAdded : 0);
    if (h.boxPurchasePrice && h.boxPurchasePrice > 0) {
      unitPrice = h.boxPurchasePrice / boxQty;
    }
    
    const sName = h.supplierName || relatedProduct.name || t('unknown_supplier');
    if (unitPrice > 0) {
      const key = `${sName}_${unitPrice.toFixed(3)}`;
      // Only add if not exists or if this history record is newer than what we have
      if (!pricePointsMap[key] || (h.date?.seconds > (pricePointsMap[key].lastDate?.seconds || 0))) {
        pricePointsMap[key] = {
          price: unitPrice,
          lastDate: h.date,
          supplierName: sName,
          boxQty: boxQty
        };
      }
    }
  });

  const sortedSuppliers = Object.values(pricePointsMap).sort((a, b) => a.price - b.price);
  const bestSupplierName = sortedSuppliers.length > 0 ? sortedSuppliers[0].supplierName : mainProduct.name;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs" dir="rtl" onClick={onClose}>
          <div
            className="relative w-full max-w-md border flex flex-col max-h-[90vh] shadow-2xl overflow-hidden transition-colors"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-4 py-3.5 sm:px-5 sm:py-4 border-b flex items-start justify-between gap-3 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <Shield size={13} style={{ color: theme.accent }} />
                  <span className="font-mono tabular-nums" style={{ color: theme.accent }}>01</span>
                  <span style={{ color: theme.textMuted }}>{t('price_negotiation_tool')}</span>
                </div>
                <h2 className="text-base sm:text-xl font-black leading-tight truncate" style={{ color: theme.text }}>
                  {mainProduct.name}
                </h2>
                {(mainProduct.barcode || mainProduct.barcode2) && (
                  <p className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                    {mainProduct.barcode || mainProduct.barcode2}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="p-1.5 border cursor-pointer shrink-0"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Best Historical Price KPI Strip */}
            <div
              className="grid grid-cols-2 border-b divide-x divide-x-reverse shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="p-3.5 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
                <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                  {t('best_historical_price')}
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={16} style={{ color: theme.positive }} />
                  <span className="text-lg sm:text-xl font-black font-mono tabular-nums" style={{ color: theme.positive }}>
                    {formatCurrency(absoluteBestPrice, settings.currency, settings.language)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 space-y-1" style={{ borderColor: theme.border }}>
                <div className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
                  عمليات الشراء المسجلة
                </div>
                <div className="text-lg sm:text-xl font-black font-mono tabular-nums" style={{ color: theme.text }}>
                  {history.length} <span className="text-xs font-bold" style={{ color: theme.textMuted }}>{t('purchases') || 'مشتريات'}</span>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {sortedSuppliers.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black" style={{ color: theme.textMuted }}>
                    <History size={14} style={{ color: theme.accent }} />
                    <span>{t('supplier_comparison')}</span>
                  </div>

                  <div className="space-y-2.5">
                    {sortedSuppliers.map((s, idx) => {
                      const isBest = idx === 0;
                      return (
                        <div
                          key={idx}
                          className="p-3.5 border transition-colors flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: theme.surface,
                            borderColor: isBest ? theme.positive : theme.border,
                            borderRight: isBest ? `4px solid ${theme.positive}` : undefined,
                          }}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Truck size={14} style={{ color: isBest ? theme.positive : theme.accent }} />
                              <span className="text-sm font-black truncate" style={{ color: theme.text }}>
                                {s.supplierName}
                              </span>
                              {isBest && (
                                <span
                                  className="text-[10px] font-black px-1.5 py-0.5 border inline-flex items-center gap-1"
                                  style={{
                                    borderColor: theme.positive,
                                    color: theme.positive,
                                    backgroundColor: theme.surfaceMuted,
                                  }}
                                >
                                  <TrendingDown size={10} />
                                  <span>{t('best_deal')}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} />
                                {s.lastDate?.seconds ? new Date(s.lastDate.seconds * 1000).toLocaleDateString(settings.language === 'ar' ? 'ar-TN' : 'en-GB') : '-'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Package size={11} />
                                {s.boxQty} {t('piece')} / {t('box')}
                              </span>
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            <div
                              className="text-base font-black font-mono tabular-nums"
                              style={{ color: isBest ? theme.positive : theme.text }}
                            >
                              {formatCurrency(s.price * s.boxQty, settings.currency, settings.language)}
                            </div>
                            <div className="text-[10px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                              {formatCurrency(s.price, settings.currency, settings.language)} / قطعة
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className="p-8 border text-center text-xs font-bold"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }}
                >
                  لا توجد بيانات تاريخية للأسعار بعد
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div
              className="p-4 border-t shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border font-black text-xs cursor-pointer transition-colors"
                style={{ backgroundColor: theme.text, borderColor: theme.text, color: theme.surface }}
              >
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

