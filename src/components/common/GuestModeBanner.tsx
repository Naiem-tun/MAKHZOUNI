import React from 'react';
import { Eye, LogIn, Sparkles, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GuestModeBannerProps {
  onExitGuestMode: () => void;
}

export function GuestModeBanner({ onExitGuestMode }: GuestModeBannerProps) {
  const { t } = useTranslation();

  return (
    <aside 
      aria-label="تنبيه وضع الضيف"
      className="sticky top-0 z-50 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white shadow-md transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
            <Eye size={14} />
          </span>
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold whitespace-nowrap bg-black/20 px-2 py-0.5 rounded text-[11px] sm:text-xs">
              وضع المعاينة (ضيف)
            </span>
            <span className="hidden md:inline text-amber-50 text-xs">
              البيانات المعروضة افتراضية وآمنة تماماً للمعاينة وتقييم التصميم
            </span>
            <span className="md:hidden text-amber-50 text-[11px] truncate">
              نسخة استعراضية للقراءة فقط
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExitGuestMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-amber-900 font-bold text-xs shadow-sm hover:bg-amber-50 active:scale-95 transition-all"
          >
            <LogIn size={14} className="text-amber-700" />
            <span>تسجيل الدخول كمسؤول</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
