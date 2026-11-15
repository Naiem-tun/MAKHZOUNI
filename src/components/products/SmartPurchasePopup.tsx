import React from 'react';
import { X, Truck, Package, CheckCircle2, ArrowRight } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

interface SmartPurchasePopupProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPurchase: () => void;
}

export function SmartPurchasePopup({ product, isOpen, onClose, onConfirmPurchase }: SmartPurchasePopupProps) {
  const { settings, user } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);

  if (!isOpen || !product) return null;

  const userName = user?.displayName?.split(' ')[0] || '';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl" onClick={onClose}>
      <div
        className="relative w-full max-w-md border shadow-2xl overflow-hidden transition-colors"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3.5 sm:px-5 border-b flex items-center justify-between gap-3"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 border flex items-center justify-center shrink-0"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.accent }}
            >
              <Truck size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold font-mono tabular-nums" style={{ color: theme.accent }}>
                01 · تنبيه ذكي للمشتريات
              </div>
              <h3 className="text-sm sm:text-base font-black truncate" style={{ color: theme.text }}>
                {userName ? `أهلاً ${userName}` : 'تسجيل المشتريات الفوري'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 border cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-right">
          <p className="text-xs sm:text-sm font-bold leading-relaxed" style={{ color: theme.textMuted }}>
            تم إنشاء المنتج{' '}
            <span className="font-black underline" style={{ color: theme.accent }}>
              &quot;{product.name}&quot;
            </span>{' '}
            بنجاح!
          </p>

          <div
            className="border p-4 space-y-3"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, borderRight: `3px solid ${theme.accent}` }}
          >
            <h4 className="text-xs font-black flex items-center gap-1.5" style={{ color: theme.accent }}>
              <Package size={14} />
              <span>هل تريد تسجيل فاتورة مشتريات (إضافة مخزون) الآن؟</span>
            </h4>

            <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
              تسجيل المشتريات فوراً يساعدك على:
            </p>

            <ul className="space-y-2 text-xs font-bold" style={{ color: theme.text }}>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" style={{ color: theme.positive }} />
                <span>ضبط كمية المخزون الحالي الفعلي</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" style={{ color: theme.positive }} />
                <span>تسجيل كلفة رأس المال الصحيحة لحساب الأرباح بدقة</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" style={{ color: theme.positive }} />
                <span>ربط العملية بحركات المورد وسجل المدفوعات</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onConfirmPurchase}
              className="w-full flex items-center justify-center gap-2 border py-3 text-sm font-black transition-opacity hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
            >
              <span>نعم، سجل الشراء والكمية الآن</span>
              <ArrowRight size={16} className="rotate-180" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 border text-xs font-bold transition-colors cursor-pointer"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
            >
              لا، شكراً (سأقوم بذلك لاحقاً)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
