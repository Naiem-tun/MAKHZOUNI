import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Supplier } from '../../types';

interface SupplierFormModalProps {
  isModalOpen: boolean;
  closeModal: () => void;
  editingSupplier: Supplier | null;
  handleSave: (e: React.FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  selectedVisitDays: number[];
  setSelectedVisitDays: (days: number[]) => void;
}

const days = [
  { id: 0, name: 'الأحد' }, // Note: We will use t() in the component
  { id: 1, name: 'الإثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' },
  { id: 6, name: 'السبت' },
];

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

  const localizedDays = [
    { id: 0, name: t('sunday') },
    { id: 1, name: t('monday') },
    { id: 2, name: t('tuesday') },
    { id: 3, name: t('wednesday') },
    { id: 4, name: t('thursday') },
    { id: 5, name: t('friday') },
    { id: 6, name: t('saturday') },
  ];

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div key="modal-supplier-form" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
          <motion.div key={editingSupplier?.id || 'new'} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-lg bg-white p-8 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">{editingSupplier ? t('edit_supplier_data') : t('add_new_supplier')}</h2>
            <form onSubmit={handleSave} className="space-y-4 text-right">
              <div>
                <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('name')}</label>
                <input name="name" placeholder={t('supplier_name_placeholder')} defaultValue={editingSupplier?.name} required className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('phone_number')}</label>
            <input name="phone" placeholder={t('supplier_phone_placeholder')} defaultValue={editingSupplier?.phone} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-400 mb-1 block">{t('category')}</label>
            <input name="typeOfGoods" placeholder={t('supplier_goods_placeholder')} defaultValue={editingSupplier?.typeOfGoods} className="w-full rounded-lg border bg-zinc-50 p-4 text-right outline-none dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700" />
          </div>
          <div>
            <label className="text-xs font-bold text-zinc-400 mb-3 block">{t('weekly_visit_days')}</label>
            <div className="space-y-2">
              {/* Row 1: Sun-Wed */}
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((id) => {
                  const day = localizedDays.find(d => d.id === id);
                  if (!day) return null;
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => {
                        if (selectedVisitDays.includes(day.id)) {
                          setSelectedVisitDays(selectedVisitDays.filter(d => d !== id));
                        } else {
                          setSelectedVisitDays([...selectedVisitDays, id]);
                        }
                      }}
                      className={`py-3 rounded-lg text-[11px] font-black transition-all ${
                        selectedVisitDays.includes(day.id)
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                          : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800'
                      }`}
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
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => {
                        if (selectedVisitDays.includes(day.id)) {
                          setSelectedVisitDays(selectedVisitDays.filter(d => d !== id));
                        } else {
                          setSelectedVisitDays([...selectedVisitDays, id]);
                        }
                      }}
                      className={`py-3 rounded-lg text-[11px] font-black transition-all ${
                        selectedVisitDays.includes(day.id)
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                          : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800'
                      }`}
                    >
                      {day.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={closeModal} className="flex-1 rounded-lg bg-zinc-100 py-3 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">{t('cancel')}</button>
            <button type="submit" disabled={isSaving} className="flex-1 rounded-lg bg-brand-600 py-3 font-semibold text-white shadow-lg shadow-brand-500/20 disabled:opacity-50">
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
