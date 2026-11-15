import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Supplier } from '../../types';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface SupplierFormModalProps {
  isModalOpen: boolean;
  closeModal: () => void;
  editingSupplier: Supplier | null;
  handleSave: (e: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  selectedVisitDays: number[];
  setSelectedVisitDays: (days: number[]) => void;
}

export function SupplierFormModal({
  isModalOpen,
  closeModal,
  editingSupplier,
  handleSave,
  isSaving,
  selectedVisitDays,
  setSelectedVisitDays,
}: SupplierFormModalProps) {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  const localizedDays = [
    { id: 0, name: t('sunday') },
    { id: 1, name: t('monday') },
    { id: 2, name: t('tuesday') },
    { id: 3, name: t('wednesday') },
    { id: 4, name: t('thursday') },
    { id: 5, name: t('friday') },
    { id: 6, name: t('saturday') },
  ];

  const toggleDay = (id: number) => {
    if (selectedVisitDays.includes(id)) {
      setSelectedVisitDays(selectedVisitDays.filter(d => d !== id));
    } else {
      setSelectedVisitDays([...selectedVisitDays, id]);
    }
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          key="modal-supplier-form"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            key={editingSupplier?.id || 'new'}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-md border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between shrink-0"
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
                <h2 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>
                  {editingSupplier ? t('edit_supplier_data') : t('add_new_supplier')}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 border transition-colors cursor-pointer"
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
              onSubmit={handleSave}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-protonpass-ignore="true"
              className="flex flex-col min-h-0 overflow-hidden"
            >
              <div className="p-5 space-y-4 text-right min-h-0 overflow-y-auto">
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: theme.textMuted }}>
                    {t('name')}
                  </label>
                  <input
                    name="supplier_name"
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
                    placeholder={t('supplier_name_placeholder')}
                    defaultValue={editingSupplier?.name}
                    required
                    className="w-full border p-3.5 text-right outline-none font-bold text-sm transition-colors"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: theme.textMuted }}>
                    {t('phone_number')}
                  </label>
                  <input
                    name="supplier_phone"
                    type="tel"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    placeholder={t('supplier_phone_placeholder')}
                    defaultValue={editingSupplier?.phone}
                    className="w-full border p-3.5 text-right outline-none font-mono text-sm transition-colors"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: theme.textMuted }}>
                    {t('category')}
                  </label>
                  <input
                    name="supplier_goods"
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
                    placeholder={t('supplier_goods_placeholder')}
                    defaultValue={editingSupplier?.typeOfGoods}
                    className="w-full border p-3.5 text-right outline-none text-sm transition-colors"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-2.5 block" style={{ color: theme.textMuted }}>
                    {t('weekly_visit_days')}
                  </label>
                  <div className="space-y-2">
                    {/* Row 1: Sun-Wed */}
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((id) => {
                        const day = localizedDays.find(d => d.id === id);
                        if (!day) return null;
                        const active = selectedVisitDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className="py-2.5 border text-[11px] font-black transition-colors cursor-pointer"
                            style={
                              active
                                ? { backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }
                                : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }
                            }
                          >
                            {day.name}
                          </button>
                        );
                      })}
                    </div>
                    {/* Row 2: Thu-Sat */}
                    <div className="grid grid-cols-3 gap-2">
                      {[4, 5, 6].map((id) => {
                        const day = localizedDays.find(d => d.id === id);
                        if (!day) return null;
                        const active = selectedVisitDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className="py-2.5 border text-[11px] font-black transition-colors cursor-pointer"
                            style={
                              active
                                ? { backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }
                                : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textMuted }
                            }
                          >
                            {day.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="px-5 py-4 border-t flex gap-3 shrink-0"
                style={{ backgroundColor: theme.surface, borderColor: theme.border }}
              >
                <button
                  type="button"
                  onClick={closeModal}
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
                  className="flex-1 py-3 text-xs font-black transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                >
                  {isSaving ? t('saving') : t('save_data')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
