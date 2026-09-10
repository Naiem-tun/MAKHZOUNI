import React from 'react';
import { motion } from 'motion/react';
import { Check, PlusCircle, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn, cleanQuantity, formatQuantity } from '../../lib/utils';
import { ProductIcon } from './ProductIcon';
import { useAppContext } from '../../AppContext';

interface InventoryItemProps {
  product: any;
  sequenceNumber?: number;
  inventoryQuantity: number | undefined;
  isChecked: boolean;
  showDetailedControls: boolean;
  onToggleCheck: (id: string) => void;
  onAddPiece: (id: string) => void;
  onAddCarton: (id: string, piecesPerBox: number) => void;
  onChangeQuantity: (id: string, val: string) => void;
}

export const InventoryItem = React.memo(({
  product,
  sequenceNumber,
  inventoryQuantity,
  isChecked,
  showDetailedControls,
  onToggleCheck,
  onAddPiece,
  onAddCarton,
  onChangeQuantity,
}: InventoryItemProps) => {
  const { t } = useTranslation();
  const { settings } = useAppContext();

  const unitMap: Record<string, string> = {
    piece: 'قطعة',
    carton: 'كرتونة',
    kg: 'كغ',
    gram: 'غرام',
    liter: 'لتر',
    box: 'صندوق',
    meter: 'متر'
  };
  const unitText = product.unit ? (unitMap[product.unit] || t(product.unit) || 'قطعة') : t('piece');

  const getCountBreakdown = (total: number, piecesPerBox: number) => {
    const cleanTotal = cleanQuantity(total);
    
    if (settings.defaultStockView === 'boxes' && piecesPerBox && piecesPerBox > 1) {
      return `${(cleanTotal / piecesPerBox).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${t('box')}`;
    }
    
    return `${formatQuantity(cleanTotal)} ${unitText}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[data-inventory-input="true"]:not([disabled])')
      ).filter(el => el.offsetParent !== null);

      const currentIndex = allInputs.indexOf(e.currentTarget);
      if (currentIndex > -1 && currentIndex < allInputs.length - 1) {
        const nextInput = allInputs[currentIndex + 1];
        nextInput.focus();
        nextInput.select();
      } else {
        e.currentTarget.blur();
      }
    }
  };

  return (
    <motion.div 
      className={cn(
        "flex items-center justify-between gap-3 py-2.5 px-3.5 bg-white dark:bg-zinc-900 border rounded-lg min-h-[70px] transition-all relative",
        isChecked ? "opacity-50 grayscale-[0.5]" : "",
        inventoryQuantity !== undefined ? "border-brand-500/20 bg-brand-50/5 shadow-sm" : "border-neutral-100 dark:border-neutral-800"
      )}
    >
      {/* Product Info (Right) */}
      <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => onToggleCheck(product.id)}>
        {sequenceNumber !== undefined && (
          <span className="w-5 flex-shrink-0 text-[10px] font-black text-zinc-400 dark:text-zinc-500 text-center">
            {sequenceNumber}
          </span>
        )}
        <div className="relative">
          <ProductIcon category={product.category} />
          {isChecked && (
            <div className="absolute -top-1 -right-1 bg-brand-500 text-white rounded-full p-0.5 shadow-sm">
              <Check size={8} strokeWidth={4} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          <h3 className="text-[13px] font-medium text-black dark:text-white leading-tight mb-1 truncate">
            {product.name || t('product')}
          </h3>
          <div className="flex items-center gap-1 mb-1.5 opacity-60">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{t('stock')}:</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">
              {settings.defaultStockView === 'boxes' ? getCountBreakdown(product.quantity || 0, product.piecesPerBox || 1) : `${formatQuantity(product.quantity || 0)} ${unitText}`}
            </span>
          </div>
          {cleanQuantity(inventoryQuantity) > 0 && (
            <div className="flex items-center gap-1">
              <div className="inline-flex items-center gap-1 bg-brand-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black shadow-sm ring-2 ring-white dark:ring-zinc-900">
                <Check size={8} strokeWidth={4} />
                <span className="truncate">{getCountBreakdown(inventoryQuantity || 0, product.piecesPerBox || 1)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls (Left) */}
      <div className="flex items-center gap-2 shrink-0 mr-auto">
        {showDetailedControls && (
          <button 
            type="button"
            tabIndex={-1}
            onClick={() => onAddPiece(product.id)} 
            className="w-9 h-9 flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 active:scale-95 transition-transform shadow-sm"
            title={t('add_piece')}
          >
            <div className="flex flex-col items-center">
              <PlusCircle size={14} className="text-brand-500" />
              <span className="text-[8px] font-black leading-none mt-0.5">+1</span>
            </div>
          </button>
        )}

        {(product.piecesPerBox || 1) > 1 && (
          <button 
            type="button"
            tabIndex={-1}
            onClick={() => onAddCarton(product.id, product.piecesPerBox || 1)} 
            className="w-9 h-9 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg text-zinc-400 active:scale-95 transition-transform"
            title={`${t('add_carton')} (${product.piecesPerBox} ${t('piece')})`}
          >
            <div className="flex flex-col items-center">
              <Package size={14} className="mb-0" />
              <span className="text-[8px] font-black leading-none mt-0.5">+{(product.piecesPerBox || 1)}</span>
            </div>
          </button>
        )}

        <div className="relative">
          <input 
            type="number" 
            step="any"
            inputMode="decimal"
            enterKeyHint="next"
            data-inventory-input="true"
            autoComplete="off"
            autoCorrect="off"
            data-lpignore="true"
            data-form-type="other"
            value={inventoryQuantity ?? ''}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleKeyDown}
            onChange={(e) => onChangeQuantity(product.id, e.target.value.replace(',', '.'))}
            className="w-16 h-9 text-center text-sm font-black bg-zinc-100/50 dark:bg-zinc-800 border border-zinc-100 dark:border-neutral-800 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white placeholder:text-zinc-300 transition-all font-mono"
            placeholder={t('quantity')}
          />
        </div>
      </div>
    </motion.div>
  );
});