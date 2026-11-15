import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../lib/utils';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          dir="rtl"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm border shadow-2xl overflow-hidden"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Sticky Header */}
            <div
              className="px-5 py-4 border-b flex justify-between items-center"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border"
                  style={{
                    color: theme.accent,
                    borderColor: `${theme.accent}45`,
                    backgroundColor: `${theme.accent}12`
                  }}
                >
                  01
                </span>
                <h3 className="font-black text-base" style={{ color: theme.text }}>
                  {t('expenses_month')}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 border transition-colors cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div
                className="space-y-1.5 text-center py-5 px-4 border"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <div className="text-3xl font-mono font-black tabular-nums" style={{ color: theme.negative }} dir="ltr">
                  {loading ? '...' : formatCurrency(amount, settings.currency, settings.language)}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>
                  {t('total_expenses_recorded')}
                </div>
              </div>

              <div
                className="p-4 border space-y-2"
                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold" style={{ color: theme.text }}>
                      {t('deduct_from_inventory_profit')}
                    </span>
                    <span className="text-[11px] leading-snug mt-0.5" style={{ color: theme.textMuted }}>
                      {t('deduct_expenses_profit_desc')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleDeduct}
                    className="w-12 h-6 border transition-colors relative shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: shouldDeduct ? theme.negative : theme.surface,
                      borderColor: shouldDeduct ? theme.negative : theme.border
                    }}
                  >
                    <motion.div
                      animate={{ x: shouldDeduct ? 24 : 2 }}
                      className="absolute top-0.5 left-0 w-4 h-4"
                      style={{ backgroundColor: shouldDeduct ? '#FFFFFF' : theme.textMuted }}
                    />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-center px-2 leading-relaxed font-medium" style={{ color: theme.textMuted }}>
                {t('expenses_auto_fetched_desc')}
              </p>
            </div>

            <div
              className="px-5 py-3.5 border-t"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-xs font-black transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: theme.accent, color: theme.accentText }}
              >
                {t('close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
