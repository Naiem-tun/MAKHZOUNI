import React from 'react';
import { X, Search, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { useSupplierSession } from '../hooks/useSupplierSession';
import { useFolioTheme } from './folio/FolioPageChrome';

export function SupplierSelector() {
  const { user, settings, setActiveSupplier } = useAppContext();
  const { t } = useTranslation();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  const {
    supplierSearchQuery,
    setSupplierSearchQuery,
    isSupplierSelectorOpen,
    setIsSupplierSelectorOpen,
    filteredSuppliers
  } = useSupplierSession(user);

  React.useEffect(() => {
    const handleOpen = () => setIsSupplierSelectorOpen(true);
    window.addEventListener('open-supplier-selector', handleOpen);
    return () => window.removeEventListener('open-supplier-selector', handleOpen);
  }, [setIsSupplierSelectorOpen]);

  return (
    <AnimatePresence>
      {isSupplierSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsSupplierSelectorOpen(false);
              window.dispatchEvent(new CustomEvent('supplier-selector-closed'));
            }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-sm border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Header */}
            <div
              className="px-4 py-3.5 sm:px-5 border-b flex items-center justify-between gap-3 shrink-0"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold font-mono tabular-nums" style={{ color: theme.accent }}>
                  01 · بدء حصة توريد
                </div>
                <h2 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>
                  {t('select_supplier')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSupplierSelectorOpen(false);
                  window.dispatchEvent(new CustomEvent('supplier-selector-closed'));
                }}
                aria-label="إغلاق"
                className="p-1.5 border cursor-pointer"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 min-h-0 overflow-y-auto">
              {/* Search */}
              <div
                className="flex items-center gap-2 px-3 py-2 border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <Search size={15} style={{ color: theme.textMuted }} />
                <input
                  type="text"
                  placeholder={t('search')}
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm outline-none"
                  style={{ color: theme.text }}
                />
              </div>

              {/* List */}
              <div className="max-h-[380px] overflow-y-auto space-y-2">
                {filteredSuppliers.length === 0 ? (
                  <div
                    className="py-10 border text-center text-xs font-bold"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }}
                  >
                    {t('no_suppliers_found')}
                  </div>
                ) : (
                  filteredSuppliers.map((s) => {
                    const isVisitToday = s.visitDays?.includes(new Date().getDay());
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setActiveSupplier({ id: s.id!, name: s.name, visitDays: s.visitDays });
                          setIsSupplierSelectorOpen(false);
                        }}
                        className="w-full flex items-center gap-3 p-3.5 border transition-colors text-right cursor-pointer"
                        style={{
                          backgroundColor: theme.surface,
                          borderColor: isVisitToday ? theme.accent : theme.border,
                          borderRight: isVisitToday ? `3px solid ${theme.accent}` : undefined,
                          color: theme.text,
                        }}
                      >
                        <div
                          className="h-10 w-10 border flex items-center justify-center shrink-0"
                          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.accent }}
                        >
                          <Truck size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-black text-sm truncate" style={{ color: theme.text }}>{s.name}</p>
                            {isVisitToday && (
                              <span
                                className="text-[10px] font-black px-1.5 py-0.5 border shrink-0"
                                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.accent, color: theme.accent }}
                              >
                                {t('visits_today')}
                              </span>
                            )}
                          </div>
                          {s.typeOfGoods && (
                            <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: theme.textMuted }}>
                              {s.typeOfGoods}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
