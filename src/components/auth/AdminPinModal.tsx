import React, { useState } from 'react';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { PinPad } from './PinPad';
import { ShieldCheck, X, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'مطلوب إذن المشرف / المدير',
  description = 'هذه العملية تتطلب إدخال رمز PIN للمدير للموافقة والمتابعة',
}) => {
  const { verifyAdminPin } = useStaffAuth();

  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDigits, setShowDigits] = useState(false);

  if (!isOpen) return null;

  const handlePinChange = async (newPin: string) => {
    setPin(newPin);
    setIsError(false);
    setErrorMessage('');

    if (newPin.length === 4) {
      setIsSubmitting(true);
      const isValid = await verifyAdminPin(newPin);
      setIsSubmitting(false);

      if (isValid) {
        setPin('');
        onSuccess();
        onClose();
      } else {
        setIsError(true);
        setErrorMessage('رمز المشرف غير صحيح');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                {title}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          <PinPad
            pin={pin}
            onChange={handlePinChange}
            disabled={isSubmitting}
            isError={isError}
            errorMessage={errorMessage}
            showDigits={showDigits}
            onToggleShowDigits={() => setShowDigits(!showDigits)}
          />

          <button
            type="button"
            onClick={onClose}
            className="mt-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 py-1.5 px-4 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            إلغاء العملية
          </button>
        </div>
      </motion.div>
    </div>
  );
};
