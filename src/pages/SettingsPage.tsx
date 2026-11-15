import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Moon,
  BookOpen,
  Database,
  LayoutList,
  ChevronLeft,
  Upload,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Eye,
  Play,
  Truck,
  Check,
  Percent,
  Lock,
  FileDown,
  CloudUpload,
  Calculator,
  Sparkles,
  Palette,
  ShieldCheck,
  KeyRound,
  Monitor,
} from 'lucide-react';
import { PinSetupModal } from '../components/settings/PinSetupModal';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { uploadCloudImage } from '../lib/cloudImages';
import { getLocalImage } from '../lib/localImages';
import { CategoriesManager } from '../components/settings/CategoriesManager';
import { GuideView } from '../components/settings/GuideView';
import { DataManagement } from '../components/settings/DataManagement';
import { FOLIO_THEMES } from '../components/inventory/analytics/folio/folioThemes';
import {
  setGlobalFolioTheme,
  useFolioTheme,
} from '../components/folio/FolioPageChrome';

type View = 'main' | 'data' | 'guide' | 'categories';

export default function SettingsPage() {
  const { t } = useTranslation();
  const {
    settings,
    updateSettings,
    toggleDarkMode,
    user,
    setIsCatalogMode,
    lockApp,
    showToast,
  } = useAppContext();
  const { theme } = useFolioTheme(
    Boolean(settings.darkMode),
    settings.folioThemeId,
  );

  const [activeView, setActiveView] = useState<View>('main');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'change' | 'disable'>('setup');

  const handleTogglePin = () => {
    if (settings.appPinEnabled && settings.appPin) {
      setPinModalMode('disable');
      setIsPinModalOpen(true);
    } else {
      setPinModalMode('setup');
      setIsPinModalOpen(true);
    }
  };

  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info';
    msg: string;
  } | null>(null);

  const [isSyncingOldImages, setIsSyncingOldImages] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleSyncOldImages = async () => {
    if (!user) return;
    setIsSyncingOldImages(true);
    setSyncProgress(null);
    try {
      const productsSnapshot = await getDocs(
        collection(db, `users/${user.uid}/products`),
      );
      const productsToSync = productsSnapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        return data.hasLocalImage && !data.hasCloudImage;
      });

      if (productsToSync.length === 0) {
        setStatus({ type: 'info', msg: 'جميع الصور متزامنة بالفعل.' });
        setIsSyncingOldImages(false);
        return;
      }

      setSyncProgress({ current: 0, total: productsToSync.length });

      const batch = writeBatch(db);
      let successCount = 0;

      for (let i = 0; i < productsToSync.length; i++) {
        const docSnap = productsToSync[i];
        try {
          const blob = await getLocalImage(docSnap.id);
          if (blob) {
            await uploadCloudImage(user.uid, docSnap.id, blob);
            batch.update(docSnap.ref, { hasCloudImage: true });
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to sync image for product ${docSnap.id}:`, err);
        }
        setSyncProgress({ current: i + 1, total: productsToSync.length });
      }

      if (successCount > 0) {
        await batch.commit();
      }
      setStatus({ type: 'success', msg: `تم مزامنة ${successCount} صورة بنجاح.` });
    } catch (error) {
      console.error('Error syncing images:', error);
      setStatus({ type: 'error', msg: 'حدث خطأ أثناء مزامنة الصور.' });
    } finally {
      setIsSyncingOldImages(false);
      setSyncProgress(null);
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;

    if (deletePassword !== (settings.deleteDataPassword || '1234')) {
      setPasswordError('كلمة السر غير صحيحة');
      return;
    }

    setIsClearDataModalOpen(false);
    setDeletePassword('');
    setPasswordError('');
    setStatus({ type: 'success', msg: t('clear_data_success') });
    setIsClearing(true);

    try {
      const colNames = [
        'products',
        'suppliers',
        'debts',
        'categories',
        'transactions',
        'supplierTransactions',
        'expenses',
        'reports',
        'purchases',
        'inventories',
        'smart_list',
      ];
      for (const colName of colNames) {
        const snapshot = await getDocs(
          collection(db, `users/${user.uid}/${colName}`),
        );
        for (let i = 0; i < snapshot.docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = snapshot.docs.slice(i, i + 500);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }

      await updateSettings({ deletedCategories: [] });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: t('clear_data_error') });
    } finally {
      setIsClearing(false);
    }
  };

  const menuItems = [
    {
      id: 'guide',
      label: t('user_guide'),
      subtitle: t('learn_store_management'),
      icon: BookOpen,
    },
    {
      id: 'categories',
      label: t('manage_categories'),
      subtitle: t('add_remove_categories'),
      icon: LayoutList,
    },
    {
      id: 'data',
      label: t('data_export'),
      subtitle: t('export_import_data'),
      icon: Database,
    },
  ];

  const [tempSettings, setTempSettings] = useState({
    storeName: settings.storeName || 'مخزوني',
    currency: settings.currency || 'د.ت',
    catalogPin: settings.catalogPin || '0000',
    deleteDataPassword: settings.deleteDataPassword || '1234',
    receiptLogo: settings.receiptLogo || '',
    receiptThankYouMessage: settings.receiptThankYouMessage || '',
    receiptPolicy: settings.receiptPolicy || '',
    receiptPaperSize: settings.receiptPaperSize || '80mm',
    cycleStartDay: settings.cycleStartDay || 18,
    cycleEndDay: settings.cycleEndDay || 18,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveStoreSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings(tempSettings);
      setStatus({ type: 'success', msg: t('settings_saved_success') });
    } catch (error) {
      setStatus({ type: 'error', msg: t('settings_saved_error') });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setStatus({
          type: 'error',
          msg: 'حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 2 ميجابايت',
        });
        setTimeout(() => setStatus(null), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempSettings({
          ...tempSettings,
          receiptLogo: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  if (activeView === 'categories') {
    return <CategoriesManager onBack={() => setActiveView('main')} />;
  }

  if (activeView === 'guide') {
    return <GuideView onBack={() => setActiveView('main')} />;
  }

  if (activeView === 'data') {
    return <DataManagement onBack={() => setActiveView('main')} />;
  }

  const renderSwitch = (active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="relative h-7 w-12 border transition-colors shrink-0 cursor-pointer"
      style={{
        backgroundColor: active ? theme.accent : theme.surfaceMuted,
        borderColor: active ? theme.accent : theme.border,
      }}
    >
      <motion.div
        animate={{ x: active ? 21 : 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute left-0 top-1 h-4.5 w-4.5"
        style={{
          backgroundColor: active ? theme.surface : theme.textMuted,
        }}
      />
    </button>
  );

  return (
    <div
      dir="rtl"
      className="min-h-screen pb-24 transition-colors"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* FOLIO EDITORIAL HEADER */}
        <header
          className="border-b pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-right"
          style={{ borderColor: theme.border }}
        >
          <div className="space-y-1 min-w-0">
            <div
              className="flex items-center gap-2 text-xs font-bold"
              style={{ color: theme.textMuted }}
            >
              <span className="font-mono" style={{ color: theme.accent }}>
                FOLIO · SETTINGS
              </span>
              <span aria-hidden="true">·</span>
              <span>{t('customize_experience')}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight"
              style={{ color: theme.text }}
            >
              {t('settings')}
            </h1>
          </div>

          {/* Account Card */}
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="p-2 border flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-colors self-start sm:self-auto"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            <div className="text-left">
              <p
                className="text-[10px] font-bold leading-none mb-1"
                style={{ color: theme.textMuted }}
              >
                {t('linked_account')}
              </p>
              <p
                className="text-xs font-black truncate max-w-[140px]"
                style={{ color: theme.text }}
              >
                {user?.email || user?.phoneNumber}
              </p>
            </div>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-9 h-9 object-cover border"
                style={{ borderColor: theme.border }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-9 h-9 border flex items-center justify-center font-black text-xs"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
              >
                {(user?.email || user?.displayName || '?')[0].toUpperCase()}
              </div>
            )}
          </button>
        </header>

        {status && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 border flex items-center gap-2 text-xs font-bold"
            style={{
              backgroundColor: theme.surface,
              borderColor:
                status.type === 'success'
                  ? theme.positive
                  : status.type === 'error'
                    ? theme.negative
                    : theme.accent,
              color:
                status.type === 'success'
                  ? theme.positive
                  : status.type === 'error'
                    ? theme.negative
                    : theme.accent,
            }}
          >
            {status.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{status.msg}</span>
          </motion.div>
        )}

        {/* 01: STORE CONFIGURATION */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center gap-2 text-xs font-bold"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            }}
          >
            <span className="font-mono" style={{ color: theme.accent }}>
              01
            </span>
            <span style={{ color: theme.text }}>إعدادات المتجر والدورة المالية</span>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-bold block"
                  style={{ color: theme.textMuted }}
                >
                  {t('store_name')}
                </label>
                <input
                  type="text"
                  value={tempSettings.storeName}
                  onChange={(e) =>
                    setTempSettings((prev) => ({
                      ...prev,
                      storeName: e.target.value,
                    }))
                  }
                  placeholder={t('store_name_placeholder')}
                  className="w-full h-11 px-3 border text-sm font-bold text-center outline-none"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-bold block"
                  style={{ color: theme.textMuted }}
                >
                  {t('currency')}
                </label>
                <input
                  type="text"
                  value={tempSettings.currency}
                  onChange={(e) =>
                    setTempSettings((prev) => ({
                      ...prev,
                      currency: e.target.value,
                    }))
                  }
                  placeholder={t('currency_placeholder')}
                  className="w-full h-11 px-3 border text-sm font-bold text-center outline-none"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-bold block"
                  style={{ color: theme.textMuted }}
                >
                  {t('catalog_pin') || 'رمز وضع الكتالوج'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={tempSettings.catalogPin}
                  onChange={(e) =>
                    setTempSettings((prev) => ({
                      ...prev,
                      catalogPin: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder="0000"
                  className="w-full h-11 px-3 border text-sm font-mono font-bold text-center tracking-[0.5em] outline-none"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-bold block"
                  style={{ color: theme.textMuted }}
                >
                  كلمة سر حذف البيانات
                </label>
                <input
                  type="password"
                  value={tempSettings.deleteDataPassword}
                  onChange={(e) =>
                    setTempSettings((prev) => ({
                      ...prev,
                      deleteDataPassword: e.target.value,
                    }))
                  }
                  placeholder="****"
                  className="w-full h-11 px-3 border text-sm font-mono font-bold text-center tracking-[0.5em] outline-none"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t" style={{ borderColor: theme.border }}>
              <label
                className="text-xs font-bold block"
                style={{ color: theme.textMuted }}
              >
                تحديد الدورة المالية للحرفاء (بداية ونهاية الدورة)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span
                    className="text-[11px] font-bold block"
                    style={{ color: theme.textMuted }}
                  >
                    يوم البداية
                  </span>
                  <select
                    value={tempSettings.cycleStartDay}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        cycleStartDay: parseInt(e.target.value) || 18,
                      }))
                    }
                    className="w-full h-10 px-3 border text-xs font-bold text-center outline-none cursor-pointer"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        يوم {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span
                    className="text-[11px] font-bold block"
                    style={{ color: theme.textMuted }}
                  >
                    يوم النهاية
                  </span>
                  <select
                    value={tempSettings.cycleEndDay}
                    onChange={(e) =>
                      setTempSettings((prev) => ({
                        ...prev,
                        cycleEndDay: parseInt(e.target.value) || 18,
                      }))
                    }
                    className="w-full h-10 px-3 border text-xs font-bold text-center outline-none cursor-pointer"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        يوم {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                تبدأ الدورة من يوم {tempSettings.cycleStartDay} وتغلق يوم{' '}
                {tempSettings.cycleEndDay} من الشهر القادم.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveStoreSettings}
              disabled={isSaving}
              className="w-full h-11 border text-xs font-black flex items-center justify-center transition-opacity disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              {isSaving ? t('saving') : t('save')}
            </button>
          </div>
        </section>

        {/* 02: UNIFIED THEME & DISPLAY SETTINGS */}
        <section
          className="border text-right divide-y"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between text-xs font-bold"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono" style={{ color: theme.accent }}>
                02
              </span>
              <span style={{ color: theme.text }}>المظهر والعرض الموحد</span>
            </div>
            <span className="font-mono text-[11px]" style={{ color: theme.textMuted }}>
              {theme.name}
            </span>
          </div>

          {/* Dark Mode Toggle */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
              >
                <Moon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  {t('dark_mode')}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  {t('change_app_appearance')}
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.darkMode), toggleDarkMode)}
          </div>

          {/* Unified Folio Theme Switcher (Single source of truth for entire app) */}
          <div
            className="p-4 sm:p-5 space-y-3.5"
            style={{ backgroundColor: theme.bg, borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
              >
                <Palette size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  مظهر التطبيق الموحد (Theme)
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  اختر السمة التصميمية الموحدة التي تُطبَّق فورياً على جميع صفحات المتجر والجداول والرسومات
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {FOLIO_THEMES.map((item) => {
                const isSelected = theme.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setGlobalFolioTheme(item.id);
                      updateSettings({
                        folioThemeId: item.id,
                        darkMode: item.isDark,
                      });
                      showToast(`تم تطبيق المظهر: ${item.name}`, 'info');
                    }}
                    className="p-3 border text-right transition-colors cursor-pointer flex flex-col gap-2.5"
                    style={{
                      backgroundColor: isSelected ? theme.surface : item.surface,
                      borderColor: isSelected ? theme.accent : item.border,
                      color: item.text,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-black truncate"
                        style={{ color: item.text }}
                      >
                        {item.name}
                      </span>
                      {isSelected && (
                        <span
                          className="w-5 h-5 flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: theme.accent,
                            color: theme.surface,
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: item.textMuted }}
                      >
                        {item.isDark ? 'وضع ليلي' : 'وضع نهاري'}
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-4 h-3 border"
                          style={{ backgroundColor: item.bg, borderColor: item.border }}
                        />
                        <span
                          className="w-4 h-3 border"
                          style={{
                            backgroundColor: item.surface,
                            borderColor: item.border,
                          }}
                        />
                        <span
                          className="w-4 h-3"
                          style={{ backgroundColor: item.accent }}
                        />
                        <span
                          className="w-4 h-3"
                          style={{ backgroundColor: item.series[1] || item.positive }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sync Images Toggle */}
          <div className="p-4 space-y-3" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className="h-10 w-10 border flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black" style={{ color: theme.text }}>
                    مزامنة الصور سحابياً
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                    حفظ الصور في السحابة لتنزيلها على أجهزة أخرى
                  </p>
                </div>
              </div>
              {renderSwitch(Boolean(settings.syncImages ?? false), () =>
                updateSettings({ syncImages: !(settings.syncImages ?? false) }),
              )}
            </div>

            {(settings.syncImages ?? false) && (
              <div className="pt-3 border-t" style={{ borderColor: theme.border }}>
                <button
                  type="button"
                  onClick={handleSyncOldImages}
                  disabled={isSyncingOldImages}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.accent,
                  }}
                >
                  {isSyncingOldImages ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                      <span>
                        جاري المزامنة{' '}
                        {syncProgress
                          ? `(${syncProgress.current}/${syncProgress.total})`
                          : '...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CloudUpload size={15} />
                      <span>مزامنة الصور القديمة إلى السحابة</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Financials Toggle */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <Eye size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  {t('financial_stats')}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  {t('show_financial_data')}
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.showFinancials ?? true), () =>
              updateSettings({
                showFinancials: !(settings.showFinancials ?? true),
              }),
            )}
          </div>

          {/* Floating Totals Toggle */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <LayoutList size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  {t('show_floating_totals')}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  {t('show_floating_totals')}
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.showFloatingTotals ?? true), () =>
              updateSettings({
                showFloatingTotals: !(settings.showFloatingTotals ?? true),
              }),
            )}
          </div>

          {/* Supplier Session Button Toggle */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <Play size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  {t('show_supplier_session_button')}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  {t('show_supplier_session_button')}
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.showSupplierSessionButton ?? true), () =>
              updateSettings({
                showSupplierSessionButton: !(
                  settings.showSupplierSessionButton ?? true
                ),
              }),
            )}
          </div>
        </section>

        {/* 03: SECURITY & APP PIN */}
        <section
          className="border text-right divide-y"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between text-xs font-bold"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono" style={{ color: theme.accent }}>
                03
              </span>
              <span style={{ color: theme.text }}>حماية التطبيق (رمز PIN)</span>
            </div>
            {settings.appPinEnabled && settings.appPin && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-black"
                style={{ color: theme.positive }}
              >
                <ShieldCheck size={13} />
                <span>مفعل</span>
              </span>
            )}
          </div>

          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color:
                    settings.appPinEnabled && settings.appPin
                      ? theme.accent
                      : theme.textMuted,
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  قفل التطبيق برمز سري (4 أرقام)
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  طلب رمز PIN المكون من 4 أرقام عند فتح التطبيق لحماية الخصوصية
                </p>
              </div>
            </div>
            {renderSwitch(
              Boolean(settings.appPinEnabled && settings.appPin),
              handleTogglePin,
            )}
          </div>

          {settings.appPinEnabled && settings.appPin && (
            <div
              className="p-4 space-y-3"
              style={{ backgroundColor: theme.bg, borderColor: theme.border }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinModalMode('change');
                    setIsPinModalOpen(true);
                  }}
                  className="flex-1 min-w-[140px] h-10 px-3 border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <KeyRound size={15} />
                  <span>تغيير الرمز السري</span>
                </button>

                <button
                  type="button"
                  onClick={lockApp}
                  className="flex-1 min-w-[140px] h-10 px-3 border text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: theme.text,
                    color: theme.surface,
                    borderColor: theme.text,
                  }}
                >
                  <Lock size={15} />
                  <span>قفل التطبيق الآن</span>
                </button>
              </div>

              <div className="pt-2 border-t space-y-1.5" style={{ borderColor: theme.border }}>
                <label
                  className="text-[11px] font-bold block"
                  style={{ color: theme.textMuted }}
                >
                  القفل التلقائي عند الخمول:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" dir="rtl">
                  {[
                    { value: 0, label: 'عند الفتح فقط' },
                    { value: 1, label: 'بعد دقيقة' },
                    { value: 5, label: 'بعد 5 دقائق' },
                    { value: 15, label: 'بعد 15 دقيقة' },
                  ].map((opt) => {
                    const active = (settings.autoLockTimeout ?? 0) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          updateSettings({ autoLockTimeout: opt.value })
                        }
                        className="h-9 px-2 border text-[11px] font-bold transition-colors cursor-pointer"
                        style={
                          active
                            ? {
                                backgroundColor: theme.text,
                                color: theme.surface,
                                borderColor: theme.text,
                              }
                            : {
                                backgroundColor: theme.surface,
                                color: theme.text,
                                borderColor: theme.border,
                              }
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 04: APPLICATION CONFIGURATION */}
        <section
          className="border text-right divide-y"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 flex items-center gap-2 text-xs font-bold"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            }}
          >
            <span className="font-mono" style={{ color: theme.accent }}>
              04
            </span>
            <span style={{ color: theme.text }}>إعدادات التشغيل والعمليات</span>
          </div>

          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  التدقيق الذكي للأسعار والتنبيهات
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  كشف أخطاء خلط سعر العلبة بالقطعة، البيع بخسارة، واقتراح التصحيح الفوري
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.enablePriceAudit ?? true), () =>
              updateSettings({
                enablePriceAudit: !(settings.enablePriceAudit ?? true),
              }),
            )}
          </div>

          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <Calculator size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  نظام المبيعات (POS)
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  تفعيل واجهة إنشاء فواتير المبيعات
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.enablePOS ?? false), () =>
              updateSettings({ enablePOS: !(settings.enablePOS ?? false) }),
            )}
          </div>

          <AnimatePresence>
            {(settings.enablePOS ?? false) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden divide-y"
                style={{ borderColor: theme.border }}
              >
                <div
                  className="flex items-center justify-between p-4"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="h-10 w-10 border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.textMuted,
                      }}
                    >
                      <Database size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black" style={{ color: theme.text }}>
                        خصم من المخزون
                      </h3>
                      <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                        خصم كميات الفاتورة من مخزون المنتجات
                      </p>
                    </div>
                  </div>
                  {renderSwitch(Boolean(settings.posDeductInventory ?? false), () =>
                    updateSettings({
                      posDeductInventory: !(settings.posDeductInventory ?? false),
                    }),
                  )}
                </div>

                <div
                  className="flex items-center justify-between p-4"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="h-10 w-10 border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        color: theme.textMuted,
                      }}
                    >
                      <Monitor size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black" style={{ color: theme.text }}>
                        إظهار زر مخزون الكاشير
                      </h3>
                      <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                        عرض زر مخزون الكاشير في صفحة المنتجات
                      </p>
                    </div>
                  </div>
                  {renderSwitch(
                    Boolean(settings.showCashierStockButton ?? true),
                    () =>
                      updateSettings({
                        showCashierStockButton: !(
                          settings.showCashierStockButton ?? true
                        ),
                      }),
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <FileDown size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  تقارير العمليات
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  طباعة تقارير المشتريات والموردين بصيغة PDF
                </p>
              </div>
            </div>
            {renderSwitch(
              Boolean(settings.enablePurchasesReports ?? false),
              () =>
                updateSettings({
                  enablePurchasesReports: !(
                    settings.enablePurchasesReports ?? false
                  ),
                }),
            )}
          </div>

          <div
            className="flex items-center justify-between p-4"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <Truck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  إلزامية حصة المورد
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  إلزام فتح حصة مورد قبل إضافة كميات للمخزون
                </p>
              </div>
            </div>
            {renderSwitch(Boolean(settings.requireSupplierSession ?? false), () =>
              updateSettings({
                requireSupplierSession: !(
                  settings.requireSupplierSession ?? false
                ),
              }),
            )}
          </div>

          <div className="p-4 space-y-3" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.textMuted,
                }}
              >
                <Percent size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.text }}>
                  {t('profit_calculation_method')}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  {t('profit_calc_desc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'markup', label: t('profit_calc_markup') },
                { id: 'margin', label: t('profit_calc_margin') },
              ].map((m) => {
                const active =
                  (settings.profitCalculationMethod || 'markup') === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        profitCalculationMethod: m.id as 'markup' | 'margin',
                      })
                    }
                    className="py-2.5 border text-xs font-bold transition-colors cursor-pointer"
                    style={
                      active
                        ? {
                            backgroundColor: theme.text,
                            color: theme.surface,
                            borderColor: theme.text,
                          }
                        : {
                            backgroundColor: theme.bg,
                            color: theme.text,
                            borderColor: theme.border,
                          }
                    }
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 05: RECEIPT CUSTOMIZATION */}
        <section
          className="border text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 border-b flex items-center gap-2 text-xs font-bold"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            }}
          >
            <span className="font-mono" style={{ color: theme.accent }}>
              05
            </span>
            <span style={{ color: theme.text }}>تخصيص الفاتورة المطبوعة</span>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <label
                className="text-xs font-bold block"
                style={{ color: theme.textMuted }}
              >
                عرض ورق الفاتورة المطبوعة
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '80mm', label: '80 ملم (قياسي / طابعة مكتبية)' },
                  { id: '58mm', label: '58 ملم (صغير / طابعة محمولة)' },
                ].map((paper) => {
                  const active = tempSettings.receiptPaperSize === paper.id;
                  return (
                    <button
                      key={paper.id}
                      type="button"
                      onClick={() =>
                        setTempSettings({
                          ...tempSettings,
                          receiptPaperSize: paper.id as '80mm' | '58mm',
                        })
                      }
                      className="py-2.5 px-3 border text-xs font-bold transition-colors cursor-pointer"
                      style={
                        active
                          ? {
                              backgroundColor: theme.text,
                              color: theme.surface,
                              borderColor: theme.text,
                            }
                          : {
                              backgroundColor: theme.bg,
                              color: theme.text,
                              borderColor: theme.border,
                            }
                      }
                    >
                      {paper.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-bold block"
                style={{ color: theme.textMuted }}
              >
                رسالة الشكر (تظهر أسفل الفاتورة)
              </label>
              <input
                type="text"
                value={tempSettings.receiptThankYouMessage ?? ''}
                onChange={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    receiptThankYouMessage: e.target.value,
                  })
                }
                placeholder="مثال: شكراً لثقتكم بنا، نتمنى لكم يوماً سعيداً"
                className="w-full text-right border px-3.5 py-2.5 text-sm outline-none"
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-bold block"
                style={{ color: theme.textMuted }}
              >
                سياسة الاسترجاع أو ملاحظات إضافية
              </label>
              <textarea
                value={tempSettings.receiptPolicy ?? ''}
                onChange={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    receiptPolicy: e.target.value,
                  })
                }
                placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام..."
                rows={3}
                className="w-full text-right border px-3.5 py-2.5 text-sm outline-none resize-none"
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-xs font-bold block"
                style={{ color: theme.textMuted }}
              >
                شعار المتجر في الفاتورة (اختياري)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempSettings.receiptLogo ?? ''}
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      receiptLogo: e.target.value,
                    })
                  }
                  placeholder="رابط الصورة (أو ارفع من الجهاز)"
                  className="w-full text-left border px-3.5 py-2.5 text-sm outline-none font-mono"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                  dir="ltr"
                />
                <label
                  className="flex-shrink-0 flex items-center justify-center border px-4 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.accent,
                  }}
                  title="رفع صورة من الجهاز"
                >
                  <Upload size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
              {tempSettings.receiptLogo && (
                <div
                  className="mt-2 relative p-3 border flex justify-center group"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <img
                    src={tempSettings.receiptLogo}
                    alt="Logo preview"
                    className="max-h-20 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://placehold.co/150x80?text=Invalid+Image';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTempSettings({ ...tempSettings, receiptLogo: '' })
                    }
                    className="absolute top-2 right-2 border p-1.5 cursor-pointer"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.negative,
                    }}
                    title="إزالة الشعار"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveStoreSettings}
              disabled={isSaving}
              className="w-full py-3 border text-xs font-black flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: theme.text,
                color: theme.surface,
                borderColor: theme.text,
              }}
            >
              {isSaving ? (
                <span className="animate-spin text-base">↻</span>
              ) : (
                <Check size={16} />
              )}
              <span>حفظ إعدادات الفاتورة</span>
            </button>
          </div>
        </section>

        {/* 06: ACTIONS & TOOLS */}
        <section
          className="border text-right divide-y"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="px-4 py-2.5 flex items-center gap-2 text-xs font-bold"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            }}
          >
            <span className="font-mono" style={{ color: theme.accent }}>
              06
            </span>
            <span style={{ color: theme.text }}>إجراءات وأدوات النظام</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCatalogMode(true)}
            className="w-full flex items-center justify-between p-4 text-right transition-colors cursor-pointer"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="h-10 w-10 border flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
              >
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black" style={{ color: theme.accent }}>
                  {t('enter_catalog_mode') || 'الدخول لوضع الكتالوج'}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                  {t('catalog_mode_desc') || 'يعرض المنتجات والأسعار للعملاء'}
                </p>
              </div>
            </div>
            <ChevronLeft size={16} style={{ color: theme.textMuted }} />
          </button>

          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id as View)}
              className="w-full flex items-center justify-between p-4 text-right transition-colors cursor-pointer"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="h-10 w-10 border flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.textMuted,
                  }}
                >
                  <item.icon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black" style={{ color: theme.text }}>
                    {item.label}
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                    {item.subtitle}
                  </p>
                </div>
              </div>
              <ChevronLeft size={16} style={{ color: theme.textMuted }} />
            </button>
          ))}
        </section>

        {/* DANGER ZONE */}
        <button
          type="button"
          onClick={() => setIsClearDataModalOpen(true)}
          className="w-full flex items-center justify-between p-5 border font-black transition-opacity active:scale-[0.99] cursor-pointer"
          style={{
            backgroundColor: theme.negative,
            borderColor: theme.negative,
            color: theme.surface,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="h-11 w-11 border flex items-center justify-center"
              style={{ borderColor: 'rgba(255,255,255,0.35)' }}
            >
              <Trash2 size={20} />
            </div>
            <div className="text-right">
              <h3 className="text-base font-black">{t('clear_store_data')}</h3>
              <p className="text-xs opacity-80 mt-0.5">{t('delete_all_data')}</p>
            </div>
          </div>
          <ChevronLeft size={18} />
        </button>

        {/* CLEAN FOLIO FOOTER (NO ANIMATED DOT / NO PILL) */}
        <div className="text-center pt-4">
          <span
            className="inline-block px-3.5 py-1.5 border text-xs font-mono font-bold"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
          >
            الإصدار {__APP_VERSION__} · مخزوني
          </span>
        </div>
      </div>

      {/* Clear All Data Modal */}
      <AnimatePresence>
        {isClearDataModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClearDataModalOpen(false)}
              className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-xs border p-6 text-center shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <p className="text-xs font-bold mb-4 leading-relaxed">
                {t('confirm_clear_all_data_desc')}{' '}
                <span style={{ color: theme.negative }}>
                  {t('irreversible_action')}
                </span>
              </p>

              <div className="mb-5">
                <input
                  type="password"
                  placeholder="أدخل كلمة السر لتأكيد الحذف"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setPasswordError('');
                  }}
                  className="w-full text-center px-3 py-2.5 border text-sm font-bold outline-none"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                />
                {passwordError && (
                  <p
                    className="text-xs font-bold mt-2"
                    style={{ color: theme.negative }}
                  >
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAllData}
                  disabled={isClearing}
                  className="flex-1 py-2.5 border font-black text-xs disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: theme.negative,
                    borderColor: theme.negative,
                    color: theme.surface,
                  }}
                >
                  {t('confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsClearDataModalOpen(false);
                    setDeletePassword('');
                    setPasswordError('');
                  }}
                  disabled={isClearing}
                  className="flex-1 py-2.5 border text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logout Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute inset-0 bg-black/55 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-xs border p-6 text-center shadow-2xl"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              <div className="mb-4 pt-1">
                <p
                  className="text-[10px] font-black mb-1"
                  style={{ color: theme.textMuted }}
                >
                  {t('current_account')}
                </p>
                <p className="text-xs font-black truncate">
                  {user?.email || user?.phoneNumber}
                </p>
              </div>

              <p className="text-xs font-bold mb-5 leading-relaxed">
                {t('confirm_logout_desc')}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => auth.signOut()}
                  className="flex-1 py-2.5 border font-black text-xs cursor-pointer"
                  style={{
                    backgroundColor: theme.negative,
                    borderColor: theme.negative,
                    color: theme.surface,
                  }}
                >
                  {t('confirm_logout')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-2.5 border text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Setup & Change Modal */}
      <PinSetupModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        mode={pinModalMode}
      />
    </div>
  );
}
