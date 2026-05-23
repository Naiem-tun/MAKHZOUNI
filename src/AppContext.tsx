import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, orderBy } from 'firebase/firestore';
import { OperationType, UserSettings, Category } from './types';
import { handleFirestoreError, cn } from './lib/utils';
import i18n from './lib/i18n';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  isOffline: boolean;
  isDataLoaded: boolean;
  setIsDataLoaded: (val: boolean) => void;
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  toggleDarkMode: () => void;
  setLanguage: (lang: 'ar' | 'en') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  categories: Category[];
  activeSupplier: { id: string; name: string } | null;
  setActiveSupplier: (supplier: { id: string; name: string } | null) => void;
}

const defaultSettings: UserSettings = {
  currency: 'د.ت',
  language: 'ar',
  darkMode: false,
  storeName: 'H.STORE',
  showFinancials: true,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('user_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(() => !localStorage.getItem('has_session'));
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('user_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Apply dark mode and language immediately
      if (parsed.darkMode) document.documentElement.classList.add('dark');
      if (parsed.language) i18n.changeLanguage(parsed.language);
      return parsed;
    }
    return defaultSettings;
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<{ id: string; name: string } | null>(() => {
    const saved = localStorage.getItem('active_supplier_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (activeSupplier) {
      localStorage.setItem('active_supplier_session', JSON.stringify(activeSupplier));
    } else {
      localStorage.removeItem('active_supplier_session');
    }
  }, [activeSupplier]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        const userData = { uid: u.uid, email: u.email, displayName: u.displayName };
        setUser(userData);
        localStorage.setItem('has_session', 'true');
        localStorage.setItem('user_session', JSON.stringify(userData));
        setLoading(false); // Make sure we set loading false here too
      } else {
        setUser(null);
        localStorage.removeItem('has_session');
        localStorage.removeItem('user_session');
        localStorage.removeItem('user_settings');
        // If we are not logged in, we are definitely done loading the auth state
        setLoading(false);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const settingsDoc = doc(db, `users/${user.uid}/settings`, 'config');
    const unsubscribe = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserSettings;
        setSettings(data);
        localStorage.setItem('user_settings', JSON.stringify(data));
        i18n.changeLanguage(data.language);
        if (data.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        setLoading(false);
      } else {
        // Initialize default settings - if offline, this will just be queued
        // but we should allow the app to load with defaults if it's the first time and offline
        setLoading(false); 
        
        setDoc(settingsDoc, {
          ...defaultSettings,
          email: user.email,
          displayName: user.displayName,
        }).catch(err => {
          // If offline, this error might be "client is offline" which we expect
          console.warn("Settings initialization pending (offline)");
        });
      }
    }, (error) => {
      // Don't treat offline as a fatal error for settings
      setLoading(false);
      if (!navigator.onLine) {
        return;
      } else {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/config`);
      }
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCategories([]);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/categories`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/categories`);
    });

    return unsubscribe;
  }, [user]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    const path = `users/${user.uid}/settings/config`;
    const settingsDoc = doc(db, path);
    try {
      await setDoc(settingsDoc, { ...settings, ...newSettings }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const toggleDarkMode = () => {
    const nextMode = !settings.darkMode;
    updateSettings({ darkMode: nextMode });
    showToast(nextMode ? i18n.t('night_mode_on') : i18n.t('day_mode_on'), 'info');
  };

  const setLanguage = (lang: 'ar' | 'en') => {
    updateSettings({ language: lang });
  };

  return (
    <AppContext.Provider value={{ 
      user, 
      loading, 
      isOffline, 
      isDataLoaded, 
      setIsDataLoaded, 
      settings, 
      updateSettings, 
      toggleDarkMode, 
      setLanguage, 
      showToast, 
      categories,
      activeSupplier,
      setActiveSupplier
    }}>
      <div className={settings.language === 'ar' ? 'rtl' : 'ltr'} dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
        {children}
        
        {/* Simple Toast Overlay */}
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-full max-w-xs px-4">
          {toasts.map(toast => (
            <div 
              key={toast.id}
              className={cn(
                "p-4 rounded-lg shadow-2xl border text-sm font-bold text-center animate-in fade-in slide-in-from-top-4 duration-300",
                toast.type === 'success' ? "bg-emerald-600 text-white border-emerald-500" : 
                toast.type === 'error' ? "bg-[#B34C36] text-white border-[#B34C36]/50" :
                "bg-brand-600 text-white border-brand-500"
              )}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
