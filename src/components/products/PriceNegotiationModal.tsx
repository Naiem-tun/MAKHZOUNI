import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, History, TrendingUp, TrendingDown, Minus, Truck, Calendar, Info, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { query, collection, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PriceNegotiationModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PriceNegotiationModal({ product, isOpen, onClose }: PriceNegotiationModalProps) {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && product && user) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const q = query(
            collection(db, `users/${user.uid}/purchases`),
            where('productId', '==', product.id),
            orderBy('date', 'desc'),
            limit(10)
          );
          const snap = await getDocs(q);
          setHistory(snap.docs.map(doc => doc.data()));
        } catch (err) {
          console.error("Error fetching price history:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, product, user]);

  if (!product) return null;

  // Aggregate all prices to find the absolute best
  const allPrices: number[] = [];
  if (product.purchasePrice) allPrices.push(product.purchasePrice);
  history.forEach(h => {
    const price = h.price || (h.amount && h.qtyAdded ? h.amount / h.qtyAdded : 0);
    if (price > 0) allPrices.push(price);
  });

  const absoluteBestPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;

  // Calculate Supplier Comparison
  const supplierBestPrices: Record<string, { price: number, lastDate: any, supplierName: string, boxQty: number }> = {};
  
  const pBoxQty = product.piecesPerBox || 1;
  
  history.forEach(h => {
    const sName = h.supplierName || t('unknown_supplier');
    const unitPrice = h.price || (h.amount / h.qtyAdded);
    if (unitPrice > 0) {
      if (!supplierBestPrices[sName] || unitPrice < supplierBestPrices[sName].price) {
        supplierBestPrices[sName] = {
          price: unitPrice,
          lastDate: h.date,
          supplierName: sName,
          boxQty: pBoxQty
        };
      }
    }
  });

  const sortedSuppliers = Object.values(supplierBestPrices).sort((a, b) => a.price - b.price);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative w-full max-w-xl overflow-hidden rounded-[40px] bg-zinc-50 dark:bg-zinc-950 shadow-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col max-h-[90vh]"
          >
            {/* Top Banner - Absolute Best */}
            <div className="bg-brand-600 p-8 text-white relative shrink-0">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Shield size={100} strokeWidth={1} />
              </div>
              
              <div className="relative z-10 flex items-start justify-between mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 backdrop-blur-sm p-1 rounded-lg">
                      <Shield size={14} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('price_negotiation_tool')}</span>
                  </div>
                  <h2 className="text-xl font-black">{product.name}</h2>
                  <p className="text-[10px] font-bold text-white/60">{product.barcode}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white/20 hover:bg-white/30 transition-colors text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-end justify-between relative z-10">
                <div className="space-y-1">
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{t('best_historical_price')}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-4xl font-black leading-none">{formatCurrency(absoluteBestPrice, settings.currency, settings.language)}</p>
                    <div className="bg-white text-brand-600 h-8 w-8 rounded-full flex items-center justify-center animate-bounce">
                      <TrendingDown size={20} />
                    </div>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black">
                  {history.length} {t('purchases') || 'مشتريات'}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Negotiation Alert */}
              <div className="flex items-start gap-4 p-4 rounded-3xl bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30">
                <div className="h-10 w-10 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center text-brand-600 shrink-0 shadow-sm">
                  <Info size={20} />
                </div>
                <p className="text-xs font-bold text-brand-900/70 dark:text-brand-200/60 leading-relaxed pt-1">
                  {t('negotiation_tip')}
                </p>
              </div>
              
              {/* Supplier Comparison Section */}
              {sortedSuppliers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 px-2">
                    <History size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('supplier_comparison')}</span>
                  </div>
                  
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
                    {sortedSuppliers.map((s, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ scale: 1.02 }}
                        className={cn(
                          "min-w-[170px] p-4 rounded-[28px] border shrink-0 transition-all shadow-sm relative overflow-hidden",
                          idx === 0 
                            ? "bg-emerald-500 border-emerald-600 text-white" 
                            : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-white"
                        )}
                      >
                        {/* Background Decoration for First Place */}
                        {idx === 0 && (
                           <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                              <Truck size={60} strokeWidth={1} />
                           </div>
                        )}
                        
                        <div className="flex flex-col gap-2 relative z-10">
                          <div className="flex items-center justify-between">
                            <Truck size={14} className={idx === 0 ? "text-white" : "text-brand-500"} />
                            {idx === 0 && (
                              <span className="bg-white/20 backdrop-blur-sm text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                                {t('best_deal')}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className={cn(
                              "text-xs font-black truncate",
                              idx === 0 ? "text-white" : "text-zinc-900 dark:text-white"
                            )}>
                              {s.supplierName}
                            </p>
                            <p className={cn(
                              "text-[10px] font-bold mt-0.5",
                              idx === 0 ? "text-white/80" : "text-zinc-400"
                            )}>
                              {s.lastDate?.seconds ? new Date(s.lastDate.seconds * 1000).toLocaleDateString(settings.language === 'ar' ? 'ar-TN' : 'en-GB') : '-'}
                            </p>
                          </div>
                          <div className="mt-1">
                            <p className="text-lg font-black leading-none">
                              {formatCurrency(s.price * s.boxQty, settings.currency, settings.language)}
                            </p>
                            <div className="flex items-center gap-1 mt-1 opacity-60">
                              <Package size={10} />
                              <span className="text-[9px] font-bold">
                                {s.boxQty} {t('piece')} / {t('box')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer Action */}
            <div className="p-6 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
               <button 
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-sm active:scale-95 transition-transform shadow-lg"
              >
                {t('back')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

