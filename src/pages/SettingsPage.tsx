import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Moon, 
  Wallet, 
  BookOpen, 
  Database, 
  LayoutList, 
  LogOut,
  ChevronLeft,
  Download,
  Upload,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  FileJson,
  ArrowRight,
  Plus,
  Trash2,
  Package,
  Eye,
  Play,
  Coffee,
  Truck,
  Apple,
  Milk,
  Beef,
  Cookie,
  Fish,
  Pizza,
  GlassWater,
  Cherry,
  Candy,
  IceCream,
  Grape,
  Banana,
  Carrot,
  Nut,
  Cigarette,
  Zap,
  Heart,
  Home,
  ShoppingBag,
  Printer,
  Monitor,
  Smartphone,
  Check,
  Percent,
  Lock,
  Grid,
  FileDown,
  CloudUpload,
  Calculator
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';
import { uploadCloudImage } from '../lib/cloudImages';
import { getLocalImage } from '../lib/localImages';

type View = 'main' | 'data' | 'guide' | 'categories';
import { useCategories } from '../hooks/useCategories';
import { CategoriesManager } from '../components/settings/CategoriesManager';
import { GuideView } from '../components/settings/GuideView';
import { DataManagement } from '../components/settings/DataManagement';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateSettings, toggleDarkMode, setLanguage, user, setIsCatalogMode } = useAppContext();
  const [activeView, setActiveView] = useState<View>('main');
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  const [isSyncingOldImages, setIsSyncingOldImages] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number, total: number } | null>(null);

  const handleSyncOldImages = async () => {
    if (!user) return;
    setIsSyncingOldImages(true);
    setSyncProgress(null);
    try {
      const productsSnapshot = await getDocs(collection(db, `users/${user.uid}/products`));
      const productsToSync = productsSnapshot.docs.filter(doc => {
        const data = doc.data();
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

    setIsClearDataModalOpen(false); // Close first so UI is unblocked
    setDeletePassword('');
    setPasswordError('');
    setStatus({ type: 'success', msg: t('clear_data_success') }); // Optimistically show success
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
        'smart_list'
      ];
      for (const colName of colNames) {
        let snapshot = await getDocs(collection(db, `users/${user.uid}/${colName}`));
        // Firestore batch max is 500, simple approach for client
        for(let i = 0; i < snapshot.docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = snapshot.docs.slice(i, i + 500);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
      }
      
      // Also clear settings locally
      await updateSettings({ deletedCategories: [] });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: t('clear_data_error') });
    } finally {
      setIsClearing(false);
    }
  };

  const menuItems = [
    { id: 'guide', label: t('user_guide'), subtitle: t('learn_store_management'), icon: BookOpen, color: 'text-brand-500' },
    { id: 'categories', label: t('manage_categories'), subtitle: t('add_remove_categories'), icon: LayoutList, color: 'text-zinc-500' },
    { id: 'data', label: t('data_export'), subtitle: t('export_import_data'), icon: Database, color: 'text-zinc-500' },
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
      if (file.size > 2 * 1024 * 1024) { // 2MB max
        setStatus({ type: 'error', msg: 'حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 2 ميجابايت' });
        setTimeout(() => setStatus(null), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempSettings({ ...tempSettings, receiptLogo: reader.result as string });
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

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="text-right">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('settings')}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">{t('customize_experience')}</p>
        </div>

        {/* Account Card */}
        <div 
          onClick={() => setIsLogoutModalOpen(true)}
          className="p-2 rounded-lg bg-white border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm flex items-center gap-3 cursor-pointer active:scale-95 transition-all"
        >
          <div className="text-left">
            <p className="text-[9px] text-zinc-400 font-bold mb-0.5 leading-none uppercase">{t('linked_account')}</p>
            <p className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 truncate max-w-[100px]">
              {user?.email || user?.phoneNumber}
            </p>
          </div>
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt="Profile" 
              className="w-10 h-10 rounded-lg object-cover border-2 border-brand-50"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-xs border-2 border-brand-50 dark:border-brand-900/50">
              {(user?.email || user?.displayName || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {/* Store Settings Form */}
        <section className="p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-6">
          {status && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg flex items-center gap-2 text-xs font-bold ${
                status.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' 
                  : status.type === 'info'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={16} /> : status.type === 'info' ? <AlertCircle size={16} /> : <AlertCircle size={16} />}
              {status.msg}
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">{t('store_name')}</label>
              <input 
                type="text"
                value={tempSettings.storeName}
                onChange={(e) => setTempSettings(prev => ({ ...prev, storeName: e.target.value }))}
                placeholder={t('store_name_placeholder')}
                className="w-full h-12 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center"
              />
            </div>            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">{t('currency')}</label>
              <input 
                type="text" 
                value={tempSettings.currency}
                onChange={(e) => setTempSettings(prev => ({ ...prev, currency: e.target.value }))}
                placeholder={t('currency_placeholder')}
                className="w-full h-12 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">{t('catalog_pin') || 'رمز وضع الكتالوج'}</label>
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={tempSettings.catalogPin}
                onChange={(e) => setTempSettings(prev => ({ ...prev, catalogPin: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="0000"
                className="w-full h-12 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center tracking-[0.5em]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">كلمة سر حذف البيانات</label>
              <input 
                type="password"
                value={tempSettings.deleteDataPassword}
                onChange={(e) => setTempSettings(prev => ({ ...prev, deleteDataPassword: e.target.value }))}
                placeholder="****"
                className="w-full h-12 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center tracking-[0.5em]"
              />
            </div>
          </div>

          <button 
            onClick={handleSaveStoreSettings}
            disabled={isSaving}
            className="w-full h-14 rounded-lg bg-brand-600 text-white font-black shadow-lg shadow-brand-500/20 flex items-center justify-center transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? t('saving') : t('save')}
          </button>
        </section>

        {/* Display / UI Settings Group */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 text-right">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">المظهر والعرض</h3>
          </div>
          
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <Moon size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t('dark_mode')}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('change_app_appearance')}</p>
              </div>
            </div>
            <button 
              onClick={toggleDarkMode}
              className={`relative h-7 w-12 rounded-full transition-colors ${settings.darkMode ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: settings.darkMode ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>

          {/* Sync Images Toggle */}
          <div className="flex flex-col p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                  <Database size={20} />
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">مزامنة الصور سحابياً</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">حفظ الصور في السحابة لتنزيلها على أجهزة أخرى</p>
                </div>
              </div>
              <button 
                onClick={() => updateSettings({ syncImages: !(settings.syncImages ?? false) })}
                className={`relative h-7 w-12 rounded-full transition-colors ${(settings.syncImages ?? false) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
              >
                <motion.div 
                  animate={{ x: (settings.syncImages ?? false) ? 20 : 4 }}
                  className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>
            
            {/* Bulk Sync Button */}
            {(settings.syncImages ?? false) && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                <button
                  onClick={handleSyncOldImages}
                  disabled={isSyncingOldImages}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 text-brand-600 dark:text-brand-400 rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50"
                >
                  {isSyncingOldImages ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current rounded-full border-t-transparent animate-spin" />
                      <span>
                        جاري المزامنة {syncProgress ? `(${syncProgress.current}/${syncProgress.total})` : '...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CloudUpload size={16} />
                      <span>مزامنة الصور القديمة إلى السحابة</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Financials Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <Eye size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t('financial_stats')}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('show_financial_data')}</p>
              </div>
            </div>
            <button 
              onClick={() => updateSettings({ showFinancials: !(settings.showFinancials ?? true) })}
              className={`relative h-7 w-12 rounded-full transition-colors ${(settings.showFinancials ?? true) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: (settings.showFinancials ?? true) ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>

          {/* Floating Totals Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <LayoutList size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t('show_floating_totals')}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('show_floating_totals')}</p>
              </div>
            </div>
            <button 
              onClick={() => updateSettings({ showFloatingTotals: !(settings.showFloatingTotals ?? true) })}
              className={`relative h-7 w-12 rounded-full transition-colors ${(settings.showFloatingTotals ?? true) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: (settings.showFloatingTotals ?? true) ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>

          {/* Supplier Session Button Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <Play size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t('show_supplier_session_button')}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('show_supplier_session_button')}</p>
              </div>
            </div>
            <button 
              onClick={() => updateSettings({ showSupplierSessionButton: !(settings.showSupplierSessionButton ?? true) })}
              className={`relative h-7 w-12 rounded-full transition-colors ${(settings.showSupplierSessionButton ?? true) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: (settings.showSupplierSessionButton ?? true) ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
        </div>

        {/* Application Config Group */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 text-right">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">إعدادات التطبيق</h3>
          </div>

          {/* Enable POS Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <Calculator size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">نظام المبيعات (POS)</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">تفعيل واجهة إنشاء فواتير المبيعات</p>
              </div>
            </div>
            <button 
              onClick={() => updateSettings({ enablePOS: !(settings.enablePOS ?? false) })}
              className={`relative h-7 w-12 rounded-full transition-colors ${(settings.enablePOS ?? false) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: (settings.enablePOS ?? false) ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>

          {/* POS Deduct Inventory Toggle */}
          <AnimatePresence>
            {(settings.enablePOS ?? false) && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-100 dark:border-zinc-800">
                      <Database size={20} />
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">خصم من المخزون</h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">خصم كميات الفاتورة من مخزون المنتجات</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateSettings({ posDeductInventory: !(settings.posDeductInventory ?? false) })}
                    className={`relative h-7 w-12 rounded-full transition-colors ${(settings.posDeductInventory ?? false) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                  >
                    <motion.div 
                      animate={{ x: (settings.posDeductInventory ?? false) ? 20 : 4 }}
                      className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Purchases Reports Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <FileDown size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">تقارير العمليات</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">طباعة تقارير المشتريات والموردين بصيغة PDF</p>
              </div>
            </div>
            <button 
              onClick={() => updateSettings({ enablePurchasesReports: !(settings.enablePurchasesReports ?? false) })}
              className={`relative h-7 w-12 rounded-full transition-colors ${(settings.enablePurchasesReports ?? false) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: (settings.enablePurchasesReports ?? false) ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>

          {/* Require Supplier Session Toggle */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <Truck size={20} />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">إلزامية حصة المورد</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">إلزام فتح حصة مورد قبل إضافة كميات للمخزون</p>
              </div>
            </div>
            <button 
              onClick={() => updateSettings({ requireSupplierSession: !(settings.requireSupplierSession ?? false) })}
              className={`relative h-7 w-12 rounded-full transition-colors ${(settings.requireSupplierSession ?? false) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: (settings.requireSupplierSession ?? false) ? 20 : 4 }}
                className="absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>

          {/* Profit Calculation Method Toggle */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                  <Percent size={20} />
                </div>
                <div className="text-right flex-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{t('profit_calculation_method')}</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{t('profit_calc_desc')}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full bg-zinc-50 dark:bg-zinc-900/50 p-1 rounded-lg">
              <button
                onClick={() => updateSettings({ profitCalculationMethod: 'markup' })}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                  (settings.profitCalculationMethod || 'markup') === 'markup' 
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-800 dark:text-white' 
                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                }`}
              >
                {t('profit_calc_markup')}
              </button>
              <button
                onClick={() => updateSettings({ profitCalculationMethod: 'margin' })}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                  settings.profitCalculationMethod === 'margin' 
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-800 dark:text-white' 
                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                }`}
              >
                {t('profit_calc_margin')}
              </button>
            </div>
          </div>
        </div>

        {/* Invoice Customization Group */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 text-right">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">تخصيص الفاتورة المطبوعة</h3>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">عرض ورق الفاتورة المطبوعة</label>
              <div className="flex gap-2 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setTempSettings({ ...tempSettings, receiptPaperSize: '80mm' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    tempSettings.receiptPaperSize === '80mm' 
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-900 dark:text-white' 
                      : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  80 ملم (قياسي / طابعة مكتبية)
                </button>
                <button
                  type="button"
                  onClick={() => setTempSettings({ ...tempSettings, receiptPaperSize: '58mm' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    tempSettings.receiptPaperSize === '58mm' 
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-900 dark:text-white' 
                      : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  58 ملم (صغير / طابعة محمولة)
                </button>
              </div>
            </div>

            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">رسالة الشكر (تظهر أسفل الفاتورة)</label>
              <input 
                type="text" 
                value={tempSettings.receiptThankYouMessage ?? ''}
                onChange={(e) => setTempSettings({ ...tempSettings, receiptThankYouMessage: e.target.value })}
                placeholder="مثال: شكراً لثقتكم بنا، نتمنى لكم يوماً سعيداً"
                className="w-full text-right bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
              />
            </div>

            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">سياسة الاسترجاع أو ملاحظات إضافية</label>
              <textarea 
                value={tempSettings.receiptPolicy ?? ''}
                onChange={(e) => setTempSettings({ ...tempSettings, receiptPolicy: e.target.value })}
                placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام..."
                rows={3}
                className="w-full text-right bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
              />
            </div>
            
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">شعار المتجر في الفاتورة (اختياري)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={tempSettings.receiptLogo ?? ''}
                  onChange={(e) => setTempSettings({ ...tempSettings, receiptLogo: e.target.value })}
                  placeholder="رابط الصورة (أو ارفع من الجهاز)"
                  className="w-full text-left bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  dir="ltr"
                />
                <label className="flex-shrink-0 flex items-center justify-center bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-xl px-4 cursor-pointer transition-colors dark:bg-brand-500/10 dark:hover:bg-brand-500/20" title="رفع صورة من الجهاز">
                  <Upload size={20} />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
              {tempSettings.receiptLogo && (
                <div className="mt-2 relative p-2 border border-zinc-100 rounded-lg flex justify-center bg-white dark:bg-zinc-800 dark:border-zinc-700 group">
                  <img src={tempSettings.receiptLogo} alt="Logo preview" className="max-h-20 object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/150x80?text=Invalid+Image' }} />
                  <button 
                    onClick={() => setTempSettings({ ...tempSettings, receiptLogo: '' })}
                    className="absolute top-1 right-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity dark:bg-red-500/10 dark:hover:bg-red-500/20"
                    title="إزالة الشعار"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSaveStoreSettings}
              disabled={isSaving}
              className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? <span className="animate-spin text-xl">↻</span> : <Check size={20} />}
              <span>حفظ إعدادات الفاتورة</span>
            </button>
          </div>
        </div>

        {/* Actions / Menu Items Group */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 text-right">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">إجراءات وأدوات</h3>
          </div>

          {/* Catalog Mode Entry */}
          <button
            onClick={() => setIsCatalogMode(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-right"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center dark:bg-brand-900/30 dark:text-brand-400">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-600 dark:text-brand-400">{t('enter_catalog_mode') || 'الدخول لوضع الكتالوج'}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t('catalog_mode_desc') || 'يعرض المنتجات والأسعار للعملاء'}</p>
              </div>
            </div>
            <ChevronLeft className="text-zinc-400" size={18} />
          </button>

          {/* Other menu items */}
          {menuItems.map((item, idx) => (
            <button 
              key={`menu-${item.id}-${idx}`} 
              onClick={() => setActiveView(item.id as View)}
              className="group w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-right"
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${item.color}`}>
                  <item.icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{item.label}</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{item.subtitle}</p>
                </div>
              </div>
              <ChevronLeft className="text-zinc-400 group-hover:text-brand-500 transition-transform group-hover:-translate-x-1" size={18} />
            </button>
          ))}
        </div>

        {/* Danger Zone Group */}
        <button 
          onClick={() => setIsClearDataModalOpen(true)}
          className="w-full flex items-center justify-between p-6 rounded-lg text-white font-bold transition-all shadow-lg shadow-[#B34C36]/20 active:scale-95 mt-8"
          style={{ backgroundColor: '#B34C36' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <Trash2 size={24} />
            </div>
            <div className="text-right">
              <h3 className="text-lg font-bold">{t('clear_store_data')}</h3>
              <p className="text-xs text-white/70 mt-0.5">{t('delete_all_data')}</p>
            </div>
          </div>
          <ChevronLeft className="text-white/60" size={20} />
        </button>
      </div>

      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 text-brand-600 text-xs font-bold dark:bg-brand-950/20 dark:text-brand-400">
          <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
          الإصدار {__APP_VERSION__} • مخزوني
        </div>
      </div>

      <AnimatePresence>
        {isClearDataModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsClearDataModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-4 leading-relaxed">
                {t('confirm_clear_all_data_desc')} <span className="text-[#B34C36]">{t('irreversible_action')}</span>
              </p>
              
              <div className="mb-6">
                <input 
                  type="password"
                  placeholder="أدخل كلمة السر لتأكيد الحذف"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setPasswordError('');
                  }}
                  className="w-full text-center px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B34C36]"
                />
                {passwordError && (
                  <p className="text-[#B34C36] text-xs font-bold mt-2">{passwordError}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleClearAllData}
                  disabled={isClearing}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => {
                    setIsClearDataModalOpen(false);
                    setDeletePassword('');
                    setPasswordError('');
                  }}
                  disabled={isClearing}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLogoutModalOpen(false)} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative w-full max-w-[280px] rounded-lg bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <div className="mb-4 pt-2">
                <p className="text-[10px] font-black text-zinc-400 mb-0.5 uppercase tracking-wider">{t('current_account')}</p>
                <p className="text-xs font-black text-zinc-900 dark:text-white truncate">{user?.email || user?.phoneNumber}</p>
              </div>

              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_logout_desc')}
              </p>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => auth.signOut()}
                  className="flex-1 py-2.5 rounded-lg font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px]"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm_logout')}
                </button>
                <button 
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-[12px] font-bold active:scale-95 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
