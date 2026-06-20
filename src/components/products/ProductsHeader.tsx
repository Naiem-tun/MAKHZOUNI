import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface ProductsHeaderProps {
  onAddProduct: () => void;
}

export const ProductsHeader: React.FC<ProductsHeaderProps> = ({ onAddProduct }) => {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between gap-2">
      <div className="text-right">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('products')}</h1>
        <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('products_list_subtitle')}</p>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={onAddProduct}
          className="flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-lg bg-[#4A6FA5] text-sm font-bold text-white transition-all hover:bg-[#4A6FA5]/90 shadow-lg shadow-[#4A6FA5]/20 active:scale-95 whitespace-nowrap"
        >
          <Plus size={18} strokeWidth={3} />
          {t('add_product')}
        </button>
      </div>
    </header>
  );
};
