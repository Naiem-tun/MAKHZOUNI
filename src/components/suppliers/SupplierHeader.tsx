import { useTranslation } from 'react-i18next';
import { UserPlus, Sparkles } from 'lucide-react';
import { Supplier } from '../../types';

interface SupplierHeaderProps {
  setEditingSupplier: (s: Supplier | null) => void;
  setSelectedVisitDays: (days: number[]) => void;
  setIsModalOpen: (open: boolean) => void;
}

export function SupplierHeader({ setEditingSupplier, setSelectedVisitDays, setIsModalOpen }: SupplierHeaderProps) {
  const { t } = useTranslation();

  const handleOpenInvoiceModal = () => {
    window.dispatchEvent(new CustomEvent('open-purchase-invoice-modal'));
  };

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{t('suppliers_book')}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('suppliers_subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button 
          onClick={handleOpenInvoiceModal}
          className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-xs sm:text-sm font-black text-white transition-all shadow-md shadow-indigo-500/20 active:scale-95 whitespace-nowrap"
        >
          <Sparkles size={18} className="text-yellow-300" />
          <span>إدخال فاتورة توريد بالذكاء الاصطناعي</span>
        </button>

        <button 
          onClick={() => { setEditingSupplier(null); setSelectedVisitDays([]); setIsModalOpen(true); }} 
          className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand-600 text-xs sm:text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-lg shadow-brand-500/20 active:scale-95 whitespace-nowrap"
        >
          <UserPlus size={18} strokeWidth={3} />
          {t('add_supplier')}
        </button>
      </div>
    </header>
  );
}

