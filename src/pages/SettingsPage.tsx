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
  ArrowRight
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

type View = 'main' | 'data' | 'guide' | 'categories';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateSettings, toggleDarkMode, setLanguage, user } = useAppContext();
  const [activeView, setActiveView] = useState<View>('main');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const menuItems = [
    { id: 'guide', label: t('user_guide'), subtitle: 'تعلم كيفية احتراف إدارة مخزنك', icon: BookOpen, color: 'text-brand-500' },
    { id: 'categories', label: t('manage_categories'), subtitle: 'إضافة أو حذف فئات المنتجات', icon: LayoutList, color: 'text-zinc-500' },
    { id: 'data', label: t('data_export'), subtitle: 'تصدير واستيراد وإدارة البيانات', icon: Database, color: 'text-zinc-500' },
  ];

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    setStatus(null);

    try {
      const collections = ['products', 'suppliers', 'debts', 'categories', 'transactions'];
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

      setStatus({ type: 'success', msg: 'تم تصدير البيانات بنجاح وتحميل الملف ونسخ الكود!' });
    } catch (error) {
      console.error('Export error:', error);
      setStatus({ type: 'error', msg: 'فشل تصدير البيانات. يرجى المحاولة لاحقاً.' });
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
        throw new Error('لم يتم العثور على بيانات صالحة للاستيراد في الملف');
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
              if (data.minQuantity === undefined) {
                data.minQuantity = 5; // Default value
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

      setStatus({ type: 'success', msg: `تم استيراد ${totalProcessed} عنصر بنجاح عبر ${collectionsToProcess.length} فئة!` });
      setManualCode('');
    } catch (error: any) {
      console.error('Import error:', error);
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      setStatus({ type: 'error', msg: `فشل استيراد البيانات: ${errorMsg}` });
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
      setStatus({ type: 'success', msg: 'تم حفظ الإعدادات بنجاح' });
    } catch (error) {
      setStatus({ type: 'error', msg: 'فشل حفظ الإعدادات' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  if (activeView === 'data') {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => setActiveView('main')} className="h-10 w-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">إدارة البيانات</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">تصدير واستيراد قاعدة البيانات الخاصة بك</p>
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
          <section className="p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
              <Download size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">تصدير النسخة الاحتياطية</h3>
              <p className="text-sm text-zinc-500">سيتم تحميل ملف JSON ونسخ كود البيانات إلى الحافظة تلقائياً.</p>
            </div>
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all hover:bg-brand-700 disabled:opacity-50"
            >
              {isExporting ? 'جاري التصدير...' : <><Clipboard size={20} /> تصدير الآن</>}
            </button>
          </section>

          {/* Import section */}
          <section className="p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 dark:bg-amber-950/20">
              <Upload size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">استيراد ملف</h3>
              <p className="text-sm text-zinc-500">اختر ملف .json الذي قمت بتصديره مسبقاً لاستعادة بياناتك.</p>
            </div>
            <label className="cursor-pointer w-full py-4 rounded-2xl bg-zinc-100 text-zinc-600 font-bold border-2 border-dashed border-zinc-200 flex items-center justify-center gap-2 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-700">
              <FileJson size={20} />
              {isImporting ? 'جاري الاستيراد...' : 'اختر ملف للاستيراد'}
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" disabled={isImporting} />
            </label>
          </section>

          {/* Manual Import section */}
          <section className="md:col-span-2 p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <Clipboard size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">استيراد يدوي (لصق الكود)</h3>
            </div>
            <textarea 
              placeholder="الصق كود النسخة الاحتياطية هنا..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="w-full h-32 rounded-2xl bg-zinc-50 border border-zinc-200 p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
            />
            <button 
              onClick={() => processImport(manualCode)}
              disabled={isImporting || !manualCode.trim()}
              className="w-full py-3 rounded-2xl bg-zinc-900 text-white font-bold transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 shadow-xl"
            >
              تحميل الكود ومعالجة البيانات
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('settings')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400">تخصيص تجربة {settings.storeName || 'H.STORE'} الخاصة بك</p>
      </header>

      <div className="space-y-4">
        {/* Store Settings Form */}
        <section className="p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-6">
          {status && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}
            >
              {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {status.msg}
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">الاسم</label>
              <input 
                type="text"
                value={tempSettings.storeName}
                onChange={(e) => setTempSettings(prev => ({ ...prev, storeName: e.target.value }))}
                placeholder="اسم المتجر"
                className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">العملة</label>
              <input 
                type="text"
                value={tempSettings.currency}
                onChange={(e) => setTempSettings(prev => ({ ...prev, currency: e.target.value }))}
                placeholder="مثال: د.ت أو TND"
                className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 text-center"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 mr-2">اللغة</label>
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
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </section>

        {/* Dark Mode Toggle */}
        <section className="flex items-center justify-between p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
              <Moon size={24} />
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">تغيير مظهر التطبيق</p>
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

        {/* Other menu items */}
        {menuItems.map((item) => (
          <button 
            key={item.id} 
            onClick={() => setActiveView(item.id as View)}
            className="group w-full flex items-center justify-between p-6 rounded-3xl bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 transition-all hover:shadow-md"
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
          onClick={() => auth.signOut()}
          className="w-full mt-4 flex items-center justify-center gap-2 p-6 rounded-3xl bg-rose-50 text-rose-600 font-bold transition-all hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20"
        >
          <LogOut size={20} />
          {t('logout')}
        </button>
      </div>

      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 text-brand-600 text-xs font-bold dark:bg-brand-950/20 dark:text-brand-400">
          <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
          إصدار 1.0.0 • مخزوني الذكي
        </div>
      </div>
    </div>
  );
}
