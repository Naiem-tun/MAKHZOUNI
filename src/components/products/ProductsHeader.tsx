import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkles } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface ProductsHeaderProps {
  onAddProduct: () => void;
  onOpenInvoiceModal?: () => void;
}

export const ProductsHeader: React.FC<ProductsHeaderProps> = ({ onAddProduct, onOpenInvoiceModal }) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const enableAIInvoice = settings.enableAIInvoice ?? true;

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="text-right min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white leading-tight truncate">{t('products')}</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{t('products_list_subtitle')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {enableAIInvoice && onOpenInvoiceModal && (
          <button 
            onClick={onOpenInvoiceModal}
            className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-xs sm:text-sm font-bold text-white transition-all shadow-md shadow-indigo-500/20 active:scale-95 whitespace-nowrap"
            title="إدخال فاتورة توريد بالذكاء الاصطناعي"
          >
            <Sparkles size={18} className="text-yellow-300 shrink-0" />
            <span className="hidden sm:inline">فاتورة بالذكاء الاصطناعي</span>
            <span className="sm:hidden">فاتورة AI</span>
          </button>
        )}
        <button 
          onClick={onAddProduct}
          className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand-600 text-sm font-bold text-white transition-all hover:bg-brand-700 shadow-md shadow-brand-500/20 active:scale-95 whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>{t('add_product')}</span>
        </button>
      </div>
    </header>
  );
};

