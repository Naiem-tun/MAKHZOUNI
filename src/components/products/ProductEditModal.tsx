import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ScanBarcode, Trash2, Camera, ImagePlus, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { Product } from '../../types';
import { getLocalImage } from '../../lib/localImages';

interface ProductEditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any, imageFile?: File | Blob | null, imageRemoved?: boolean) => Promise<void>;
  onDelete?: (product: Product) => void;
  scannedBarcode: string;
  scannedBarcode2?: string;
  onScan: (target: 'barcode' | 'barcode2') => void;
  onCopy?: (product: Product) => void;
}

export function ProductEditModal({ product, isOpen, onClose, onSave, onDelete, scannedBarcode, scannedBarcode2 = '', onScan, onCopy }: ProductEditModalProps) {
  const { t } = useTranslation();
  const { categories } = useCategories();
  const [piecesPerBox, setPiecesPerBox] = useState<number | string>(1);
  const [subItemsPerPiece, setSubItemsPerPiece] = useState<number | string>(1);
  const [boxPrice, setBoxPrice] = useState<number | string>('');
  const [piecePrice, setPiecePrice] = useState<number | string>('');
  const [barcode, setBarcode] = useState('');
  const [barcode2, setBarcode2] = useState('');
  const [showBarcode2, setShowBarcode2] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [unit, setUnit] = useState<string>('piece');
  const [showUnitMenu, setShowUnitMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [imageFile, setImageFile] = useState<File | Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let url: string | null = null;
    if (isOpen) {
      if (product) {
        setPiecesPerBox(product.piecesPerBox || 1);
        setSubItemsPerPiece(product.subItemsPerPiece || 1);
        setBoxPrice(product.boxPurchasePrice ? parseFloat(Number(product.boxPurchasePrice).toFixed(3)) : '');
        setPiecePrice(product.purchasePrice ? parseFloat(Number(product.purchasePrice).toFixed(3)) : '');
        setCategory(product.category || (categories[0]?.name || ""));
        const fetchId = product.id || product._copiedFromId;
        if (product.hasLocalImage && fetchId) {
           getLocalImage(fetchId).then(blob => {
              if (blob) {
                 url = URL.createObjectURL(blob);
                 setImagePreview(url);
                 if (product._copiedFromId) {
                   setImageFile(blob);
                 }
              }
           });
        }
      } else {
        setPiecesPerBox(1);
        setBoxPrice('');
        setPiecePrice('');
        setCategory(categories[0]?.name || "");
      }
      setBarcode(product?.barcode || scannedBarcode || '');
      setBarcode2(product?.barcode2 || scannedBarcode2 || '');
      setShowBarcode2(!!product?.barcode2 || !!scannedBarcode2);
      setUnit(product?.unit || 'piece');
      setImageFile(null);
      setImageRemoved(false);
      if (!product?.hasLocalImage) setImagePreview(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, product]);

  useEffect(() => {
    if (isOpen && scannedBarcode) setBarcode(scannedBarcode);
  }, [scannedBarcode, isOpen]);

  useEffect(() => {
    if (isOpen && scannedBarcode2) {
      setBarcode2(scannedBarcode2);
      setShowBarcode2(true);
    }
  }, [scannedBarcode2, isOpen]);

  const handleBoxPriceChange = (valStr: string) => {
    setBoxPrice(valStr);
    const parsed = parseFloat(valStr) || 0;
    const pieces = parseFloat(String(piecesPerBox)) || 0;
    if (pieces > 0 && parsed > 0) {
      setPiecePrice(parseFloat((parsed / pieces).toFixed(3)));
    } else if (parsed === 0) {
      setPiecePrice('');
    }
  };

  const handlePiecePriceChange = (valStr: string) => {
    setPiecePrice(valStr);
    const parsed = parseFloat(valStr) || 0;
    const pieces = parseFloat(String(piecesPerBox)) || 0;
    if (parsed > 0) {
      setBoxPrice(parseFloat((parsed * pieces).toFixed(3)));
    } else if (parsed === 0) {
      setBoxPrice('');
    }
  };

  const handlePiecesChange = (valStr: string) => {
    setPiecesPerBox(valStr);
    const parsed = parseFloat(valStr) || 0;
    const currentBoxPrice = parseFloat(String(boxPrice)) || 0;
    if (parsed > 0 && currentBoxPrice > 0) {
      setPiecePrice(parseFloat((currentBoxPrice / parsed).toFixed(3)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      // The form submission will be handled by the form's submit button or we can trigger it
      const form = e.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setImageRemoved(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const rawPurchasePrice = parseFloat((formData.get('purchasePrice') as string)?.replace(',', '.') || '0') || 0;
    const rawSellingPrice = parseFloat((formData.get('sellingPrice') as string)?.replace(',', '.') || '0') || 0;
    const rawBoxPurchasePrice = parseFloat((formData.get('boxPurchasePrice') as string)?.replace(',', '.') || '0') || 0;

    const productData = {
      name: formData.get('name') as string,
      category: formData.get('category') as string,
      purchasePrice: parseFloat(rawPurchasePrice.toFixed(3)),
      sellingPrice: parseFloat(rawSellingPrice.toFixed(3)),
      barcode: formData.get('barcode') as string,
      barcode2: formData.get('barcode2') as string,
      piecesPerBox: parseFloat((formData.get('piecesPerBox') as string)?.replace(',', '.') || '0') || 1,
      subItemsPerPiece: parseFloat((formData.get('subItemsPerPiece') as string)?.replace(',', '.') || '0') || 1,
      unit: formData.get('unit') as string || 'piece',
      boxPurchasePrice: parseFloat(rawBoxPurchasePrice.toFixed(3)),
      // Keep existing stock values if editing, or default to 0 for new products
      quantity: product?.quantity ?? 0,
      minQuantity: parseFloat((formData.get('minQuantity') as string)?.replace(',', '.') || '0') || 0,
    };
    await onSave(productData, imageFile, imageRemoved);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          <div 
            className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900 max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 left-4 text-zinc-400 hover:text-zinc-600 p-1"
            >
              <X size={20} />
            </button>
            {product && product.id && onCopy && (
              <button 
                type="button"
                onClick={() => onCopy(product)}
                title={t('copy_product') || 'نسخ المنتج'}
                className="absolute top-4 left-12 text-zinc-400 hover:text-brand-500 p-1 transition-colors"
              >
                <Copy size={20} />
              </button>
            )}
            <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white pr-4">
              {product && product.id ? t('edit') : t('add_product')}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-3 text-right">
              {/* Image Picker */}
              <div className="flex justify-center mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-[20px] bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center overflow-hidden transition-colors hover:border-brand-500 overflow-hidden relative">
                    {imagePreview ? (
                      <div className="w-full h-full relative">
                        <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 backdrop-blur-sm"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-zinc-400 flex flex-col items-center gap-2">
                        <ImagePlus size={24} />
                        <span className="text-[10px] font-medium">{t('image') || 'صورة'}</span>
                      </div>
                    )}
                  </div>
                  {!imagePreview && (
                    <div className="absolute -bottom-2 -right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="h-8 w-8 bg-brand-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-brand-600 active:scale-95 transition-all"
                      >
                        <Camera size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 w-8 bg-zinc-700 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-800 active:scale-95 transition-all"
                      >
                        <ImagePlus size={14} />
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={cameraInputRef}
                    onChange={handleImageChange}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              {/* 1. Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500">{t('name')}</label>
                <input 
                  name="name" 
                  defaultValue={product?.name} 
                  required 
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-right font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                />
              </div>

              {/* 2. Barcode */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    {!showBarcode2 && (
                      <button 
                        type="button" 
                        onClick={() => setShowBarcode2(true)}
                        className="text-[10px] font-bold text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        {t('extra_barcode')}
                      </button>
                    )}
                    <label className="text-[10px] font-bold text-zinc-500">{t('barcode')}</label>
                  </div>
                  <div className="relative group">
                    <input 
                      name="barcode" 
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pl-10 text-sm text-right outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white block" 
                      placeholder={t('scan_barcode_placeholder')}
                    />
                    <div className="absolute inset-y-0 left-1 flex items-center pl-1">
                      <button 
                        type="button" 
                        onClick={() => onScan('barcode')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-400 group-focus-within:border-brand-500 group-focus-within:text-brand-500 dark:bg-zinc-950 dark:border-zinc-800 transition-all active:scale-90"
                      >
                        <ScanBarcode size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {showBarcode2 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 flex justify-end">{t('barcode')}</label>
                    <div className="relative group">
                      <input 
                        name="barcode2" 
                        value={barcode2}
                        onChange={(e) => setBarcode2(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pl-10 text-sm text-right outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white block" 
                        placeholder={t('scan_barcode_placeholder')}
                      />
                      <div className="absolute inset-y-0 left-1 flex items-center pl-1">
                        <button 
                          type="button" 
                          onClick={() => onScan('barcode2')}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-400 group-focus-within:border-brand-500 group-focus-within:text-brand-500 dark:bg-zinc-950 dark:border-zinc-800 transition-all active:scale-90"
                        >
                          <ScanBarcode size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Category & Unit */}
              <div className="grid grid-cols-2 gap-3 text-right">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('category')}</label>
                  <div className="relative">
                    <input type="hidden" name="category" value={category} />
                    <button
                      type="button"
                      onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                      className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-900 outline-none hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white flex items-center justify-between transition-colors overflow-hidden"
                    >
                      <span className="truncate flex-1 text-right">{t(categories.find(c => c.name === category)?.key || category || categories[0]?.name || '')}</span>
                      <svg className="h-4 w-4 fill-current text-zinc-400 shrink-0 mr-2" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </button>
                    {showCategoryMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
                        <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1 max-h-48 overflow-y-auto">
                          {categories.map((c, index) => (
                            <button
                              key={`${c.id}-${index}`}
                              type="button"
                              onClick={() => { setCategory(c.name); setShowCategoryMenu(false); }}
                              className="w-full px-4 py-2 text-sm font-bold text-right text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              {t(c.key || c.name)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('unit') || 'الوحدة'}</label>
                  <div className="relative">
                    <input type="hidden" name="unit" value={unit} />
                    <button
                      type="button"
                      onClick={() => setShowUnitMenu(!showUnitMenu)}
                      className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-900 outline-none hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white flex items-center justify-between transition-colors overflow-hidden"
                    >
                      <span className="truncate flex-1 text-right">{unit === 'kg' ? 'كغ' : 'قطعة'}</span>
                      <svg className="h-4 w-4 fill-current text-zinc-400 shrink-0 mr-2" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </button>
                    {showUnitMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUnitMenu(false)} />
                        <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                          <button
                            type="button"
                            onClick={() => { setUnit('piece'); setShowUnitMenu(false); }}
                            className="w-full px-4 py-2 text-sm font-bold text-right text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            قطعة
                          </button>
                          <button
                            type="button"
                            onClick={() => { setUnit('kg'); setShowUnitMenu(false); }}
                            className="w-full px-4 py-2 text-sm font-bold text-right text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            كغ
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors py-1"
                >
                  <span>إعدادات متقدمة (الحد الأدنى، الوحدات الصغرى)</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                <div className={showAdvanced ? "grid grid-cols-2 gap-3 text-right mt-3" : "hidden"}>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500">{t('min_quantity')}</label>
                    <input 
                      name="minQuantity" 
                      type="number" 
                      step="any"
                      defaultValue={product?.minQuantity ?? 0} 
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500">{"عدد الحبات في القطعة (وحدة صغرى)"}</label>
                    <input 
                      name="subItemsPerPiece" 
                      type="number" 
                      value={subItemsPerPiece}
                      onChange={(e) => setSubItemsPerPiece(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                    />
                  </div>
                </div>
              </div>
              {/* 4. Box Info Row */}
              <div className="grid grid-cols-2 gap-3 text-right">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('pieces_in_box')}</label>
                  <input 
                    name="piecesPerBox" 
                    type="number" 
                    value={piecesPerBox}
                    onChange={(e) => handlePiecesChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('box_purchase_price')}</label>
                  <input 
                    name="boxPurchasePrice" 
                    type="number" 
                    step="0.001"
                    value={boxPrice}
                    onChange={(e) => handleBoxPriceChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
              </div>

              {/* 5. Prices Row */}
              <div className="grid grid-cols-2 gap-3 text-right">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('piece_purchase_price')}</label>
                  <input 
                    name="purchasePrice" 
                    type="number" 
                    step="0.001" 
                    value={piecePrice}
                    onChange={(e) => handlePiecePriceChange(e.target.value)}
                    required 
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('selling_price')}</label>
                  <input 
                    name="sellingPrice" 
                    type="number" 
                    step="0.001" 
                    defaultValue={product?.sellingPrice || ''} 
                    required 
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
              </div>

              <div className="pt-3">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full rounded-lg bg-brand-600 py-3 text-sm font-bold text-white transition-all hover:bg-brand-700 active:scale-95 shadow-lg shadow-brand-600/10 disabled:opacity-50"
                >
                  {isSaving ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent mx-auto"></div> : t('save')}
                </button>
              </div>

              {product && onDelete && (
                <>
                  <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800 my-2"></div>
                  <button
                    type="button"
                    onClick={() => onDelete(product)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white shadow-lg shadow-[#B34C36]/20 transition-all active:scale-95"
                    style={{ backgroundColor: '#B34C36' }}
                  >
                    <Trash2 size={16} />
                    <span>{t('delete_product')}</span>
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
