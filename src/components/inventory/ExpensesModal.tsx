import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, cn } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { useModalBackButton } from '../../hooks/useModalBackButton';

interface ExpensesModalProps {
  show: boolean;
  onClose: () => void;
  loading: boolean;
  amount: number;
  shouldDeduct: boolean;
  onToggleDeduct: () => void;
}

export const ExpensesModal: React.FC<ExpensesModalProps> = ({
  show,
  onClose,
  loading,
  amount,
  shouldDeduct,
  onToggleDeduct
}) => {
  const { t } = useTranslation();
  useModalBackButton(show, onClose);
  const { settings } = useAppContext();

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800"
          >
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
                    <Wallet size={20} />
                  </div>
                  <h3 className="font-bold text-lg">{t('expenses_month')}</h3>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2 text-center py-4 bg-amber-50/30 dark:bg-amber-950/10 rounded-lg border border-amber-50 dark:border-amber-950/20">
                <div className="text-4xl font-black text-zinc-900 dark:text-white">
                  {loading ? "..." : formatCurrency(amount, settings.currency, settings.language)}
                </div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('total_expenses_recorded')}</div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t('deduct_from_inventory_profit')}</span>
                    <span className="text-[10px] text-zinc-400 font-medium leading-tight">{t('deduct_expenses_profit_desc')}</span>
                  </div>
                  <button 
                    onClick={onToggleDeduct}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      shouldDeduct ? "bg-[#B34C36]" : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  >
                    <motion.div 
                      animate={{ x: shouldDeduct ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </div>
              
              <p className="text-[10px] text-zinc-400 text-center px-4 leading-relaxed font-medium">
                {t('expenses_auto_fetched_desc')}
              </p>

              <button 
                onClick={onClose}
                className="w-full py-4 bg-zinc-900 dark:bg-brand-600 text-white rounded-lg font-black shadow-lg shadow-zinc-500/20 active:scale-95 transition-all"
              >
                {t('close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
