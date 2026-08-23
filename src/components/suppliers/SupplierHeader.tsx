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
    <header className="flex items-center justify-between gap-3">
      <div className="text-right min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white leading-tight truncate">{t('suppliers_book')}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{t('suppliers_subtitle')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button 
          onClick={() => { setEditingSupplier(null); setSelectedVisitDays([]); setIsModalOpen(true); }} 
          className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand-600 text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-md shadow-brand-500/20 active:scale-95 whitespace-nowrap"
        >
          <UserPlus size={18} strokeWidth={2.5} />
          <span>{t('add_supplier')}</span>
        </button>
      </div>
    </header>
  );
}

