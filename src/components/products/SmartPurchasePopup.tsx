import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Package, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { Product } from '../../types';
import { useAppContext } from '../../AppContext';

interface SmartPurchasePopupProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPurchase: () => void;
}

export function SmartPurchasePopup({ product, isOpen, onClose, onConfirmPurchase }: SmartPurchasePopupProps) {
  const { t } = useTranslation();
  const { settings, user } = useAppContext();

  if (!isOpen || !product) return null;

  // Derive simple human-friendly name or fallback
  const userName = user?.displayName?.split(' ')[0] || '';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md transition-opacity duration-300"
      />
      
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-1/4 left-1/4 h-16 bg-gradient-to-b from-brand-500/10 via-brand-500/5 to-transparent blur-xl pointer-events-none rounded-full" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="text-center mt-2">
          {/* Glowing Smart Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 shadow-inner">
            <Sparkles size={28} className="animate-pulse" />
          </div>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {userName ? `أهلاً ${userName} 👋` : 'تنبيه ذكي للمشتريات'}
          </h3>
          
          <p className="mt-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
            لقد تم إنشاء المنتج <span className="text-brand-600 dark:text-brand-400 font-extrabold underline decoration-brand-500/30">"{product.name}"</span> بنجاح!
          </p>

          <div className="my-5 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/40 text-right border border-zinc-100 dark:border-zinc-800">
            <h4 className="text-xs font-black text-brand-700 dark:text-brand-400 mb-3 flex items-center gap-1.5">
              <Package size={14} />
              <span>هل تريد تسجيل فاتورة مشتريات (إضافة مخزون) الآن؟</span>
            </h4>
            
            <p className="text-xs text-zinc-500 dark:text-zinc-450 leading-relaxed mb-4">
              نعلم أنك قد تنسى أحياناً تسجيل فواتير الشراء لاحقاً. تسجيل المشتريات فوراً يساعدك على:
            </p>

            <ul className="space-y-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 pr-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>ضبط كمية المخزون الحالي الفعلي</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>تسجيل كلفة رأس المال الصحيحة لحساب الأرباح بدقة</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>ربط العملية بحركات المورد وسجل المدفوعات</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              onClick={onConfirmPurchase}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/15 active:scale-[0.98] transition-all"
            >
              <span>نعم، سجل الشراء والكمية الآن</span>
              <ArrowRight size={16} className="rotate-180" />
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            >
              لا، شكراً (سأقوم بذلك لاحقاً)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
