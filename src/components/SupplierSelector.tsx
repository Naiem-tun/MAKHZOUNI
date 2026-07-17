import React from 'react';
import { X, Search, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { useSupplierSession } from '../hooks/useSupplierSession';

export function SupplierSelector() {
  const { user, setActiveSupplier } = useAppContext();
  const { t } = useTranslation();
  
  const {
    supplierSearchQuery,
    setSupplierSearchQuery,
    isSupplierSelectorOpen,
    setIsSupplierSelectorOpen,
    filteredSuppliers
  } = useSupplierSession(user);

  // Expose event listener
  React.useEffect(() => {
    const handleOpen = () => setIsSupplierSelectorOpen(true);
    window.addEventListener('open-supplier-selector', handleOpen);
    return () => window.removeEventListener('open-supplier-selector', handleOpen);
  }, [setIsSupplierSelectorOpen]);

  return (
    <AnimatePresence>
      {isSupplierSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => {
              setIsSupplierSelectorOpen(false);
              window.dispatchEvent(new CustomEvent('supplier-selector-closed'));
            }} 
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 10 }} 
            className="relative w-full max-w-sm rounded-lg bg-white p-8 dark:bg-zinc-900 shadow-2xl border border-zinc-100 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">{t('select_supplier')}</h2>
              <button 
                onClick={() => {
                  setIsSupplierSelectorOpen(false);
                  window.dispatchEvent(new CustomEvent('supplier-selector-closed'));
                }}
                className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center pointer-events-none">
                <Search size={16} className="text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder={t('search')}
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 rounded-lg py-3 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 no-scrollbar">
              {filteredSuppliers.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 font-bold">{t('no_suppliers_found')}</div>
              ) : (
                filteredSuppliers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSupplier({ id: s.id!, name: s.name });
                      setIsSupplierSelectorOpen(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/10 hover:text-brand-600 transition-all text-right border border-transparent hover:border-brand-100 group"
                  >
                    <div className="h-12 w-12 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-brand-600 group-hover:scale-110 transition-all">
                      <Truck size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-brand-600">{s.name}</p>
                        {s.visitDays?.includes(new Date().getDay()) && (
                          <span className="text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/40 px-1.5 py-0.5 rounded-lg">{t('visits_today')}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">{s.typeOfGoods}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
