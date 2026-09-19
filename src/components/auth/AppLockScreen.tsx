import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, LogOut, ShieldCheck, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { Logo } from '../UI';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

export const AppLockScreen: React.FC = () => {
  const { settings, unlockApp, showToast, user } = useAppContext();
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
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between bg-zinc-50 dark:bg-[#0B1121] text-zinc-900 dark:text-white px-4 py-8 select-none transition-colors duration-300 overflow-y-auto"
      dir="rtl"
    >
      {/* Background Subtle Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header & Store Branding */}
      <div className="relative z-10 flex flex-col items-center mt-2 sm:mt-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative mb-3"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white dark:bg-zinc-900 shadow-xl shadow-brand-500/10 dark:shadow-none border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-center p-3 relative group">
            <Logo className="w-full h-full" />
            <div className="absolute -bottom-1 -right-1 bg-brand-600 text-white p-1.5 rounded-full shadow-md">
              <Lock size={14} />
            </div>
          </div>
        </motion.div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
          {settings?.storeName || 'مخزوني'}
        </h1>
        <p className="text-xs sm:text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
          أدخل رمز الدخول (4 أرقام) للمتابعة
        </p>
      </div>

      {/* PIN Indicator Dots */}
      <div className="relative z-10 flex flex-col items-center my-4 sm:my-6">
        <motion.div 
          animate={isError ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 py-2"
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <motion.div
                key={index}
                initial={false}
                animate={{
                  scale: isFilled ? 1.15 : 1,
                  backgroundColor: isError 
                    ? '#EF4444' 
                    : isSuccess 
                    ? '#10B981' 
                    : isFilled 
                    ? '#2563EB' 
                    : 'transparent',
                  borderColor: isError 
                    ? '#EF4444' 
                    : isSuccess 
                    ? '#10B981' 
                    : isFilled 
                    ? '#2563EB' 
                    : 'currentColor',
                }}
                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all duration-200 ${
                  isFilled 
                    ? 'border-brand-600 dark:border-brand-500' 
                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-200/50 dark:bg-zinc-800/50'
                }`}
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
                className="text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1.5"
              >
                <AlertCircle size={14} />
                رمز PIN غير صحيح، حاول مجدداً
              </motion.span>
            )}
            {isSuccess && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
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
        <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full px-2" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={isSuccess}
              className="h-14 sm:h-16 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 text-xl sm:text-2xl font-bold text-zinc-800 dark:text-zinc-100 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800/80 active:scale-95 active:bg-brand-50 dark:active:bg-brand-950/40 transition-all flex items-center justify-center select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {digit}
            </button>
          ))}

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isSuccess || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/40 text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            مسح الكل
          </button>

          {/* 0 button */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isSuccess}
            className="h-14 sm:h-16 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 text-xl sm:text-2xl font-bold text-zinc-800 dark:text-zinc-100 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800/80 active:scale-95 active:bg-brand-50 dark:active:bg-brand-950/40 transition-all flex items-center justify-center select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            0
          </button>

          {/* Delete backspace button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSuccess || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="حذف"
          >
            <Delete size={22} />
          </button>
        </div>

        {/* Forgot PIN / Reset Link */}
        <div className="mt-6 sm:mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-xs sm:text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors py-1.5 px-3 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/30 flex items-center gap-1.5"
          >
            <KeyRound size={14} />
            <span>نسيت رمز الدخول؟</span>
          </button>
        </div>
      </div>

      {/* Forgot PIN Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-right"
              dir="rtl"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <KeyRound size={24} />
              </div>

              <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
                استعادة أو إعادة تعيين الرمز السري
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                للحفاظ على أمان بيانات المتجر، في حال نسيان الرمز يمكنك تسجيل الخروج وإعادة تسجيل الدخول بحسابك 
                ({user?.email || 'المسجل'}) لإعادة تعيين الرمز من الإعدادات.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <LogOut size={16} />
                  <span>تسجيل الخروج وإعادة الدخول</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors"
                >
                  العودة وإعادة المحاولة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
