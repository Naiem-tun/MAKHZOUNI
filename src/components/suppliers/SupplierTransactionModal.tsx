import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Supplier } from '../../types';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface SupplierTransactionModalProps {
  isAddTxModalOpen: boolean;
  setIsAddTxModalOpen: (open: boolean) => void;
  selectedSupplier: Supplier | null;
  handleAddTransaction: (e: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  currency: string;
}

export function SupplierTransactionModal({
  isAddTxModalOpen,
  setIsAddTxModalOpen,
  selectedSupplier,
  handleAddTransaction,
  isSaving,
  currency
}: SupplierTransactionModalProps) {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  return (
    <AnimatePresence>
      {isAddTxModalOpen && selectedSupplier && (
        <motion.div
          key="modal-add-tx"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddTxModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-md border shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 border shrink-0"
                  style={{
                    color: theme.negative,
                    borderColor: `${theme.negative}45`,
                    backgroundColor: `${theme.negative}12`
                  }}
                >
                  01
                </span>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black truncate" style={{ color: theme.text }}>
                    {t('record_payment')}
                  </h2>
                  <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                    {t('suppliers')}: {selectedSupplier.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(false)}
                className="p-1.5 border transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleAddTransaction}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-protonpass-ignore="true"
              className="flex flex-col"
            >
              <div className="p-5 space-y-4 text-right">
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: theme.textMuted }}>
                    {t('purchase_price')}
                  </label>
                  <div
                    className="flex items-center border overflow-hidden"
                    style={{ backgroundColor: theme.surface, borderColor: theme.border }}
                  >
                    <input
                      name="amount"
                      type="number"
                      step="0.001"
                      inputMode="decimal"
                      autoComplete="one-time-code"
                      autoCorrect="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      placeholder="0.000"
                      required
                      className="flex-1 bg-transparent p-3.5 text-right outline-none font-mono font-black tabular-nums text-lg"
                      style={{ color: theme.text }}
                    />
                    <span
                      className="px-3.5 py-3.5 border-r font-mono text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.textMuted
                      }}
                    >
                      {currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: theme.textMuted }}>
                    {t('date')}
                  </label>
                  <input
                    name="date"
                    type="date"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full border p-3.5 text-right outline-none font-mono text-sm"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: theme.textMuted }}>
                    {t('notes')}
                  </label>
                  <input
                    name="note"
                    type="text"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    placeholder={t('record_payment_note_placeholder')}
                    className="w-full border p-3.5 text-right outline-none text-sm"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>
              </div>

              <div
                className="px-5 py-4 border-t flex gap-3"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddTxModalOpen(false)}
                  className="flex-1 py-3 border text-xs font-bold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 text-xs font-black text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: theme.negative }}
                >
                  {isSaving ? t('saving') : t('confirm_payment')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
