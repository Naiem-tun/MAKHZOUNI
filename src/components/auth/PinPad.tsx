import React from 'react';
import { Delete, X } from 'lucide-react';
import { motion } from 'motion/react';

interface PinPadProps {
  pin: string;
  onChange: (pin: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  disabled?: boolean;
  isError?: boolean;
  errorMessage?: string;
  showDigits?: boolean;
  onToggleShowDigits?: () => void;
}

export const PinPad: React.FC<PinPadProps> = ({
  pin,
  onChange,
  onSubmit,
  maxLength = 6,
  disabled = false,
  isError = false,
  errorMessage,
  showDigits = false,
  onToggleShowDigits,
}) => {
  const handleDigit = (digit: string) => {
    if (disabled) return;
    if (pin.length < maxLength) {
      const nextPin = pin + digit;
      onChange(nextPin);
    }
  };

  const handleBackspace = () => {
    if (disabled) return;
    onChange(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto">
      {/* PIN Bullets / Display */}
      <motion.div
        animate={isError ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.4 }}
        dir="ltr"
        className="flex items-center justify-center gap-3 my-4 py-2"
      >
        {Array.from({ length: 4 }).map((_, index) => {
          const isFilled = index < pin.length;
          return (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                isError
                  ? 'bg-red-500 ring-4 ring-red-100 dark:ring-red-950'
                  : isFilled
                  ? 'bg-blue-600 dark:bg-blue-400 scale-110 shadow-sm shadow-blue-500/40'
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          );
        })}
      </motion.div>

      {/* Numerical Text Feedback */}
      {showDigits && pin.length > 0 && (
        <div dir="ltr" className="font-mono text-xl font-bold tracking-widest text-zinc-700 dark:text-zinc-300 mb-2 h-6">
          {pin}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-3 text-center animate-pulse">
          {errorMessage}
        </p>
      )}

      {/* Keypad Grid (LTR for standard phone / ATM dial pad layout) */}
      <div className="grid grid-cols-3 gap-2.5 w-full" dir="ltr">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(num.toString())}
            className="h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/90 hover:bg-blue-50 dark:hover:bg-zinc-700/80 active:scale-95 active:bg-blue-100 dark:active:bg-zinc-700 text-2xl font-bold text-zinc-800 dark:text-zinc-100 shadow-sm transition-all duration-150 flex items-center justify-center select-none border border-zinc-200/60 dark:border-zinc-700/60 disabled:opacity-50"
          >
            {num}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleClear}
          className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 active:scale-95 text-xs font-semibold text-zinc-600 dark:text-zinc-400 transition-all flex items-center justify-center disabled:opacity-30 border border-zinc-200/40 dark:border-zinc-800"
          title="مسح الكل"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Zero */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/90 hover:bg-blue-50 dark:hover:bg-zinc-700/80 active:scale-95 active:bg-blue-100 dark:active:bg-zinc-700 text-2xl font-bold text-zinc-800 dark:text-zinc-100 shadow-sm transition-all duration-150 flex items-center justify-center select-none border border-zinc-200/60 dark:border-zinc-700/60 disabled:opacity-50"
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 active:scale-95 text-zinc-700 dark:text-zinc-300 transition-all flex items-center justify-center disabled:opacity-30 border border-zinc-200/40 dark:border-zinc-800"
          title="مسح رقم"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {onToggleShowDigits && (
        <button
          type="button"
          onClick={onToggleShowDigits}
          className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 hover:underline"
        >
          {showDigits ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
        </button>
      )}
    </div>
  );
};
