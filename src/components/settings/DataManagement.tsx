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
import { useFolioTheme } from '../folio/FolioPageChrome';

interface DataManagementProps {
  onBack: () => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { user, settings } = useAppContext();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);
  
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
    <div className="max-w-4xl mx-auto space-y-5 pb-20" style={{ color: theme.text }}>
      <header
        className="flex items-center gap-3 border-b pb-4"
        style={{ borderColor: theme.border }}
      >
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 border flex items-center justify-center cursor-pointer"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          }}
        >
          <ArrowRight size={18} />
        </button>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
            <span>{t('export_import_data_desc')}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>
            {t('data_management')}
          </h1>
        </div>
      </header>

      {status && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 border flex items-center gap-2.5 text-xs font-bold"
          style={{
            backgroundColor: theme.surface,
            borderColor: status.type === 'success' ? theme.positive : theme.negative,
            color: status.type === 'success' ? theme.positive : theme.negative,
          }}
        >
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{status.msg}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export section */}
        <section
          className="p-5 border space-y-4 text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="h-10 w-10 border flex items-center justify-center"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.accent,
            }}
          >
            <Download size={20} />
          </div>
          <div>
            <h3 className="text-base font-black" style={{ color: theme.text }}>
              {t('export_backup')}
            </h3>
            <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
              {t('export_backup_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 border text-xs font-black flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 cursor-pointer"
            style={{
              backgroundColor: theme.text,
              color: theme.surface,
              borderColor: theme.text,
            }}
          >
            {isExporting ? t('exporting') : <><Clipboard size={16} /> {t('export_now')}</>}
          </button>
        </section>

        {/* Import section */}
        <section
          className="p-5 border space-y-4 text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div
            className="h-10 w-10 border flex items-center justify-center"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.accent,
            }}
          >
            <Upload size={20} />
          </div>
          <div>
            <h3 className="text-base font-black" style={{ color: theme.text }}>
              {t('import_file')}
            </h3>
            <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
              {t('import_file_desc')}
            </p>
          </div>
          <label
            className="cursor-pointer w-full py-3 border border-dashed text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <FileJson size={16} style={{ color: theme.accent }} />
            {isImporting ? t('importing') : t('choose_file_import')}
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" disabled={isImporting || isImportingCatalog} />
          </label>
        </section>

        {/* Catalog Import section */}
        <section
          className="md:col-span-2 p-5 border space-y-4 text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.accent,
              }}
            >
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-black" style={{ color: theme.text }}>
                استيراد من كتالوج المنتجات
              </h3>
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                جلب المنتجات من تطبيق الكتالوج الخاص بك. ستوضع المنتجات في خانة "قائمة النقل" (المسودات) لحين تحديد أسعارها.
              </p>
            </div>
          </div>
          <label
            className="cursor-pointer w-full py-3 border border-dashed text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.accent,
            }}
          >
            <Upload size={16} />
            {isImportingCatalog ? 'جاري الاستيراد...' : 'اختيار ملف الكتالوج (.json)'}
            <input type="file" accept=".json" onChange={handleCatalogImport} className="hidden" disabled={isImporting || isImportingCatalog} />
          </label>
        </section>

        {/* Manual Import section */}
        <section
          className="md:col-span-2 p-5 border space-y-4 text-right"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 border flex items-center justify-center"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.textMuted,
              }}
            >
              <Clipboard size={18} />
            </div>
            <h3 className="text-base font-black" style={{ color: theme.text }}>
              {t('manual_import')}
            </h3>
          </div>
          <textarea
            placeholder={t('paste_backup_placeholder')}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="w-full h-32 border p-3.5 font-mono text-xs outline-none"
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
            }}
          />
          <button
            type="button"
            onClick={() => processImport(manualCode)}
            disabled={isImporting || !manualCode.trim()}
            className="w-full py-3 border text-xs font-black transition-opacity disabled:opacity-40 cursor-pointer"
            style={{
              backgroundColor: theme.text,
              color: theme.surface,
              borderColor: theme.text,
            }}
          >
            {t('load_code_process_data')}
          </button>
        </section>
      </div>
    </div>
  );
};
