import React, { useState } from 'react';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { useAppContext } from '../../AppContext';
import { StaffMember } from '../../types';
import { ROLE_LABELS } from '../../lib/permissions';
import { PinPad } from './PinPad';
import { X, ShieldCheck, User, Users, UserPlus, Lock, ChevronRight, Crown, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StaffSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffSwitcherModal: React.FC<StaffSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { staffList, currentStaff, loginWithStaffPin, quickLoginWithPin } = useStaffAuth();
  const { setActiveTab, settings } = useAppContext();

  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDigits, setShowDigits] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedStaff(null);
      setPin('');
      setIsError(false);
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setPin('');
    setIsError(false);
    setErrorMessage('');
  };

  const handlePinChange = async (newPin: string) => {
    setPin(newPin);
    setIsError(false);
    setErrorMessage('');

    // If 4 digits entered, auto-submit
    if (newPin.length === 4) {
      setIsSubmitting(true);
      if (selectedStaff && selectedStaff.id) {
        const res = await loginWithStaffPin(selectedStaff.id, newPin);
        if (res.success) {
          setIsSubmitting(false);
          const loggedStaff = res.staff || selectedStaff;
          if (loggedStaff.role === 'cashier') {
            setActiveTab('pos');
          } else if (loggedStaff.role === 'storekeeper') {
            setActiveTab('inventory');
          }
          onClose();
        } else {
          setIsSubmitting(false);
          setIsError(true);
          setErrorMessage(res.error || 'رمز الـ PIN غير صحيح');
          setTimeout(() => setPin(''), 600);
        }
      } else {
        // Quick login attempt
        const res = await quickLoginWithPin(newPin);
        if (res.success) {
          setIsSubmitting(false);
          if (res.staff?.role === 'cashier') {
            setActiveTab('pos');
          } else if (res.staff?.role === 'storekeeper') {
            setActiveTab('inventory');
          }
          onClose();
        } else {
          setIsSubmitting(false);
          setIsError(true);
          setErrorMessage(res.error || 'رمز الـ PIN غير صحيح');
          setTimeout(() => setPin(''), 600);
        }
      }
    }
  };

  const handleBackToStaffList = () => {
    setSelectedStaff(null);
    setPin('');
    setIsError(false);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                {selectedStaff ? 'أدخل رمز الـ PIN' : 'تبديل الموظف النشط'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {selectedStaff ? `تسجيل دخول: ${selectedStaff.name}` : 'اختر حسابك لبدء العمل'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {!selectedStaff ? (
              <motion.div
                key="staff-list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {staffList
                    .filter((s) => s.isActive)
                    .map((staff) => {
                      const isCurrent = currentStaff?.id === staff.id;
                      const isAdmin = staff.role === 'admin' || staff.id === 'admin-master';
                      const roleInfo = ROLE_LABELS[staff.role] || ROLE_LABELS.cashier;

                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => handleSelectStaff(staff)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-right ${
                            isCurrent
                              ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-sm'
                              : isAdmin
                              ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400'
                              : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/70 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm text-base relative"
                              style={{ backgroundColor: staff.avatarColor || (isAdmin ? '#f59e0b' : '#3b82f6') }}
                            >
                              {isAdmin ? <Crown className="w-5 h-5 text-white" /> : staff.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                                  {staff.name}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">
                                    الحالي
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${roleInfo.badgeBg}`}
                                >
                                  {roleInfo.ar}
                                </span>
                                {isAdmin && staff.pin === '0000' && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                    (PIN: 0000)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <ChevronRight className="w-5 h-5 text-zinc-400 rotate-180" />
                        </button>
                      );
                    })}
                </div>

                {/* Staff Management Direct Navigation & Fast PIN */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setActiveTab('staff');
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-2 transition border border-blue-200/80 dark:border-blue-800/60 shadow-2xs"
                  >
                    <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>إدارة الطاقم وتعديل الرموز السرية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStaff({ id: '', name: 'دخول سريع بالـ PIN', role: 'cashier', pin: '', isActive: true, createdAt: '' })}
                    className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium flex items-center justify-center gap-1.5 mx-auto py-0.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    أو كتابة الـ PIN مباشرة للدخول التلقائي
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="pin-pad"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center"
              >
                {selectedStaff.id && (
                  <div className="flex flex-col items-center gap-1 mb-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {selectedStaff.role === 'admin' ? (
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      <span>{selectedStaff.name}</span>
                      <span className="text-zinc-400">|</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">
                        {ROLE_LABELS[selectedStaff.role]?.ar}
                      </span>
                    </div>
                    {selectedStaff.role === 'admin' && selectedStaff.pin === '0000' && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                        الرمز المبدئي للمدير العام: 0000
                      </span>
                    )}
                  </div>
                )}

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
                  onClick={handleBackToStaffList}
                  className="mt-4 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
                >
                  العودة لاختيار موظف آخر
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

