import React from 'react';
import { X, Shield, History, TrendingUp, TrendingDown, Minus, Truck, Calendar, Info, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { formatCurrency, cn, safeParseDate } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { query, collection, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PriceNegotiationModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
}

export function PriceNegotiationModal({ products, isOpen, onClose }: PriceNegotiationModalProps) {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

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
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            onClick={onClose} 
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md" 
          />
          <div 
            className="relative w-full max-w-md overflow-hidden rounded-lg bg-zinc-50/95 backdrop-blur-xl dark:bg-zinc-950/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] border border-white/20 dark:border-zinc-800 flex flex-col max-h-[90vh]"
          >
            {/* Top Banner - Absolute Best */}
            <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-8 text-white relative shrink-0 overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4 rotate-12">
                <Shield size={140} strokeWidth={1} />
              </div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              
              <div className="relative z-10 flex items-start justify-between mb-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-lg shadow-sm">
                      <Shield size={12} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{t('price_negotiation_tool')}</span>
                  </div>
                  <h2 className="text-2xl font-black leading-tight drop-shadow-sm">{mainProduct.name}</h2>
                  <p className="text-[11px] font-bold text-white/70 tracking-widest drop-shadow-sm">{mainProduct.barcode || mainProduct.barcode2}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all text-white border border-white/10 shadow-sm active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-end justify-between relative z-10">
                <div className="space-y-1">
                  <p className="text-brand-100 text-[11px] font-black uppercase tracking-widest mb-1">{t('best_historical_price')}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-[40px] tracking-tight font-black leading-none drop-shadow-md">
                      {formatCurrency(absoluteBestPrice, settings.currency, settings.language).split(' ')[0]}
                      <span className="text-xl ml-1 text-white/80">{formatCurrency(absoluteBestPrice, settings.currency, settings.language).split(' ').slice(1).join(' ')}</span>
                    </p>
                    <div className="bg-emerald-400 text-emerald-950 h-8 w-8 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                      <TrendingDown size={18} strokeWidth={3} />
                    </div>
                  </div>
                </div>
                <div className="bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black text-white/90 border border-white/10 flex items-center gap-1.5 shadow-inner">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {history.length} {t('purchases') || 'مشتريات'}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gradient-to-b from-white/50 to-transparent dark:from-zinc-900/50 dark:to-transparent">
              
              {/* Supplier Comparison Section */}
              {sortedSuppliers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 px-1">
                    <History size={16} />
                    <span className="text-[11px] font-black uppercase tracking-widest">{t('supplier_comparison')}</span>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 no-scrollbar snap-x">
                    {sortedSuppliers.map((s, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "min-w-[180px] snap-center p-5 rounded-lg shrink-0 transition-all relative flex flex-col justify-between overflow-hidden hover:scale-[1.02] hover:-translate-y-0.5",
                          idx === 0 
                            ? "bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-400/50 text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)]" 
                            : "bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-900 dark:text-white hover:border-brand-200 dark:hover:border-brand-800 shadow-sm hover:shadow-md"
                        )}
                      >
                        {/* Background Decoration for First Place */}
                        {idx === 0 && (
                           <div className="absolute top-0 left-0 p-4 opacity-[0.08] pointer-events-none transform -rotate-12 -translate-x-4 -translate-y-4">
                              <Shield size={100} strokeWidth={1} />
                           </div>
                        )}
                        
                        <div className="flex flex-col gap-3 relative z-10 h-full">
                          <div className="flex items-center justify-between">
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm",
                              idx === 0 ? "bg-white/20 text-white" : "bg-zinc-50 dark:bg-zinc-800 text-brand-500 dark:text-brand-400 border border-zinc-100 dark:border-zinc-700"
                            )}>
                              <Truck size={14} />
                            </div>
                            {idx === 0 && (
                              <span className="bg-white text-emerald-600 text-[9px] font-black uppercase px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                                <TrendingDown size={10} strokeWidth={3} />
                                {t('best_deal')}
                              </span>
                            )}
                          </div>
                          <div className="mt-2">
                            <p className={cn(
                              "text-sm font-black truncate",
                              idx === 0 ? "text-white" : "text-zinc-900 dark:text-white"
                            )}>
                              {s.supplierName}
                            </p>
                            <p className={cn(
                              "text-[10px] font-bold mt-1 flex items-center gap-1",
                              idx === 0 ? "text-emerald-50" : "text-zinc-400"
                            )}>
                              <Calendar size={10} />
                              <span>{s.lastDate?.seconds ? new Date(s.lastDate.seconds * 1000).toLocaleDateString(settings.language === 'ar' ? 'ar-TN' : 'en-GB') : '-'}</span>
                            </p>
                          </div>
                          <div className={cn(
                              "mt-4 pt-4 border-t border-dashed",
                              idx === 0 ? "border-white/30" : "border-zinc-100 dark:border-zinc-800"
                          )}>
                            <div className="flex items-baseline gap-1">
                              <p className="text-[22px] tracking-tight font-black leading-none drop-shadow-sm">
                                {formatCurrency(s.price * s.boxQty, settings.currency, settings.language).split(' ')[0]}
                              </p>
                              <span className={cn("text-[11px] font-bold", idx === 0 ? "text-white/80" : "text-zinc-400")}>
                                {formatCurrency(s.price * s.boxQty, settings.currency, settings.language).split(' ').slice(1).join(' ')}
                              </span>
                            </div>
                            <div className={cn(
                                "inline-flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg transition-colors",
                                idx === 0 ? "bg-black/10 backdrop-blur-sm" : "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                            )}>
                               <Package size={10} className={idx === 0 ? "text-white" : "text-zinc-400"} />
                               <span className={cn(
                                   "text-[9.5px] font-black tracking-wide",
                                   idx === 0 ? "text-white/95" : "text-zinc-500"
                               )}>
                                 {s.boxQty} {t('piece')} / {t('box')}
                               </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer Action */}
            <div className="p-6 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md border-t border-white/20 dark:border-zinc-800/50 shrink-0">
               <button 
                onClick={onClose}
                className="w-full py-4 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-sm tracking-widest uppercase active:scale-[0.98] transition-all shadow-[0_10px_20px_-10px_rgba(0,0,0,0.3)] hover:shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 flex items-center justify-center"
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

