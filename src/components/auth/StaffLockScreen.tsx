import React, { useState } from 'react';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { useAppContext } from '../../AppContext';
import { ROLE_LABELS } from '../../lib/permissions';
import { PinPad } from './PinPad';
import { Lock, Store, Users, LogOut, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface StaffLockScreenProps {
  onOpenSwitcher?: () => void;
}

export const StaffLockScreen: React.FC<StaffLockScreenProps> = ({ onOpenSwitcher }) => {
  const { currentStaff, isLocked, unlockScreen, logoutStaff, quickLoginWithPin } = useStaffAuth();
  const { settings, setActiveTab } = useAppContext();

  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDigits, setShowDigits] = useState(false);

  if (!isLocked) return null;

  const handlePinChange = async (newPin: string) => {
    setPin(newPin);
    setIsError(false);
    setErrorMessage('');

    if (newPin.length === 4) {
      setIsSubmitting(true);
      const res = await unlockScreen(newPin);
      if (res.success) {
        setIsSubmitting(false);
        setPin('');
        const staff = res.staff || currentStaff;
        if (staff?.role === 'cashier') {
          setActiveTab('pos');
        } else if (staff?.role === 'storekeeper') {
          setActiveTab('inventory');
        }
      } else {
        setIsSubmitting(false);
        setIsError(true);
        setErrorMessage(res.error || 'رمز الـ PIN غير صحيح');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const roleInfo = currentStaff ? ROLE_LABELS[currentStaff.role] : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md text-white select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        {/* Store Title */}
        <div className="flex items-center gap-2 mb-3 text-zinc-400">
          <Store className="w-4 h-4" />
          <span className="text-sm font-semibold tracking-wide">
            {settings.storeName || 'المتجر'}
          </span>
        </div>

        {/* Lock Avatar / Info */}
        <div className="relative mb-4 flex flex-col items-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white shadow-xl ring-4 ring-zinc-800"
            style={{ backgroundColor: currentStaff?.avatarColor || '#3b82f6' }}
          >
            {currentStaff?.name ? currentStaff.name.slice(0, 2) : <Lock className="w-8 h-8" />}
          </div>
          <div className="absolute -bottom-2 bg-zinc-900 border border-zinc-700 text-zinc-300 p-1.5 rounded-full shadow">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-zinc-100 mb-1">
          {currentStaff ? currentStaff.name : 'النظام مغلق'}
        </h2>

        {roleInfo && (
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-4 ${roleInfo.badgeBg}`}
          >
            {roleInfo.ar}
          </span>
        )}

        <p className="text-xs text-zinc-400 mb-2 text-center">
          أدخل رمز الـ PIN لإلغاء القفل واستئناف العمل
        </p>

        {currentStaff?.pin === '0000' && (
          <div className="mb-3 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/60 text-[11px] text-blue-300 font-medium flex items-center gap-1.5">
            <span>الرمز المبدئي للمدير العام:</span>
            <span className="font-mono font-bold tracking-widest bg-blue-900/80 px-1.5 py-0.5 rounded text-white">0000</span>
          </div>
        )}

        {/* PinPad */}
        <div className="w-full bg-zinc-900/80 p-5 rounded-3xl border border-zinc-800 shadow-2xl">
          <PinPad
            pin={pin}
            onChange={handlePinChange}
            disabled={isSubmitting}
            isError={isError}
            errorMessage={errorMessage}
            showDigits={showDigits}
            onToggleShowDigits={() => setShowDigits(!showDigits)}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-6 mt-6">
          {onOpenSwitcher && (
            <button
              type="button"
              onClick={onOpenSwitcher}
              className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-2 px-3 rounded-xl hover:bg-zinc-800/80"
            >
              <Users className="w-4 h-4 text-blue-400" />
              تبديل الموظف
            </button>
          )}

          <button
            type="button"
            onClick={logoutStaff}
            className="flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 transition py-2 px-3 rounded-xl hover:bg-zinc-800/80"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </motion.div>
    </div>
  );
};
