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
  Coffee,
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
  Check
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

type View = 'main' | 'data' | 'guide' | 'categories';

import { useCategories, categoryIcons } from '../hooks/useCategories';

function CategoriesManager({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { user, settings, updateSettings } = useAppContext();
  const { customCategories: categories, categories: allCategories } = useCategories();
  const [newCatName, setNewCatName] = React.useState('');
  const [selectedIcon, setSelectedIcon] = React.useState('Package');
  const [isAdding, setIsAdding] = React.useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = React.useState(false);

  const iconsList = Object.entries(categoryIcons).map(([name, icon]) => ({ name, icon }));

  const SelectedIconComp = categoryIcons[selectedIcon] || Package;

  const handleAddCategory = async () => {
    if (!user || !newCatName.trim()) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/categories`), {
        name: newCatName.trim(),
        icon: selectedIcon,
        createdAt: serverTimestamp()
      });
      setNewCatName('');
      setSelectedIcon('Package');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/categories`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return;
    try {
      if (id.startsWith('default_')) {
        await updateSettings({ deletedCategories: [...(settings.deletedCategories || []), id] });
      } else {
        await deleteDoc(doc(db, `users/${user.uid}/categories`, id));
      }
    } catch (err) {
      if (!id.startsWith('default_')) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/categories/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <button onClick={onBack} className="h-10 w-10 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-right">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('manage_categories')}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('add_remove_categories')}</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
          <LayoutList size={24} />
        </div>
      </header>

      {/* Add New Category */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
        <div className="flex gap-3">
          <button 
            onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
            className="h-14 w-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-brand-600 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm transition-all hover:border-brand-500/50"
          >
            <SelectedIconComp size={24} />
          </button>
          <input 
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            placeholder={t('new_category_placeholder')}
            className="flex-1 h-14 px-5 text-right rounded-2xl bg-white border border-zinc-200 outline-none focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white shadow-sm"
          />
        </div>

        <AnimatePresence>
          {isIconPickerOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                {iconsList.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSelectedIcon(item.name);
                      setIsIconPickerOpen(false);
                    }}
                    className={`h-11 flex items-center justify-center rounded-xl transition-all ${
                      selectedIcon === item.name 
                        ? 'bg-brand-600 text-white shadow-lg' 
                        : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 shadow-sm'
                    }`}
                  >
                    <item.icon size={22} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={handleAddCategory}
          disabled={isAdding || !newCatName.trim()}
          className="h-14 w-full rounded-2xl bg-brand-600 text-white font-bold flex items-center justify-center gap-2 transition-all hover:bg-brand-700 disabled:opacity-50 shadow-sm"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span>{t('add_category')}</span>
        </button>
      </div>

      {/* Categories List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {allCategories.map((cat) => {
            const IconComp = categoryIcons[(cat as any).icon] || Package;
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={cat.id}
                className="flex items-center justify-between p-3 pl-4 rounded-2xl bg-white border border-zinc-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                    <IconComp size={20} />
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-white text-base">{cat.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="h-10 w-10 flex items-center justify-center rounded-2xl text-white transition-all active:scale-90 shadow-sm"
                    style={{ backgroundColor: '#B34C36' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateSettings, toggleDarkMode, setLanguage, user } = useAppContext();
  const [activeView, setActiveView] = useState<View>('main');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = async () => {
    if (!user) return;
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
      setIsClearDataModalOpen(false);
      setStatus({ type: 'success', msg: t('clear_data_success') });
      
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

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    setStatus(null);

    try {
      const collections = [
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
      const exportData: any = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        data: {}
      };

      for (const colName of collections) {
        const snapshot = await getDocs(collection(db, `users/${user.uid}/${colName}`));
        exportData.data[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const jsonString = JSON.stringify(exportData, null, 2);

      // 1. Download file
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hstore_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // 2. Copy to clipboard
      await navigator.clipboard.writeText(jsonString);

      setStatus({ type: 'success', msg: t('export_success') });
    } catch (error) {
      console.error('Export error:', error);
      setStatus({ type: 'error', msg: t('export_error') });
    } finally {
      setIsExporting(false);
    }
  };

  const processImport = async (jsonString: string) => {
    if (!user) return;
    setIsImporting(true);
    setStatus(null);

    try {
      const imported = JSON.parse(jsonString);
      
      // Determine where the actual data resides
      // It could be in a 'data' key or at the root
      const sourceData = imported.data || imported;
      
      // List of supported collections
      const supportedCollections = [
        'products', 'suppliers', 'debts', 'categories', 'transactions', 
        'supplierTransactions', 'purchases', 'inventories', 'reports', 'expenses'
      ];
      
      const collectionsToProcess = Object.keys(sourceData).filter(key => 
        supportedCollections.includes(key) && Array.isArray(sourceData[key])
      );

      if (collectionsToProcess.length === 0) {
        throw new Error(t('no_valid_import_data'));
      }

      let totalProcessed = 0;

      for (const colName of collectionsToProcess) {
        const items = sourceData[colName];
        if (items.length === 0) continue;

        // Process in batches of 500 (Firestore limit)
        for (let i = 0; i < items.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = items.slice(i, i + 500);
          
          chunk.forEach((item: any) => {
            let { id, ...data } = item;
            
            // Map common field differences
            if (colName === 'products') {
              if (data.currentQuantity !== undefined && data.quantity === undefined) {
                data.quantity = data.currentQuantity;
              }
              if (data.piecesPerCarton !== undefined && data.piecesPerBox === undefined) {
                data.piecesPerBox = data.piecesPerCarton;
              }
              if (data.boxPrice !== undefined && data.boxPurchasePrice === undefined) {
                data.boxPurchasePrice = data.boxPrice;
              }
              if (data.cartonPrice !== undefined && data.boxPurchasePrice === undefined) {
                data.boxPurchasePrice = data.cartonPrice;
              }
              if (data.cartonPurchasePrice !== undefined && data.boxPurchasePrice === undefined) {
                data.boxPurchasePrice = data.cartonPurchasePrice;
              }
              
              // Ensure numeric types
              data.piecesPerBox = parseFloat(data.piecesPerBox as any) || 1;
              data.boxPurchasePrice = parseFloat(data.boxPurchasePrice as any) || 0;
              data.purchasePrice = parseFloat(data.purchasePrice as any) || 0;
              data.sellingPrice = parseFloat(data.sellingPrice as any) || 0;
              data.quantity = parseFloat(data.quantity as any) || 0;

              // Logic: If box price is 0 but we have piece price and box size, calculate it
              if (data.boxPurchasePrice === 0 && data.purchasePrice > 0 && data.piecesPerBox > 1) {
                data.boxPurchasePrice = data.purchasePrice * data.piecesPerBox;
              }

              if (data.minQuantity === undefined) {
                data.minQuantity = 5; // Default value
              } else {
                data.minQuantity = parseFloat(data.minQuantity as any) || 0;
              }
            }

            // Use existing ID if it's a string, otherwise generate or convert one
            const idStr = (id && typeof id === 'string') ? id : (id ? String(id) : undefined);
            const docRef = idStr ? doc(db, `users/${user.uid}/${colName}`, idStr) : doc(collection(db, `users/${user.uid}/${colName}`));
            batch.set(docRef, data, { merge: true });
          });

          await batch.commit();
          totalProcessed += chunk.length;
        }
      }

      setStatus({ type: 'success', msg: t('import_success', { count: totalProcessed, catCount: collectionsToProcess.length }) });
      setManualCode('');
    } catch (error: any) {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : t('unexpected_error');
      setStatus({ type: 'error', msg: `${t('import_error')}: ${errorMsg}` });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await processImport(content);
    };
    reader.readAsText(file);
  };

  const [tempSettings, setTempSettings] = useState({
    storeName: settings.storeName || 'H.STORE',
    currency: settings.currency || 'د.ت',
    language: settings.language || 'ar'
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

  if (activeView === 'data') {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => setActiveView('main')} className="h-10 w-10 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('data_management')}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('export_import_data_desc')}</p>
          </div>
        </header>

        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}
          >
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{status.msg}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export section */}
          <section className="p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
              <Download size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('export_backup')}</h3>
              <p className="text-sm text-zinc-500">{t('export_backup_desc')}</p>
            </div>
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all hover:bg-brand-700 disabled:opacity-50"
            >
              {isExporting ? t('exporting') : <><Clipboard size={20} /> {t('export_now')}</>}
            </button>
          </section>

          {/* Import section */}
          <section className="p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 dark:bg-amber-950/20">
              <Upload size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('import_file')}</h3>
              <p className="text-sm text-zinc-500">{t('import_file_desc')}</p>
            </div>
            <label className="cursor-pointer w-full py-4 rounded-2xl bg-zinc-100 text-zinc-600 font-bold border-2 border-dashed border-zinc-200 flex items-center justify-center gap-2 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-700">
              <FileJson size={20} />
              {isImporting ? t('importing') : t('choose_file_import')}
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" disabled={isImporting} />
            </label>
          </section>

          {/* Manual Import section */}
          <section className="md:col-span-2 p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <Clipboard size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('manual_import')}</h3>
            </div>
            <textarea 
              placeholder={t('paste_backup_placeholder')}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="w-full h-32 rounded-2xl bg-zinc-50 border border-zinc-200 p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
            />
            <button 
              onClick={() => processImport(manualCode)}
              disabled={isImporting || !manualCode.trim()}
              className="w-full py-3 rounded-2xl bg-zinc-900 text-white font-bold transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 shadow-xl"
            >
              {t('load_code_process_data')}
            </button>
          </section>
        </div>
      </div>
    );
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
          className="p-2 rounded-2xl bg-white border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm flex items-center gap-3 cursor-pointer active:scale-95 transition-all"
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
              className="w-10 h-10 rounded-2xl object-cover border-2 border-brand-50"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-xs border-2 border-brand-50 dark:border-brand-900/50">
              {(user?.email || user?.displayName || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {/* Store Settings Form */}
        <section className="p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-6">
          {status && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}
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
                className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">{t('currency')}</label>
              <input 
                type="text"
                value={tempSettings.currency}
                onChange={(e) => setTempSettings(prev => ({ ...prev, currency: e.target.value }))}
                placeholder={t('currency_placeholder')}
                className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">{t('lang')}</label>
              <select 
                value={tempSettings.language}
                onChange={(e) => setTempSettings(prev => ({ ...prev, language: e.target.value as 'ar' | 'en' }))}
                className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center appearance-none cursor-pointer"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <button 
            onClick={handleSaveStoreSettings}
            disabled={isSaving}
            className="w-full h-14 rounded-2xl bg-brand-600 text-white font-black shadow-lg shadow-brand-500/20 flex items-center justify-center transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? t('saving') : t('save')}
          </button>
        </section>

        {/* Dark Mode Toggle */}
        <section className="flex items-center justify-between p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
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
        <section className="flex items-center justify-between p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
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
        <section className="flex items-center justify-between p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
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

        {/* Other menu items */}
        {menuItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => setActiveView(item.id as View)}
            className="group w-full flex items-center justify-between p-6 rounded-2xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${item.color}`}>
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

        <button 
          onClick={() => setIsClearDataModalOpen(true)}
          className="w-full flex items-center justify-between p-6 rounded-2xl text-white font-bold transition-all shadow-lg shadow-[#B34C36]/20 active:scale-95"
          style={{ backgroundColor: '#B34C36' }}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
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
              className="relative w-full max-w-[280px] rounded-2xl bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
            >
              <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mb-6 leading-relaxed">
                {t('confirm_clear_all_data_desc')} <span className="text-[#B34C36]">{t('irreversible_action')}</span>
              </p>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleClearAllData}
                  disabled={isClearing}
                  className="flex-1 py-2.5 rounded-2xl font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px] disabled:opacity-50"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm')}
                </button>
                <button 
                  onClick={() => setIsClearDataModalOpen(false)}
                  disabled={isClearing}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl text-[12px] font-bold active:scale-95 transition-all text-[12px]"
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
              className="relative w-full max-w-[280px] rounded-2xl bg-white p-6 dark:bg-zinc-900 text-center shadow-2xl border border-zinc-100 dark:border-zinc-800"
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
                  className="flex-1 py-2.5 rounded-2xl font-black text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95 text-[12px]"
                  style={{ backgroundColor: '#B34C36' }}
                >
                  {t('confirm_logout')}
                </button>
                <button 
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl text-[12px] font-bold active:scale-95 transition-all"
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
