import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { useTranslation } from 'react-i18next';
import { Search, Lock, Boxes, Package, AlertCircle, ScanLine, ArrowRightLeft, Folder, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/products`), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category || 'other'));
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      return products.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        (p.barcode && p.barcode.includes(lowerQuery)) ||
        (p.category && p.category.toLowerCase().includes(lowerQuery)) ||
        (t(`cat_${p.category || 'other'}`).toLowerCase().includes(lowerQuery))
      );
    }
    if (selectedCategory) {
      return products.filter(p => (p.category || 'other') === selectedCategory);
    }
    return products;
  }, [products, searchQuery, selectedCategory, t]);

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
    <div className="min-h-screen relative flex flex-col overflow-hidden bg-[#F5F8FA] dark:bg-[#0F172A]" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Ambient Artistic Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#7C94B8]/40 to-[#2A4D88]/10 blur-[100px] animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-[#2A4D88]/20 to-[#B1BBC8]/20 blur-[120px] animate-[pulse_14s_ease-in-out_infinite]" />
        <div className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] rounded-full bg-[#D9D9D8]/40 dark:bg-[#1E293B]/60 blur-[90px]" />
        <div className="absolute inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-[1px]" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232A4D88' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-xl border-b border-[#D9D9D8]/50 dark:border-[#1E293B] shadow-sm px-4 py-3 flex items-center gap-4">
        <div className="flex-1 max-w-2xl mx-auto flex items-center gap-3">
          {selectedCategory && !searchQuery && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-white dark:bg-[#1E293B] border border-[#D9D9D8] dark:border-[#334155] text-[#7C94B8] hover:text-[#2A4D88] dark:text-[#B1BBC8] dark:hover:text-white transition-all shadow-sm hover:border-[#B1BBC8]"
            >
              <ArrowLeft size={24} className={settings.language === 'ar' ? 'rotate-180' : ''} />
            </button>
          )}

          <div className="relative flex-1 group">
            <Search className={`absolute ${settings.language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-[#B1BBC8] group-focus-within:text-[#7C94B8] transition-colors`} size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_products') || 'ابحث عن منتج...'}
              className={`w-full h-12 bg-white dark:bg-[#1E293B] border border-[#D9D9D8] dark:border-[#334155] rounded-xl ${settings.language === 'ar' ? 'pr-11 pl-12' : 'pl-11 pr-12'} text-[#2A4D88] dark:text-white placeholder:text-[#B1BBC8]/70 focus:outline-none focus:ring-4 focus:ring-[#7C94B8]/20 focus:border-[#7C94B8] transition-all duration-300 text-lg font-medium shadow-sm hover:border-[#B1BBC8]`}
            />
            <button
              onClick={() => setIsScannerOpen(true)}
              className={`absolute ${settings.language === 'ar' ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-[#B1BBC8] hover:text-[#2A4D88] dark:hover:text-white transition-colors rounded-lg hover:bg-[#F5F8FA] dark:hover:bg-[#334155]/50`}
            >
              <ScanLine size={18} />
            </button>
          </div>
          <button
            onClick={() => setDisplayMode(prev => prev === 'piece' ? 'box' : 'piece')}
            className={`h-12 px-5 shrink-0 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 border shadow-sm ${
              displayMode === 'box'
                ? 'bg-gradient-to-br from-[#2A4D88] to-[#1e3b6e] border-[#2A4D88] text-white shadow-md shadow-[#2A4D88]/20'
                : 'bg-white dark:bg-[#1E293B] border-[#D9D9D8] dark:border-[#334155] text-[#7C94B8] dark:text-[#B1BBC8] hover:border-[#B1BBC8] hover:text-[#2A4D88] dark:hover:text-white'
            }`}
          >
            {displayMode === 'box' ? <Boxes size={20} /> : <Package size={20} />}
            <span className="hidden sm:inline">{displayMode === 'box' ? (t('box') || 'كرتونة') : (t('piece') || 'قطعة')}</span>
          </button>
          <button 
            onClick={handleExitRequest}
            className="h-12 px-4 shrink-0 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-sm border border-[#D9D9D8] dark:border-[#334155] rounded-xl text-[#B1BBC8] hover:text-[#2A4D88] dark:text-[#B1BBC8] dark:hover:text-white transition-all duration-300 flex items-center justify-center shadow-sm hover:bg-white hover:border-[#B1BBC8]"
            title={t('exit_catalog') || 'خروج من وضع الكتالوج'}
          >
            <Lock size={20} />
          </button>
        </div>
      </header>

      {/* Main Catalog Area */}
      <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8 content-visibility-auto">
        <div className="max-w-6xl mx-auto">
          {!searchQuery && !selectedCategory ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="bg-white dark:bg-[#1E293B] rounded-[24px] border border-[#D9D9D8] dark:border-[#334155] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#7C94B8] dark:hover:border-[#7C94B8]/50 transition-all duration-300 group flex flex-col text-right"
                >
                  <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Folder size={48} strokeWidth={1.5} className="text-[#2A4D88] dark:text-[#7C94B8]" />
                    </div>
                    <span className="font-bold text-xl text-[#2A4D88] dark:text-white group-hover:text-[#1e3b6e] transition-colors">
                      {t(`cat_${category}`) || category || t('cat_other')}
                    </span>
                    <span className="text-sm font-medium text-[#7C94B8] bg-[#F5F8FA] dark:bg-[#0F172A] px-3 py-1 rounded-full">
                      {products.filter(p => (p.category || 'other') === category).length} {t('products') || 'منتجات'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-12 text-zinc-400 text-center space-y-4">
             <AlertCircle size={48} className="opacity-20" />
             <p className="text-lg">{t('no_products') || 'لا توجد منتجات'}</p>
           </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white dark:bg-[#1E293B] rounded-[20px] border border-[#D9D9D8] dark:border-[#334155] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#7C94B8] dark:hover:border-[#7C94B8]/50 transition-all duration-300 group flex flex-col"
                >
                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    <h3 className="text-base sm:text-lg font-bold text-[#2A4D88] dark:text-[#E2E8F0] line-clamp-2 leading-tight mb-2 group-hover:text-[#1e3b6e] dark:group-hover:text-white transition-colors">
                        {product.name}
                    </h3>
                    
                    {product.barcode ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#7C94B8] mb-4 bg-[#F5F8FA] dark:bg-[#0F172A]/50 px-2.5 py-1 rounded-md inline-flex self-start border border-[#F5F8FA] dark:border-[#0F172A]/50 group-hover:border-[#D9D9D8] dark:group-hover:border-[#334155] transition-colors">
                        <ScanLine size={12} />
                        <span className="font-mono tracking-wider">{product.barcode}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-[#7C94B8]/50 mb-4 px-2.5 py-1 rounded-md inline-flex self-start border border-dashed border-[#D9D9D8]/50 dark:border-[#334155]/50 group-hover:border-[#7C94B8]/40 transition-colors">
                        <ScanLine size={12} className="opacity-50" />
                        <span className="font-mono tracking-wider opacity-50">- - -</span>
                      </div>
                    )}
                    
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center justify-between pt-4 border-t border-[#D9D9D8]/50 dark:border-[#334155]/50 group-hover:border-[#D9D9D8] dark:group-hover:border-[#334155] transition-colors">
                        <div className={`flex flex-col`}>
                          <div className={`flex items-center gap-1.5 transition-colors ${displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? 'text-[#2A4D88] dark:text-[#7C94B8]' : 'text-[#7C94B8] dark:text-[#B1BBC8]'}`}>
                            {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? <Boxes size={16} /> : <Package size={16} />}
                            <span className="text-xs sm:text-sm font-medium tracking-wide">
                              {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? (
                                <>
                                  {t('box') || 'كرتونة'}
                                  <span className="opacity-70 ml-1">{`(${product.piecesPerBox})`}</span>
                                </>
                              ) : (
                                t('piece') || 'قطعة'
                              )}
                            </span>
                          </div>
                        </div>
                        <span className={`font-black text-xl sm:text-2xl tracking-tight text-[#2A4D88] dark:text-[#F1F5F9] transition-colors group-hover:scale-105 origin-left`}>
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
              className="absolute inset-0 bg-[#0F172A]/40 dark:bg-[#0F172A]/80 backdrop-blur-md"
              onClick={() => setIsExitModalOpen(false)}
            />
            <div 
              className="bg-white dark:bg-[#1E293B] w-full max-w-sm rounded-[24px] shadow-2xl border border-[#D9D9D8] dark:border-[#334155] p-8 relative z-10 overflow-hidden"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[#F5F8FA] dark:bg-[#0F172A] rounded-full flex items-center justify-center mx-auto mb-4 text-[#2A4D88] dark:text-[#7C94B8] border border-[#D9D9D8] dark:border-[#334155]">
                   <Lock size={28} className="ml-1" />
                </div>
                <h2 className="text-2xl font-bold text-[#2A4D88] dark:text-white mb-2 tracking-tight">
                  {t('exit_catalog_mode') || 'خروج من وضع الكتالوج'}
                </h2>
                <p className="text-sm font-medium text-[#7C94B8] dark:text-[#B1BBC8]">
                   {t('enter_pin_to_exit') || 'أدخل الرمز السري للعودة'}
                </p>
              </div>

              <div className="space-y-5">
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
                  className="w-full h-14 bg-[#F5F8FA] dark:bg-[#0F172A] border border-[#D9D9D8] dark:border-[#334155] rounded-xl text-center text-3xl tracking-[1em] font-mono text-[#2A4D88] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#7C94B8]/30 focus:border-[#7C94B8] transition-all shadow-inner"
                />
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsExitModalOpen(false)}
                    className="flex-1 h-12 rounded-xl text-[#7C94B8] dark:text-[#B1BBC8] font-bold transition-all hover:bg-[#F5F8FA] dark:hover:bg-[#334155]/50 border border-transparent hover:border-[#D9D9D8] dark:hover:border-[#334155]"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={verifyPinAndExit}
                    disabled={pinInput.length < 4 || isVerifying}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-br from-[#2A4D88] to-[#1e3b6e] text-white font-bold transition-all hover:opacity-90 hover:shadow-md hover:shadow-[#2A4D88]/20 disabled:opacity-50 flex items-center justify-center gap-2 border border-[#2A4D88]"
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
