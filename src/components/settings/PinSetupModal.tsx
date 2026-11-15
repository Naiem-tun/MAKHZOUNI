import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, AlertCircle, X, Check, Delete } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { useFolioTheme } from '../folio/FolioPageChrome';

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
  const { theme } = useFolioTheme(Boolean(settings?.darkMode), settings?.folioThemeId);
  
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none" dir="rtl" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="border max-w-sm w-full shadow-2xl overflow-hidden flex flex-col relative"
        style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2 text-xs font-black">
            {step === 'confirm_new' ? <Check size={14} style={{ color: theme.positive }} /> : <Lock size={14} style={{ color: theme.accent }} />}
            <span>حماية التطبيق برمز PIN</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="إغلاق"
            className="p-1 border cursor-pointer"
            style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center text-center">
          <h3 className="text-base sm:text-lg font-black" style={{ color: theme.text }}>
            {getTitle()}
          </h3>
          <p className="text-xs mt-1 mb-5" style={{ color: theme.textMuted }}>
            {getSubtitle()}
          </p>

          {/* 4 Box Indicator */}
          <div className="flex items-center justify-center gap-3 mb-3">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = currentInput.length > idx;
              return (
                <div
                  key={idx}
                  className="w-4 h-4 border-2 transition-all duration-150"
                  style={{
                    borderColor: isFilled ? theme.accent : theme.border,
                    backgroundColor: isFilled ? theme.accent : theme.surface,
                  }}
                />
              );
            })}
          </div>

          {/* Error / Step Message */}
          <div className="h-5 mb-4 flex items-center justify-center">
            {errorMsg ? (
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: theme.negative }}>
                <AlertCircle size={13} />
                {errorMsg}
              </span>
            ) : (
              <span className="text-[11px] font-mono tabular-nums font-bold" style={{ color: theme.textMuted }}>
                {step === 'confirm_new' ? 'الخطوة 2 من 2' : step === 'enter_new' ? 'الخطوة 1 من 2' : 'تأكيد الحماية'}
              </span>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]" dir="ltr">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                disabled={isSubmitting}
                className="h-12 border text-lg font-mono font-black flex items-center justify-center cursor-pointer transition-colors"
                style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || currentInput.length === 0}
              className="h-12 border text-xs font-bold flex items-center justify-center disabled:opacity-30 cursor-pointer"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.textMuted }}
            >
              مسح
            </button>

            <button
              type="button"
              onClick={() => handleDigit('0')}
              disabled={isSubmitting}
              className="h-12 border text-lg font-mono font-black flex items-center justify-center cursor-pointer transition-colors"
              style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || currentInput.length === 0}
              className="h-12 border flex items-center justify-center disabled:opacity-30 cursor-pointer"
              style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }}
            >
              <Delete size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
