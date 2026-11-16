import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../AppContext';
import { useTranslation } from 'react-i18next';
import { Search, Lock, Boxes, Package, AlertCircle, ScanLine, ArrowRightLeft, Folder, ArrowLeft } from 'lucide-react';
import { formatCurrency, safeParseFloat } from '../lib/utils';
import { BarcodeScanner } from '../components/common/BarcodeScanner';
import { ProductImage } from '../components/products/ProductImage';
import { useCategories, categoryIcons } from '../hooks/useCategories';
import { Product } from '../types';
import { useFolioTheme } from '../components/folio/FolioPageChrome';

export default function CatalogMode() {
  const { user, settings, setIsCatalogMode, showToast } = useAppContext();
  const { t } = useTranslation();
  const { categories: appCategories } = useCategories();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);

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
      setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, [user]);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category || 'other'));
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (searchQuery) {
      const lowerQuery = (searchQuery || '').toLowerCase();
      return products.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(lowerQuery) ||
          (p.barcode && p.barcode.includes(lowerQuery)) ||
          (p.aliases || []).some((a) => (a || '').toLowerCase().includes(lowerQuery)) ||
          (p.category && p.category.toLowerCase().includes(lowerQuery)) ||
          t(`cat_${p.category || 'other'}`).toLowerCase().includes(lowerQuery),
      );
    }
    if (selectedCategory) {
      return products.filter((p) => (p.category || 'other') === selectedCategory);
    }
    return products;
  }, [products, searchQuery, selectedCategory, t]);

  const handleExitRequest = () => {
    if (!settings.catalogPin) {
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
      }, 400);
    } else {
      showToast(t('invalid_pin') || 'الرمز السري غير صحيح', 'error');
      setPinInput('');
    }
  };

  return (
    <div
      className="h-[100dvh] relative flex flex-col overflow-hidden"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir={settings.language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Bottom Control Bar */}
      <header
        className="order-last sticky bottom-0 z-30 mt-auto border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex-1 max-w-2xl mx-auto flex items-center gap-2.5">
          {selectedCategory && !searchQuery && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="h-11 w-11 shrink-0 flex items-center justify-center border transition-colors cursor-pointer"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <ArrowLeft size={20} className={settings.language === 'ar' ? 'rotate-180' : ''} />
            </button>
          )}

          <div className="relative flex-1">
            <Search
              className={`absolute ${settings.language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2`}
              size={18}
              style={{ color: theme.textMuted }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_products') || 'ابحث عن منتج...'}
              className={`w-full h-11 border ${settings.language === 'ar' ? 'pr-10 pl-11' : 'pl-10 pr-11'} text-sm sm:text-base font-medium outline-none transition-colors`}
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              }}
            />
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className={`absolute ${settings.language === 'ar' ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center border transition-colors cursor-pointer`}
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.textMuted,
              }}
            >
              <ScanLine size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDisplayMode((prev) => (prev === 'piece' ? 'box' : 'piece'))}
            className="h-11 px-4 shrink-0 font-bold text-xs sm:text-sm transition-colors flex items-center gap-2 border cursor-pointer"
            style={{
              backgroundColor: displayMode === 'box' ? theme.text : theme.surfaceMuted,
              borderColor: displayMode === 'box' ? theme.text : theme.border,
              color: displayMode === 'box' ? theme.surface : theme.text,
            }}
          >
            {displayMode === 'box' ? <Boxes size={18} /> : <Package size={18} />}
            <span className="hidden sm:inline">
              {displayMode === 'box' ? t('box') || 'كرتونة' : t('piece') || 'قطعة'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExitRequest}
            className="h-11 px-3.5 shrink-0 border transition-colors flex items-center justify-center cursor-pointer"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
            title={t('exit_catalog') || 'خروج من وضع الكتالوج'}
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* Main Catalog Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-1.5 py-4 sm:px-6 sm:py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="pb-4 border-b flex items-end justify-between" style={{ borderColor: theme.border }}>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="font-mono tabular-nums" style={{ color: theme.accent }}>
                  01
                </span>
                <span style={{ color: theme.textMuted }}>
                  الكتالوج · عرض الأسعار
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">
                {settings?.storeName || t('catalog') || 'كتالوج المنتجات'}
              </h1>
            </div>
            {selectedCategory && (
              <span className="text-xs font-bold" style={{ color: theme.accent }}>
                {t(`cat_${selectedCategory}`) || selectedCategory}
              </span>
            )}
          </div>

          {!searchQuery && !selectedCategory ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className="border p-5 transition-colors flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  <Folder size={36} strokeWidth={1.4} style={{ color: theme.accent }} />
                  <span className="font-black text-base">
                    {t(`cat_${category}`) || category || t('cat_other')}
                  </span>
                  <span className="text-xs font-mono tabular-nums" style={{ color: theme.textMuted }}>
                    {products.filter((p) => (p.category || 'other') === category).length} {t('products') || 'منتجات'}
                  </span>
                </button>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center p-14 border text-center space-y-3"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <AlertCircle size={36} className="opacity-30" />
              <p className="text-sm font-bold" style={{ color: theme.textMuted }}>
                {t('no_products') || 'لا توجد منتجات'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="border overflow-hidden flex flex-col"
                  style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                >
                  {(product.hasLocalImage || product.hasCloudImage) && (
                    <div className="h-44 w-full border-b overflow-hidden" style={{ borderColor: theme.border }}>
                      <ProductImage
                        productId={product.id}
                        hasLocalImage={product.hasLocalImage}
                        hasCloudImage={product.hasCloudImage}
                        FallbackIcon={
                          categoryIcons[appCategories.find((c) => c.name === product.category)?.icon || 'Package'] ||
                          Package
                        }
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <h3 className="text-sm sm:text-base font-black line-clamp-2 leading-snug">{product.name}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: theme.textMuted }}>
                        <ScanLine size={11} />
                        <span>{product.barcode || '---'}</span>
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between pt-3 border-t"
                      style={{ borderColor: theme.border }}
                    >
                      <div className="flex items-center gap-1 text-xs font-bold" style={{ color: theme.textMuted }}>
                        {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1 ? (
                          <>
                            <Boxes size={14} />
                            <span>
                              {t('box') || 'كرتونة'} ({product.piecesPerBox})
                            </span>
                          </>
                        ) : (
                          <>
                            <Package size={14} />
                            <span>{t('piece') || 'قطعة'}</span>
                          </>
                        )}
                      </div>
                      <span
                        className="font-mono font-black text-base sm:text-lg tabular-nums"
                        dir="ltr"
                        style={{ color: theme.accent }}
                      >
                        {displayMode === 'box' && product.piecesPerBox && Number(product.piecesPerBox) > 1
                          ? formatCurrency(
                              safeParseFloat(product.sellingPrice) * Number(product.piecesPerBox),
                              settings.currency,
                            )
                          : formatCurrency(safeParseFloat(product.sellingPrice), settings.currency)}
                      </span>
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsExitModalOpen(false)} />
          <div
            className="w-full max-w-sm border shadow-2xl p-6 relative z-10 overflow-hidden space-y-5"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
          >
            <div className="text-center space-y-2">
              <div
                className="w-12 h-12 border flex items-center justify-center mx-auto"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.accent }}
              >
                <Lock size={22} />
              </div>
              <h2 className="text-lg font-black">{t('exit_catalog_mode') || 'خروج من وضع الكتالوج'}</h2>
              <p className="text-xs font-medium" style={{ color: theme.textMuted }}>
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
                className="w-full h-12 border text-center text-2xl tracking-[0.8em] font-mono outline-none"
                style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsExitModalOpen(false)}
                  className="flex-1 h-11 border text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={verifyPinAndExit}
                  disabled={pinInput.length < 4 || isVerifying}
                  className="flex-1 h-11 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: theme.accent }}
                >
                  {isVerifying ? (
                    <ArrowRightLeft size={18} className="animate-spin" />
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
        tabId="catalog-mode"
      />
    </div>
  );
}
