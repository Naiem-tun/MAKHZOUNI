import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Package, Plus, SquarePen, Lock } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';
import { useCategories, categoryIcons } from '../../hooks/useCategories';
import { formatCurrency, cleanQuantity, formatQuantity } from '../../lib/utils';
import { ProductImage } from './ProductImage';
import { auditProduct } from '../../lib/priceAuditor';
import { FolioTheme } from '../inventory/analytics/folio/folioTypes';
import { resolveFolioTheme } from '../folio/FolioPageChrome';

interface ProductCardProps {
  product: Product;
  index: number;
  showBoxInfo?: boolean;
  showPosStock?: boolean;
  onEdit: (product: Product) => void;
  onAddQuantity: (product: Product) => void;
  onCardClick?: (product: Product) => void;
  theme?: FolioTheme;
}

const ProductIcon = ({
  product,
  theme,
}: {
  product: Product;
  theme: FolioTheme;
}) => {
  const { categories } = useCategories();
  const category = categories.find((c) => c.name === product.category);
  const iconName = category?.icon || 'Package';
  const Icon = categoryIcons[iconName] || Package;

  if ((product.hasLocalImage || product.hasCloudImage) && product.id) {
    return (
      <div
        className="w-9 h-9 overflow-hidden shrink-0 border"
        style={{ borderColor: theme.border }}
      >
        <ProductImage
          productId={product.id}
          hasLocalImage={product.hasLocalImage}
          hasCloudImage={product.hasCloudImage}
          FallbackIcon={Icon}
          iconSize={16}
        />
      </div>
    );
  }

  return (
    <div
      className="w-9 h-9 flex items-center justify-center shrink-0 border"
      style={{
        backgroundColor: theme.surfaceMuted,
        borderColor: theme.border,
        color: theme.accent,
      }}
    >
      <Icon size={16} />
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  showBoxInfo,
  showPosStock,
  onEdit,
  onAddQuantity,
  onCardClick,
  theme,
}) => {
  const { t, i18n } = useTranslation();
  const { settings, activeSupplier, showToast } = useAppContext();
  const language = i18n.language;
  const activeTheme = theme || resolveFolioTheme(Boolean(settings.darkMode));
  const showFinancials = settings.showFinancials ?? true;

  const baseSellingPrice = showBoxInfo
    ? (product.sellingPrice || 0) * (product.piecesPerBox || 1)
    : product.sellingPrice || 0;
  const basePurchasePrice = showBoxInfo
    ? product.boxPurchasePrice || (product.purchasePrice || 0) * (product.piecesPerBox || 1)
    : product.purchasePrice || 0;

  const profit = baseSellingPrice - basePurchasePrice;
  const calcMethod = settings.profitCalculationMethod || 'markup';
  const profitMargin =
    calcMethod === 'margin'
      ? baseSellingPrice > 0
        ? (profit / baseSellingPrice) * 100
        : 0
      : basePurchasePrice > 0
        ? (profit / basePurchasePrice) * 100
        : 0;

  const isPurchaseDisabled = settings.requireSupplierSession && !activeSupplier;
  const enablePriceAudit = settings.enablePriceAudit ?? true;
  const audit = useMemo(() => auditProduct(product), [product]);
  const hasPriceError = enablePriceAudit && audit.hasIssues;
  const mainIssue = audit.issues[0];

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

  const stockRaw = showPosStock
    ? product.posQuantity !== undefined
      ? product.posQuantity
      : product.quantity
    : product.quantity;
  const cleanQty = cleanQuantity(stockRaw);
  const isLowStock = cleanQty <= (product.minQuantity ?? 0);

  return (
    <div
      className="relative group overflow-hidden"
      style={{ borderColor: activeTheme.border }}
    >
      {/* Background profit reveal on horizontal swipe */}
      <div
        className="absolute inset-y-0 right-0 flex items-center pr-4 z-0 w-28 justify-end"
        style={{ backgroundColor: activeTheme.surfaceMuted }}
        dir="ltr"
      >
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold" style={{ color: activeTheme.accent }}>
            {t('profit_margin')}{' '}
            {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1
              ? `(${t('box')})`
              : ''}
          </span>
          <span
            className="text-xs font-black font-mono tabular-nums"
            style={{ color: activeTheme.text }}
          >
            {!showFinancials ? '••••••' : formatCurrency(profit, settings.currency, language)}
          </span>
          <span
            className="text-[10px] font-bold font-mono tabular-nums"
            style={{ color: activeTheme.positive }}
          >
            {profitMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Swipable foreground row */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -112, right: 0 }}
        dragElastic={0.1}
        className="relative z-10 flex items-center justify-between gap-2.5 sm:gap-3 px-2.5 sm:px-3.5 py-3 cursor-pointer transition-colors"
        style={{
          backgroundColor: activeTheme.surface,
          borderRightWidth: hasPriceError ? '3px' : '0px',
          borderRightStyle: 'solid',
          borderRightColor: hasPriceError ? activeTheme.negative : 'transparent',
        }}
        onClick={() => {
          if (onCardClick) {
            onCardClick(product);
          } else {
            onEdit(product);
          }
        }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <ProductIcon product={product} theme={activeTheme} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3
                className="text-sm sm:text-base font-semibold leading-tight truncate"
                style={{ color: activeTheme.text }}
              >
                {product.name}
              </h3>
              {hasPriceError && (
                <span
                  className="text-[11px] font-bold"
                  style={{
                    color:
                      mainIssue?.severity === 'error'
                        ? activeTheme.negative
                        : activeTheme.neutral,
                  }}
                >
                  · {mainIssue?.title || 'خطأ تسعير'}
                </span>
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
              style={{ color: activeTheme.textMuted }}
            >
              {/* Stock Readout */}
              <span>{showPosStock ? 'الكاشير:' : t('stock_label')}</span>
              {settings.defaultStockView === 'boxes' &&
              product.piecesPerBox &&
              product.piecesPerBox > 1 ? (
                <span
                  className="font-mono tabular-nums font-bold"
                  style={{ color: isLowStock && !showPosStock ? activeTheme.negative : activeTheme.accent }}
                >
                  {(cleanQty / product.piecesPerBox).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{' '}
                  كرتونة ({formatQuantity(stockRaw)} {unitText})
                </span>
              ) : (
                <span
                  className="font-mono tabular-nums font-bold"
                  style={{ color: isLowStock && !showPosStock ? activeTheme.negative : activeTheme.accent }}
                >
                  {formatQuantity(stockRaw)} {unitText}
                  {showBoxInfo && product.piecesPerBox && product.piecesPerBox > 1
                    ? ` (${Math.floor(cleanQty / product.piecesPerBox)} كرتونة و ${formatQuantity(cleanQty % product.piecesPerBox)} ${unitText})`
                    : ''}
                </span>
              )}

              <span aria-hidden="true">·</span>

              {/* Pricing Readout */}
              {showBoxInfo ? (
                <span className="font-mono tabular-nums font-bold" style={{ color: activeTheme.text }}>
                  {!showFinancials
                    ? '••••••'
                    : formatCurrency(product.boxPurchasePrice || 0, settings.currency, language)}{' '}
                  <span className="font-sans font-normal" style={{ color: activeTheme.textMuted }}>
                    / {t('box')} ({product.piecesPerBox} {unitText})
                  </span>
                </span>
              ) : (
                <span className="font-mono tabular-nums font-bold" style={{ color: activeTheme.text }}>
                  {!showFinancials
                    ? '••••••'
                    : formatCurrency(product.purchasePrice || 0, settings.currency, language)}{' '}
                  <span style={{ color: activeTheme.textMuted }}>←</span>{' '}
                  {formatCurrency(product.sellingPrice || 0, settings.currency, language)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showBoxInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product);
              }}
              className="flex items-center justify-center w-9 h-9 border transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: activeTheme.surfaceMuted,
                borderColor: activeTheme.border,
                color: activeTheme.text,
              }}
              title={t('edit') || 'Edit'}
            >
              <SquarePen size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isPurchaseDisabled) {
                showToast('يجب فتح حصة مورد أولاً لإضافة المشتريات', 'error');
                return;
              }
              onAddQuantity(product);
            }}
            className="flex items-center justify-center gap-1 px-3 h-9 border text-xs font-bold transition-colors shrink-0 cursor-pointer"
            style={{
              backgroundColor: isPurchaseDisabled ? activeTheme.surfaceMuted : activeTheme.accent,
              borderColor: isPurchaseDisabled ? activeTheme.border : activeTheme.accent,
              color: isPurchaseDisabled ? activeTheme.textMuted : activeTheme.accentText,
              cursor: isPurchaseDisabled ? 'not-allowed' : 'pointer',
            }}
            title={isPurchaseDisabled ? 'يجب فتح حصة مورد أولاً' : t('add_quantity')}
          >
            {isPurchaseDisabled ? <Lock size={13} /> : <Plus size={14} />}
            <span>{t('add_quantity')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
