import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, setupRecaptcha, signInWithGoogle } from '../../lib/firebase';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { Phone, ArrowRight, Package, Globe, ShieldCheck } from 'lucide-react';

export function Login() {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize reCAPTCHA once mounted
    const initRecaptcha = () => {
      if (recaptchaRef.current && !window.recaptchaVerifier) {
        window.recaptchaVerifier = setupRecaptcha(recaptchaRef.current);
      }
    };

    const timer = setTimeout(initRecaptcha, 100);

    return () => {
      clearTimeout(timer);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [t]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure number starts with + and is valid (Tunisia example: +216)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+216${phoneNumber}`;
      
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) throw new Error('Recaptcha not initialized');
      
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('invalid_phone'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || !confirmationResult) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await confirmationResult.confirm(verificationCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('invalid_code'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-100 p-6 dark:bg-zinc-950 font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-lg bg-white p-8 text-right shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
      >
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-brand-800 text-white shadow-lg shadow-brand-800/20">
            <Package size={40} />
          </div>
        </div>
        
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          مخزوني
        </h1>
        <p className="mb-8 text-center text-zinc-500 dark:text-zinc-400">
          {t('welcome')}
        </p>

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.form 
              key="phone-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendCode} 
              className="space-y-4"
            >
              <div className="relative group">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
                  <Phone size={20} />
                </div>
                <input
                  type="tel"
                  placeholder={t('phone_number') + ' ' + t('phone_example')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-4 pr-12 pl-4 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-brand-800 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-brand-800 px-6 py-4 font-bold text-white transition-all hover:bg-brand-900 disabled:opacity-50"
              >
                {loading ? t('loading') : t('send_code')}
                {!loading && <ArrowRight size={20} className="rotate-180" />}
              </button>

              <div className="relative flex items-center justify-center py-4">
                <div className="h-[1px] w-full bg-zinc-100 dark:bg-zinc-800" />
                <span className="absolute bg-white px-4 text-xs font-bold text-zinc-400 dark:bg-zinc-900">{t('or')}</span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    await signInWithGoogle();
                  } catch (err: any) {
                    console.error("Google Sign-in Error:", err);
                    if (err.code === 'auth/unauthorized-domain') {
                      setError(t('auth_domain_error'));
                    } else if (err.code === 'auth/popup-closed-by-user') {
                      setError(t('popup_closed_error'));
                    } else {
                      setError(err.message || t('login_failed'));
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-6 py-4 font-bold text-zinc-700 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Globe size={20} />
                {t('login_with_google')}
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key="otp-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerifyCode} 
              className="space-y-4"
            >
              <div className="relative group">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
                  <ShieldCheck size={20} />
                </div>
                <input
                  type="text"
                  placeholder={t('verification_code')}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-4 pr-12 pl-4 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:ring-2 focus:ring-brand-800 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-brand-800 px-6 py-4 font-bold text-white transition-all hover:bg-brand-900 disabled:opacity-50"
              >
                {loading ? t('loading') : t('verify_code')}
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-full py-2 text-center text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
              >
                {t('edit_phone')}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 rounded-lg bg-red-50 p-4 text-center text-sm font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
      
      <div ref={recaptchaRef}></div>
    </div>
  );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
