import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, LogOut, ShieldCheck, KeyRound, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { Logo } from '../UI';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useFolioTheme } from '../folio/FolioPageChrome';

export const AppLockScreen: React.FC = () => {
  const { settings, unlockApp, showToast, user } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    if (isSuccess || isError) return;
    if (pin.length < 4) {
      // Haptic feedback if available
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(20);
        }
      } catch (_) {}

      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 4) {
        // Verify PIN
        const isValid = unlockApp(nextPin);
        if (isValid) {
          setIsSuccess(true);
          try {
            if ('vibrate' in navigator) {
              navigator.vibrate([30, 50, 30]);
            }
          } catch (_) {}
        } else {
          setIsError(true);
          try {
            if ('vibrate' in navigator) {
              navigator.vibrate(100);
            }
          } catch (_) {}
          setTimeout(() => {
            setPin('');
            setIsError(false);
          }, 600);
        }
      }
    }
  }, [pin, isSuccess, isError, unlockApp]);

  const handleDelete = useCallback(() => {
    if (isSuccess || isError) return;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(15);
      }
    } catch (_) {}
    setPin(prev => prev.slice(0, -1));
  }, [isSuccess, isError]);

  const handleClear = useCallback(() => {
    if (isSuccess || isError) return;
    setPin('');
  }, [isSuccess, isError]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showForgotModal) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, handleClear, showForgotModal]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('تم تسجيل الخروج بنجاح', 'info');
      setShowForgotModal(false);
    } catch (err) {
      console.error(err);
      showToast('تعذر تسجيل الخروج', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between px-4 py-8 select-none transition-colors duration-300 overflow-y-auto"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      {/* Top Header & Store Branding */}
      <div className="relative z-10 flex flex-col items-center mt-2 sm:mt-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative mb-3"
        >
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 border flex items-center justify-center p-3 relative"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <Logo className="w-full h-full" />
            <div
              className="absolute -bottom-1 -right-1 p-1.5 border"
              style={{ backgroundColor: theme.accent, borderColor: theme.accent, color: theme.accentText }}
            >
              <Lock size={13} />
            </div>
          </div>
        </motion.div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: theme.text }}>
          {settings?.storeName || 'مخزوني'}
        </h1>
        <p className="text-xs sm:text-sm font-bold mt-1" style={{ color: theme.textMuted }}>
          أدخل رمز الدخول (4 أرقام) للمتابعة
        </p>
      </div>

      {/* PIN Indicator */}
      <div className="relative z-10 flex flex-col items-center my-4 sm:my-6">
        <motion.div
          animate={isError ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 py-2"
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            const dotColor = isError
              ? theme.negative
              : isSuccess
                ? theme.positive
                : isFilled
                  ? theme.accent
                  : theme.border;
            return (
              <motion.div
                key={index}
                initial={false}
                animate={{ scale: isFilled ? 1.12 : 1 }}
                className="w-4 h-4 sm:w-5 sm:h-5 border-2 transition-colors duration-150"
                style={{
                  backgroundColor: isFilled || isError || isSuccess ? dotColor : theme.surface,
                  borderColor: dotColor,
                }}
              />
            );
          })}
        </motion.div>

        <div className="h-6 mt-2 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isError && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: theme.negative }}
              >
                <AlertCircle size={14} />
                رمز PIN غير صحيح، حاول مجدداً
              </motion.span>
            )}
            {isSuccess && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: theme.positive }}
              >
                <ShieldCheck size={14} />
                تم التحقق بنجاح...
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Touch Numeric Keypad */}
      <div className="relative z-10 w-full max-w-xs sm:max-w-sm flex flex-col items-center">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full px-2" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={isSuccess}
              className="h-14 sm:h-16 border text-xl sm:text-2xl font-mono font-black flex items-center justify-center select-none cursor-pointer transition-colors"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            disabled={isSuccess || pin.length === 0}
            className="h-14 sm:h-16 border text-xs sm:text-sm font-bold flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
          >
            مسح الكل
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isSuccess}
            className="h-14 sm:h-16 border text-xl sm:text-2xl font-mono font-black flex items-center justify-center select-none cursor-pointer transition-colors"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isSuccess || pin.length === 0}
            className="h-14 sm:h-16 border flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
            title="حذف"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Forgot PIN / Reset Link */}
        <div className="mt-6 sm:mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-xs sm:text-sm font-bold py-1.5 px-3 border flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.accent }}
          >
            <KeyRound size={14} />
            <span>نسيت رمز الدخول؟</span>
          </button>
        </div>
      </div>

      {/* Forgot PIN Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="border max-w-sm w-full shadow-2xl overflow-hidden text-right"
              style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
              dir="rtl"
            >
              <div
                className="px-4 py-3 border-b flex items-center gap-2 text-xs font-black"
                style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.neutral }}
              >
                <KeyRound size={15} />
                <span>استعادة أو إعادة تعيين الرمز السري</span>
              </div>

              <div className="p-5 space-y-5">
                <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                  للحفاظ على أمان بيانات المتجر، في حال نسيان الرمز يمكنك تسجيل الخروج وإعادة تسجيل الدخول بحسابك (
                  <strong style={{ color: theme.text }}>{user?.email || 'المسجل'}</strong>) لإعادة تعيين الرمز من الإعدادات.
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full h-11 border font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.negative, borderColor: theme.negative, color: '#FFFFFF' }}
                  >
                    <LogOut size={15} />
                    <span>تسجيل الخروج وإعادة الدخول</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full h-11 border font-bold text-xs cursor-pointer transition-colors"
                    style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
                  >
                    العودة وإعادة المحاولة
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
