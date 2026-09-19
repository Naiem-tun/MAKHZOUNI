import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, AlertCircle, X, Check, Delete, KeyRound } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'setup' | 'change' | 'disable';
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  mode = 'setup'
}) => {
  const { settings, updateSettings, showToast } = useAppContext();
  
  // Steps:
  // 'verify_old' (if changing or disabling and currently has PIN)
  // 'enter_new'
  // 'confirm_new'
  const initialStep = (mode === 'change' || mode === 'disable') && settings.appPin 
    ? 'verify_old' 
    : 'enter_new';

  const [step, setStep] = useState<'verify_old' | 'enter_new' | 'confirm_new'>(initialStep);
  const [currentInput, setCurrentInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (currentInput.length >= 4) return;
    setErrorMsg('');
    const nextVal = currentInput + digit;
    setCurrentInput(nextVal);

    if (nextVal.length === 4) {
      handleComplete(nextVal);
    }
  };

  const handleDelete = () => {
    setErrorMsg('');
    setCurrentInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setCurrentInput('');
  };

  const handleComplete = async (entered: string) => {
    if (step === 'verify_old') {
      if (entered === settings.appPin) {
        if (mode === 'disable') {
          // Disable PIN right away
          setIsSubmitting(true);
          try {
            await updateSettings({ appPinEnabled: false });
            showToast('تم تعطيل الرمز السري بنجاح', 'info');
            onClose();
          } catch (e) {
            setErrorMsg('حدث خطأ أثناء حفظ الإعدادات');
          } finally {
            setIsSubmitting(false);
          }
        } else {
          // Move to enter new PIN
          setStep('enter_new');
          setCurrentInput('');
        }
      } else {
        setErrorMsg('الرمز السري الحالي غير صحيح');
        setCurrentInput('');
      }
    } else if (step === 'enter_new') {
      setNewPin(entered);
      setStep('confirm_new');
      setCurrentInput('');
    } else if (step === 'confirm_new') {
      if (entered === newPin) {
        setIsSubmitting(true);
        try {
          await updateSettings({
            appPinEnabled: true,
            appPin: entered
          });
          showToast(mode === 'change' ? 'تم تغيير الرمز السري بنجاح' : 'تم تفعيل حماية الرمز السري بنجاح', 'success');
          onClose();
        } catch (err) {
          setErrorMsg('حدث خطأ أثناء حفظ الرمز السري');
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setErrorMsg('الرمزان غير متطابقين، أعد إدخال الرمز للتأكيد');
        setCurrentInput('');
      }
    }
  };

  const getTitle = () => {
    if (step === 'verify_old') return 'أدخل الرمز السري الحالي';
    if (step === 'enter_new') return mode === 'change' ? 'أدخل الرمز السري الجديد' : 'تعيين رمز سري جديد (4 أرقام)';
    if (step === 'confirm_new') return 'تأكيد الرمز السري الجديد';
    return '';
  };

  const getSubtitle = () => {
    if (step === 'verify_old') return 'يرجى تأكيد هويتك أولاً للمتابعة';
    if (step === 'enter_new') return 'اختر 4 أرقام يسهل عليك تذكرها';
    if (step === 'confirm_new') return 'أعد كتابة الرمز السري للتأكد من صحته';
    return '';
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative"
        dir="rtl"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 left-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4 mt-2">
          {step === 'confirm_new' ? <Check size={28} /> : <Lock size={28} />}
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
          {getTitle()}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-5">
          {getSubtitle()}
        </p>

        {/* 4 Dots Indicator */}
        <div className="flex items-center justify-center gap-3 mb-3">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = currentInput.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  isFilled
                    ? 'border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500 scale-110'
                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800'
                }`}
              />
            );
          })}
        </div>

        {/* Error Message */}
        <div className="h-5 mb-3 flex items-center justify-center">
          {errorMsg ? (
            <span className="text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={13} />
              {errorMsg}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-400">
              {step === 'confirm_new' ? 'الخطوة 2 من 2' : step === 'enter_new' ? 'الخطوة 1 من 2' : 'تأكيد الحماية'}
            </span>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={isSubmitting}
              className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/60 text-lg font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting || currentInput.length === 0}
            className="h-12 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            مسح
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/60 text-lg font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting || currentInput.length === 0}
            className="h-12 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            <Delete size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
