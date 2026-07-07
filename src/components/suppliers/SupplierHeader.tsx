import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { Supplier } from '../../types';

interface SupplierHeaderProps {
  setEditingSupplier: (s: Supplier | null) => void;
  setSelectedVisitDays: (days: number[]) => void;
  setIsModalOpen: (open: boolean) => void;
}

export function SupplierHeader({ setEditingSupplier, setSelectedVisitDays, setIsModalOpen }: SupplierHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('suppliers_book')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400">{t('suppliers_subtitle')}</p>
      </div>
      <button 
        onClick={() => { setEditingSupplier(null); setSelectedVisitDays([]); setIsModalOpen(true); }} 
        className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-lg bg-brand-600 text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-lg shadow-brand-500/20 active:scale-95 whitespace-nowrap"
      >
        <UserPlus size={18} strokeWidth={3} />
        {t('add_supplier')}
      </button>
    </header>
  );
}
