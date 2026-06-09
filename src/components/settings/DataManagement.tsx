import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowRight, 
  Download, 
  Upload, 
  FileJson, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle,
  PackagePlus
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { useAppContext } from '../../AppContext';

interface DataManagementProps {
  onBack: () => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingCatalog, setIsImportingCatalog] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

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

  const handleCatalogImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImportingCatalog(true);
    setStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content);
        
        // The catalog app might output { data: { products: [...] } } or just an array
        let items: any[] = [];
        if (Array.isArray(imported)) {
          items = imported;
        } else if (imported.data && Array.isArray(imported.data.products)) {
          items = imported.data.products;
        } else if (Array.isArray(imported.products)) {
          items = imported.products;
        }

        if (items.length === 0) {
          throw new Error('لم يتم العثور على منتجات في الملف (No products found)');
        }

        let totalProcessed = 0;
        
        for (let i = 0; i < items.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = items.slice(i, i + 500);
          
          chunk.forEach((item: any) => {
            const data = {
              name: item.name || '',
              category: item.category || 'عام',
              barcode: item.barcode || '',
              piecesPerBox: parseFloat(item.piecesPerBox || item.piecesPerCarton || 1),
              quantity: 0,
              purchasePrice: 0,
              sellingPrice: 0,
              boxPurchasePrice: 0,
              minQuantity: 5,
              updatedAt: new Date().toISOString(),
              isDraft: true
            };
            
            const docRef = doc(collection(db, `users/${user.uid}/draft_products`));
            batch.set(docRef, data);
          });

          await batch.commit();
          totalProcessed += chunk.length;
        }

        setStatus({ type: 'success', msg: `تم استيراد ${totalProcessed} منتج إلى المسودة بنجاح.` });
      } catch (error: any) {
        console.error('Catalog Import error:', error);
        setStatus({ type: 'error', msg: `خطأ في الاستيراد: ${error.message}` });
      } finally {
        setIsImportingCatalog(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const processImport = async (jsonString: string) => {
    if (!user) return;
    setIsImporting(true);
    setStatus(null);

    try {
      const imported = JSON.parse(jsonString);
      
      const sourceData = imported.data || imported;
      
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

        for (let i = 0; i < items.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = items.slice(i, i + 500);
          
          chunk.forEach((item: any) => {
            let { id, ...data } = item;
            
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
              
              data.piecesPerBox = parseFloat(data.piecesPerBox as any) || 1;
              data.boxPurchasePrice = parseFloat(data.boxPurchasePrice as any) || 0;
              data.purchasePrice = parseFloat(data.purchasePrice as any) || 0;
              data.sellingPrice = parseFloat(data.sellingPrice as any) || 0;
              data.quantity = parseFloat(data.quantity as any) || 0;

              if (data.boxPurchasePrice === 0 && data.purchasePrice > 0 && data.piecesPerBox > 1) {
                data.boxPurchasePrice = data.purchasePrice * data.piecesPerBox;
              }

              if (data.minQuantity === undefined) {
                data.minQuantity = 5;
              } else {
                data.minQuantity = parseFloat(data.minQuantity as any) || 0;
              }
            }

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

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="h-10 w-10 rounded-lg bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
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
          className={`p-4 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}
        >
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{status.msg}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export section */}
        <section className="p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
          <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
            <Download size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('export_backup')}</h3>
            <p className="text-sm text-zinc-500">{t('export_backup_desc')}</p>
          </div>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-4 rounded-lg bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all hover:bg-brand-700 disabled:opacity-50"
          >
            {isExporting ? t('exporting') : <><Clipboard size={20} /> {t('export_now')}</>}
          </button>
        </section>

        {/* Import section */}
        <section className="p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
          <div className="h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 dark:bg-amber-950/20">
            <Upload size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('import_file')}</h3>
            <p className="text-sm text-zinc-500">{t('import_file_desc')}</p>
          </div>
          <label className="cursor-pointer w-full py-4 rounded-lg bg-zinc-100 text-zinc-600 font-bold border-2 border-dashed border-zinc-200 flex items-center justify-center gap-2 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-700">
            <FileJson size={20} />
            {isImporting ? t('importing') : t('choose_file_import')}
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" disabled={isImporting || isImportingCatalog} />
          </label>
        </section>

        {/* Catalog Import section */}
        <section className="md:col-span-2 p-6 rounded-lg bg-white shadow-sm border border-brand-200 dark:bg-zinc-900 dark:border-brand-900/50 relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 p-4 -mr-4 -mt-4 opacity-5">
            <PackagePlus size={100} />
          </div>
          <div className="relative z-10">
            <div className="h-12 w-12 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20">
              <PackagePlus size={24} />
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">استيراد من كتالوج المنتجات</h3>
              <p className="text-sm text-zinc-500">جلب المنتجات من تطبيق الكتالوج الخاص بك. ستوضع المنتجات في خانة "قائمة النقل" (المسودات) لحين تحديد أسعارها.</p>
            </div>
            <label className="cursor-pointer mt-4 w-full py-4 rounded-lg bg-brand-50 text-brand-600 font-bold border-2 border-dashed border-brand-200 flex items-center justify-center gap-2 transition-all hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-800 dark:hover:bg-brand-900/40">
              <Upload size={20} />
              {isImportingCatalog ? 'جاري الاستيراد...' : 'اختيار ملف الكتالوج (.json)'}
              <input type="file" accept=".json" onChange={handleCatalogImport} className="hidden" disabled={isImporting || isImportingCatalog} />
            </label>
          </div>
        </section>

        {/* Manual Import section */}
        <section className="md:col-span-2 p-6 rounded-lg bg-white shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <Clipboard size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('manual_import')}</h3>
          </div>
          <textarea 
            placeholder={t('paste_backup_placeholder')}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="w-full h-32 rounded-lg bg-zinc-50 border border-zinc-200 p-4 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
          />
          <button 
            onClick={() => processImport(manualCode)}
            disabled={isImporting || !manualCode.trim()}
            className="w-full py-3 rounded-lg bg-zinc-900 text-white font-bold transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 shadow-xl"
          >
            {t('load_code_process_data')}
          </button>
        </section>
      </div>
    </div>
  );
};
