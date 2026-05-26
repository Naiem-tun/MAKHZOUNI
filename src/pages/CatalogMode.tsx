import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { useTranslation } from 'react-i18next';
import { Search, Lock, Boxes, Package, AlertCircle, ScanLine, ArrowRightLeft } from 'lucide-react';
import { formatCurrency, safeParseFloat } from '../lib/utils';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { Product } from '../types';

export default function CatalogMode() {
  const { user, settings, setIsCatalogMode, showToast } = useAppContext();
  const { t } = useTranslation();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [displayMode, setDisplayMode] = useState<'piece' | 'box'>('piece');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/products`), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, [user]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const lowerQuery = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      (p.barcode && p.barcode.includes(lowerQuery)) ||
      (p.category && p.category.toLowerCase().includes(lowerQuery))
    );
  }, [products, searchQuery]);

  const handleExitRequest = () => {
    if (!settings.catalogPin) {
      // If no PIN is configured, just exit
      setIsCatalogMode(false);
      return;
    }
    setPinInput('');
    setIsExitModalOpen(true);
  };

  const verifyPinAndExit = () => {
    if (pinInput === settings.catalogPin) {
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        setIsExitModalOpen(false);
        setIsCatalogMode(false);
      }, 500); // Small satisfying delay
    } else {
      showToast(t('invalid_pin') || 'الرمز السري غير صحيح', 'error');
      setPinInput('');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-3 flex items-center gap-4">
        <div className="flex-1 max-w-2xl mx-auto flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_products') || 'ابحث عن منتج...'}
              className="w-full h-12 bg-zinc-100 dark:bg-zinc-800/50 border-transparent rounded-xl pr-11 pl-12 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/30 transition-all text-lg font-medium"
            />
            <button
              onClick={() => setIsScannerOpen(true)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-zinc-400 hover:text-[#4A6FA5] transition-colors rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
            >
              <ScanLine size={18} />
            </button>
          </div>
          <button
            onClick={() => setDisplayMode(prev => prev === 'piece' ? 'box' : 'piece')}
            className={`h-12 px-4 shrink-0 rounded-xl font-bold transition-all flex items-center gap-2 border shadow-sm ${
              displayMode === 'box'
                ? 'bg-[#4A6FA5] border-[#4A6FA5] text-white'
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {displayMode === 'box' ? <Boxes size={20} /> : <Package size={20} />}
            <span className="hidden sm:inline">{displayMode === 'box' ? (t('box') || 'كرتونة') : (t('piece') || 'قطعة')}</span>
          </button>
          <button 
            onClick={handleExitRequest}
            className="h-12 px-4 shrink-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors flex items-center justify-center shadow-sm"
            title={t('exit_catalog') || 'خروج من وضع الكتالوج'}
          >
            <Lock size={20} />
          </button>
        </div>
      </header>

      {/* Main Catalog Area */}
      <main className="flex-1 overflow-y-auto p-4 content-visibility-auto">
        <div className="max-w-6xl mx-auto">
          {filteredProducts.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-12 text-zinc-400 text-center space-y-4">
             <AlertCircle size={48} className="opacity-20" />
             <p className="text-lg">{t('no_products') || 'لا توجد منتجات'}</p>
           </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
                >
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight mb-2">
                        {product.name}
                    </h3>
                    
                    {product.barcode && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded inline-flex self-start">
                        <ScanLine size={12} />
                        <span className="font-mono tracking-wider">{product.barcode}</span>
                      </div>
                    )}
                    
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <div className={`flex flex-col`}>
                          <div className={`flex items-center gap-1.5 ${displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? <Boxes size={16} /> : <Package size={16} />}
                            <span className="text-xs sm:text-sm font-medium">
                              {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? (
                                <>
                                  {t('box') || 'كرتونة'}
                                  {` (${product.piecesPerBox})`}
                                </>
                              ) : (
                                t('piece') || 'قطعة'
                              )}
                            </span>
                          </div>
                        </div>
                        <span className={`font-bold text-lg sm:text-xl text-[#4A6FA5] dark:text-[#6a90c1]`}>
                          {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1
                            ? formatCurrency(safeParseFloat(product.sellingPrice) * Number(product.piecesPerBox), settings.currency)
                            : formatCurrency(safeParseFloat(product.sellingPrice), settings.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Exit PIN Modal */}
      {isExitModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-zinc-900/40 dark:bg-zinc-950/80 backdrop-blur-sm"
              onClick={() => setIsExitModalOpen(false)}
            />
            <div 
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 relative z-10 overflow-hidden"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                   <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {t('exit_catalog_mode') || 'خروج من وضع الكتالوج'}
                </h2>
                <p className="text-sm text-zinc-500 mt-2">
                   {t('enter_pin_to_exit') || 'أدخل الرمز السري للعودة'}
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && verifyPinAndExit()}
                  placeholder="****"
                  autoFocus
                  className="w-full h-14 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center text-2xl tracking-[1em] font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsExitModalOpen(false)}
                    className="flex-1 h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={verifyPinAndExit}
                    disabled={pinInput.length < 4 || isVerifying}
                    className="flex-1 h-12 rounded-xl bg-brand-600 text-white font-bold transition-colors hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <div className="animate-spin">
                        <ArrowRightLeft size={20} />
                      </div>
                    ) : (
                      t('confirm')
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          setSearchQuery(code);
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
}
