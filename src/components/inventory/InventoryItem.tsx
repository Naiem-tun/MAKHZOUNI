import React from 'react';
import { Check, PlusCircle, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cleanQuantity, formatQuantity } from '../../lib/utils';
import { ProductIcon } from './ProductIcon';
import { useAppContext } from '../../AppContext';
import { FolioTheme } from './analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

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
  theme?: FolioTheme;
}

export const InventoryItem = React.memo(
  ({
    product,
    sequenceNumber,
    inventoryQuantity,
    isChecked,
    showDetailedControls,
    onToggleCheck,
    onAddPiece,
    onAddCarton,
    onChangeQuantity,
    theme,
  }: InventoryItemProps) => {
    const { t } = useTranslation();
    const { settings } = useAppContext();
    const activeTheme = theme || resolveFolioTheme(Boolean(settings.darkMode));

    const unitMap: Record<string, string> = {
      piece: 'قطعة',
      carton: 'كرتونة',
      kg: 'كغ',
      gram: 'غرام',
      liter: 'لتر',
      box: 'صندوق',
      meter: 'متر',
    };
    const unitText = product.unit
      ? unitMap[product.unit] || t(product.unit) || 'قطعة'
      : t('piece');

    const getCountBreakdown = (total: number, piecesPerBox: number) => {
      const cleanTotal = cleanQuantity(total);

      if (settings.defaultStockView === 'boxes' && piecesPerBox && piecesPerBox > 1) {
        return `${(cleanTotal / piecesPerBox).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} ${t('box')}`;
      }

      return `${formatQuantity(cleanTotal)} ${unitText}`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(
          document.querySelectorAll<HTMLInputElement>(
            'input[data-inventory-input="true"]:not([disabled])',
          ),
        ).filter((el) => el.offsetParent !== null);

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

    const hasEnteredQty = inventoryQuantity !== undefined;

    return (
      <div
        className="flex items-center justify-between gap-2.5 py-2.5 px-3 sm:px-4 min-h-[64px] transition-colors"
        style={{
          backgroundColor: hasEnteredQty ? activeTheme.surfaceMuted : activeTheme.surface,
          opacity: isChecked ? 0.52 : 1,
          borderRightWidth: '3px',
          borderRightStyle: 'solid',
          borderRightColor: hasEnteredQty ? activeTheme.accent : 'transparent',
        }}
      >
        {/* Product Info (Right) */}
        <div
          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
          onClick={() => onToggleCheck(product.id)}
        >
          {sequenceNumber !== undefined && (
            <span
              className="w-6 shrink-0 text-[11px] font-mono tabular-nums font-bold text-center"
              style={{ color: activeTheme.textMuted }}
            >
              {String(sequenceNumber).padStart(2, '0')}
            </span>
          )}

          <div className="relative shrink-0">
            <ProductIcon category={product.category} />
            {isChecked && (
              <div
                className="absolute -top-1 -right-1 text-white p-0.5"
                style={{ backgroundColor: activeTheme.positive }}
              >
                <Check size={8} strokeWidth={4} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <h3
              className="text-xs sm:text-sm font-bold leading-tight truncate"
              style={{ color: activeTheme.text }}
            >
              {product.name || t('product')}
            </h3>

            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
              style={{ color: activeTheme.textMuted }}
            >
              <span>
                {t('stock')}:{' '}
                <strong className="font-mono tabular-nums" style={{ color: activeTheme.text }}>
                  {settings.defaultStockView === 'boxes'
                    ? getCountBreakdown(product.quantity || 0, product.piecesPerBox || 1)
                    : `${formatQuantity(product.quantity || 0)} ${unitText}`}
                </strong>
              </span>

              {cleanQuantity(inventoryQuantity) > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className="font-bold font-mono tabular-nums inline-flex items-center gap-1"
                    style={{ color: activeTheme.accent }}
                  >
                    <Check size={10} strokeWidth={3} />
                    <span>
                      {getCountBreakdown(inventoryQuantity || 0, product.piecesPerBox || 1)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Controls (Left) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {showDetailedControls && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onAddPiece(product.id)}
              className="w-9 h-9 flex flex-col items-center justify-center border transition-colors cursor-pointer"
              style={{
                backgroundColor: activeTheme.bg,
                borderColor: activeTheme.border,
                color: activeTheme.accent,
              }}
              title={t('add_piece')}
            >
              <PlusCircle size={13} />
              <span className="text-[9px] font-mono font-black leading-none mt-0.5">+1</span>
            </button>
          )}

          {(product.piecesPerBox || 1) > 1 && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onAddCarton(product.id, product.piecesPerBox || 1)}
              className="w-9 h-9 flex flex-col items-center justify-center border transition-colors cursor-pointer"
              style={{
                backgroundColor: activeTheme.bg,
                borderColor: activeTheme.border,
                color: activeTheme.textMuted,
              }}
              title={`${t('add_carton')} (${product.piecesPerBox} ${t('piece')})`}
            >
              <Package size={13} />
              <span className="text-[9px] font-mono font-black leading-none mt-0.5">
                +{product.piecesPerBox || 1}
              </span>
            </button>
          )}

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
            className="w-16 h-9 text-center text-sm font-black font-mono tabular-nums border outline-none transition-colors"
            style={{
              backgroundColor: activeTheme.bg,
              borderColor: hasEnteredQty ? activeTheme.accent : activeTheme.border,
              color: activeTheme.text,
            }}
            placeholder={t('quantity')}
          />
        </div>
      </div>
    );
  },
);