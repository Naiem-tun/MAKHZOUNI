import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { OperationType, UserSettings } from './types';
import { handleFirestoreError } from './lib/utils';
import i18n from './lib/i18n';

interface AppContextType {
  user: User | null;
  loading: boolean;
  isOffline: boolean;
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  toggleDarkMode: () => void;
  setLanguage: (lang: 'ar' | 'en') => void;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
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
      if (!navigator.onLine) {
        setLoading(false);
      } else {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/config`);
        setLoading(false);
      }
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
    updateSettings({ darkMode: !settings.darkMode });
  };

  const setLanguage = (lang: 'ar' | 'en') => {
    updateSettings({ language: lang });
  };

  return (
    <AppContext.Provider value={{ user, loading, isOffline, settings, updateSettings, toggleDarkMode, setLanguage }}>
      <div className={settings.language === 'ar' ? 'rtl' : 'ltr'} dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
        {children}
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
