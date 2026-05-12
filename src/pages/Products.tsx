import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OperationType } from '../types';
import { handleFirestoreError, cn } from '../lib/utils';
import { 
  Plus, 
  Search, 
  Filter, 
  ScanBarcode,
  Boxes
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ProductCard } from '../components/products/ProductCard';
import { ProductPagination } from '../components/products/ProductPagination';
import { DeleteConfirmationModal } from '../components/products/DeleteConfirmationModal';
import { AddQuantityModal } from '../components/products/AddQuantityModal';
import { ProductEditModal } from '../components/products/ProductEditModal';
import { useCategories } from '../hooks/useCategories';

import { BarcodeScanner } from '../components/common/BarcodeScanner';

import { Logo } from '../components/UI';

export default function Products() {
  const { t } = useTranslation();
  const { user, settings, showToast, setIsDataLoaded } = useAppContext();
  const { categories } = useCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'available', 'low', 'out'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showBoxInfo, setShowBoxInfo] = useState(() => {
    const saved = localStorage.getItem('products_showBoxInfo');
    return saved === 'true';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'barcode-field' | 'barcode2-field'>('search');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedBarcode2, setScannedBarcode2] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quantityProduct, setQuantityProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/products`;
    const q = collection(db, path);
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
      setIsDataLoaded(true);
    }, (error) => {
      setLoading(false);
      setIsDataLoaded(true);
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }, [user, setIsDataLoaded]);

  // Reset to first page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = () => {
    if (!user || !productToDelete) return;
    
    // UI feedback: close modal immediately
    setIsDeleteModalOpen(false);
    const path = `users/${user.uid}/products/${productToDelete.id}`;
    
    deleteDoc(doc(db, path))
      .then(() => {
        setProductToDelete(null);
      })
      .catch(err => {
        handleFirestoreError(err, OperationType.DELETE, path);
      });
  };

  const performQuantitySave = async (numBoxes: number, extraPieces: number, boxPrice: number, piecePrice: number) => {
    if (!user || !quantityProduct) return;

    const addedQty = (numBoxes * (quantityProduct.piecesPerBox || 1)) + extraPieces;
    const newQty = (quantityProduct.quantity || 0) + addedQty;

    // UI feedback: close modal immediately
    setIsQuantityModalOpen(false);
    setQuantityProduct(null);
    showToast(t('stock_updated_success'));

    try {
      const batch = writeBatch(db);
      const productRef = doc(db, `users/${user.uid}/products/${quantityProduct.id}`);
      const purchasesPath = `users/${user.uid}/purchases`;
      const purchaseRef = doc(collection(db, purchasesPath));
      
      const purchaseAmount = (numBoxes * boxPrice) + (extraPieces * piecePrice);

      // Record the purchase transaction
      batch.set(purchaseRef, {
        productId: quantityProduct.id,
        productName: quantityProduct.name,
        qtyAdded: addedQty,
        amount: purchaseAmount,
        date: serverTimestamp(),
      });

      // Update product stock
      batch.update(productRef, {
        quantity: newQty,
        purchasePrice: piecePrice,
        boxPurchasePrice: boxPrice,
        updatedAt: serverTimestamp(),
      });

      // Commit in the background
      batch.commit().catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products`);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/products`);
    }
  };

  const handleSaveProduct = async (productData: any) => {
    if (!user) return;
    
    // UI feedback: close modal immediately
    setIsModalOpen(false);
    setEditingProduct(null);
    setScannedBarcode('');
    showToast(t('product_saved_success'));

    try {
      const batch = writeBatch(db);
      
      if (editingProduct) {
        const path = `users/${user.uid}/products/${editingProduct.id}`;
        updateDoc(doc(db, path), {
          ...productData,
          updatedAt: serverTimestamp(),
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, path);
        });
      } else {
        const path = `users/${user.uid}/products`;
        const purchasesPath = `users/${user.uid}/purchases`;
        
        const productRef = doc(collection(db, path));
        batch.set(productRef, {
          ...productData,
          updatedAt: serverTimestamp(),
        });

        // Record initial stock as a purchase
        if (productData.quantity > 0) {
          const purchaseAmount = productData.quantity * (productData.purchasePrice || 0);
          const purchaseRef = doc(collection(db, purchasesPath));
          batch.set(purchaseRef, {
            productId: productRef.id,
            productName: productData.name,
            qtyAdded: productData.quantity,
            amount: purchaseAmount,
            date: serverTimestamp(),
          });
        }
        
        batch.commit().catch(err => {
          handleFirestoreError(err, OperationType.CREATE, path);
        });
      }
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/products`);
    }
  };

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    if (scannerTarget === 'search') {
      const foundProduct = products.find(p => p.barcode === decodedText || p.barcode2 === decodedText);
      if (foundProduct) {
        setSearchTerm(decodedText);
        setQuantityProduct(foundProduct);
        setIsQuantityModalOpen(true);
      } else {
        if (window.confirm(t('product_not_found_add'))) {
          setScannedBarcode(decodedText);
          setEditingProduct(null);
          setIsModalOpen(true);
        }
      }
    } else if (scannerTarget === 'barcode-field') {
      setScannedBarcode(decodedText);
    } else if (scannerTarget === 'barcode2-field') {
      setScannedBarcode2(decodedText);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.barcode?.includes(searchTerm) ||
                         p.barcode2?.includes(searchTerm);
    
    let matchesStock = true;
    if (stockFilter === 'available') {
      matchesStock = (p.quantity || 0) > (p.minQuantity || 0);
    } else if (stockFilter === 'low') {
      matchesStock = (p.quantity || 0) <= (p.minQuantity || 0) && (p.quantity || 0) > 0;
    } else if (stockFilter === 'out') {
      matchesStock = (p.quantity || 0) <= 0;
    }

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

    return matchesSearch && matchesStock && matchesCategory;
  }).sort((a, b) => {
    const catA = a.category || '';
    const catB = b.category || '';
    if (catA !== catB) {
      return catA.localeCompare(catB, settings.language);
    }
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, settings.language);
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    localStorage.setItem('products_showBoxInfo', showBoxInfo.toString());
  }, [showBoxInfo]);

  useEffect(() => {
    const productHandler = () => {
      setEditingProduct(null);
      setIsModalOpen(true);
    };
    const scannerHandler = () => {
      setScannerTarget('search');
      setIsScannerOpen(true);
    };
    window.addEventListener('open-product-modal', productHandler);
    window.addEventListener('open-barcode-scanner', scannerHandler);
    return () => {
      window.removeEventListener('open-product-modal', productHandler);
      window.removeEventListener('open-barcode-scanner', scannerHandler);
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <div className="text-right">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('products')}</h1>
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">{t('products_list_subtitle')}</p>
        </div>
        <div>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-2xl bg-[#4A6FA5] px-3 py-2 sm:px-4 sm:py-2 text-sm font-bold text-white transition-all hover:bg-[#4A6FA5]/90 shadow-lg shadow-[#4A6FA5]/20 active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} strokeWidth={3} />
            {t('add_product')}
          </button>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-brand-500 transition-colors">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            placeholder={t('search_product_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pr-12 pl-12 outline-none focus:ring-2 focus:ring-brand-500 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
          />
          <div className="absolute inset-y-0 left-2 flex items-center pr-2">
            <button 
              type="button"
              onClick={() => {
                setScannerTarget('search');
                setIsScannerOpen(true);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all active:scale-90 dark:text-zinc-500 dark:hover:bg-zinc-800"
            >
              <ScanBarcode size={20} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative group">
            <select 
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="appearance-none flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white pr-8 pl-3 py-2 text-sm font-bold text-zinc-600 outline-none hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 cursor-pointer min-w-[110px]"
            >
              <option value="all">{t('all_stock')}</option>
              <option value="available">{t('available_stock')}</option>
              <option value="low">{t('low_stock')}</option>
              <option value="out">{t('out_of_stock')}</option>
            </select>
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-zinc-400">
              <Boxes size={16} />
            </div>
          </div>

          <div className="relative group">
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white pr-8 pl-3 py-2 text-sm font-bold text-zinc-600 outline-none hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 cursor-pointer min-w-[130px]"
            >
              <option value="all">{t('all_categories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{t(c.key || c.name)}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-zinc-400">
              <Filter size={16} />
            </div>
          </div>

          <button
            onClick={() => setShowBoxInfo(!showBoxInfo)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all text-sm font-bold",
              showBoxInfo 
                ? "bg-brand-50 border-brand-200 text-brand-600" 
                : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
            )}
          >
            <Boxes size={18} className={showBoxInfo ? "text-brand-500" : ""} />
            <span>{t('box')}</span>
          </button>
        </div>
      </div>

      {/* Products List */}
      <div className="grid grid-cols-1 gap-4">
        {paginatedProducts.map((p, idx) => (
          <ProductCard
            key={p.id}
            product={p}
            index={idx}
            showBoxInfo={showBoxInfo}
            onEdit={(product) => {
              setEditingProduct(product);
              setIsModalOpen(true);
            }}
            onAddQuantity={(product) => {
              setQuantityProduct(product);
              setIsQuantityModalOpen(true);
            }}
          />
        ))}
      </div>

      <ProductPagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />

      <AddQuantityModal
        product={quantityProduct}
        isOpen={isQuantityModalOpen}
        onClose={() => setIsQuantityModalOpen(false)}
        onConfirm={performQuantitySave}
      />

      <ProductEditModal
        product={editingProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        onDelete={(product) => {
          setIsModalOpen(false);
          setProductToDelete(product);
          setIsDeleteModalOpen(true);
        }}
        scannedBarcode={scannedBarcode}
        scannedBarcode2={scannedBarcode2}
        onScan={(target) => {
          setScannerTarget(target === 'barcode2' ? 'barcode2-field' : 'barcode-field');
          setIsScannerOpen(true);
        }}
      />

      <BarcodeScanner 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
}
