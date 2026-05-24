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
  Percent
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

type View = 'main' | 'data' | 'guide' | 'categories';
import { useCategories } from '../hooks/useCategories';
import { CategoriesManager } from '../components/settings/CategoriesManager';
import { GuideView } from '../components/settings/GuideView';
import { DataManagement } from '../components/settings/DataManagement';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateSettings, toggleDarkMode, setLanguage, user } = useAppContext();
  const [activeView, setActiveView] = useState<View>('main');
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const handleClearAllData = async () => {
    if (!user) return;
    setIsClearDataModalOpen(false); // Close first so UI is unblocked
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
              className={`p-3 rounded-lg flex items-center gap-2 text-xs font-bold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}
            >
              {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
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
          </div>

          <button 
            onClick={handleSaveStoreSettings}
            disabled={isSaving}
            className="w-full h-14 rounded-lg bg-brand-600 text-white font-black shadow-lg shadow-brand-500/20 flex items-center justify-center transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? t('saving') : t('save')}
          </button>
        </section>

        {/* Dark Mode Toggle */}
        <section className="flex items-center justify-between p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
              <Moon size={24} />
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">{t('change_app_appearance')}</p>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('dark_mode')}</h3>
            </div>
          </div>
          <button 
            onClick={toggleDarkMode}
            className={`relative h-8 w-14 rounded-full transition-colors ${settings.darkMode ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          >
            <motion.div 
              animate={{ x: settings.darkMode ? 24 : 4 }}
              className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow-sm"
            />
          </button>
        </section>

        {/* Financials Toggle */}
        <section className="flex items-center justify-between p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
              <Eye size={24} />
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">{t('show_financial_data')}</p>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('financial_stats')}</h3>
            </div>
          </div>
          <button 
            onClick={() => updateSettings({ showFinancials: !(settings.showFinancials ?? true) })}
            className={`relative h-8 w-14 rounded-full transition-colors ${(settings.showFinancials ?? true) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          >
            <motion.div 
              animate={{ x: (settings.showFinancials ?? true) ? 24 : 4 }}
              className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow-sm"
            />
          </button>
        </section>

        {/* Floating Totals Toggle */}
        <section className="flex items-center justify-between p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
              <Eye size={24} />
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">{t('show_floating_totals')}</p>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('show_floating_totals')}</h3>
            </div>
          </div>
          <button 
            onClick={() => updateSettings({ showFloatingTotals: !(settings.showFloatingTotals ?? true) })}
            className={`relative h-8 w-14 rounded-full transition-colors ${(settings.showFloatingTotals ?? true) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          >
            <motion.div 
              animate={{ x: (settings.showFloatingTotals ?? true) ? 24 : 4 }}
              className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow-sm"
            />
          </button>
        </section>

        {/* Profit Calculation Method Toggle */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-zinc-100 flex flex-col gap-4 dark:bg-zinc-800/50 dark:border-zinc-800">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
                <Percent size={24} />
              </div>
              <div className="text-right flex-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('profit_calculation_method')}</h3>
                <p className="text-xs text-zinc-400 mt-1">{t('profit_calc_desc')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full mt-2 bg-zinc-50 dark:bg-zinc-900/50 p-1 rounded-lg">
            <button
              onClick={() => updateSettings({ profitCalculationMethod: 'markup' })}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
                (settings.profitCalculationMethod || 'markup') === 'markup' 
                  ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-800 dark:text-white' 
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              }`}
            >
              {t('profit_calc_markup')}
            </button>
            <button
              onClick={() => updateSettings({ profitCalculationMethod: 'margin' })}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
                settings.profitCalculationMethod === 'margin' 
                  ? 'bg-white text-brand-600 shadow-sm dark:bg-zinc-800 dark:text-white' 
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              }`}
            >
              {t('profit_calc_margin')}
            </button>
          </div>
        </section>

        {/* Supplier Session Button Toggle */}
        <section className="flex items-center justify-between p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
              <Play size={24} />
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">{t('show_supplier_session_button')}</p>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('show_supplier_session_button')}</h3>
            </div>
          </div>
          <button 
            onClick={() => updateSettings({ showSupplierSessionButton: !(settings.showSupplierSessionButton ?? true) })}
            className={`relative h-8 w-14 rounded-full transition-colors ${(settings.showSupplierSessionButton ?? true) ? 'bg-brand-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          >
            <motion.div 
              animate={{ x: (settings.showSupplierSessionButton ?? true) ? 24 : 4 }}
              className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow-sm"
            />
          </button>
        </section>

        {/* Other menu items */}
        {menuItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => setActiveView(item.id as View)}
            className="group w-full flex items-center justify-between p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${item.color}`}>
                <item.icon size={24} />
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">{item.subtitle}</p>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{item.label}</h3>
              </div>
            </div>
            <ChevronLeft className="text-zinc-400 group-hover:text-brand-500 transition-transform group-hover:-translate-x-1" />
          </button>
        ))}

        {/* Developer Tool: Generate Mock data */}
        <button 
          onClick={() => setIsClearDataModalOpen(true)}
          className="w-full flex items-center justify-between p-6 rounded-lg text-white font-bold transition-all shadow-lg shadow-[#B34C36]/20 active:scale-95"
          style={{ backgroundColor: '#B34C36' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <Trash2 size={24} />
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">{t('delete_all_data')}</p>
              <h3 className="text-lg font-bold">{t('clear_store_data')}</h3>
            </div>
          </div>
          <ChevronLeft className="text-white/60" size={20} />
        </button>
      </div>

      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 text-brand-600 text-xs font-bold dark:bg-brand-950/20 dark:text-brand-400">
          <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
          {t('version_label')} • {t('my_smart_inventory')}
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
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_clear_all_data_desc')} <span className="text-[#B34C36]">{t('irreversible_action')}</span>
              </p>
              
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
                  onClick={() => setIsClearDataModalOpen(false)}
                  disabled={isClearing}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-[12px] font-bold active:scale-95 transition-all text-[12px]"
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
