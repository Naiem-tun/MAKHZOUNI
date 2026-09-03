import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ScanBarcode, Trash2, Camera, ImagePlus, Copy, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { Product } from '../../types';
import { getLocalImage } from '../../lib/localImages';
import { cleanQuantity, formatQuantity } from '../../lib/utils';

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
  const [productName, setProductName] = useState('');
  const [minQuantity, setMinQuantity] = useState<number | string>('');
  const [piecesPerBox, setPiecesPerBox] = useState<number | string>(1);
  const [subItemsPerPiece, setSubItemsPerPiece] = useState<number | string>(1);
  const [boxPrice, setBoxPrice] = useState<number | string>('');
  const [piecePrice, setPiecePrice] = useState<number | string>('');
  const [sellingPrice, setSellingPrice] = useState<number | string>('');
  const [priceError, setPriceError] = useState<string | null>(null);
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
      setPriceError(null);
      if (product) {
        setProductName(product.name || '');
        setMinQuantity(product.minQuantity !== undefined && product.minQuantity !== null ? product.minQuantity : '');
        const ppb = product.piecesPerBox && Number(product.piecesPerBox) > 0 ? Number(product.piecesPerBox) : 1;
        setPiecesPerBox(ppb);
        setSubItemsPerPiece(product.subItemsPerPiece || 1);
        
        const rawSellingPrice = product.sellingPrice !== undefined && product.sellingPrice !== null ? Number(product.sellingPrice) : 0;
        setSellingPrice(rawSellingPrice > 0 ? rawSellingPrice : '');

        const rawBoxPrice = product.boxPurchasePrice ? Number(product.boxPurchasePrice) : 0;
        const rawPiecePrice = product.purchasePrice ? Number(product.purchasePrice) : 0;

        if (ppb > 1) {
          if (rawBoxPrice > 0) {
            setBoxPrice(parseFloat(rawBoxPrice.toFixed(3)));
            // Ensure piece price is accurately calculated as box price divided by pieces per box
            setPiecePrice(parseFloat((rawBoxPrice / ppb).toFixed(3)));
          } else if (rawPiecePrice > 0) {
            setPiecePrice(parseFloat(rawPiecePrice.toFixed(3)));
            setBoxPrice(parseFloat((rawPiecePrice * ppb).toFixed(3)));
          } else {
            setBoxPrice('');
            setPiecePrice('');
          }
        } else {
          setBoxPrice(rawBoxPrice > 0 ? parseFloat(rawBoxPrice.toFixed(3)) : '');
          setPiecePrice(rawPiecePrice > 0 ? parseFloat(rawPiecePrice.toFixed(3)) : '');
        }
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
        setProductName('');
        setMinQuantity('');
        setPiecesPerBox(1);
        setSubItemsPerPiece(1);
        setBoxPrice('');
        setPiecePrice('');
        setSellingPrice('');
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
    setPriceError(null);
    const parsed = parseFloat(valStr.replace(',', '.')) || 0;
    const pieces = parseFloat(String(piecesPerBox).replace(',', '.')) || 0;
    if (pieces > 0 && parsed > 0) {
      setPiecePrice(parseFloat((parsed / pieces).toFixed(3)));
    } else if (parsed === 0) {
      setPiecePrice('');
    }
  };

  const handlePiecePriceChange = (valStr: string) => {
    setPiecePrice(valStr);
    setPriceError(null);
    const parsed = parseFloat(valStr.replace(',', '.')) || 0;
    const pieces = parseFloat(String(piecesPerBox).replace(',', '.')) || 0;
    if (parsed > 0) {
      setBoxPrice(parseFloat((parsed * pieces).toFixed(3)));
    } else if (parsed === 0) {
      setBoxPrice('');
    }
  };

  const handleSellingPriceChange = (valStr: string) => {
    setSellingPrice(valStr);
    setPriceError(null);
  };

  const handlePiecesChange = (valStr: string) => {
    setPiecesPerBox(valStr);
    setPriceError(null);
    const parsed = parseFloat(valStr.replace(',', '.')) || 0;
    const currentBoxPrice = parseFloat(String(boxPrice).replace(',', '.')) || 0;
    if (parsed > 0 && currentBoxPrice > 0) {
      setPiecePrice(parseFloat((currentBoxPrice / parsed).toFixed(3)));
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handlePerformSave = async () => {
    if (isSaving) return;
    const trimmedName = productName.trim();
    if (!trimmedName) return;

    const ppb = parseFloat(String(piecesPerBox).replace(',', '.')) || 1;
    let rawPurchasePrice = parseFloat(String(piecePrice).replace(',', '.')) || 0;
    const rawSellingPrice = parseFloat(String(sellingPrice).replace(',', '.')) || 0;
    let rawBoxPurchasePrice = parseFloat(String(boxPrice).replace(',', '.')) || 0;

    // Ensure price consistency for box products
    if (ppb > 1) {
      if (rawBoxPurchasePrice > 0 && (rawPurchasePrice === 0 || Math.abs(rawPurchasePrice - rawBoxPurchasePrice) < 0.001 || rawPurchasePrice > rawBoxPurchasePrice)) {
        rawPurchasePrice = rawBoxPurchasePrice / ppb;
      } else if (rawPurchasePrice > 0 && rawBoxPurchasePrice === 0) {
        rawBoxPurchasePrice = rawPurchasePrice * ppb;
      }
    }

    const finalPurchasePrice = parseFloat(rawPurchasePrice.toFixed(3));
    const finalSellingPrice = parseFloat(rawSellingPrice.toFixed(3));

    // Strict validation: selling price must ALWAYS be strictly greater than purchase price
    if (finalSellingPrice <= finalPurchasePrice) {
      setPriceError(`شرط التحقق: يجب أن يكون سعر البيع (${finalSellingPrice}) أكبر دائمًا من سعر الشراء (${finalPurchasePrice})`);
      return;
    }

    setIsSaving(true);
    setPriceError(null);

    const productData = {
      name: trimmedName,
      category: category || (categories[0]?.name || ""),
      purchasePrice: finalPurchasePrice,
      sellingPrice: finalSellingPrice,
      barcode: barcode.trim(),
      barcode2: barcode2.trim(),
      piecesPerBox: ppb,
      subItemsPerPiece: parseFloat(String(subItemsPerPiece).replace(',', '.')) || 1,
      unit: unit || 'piece',
      boxPurchasePrice: parseFloat(rawBoxPurchasePrice.toFixed(3)),
      // Keep existing stock values if editing, or default to 0 for new products
      quantity: cleanQuantity(product?.quantity ?? 0),
      posQuantity: cleanQuantity(product?.posQuantity !== undefined ? product.posQuantity : (product?.quantity ?? 0)),
      minQuantity: cleanQuantity(minQuantity),
    };
    try {
      await onSave(productData, imageFile, imageRemoved);
    } catch (err) {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      handlePerformSave();
    }
  };

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
            
            <div className="space-y-3 text-right">
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
                  type="search"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  data-form-type="other"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
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
                      type="search"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
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
                        type="search"
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-protonpass-ignore="true"
                        data-form-type="other"
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
                      type="text" 
                      inputMode="decimal"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      placeholder="0"
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500">{"عدد الحبات في القطعة (وحدة صغرى)"}</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
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
                    type="text" 
                    inputMode="numeric"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    value={piecesPerBox}
                    onChange={(e) => handlePiecesChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500">{t('box_purchase_price')}</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    data-form-type="other"
                    value={boxPrice}
                    onChange={(e) => handleBoxPriceChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" 
                  />
                </div>
              </div>

              {/* 5. Prices Row */}
              <div className="space-y-1 text-right">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500">{t('piece_purchase_price')}</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      value={piecePrice}
                      onChange={(e) => handlePiecePriceChange(e.target.value)}
                      required 
                      onKeyDown={handleKeyDown}
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 transition-colors ${
                        (parseFloat(String(sellingPrice)) > 0 && parseFloat(String(piecePrice)) > 0 && parseFloat(String(sellingPrice)) <= parseFloat(String(piecePrice)))
                          ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 focus:ring-amber-500'
                          : 'border-zinc-200 bg-zinc-50 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white'
                      }`} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500">{t('selling_price')}</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      data-form-type="other"
                      value={sellingPrice} 
                      onChange={(e) => handleSellingPriceChange(e.target.value)}
                      required 
                      onKeyDown={handleKeyDown}
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 transition-colors ${
                        (parseFloat(String(sellingPrice)) > 0 && parseFloat(String(piecePrice)) > 0 && parseFloat(String(sellingPrice)) <= parseFloat(String(piecePrice)))
                          ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 focus:ring-red-500'
                          : 'border-zinc-200 bg-zinc-50 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white'
                      }`} 
                    />
                  </div>
                </div>

                {/* Real-time inline warning for loss */}
                {parseFloat(String(sellingPrice)) > 0 && parseFloat(String(piecePrice)) > 0 && parseFloat(String(sellingPrice)) <= parseFloat(String(piecePrice)) && (
                  <p className="text-[11px] font-bold text-red-500 pt-0.5 flex items-center justify-end gap-1">
                    <span>يجب أن يكون سعر البيع أكبر من سعر الشراء ({parseFloat(String(piecePrice)).toFixed(3)})</span>
                    <AlertCircle size={13} className="shrink-0" />
                  </p>
                )}

                {/* Real-time warning for box price entered as piece price */}
                {Number(piecesPerBox) > 1 && parseFloat(String(piecePrice)) > 0 && parseFloat(String(sellingPrice)) >= (parseFloat(String(piecePrice)) * Number(piecesPerBox) * 0.8) && (
                  <div className="mt-2 p-2.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-lg text-purple-900 dark:text-purple-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle size={15} className="text-purple-600 shrink-0" />
                      <span>هل أدخلت سعر بيع العلبة كاملة ({sellingPrice}) بدلاً من سعر القطعة؟</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const ppb = Number(piecesPerBox) || 1;
                        const sp = parseFloat(String(sellingPrice)) || 0;
                        if (ppb > 0 && sp > 0) {
                          setSellingPrice(parseFloat((sp / ppb).toFixed(3)));
                        }
                      }}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-black shrink-0 transition-colors shadow-sm"
                    >
                      تقسيم على {piecesPerBox} حبات ({parseFloat(((parseFloat(String(sellingPrice)) || 0) / (Number(piecesPerBox) || 1)).toFixed(3))})
                    </button>
                  </div>
                )}
              </div>

              {/* Price validation error banner */}
              {priceError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between gap-2 text-right">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{priceError}</span>
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button 
                  type="button" 
                  onClick={handlePerformSave}
                  disabled={isSaving || !productName.trim() || (parseFloat(String(sellingPrice)) > 0 && parseFloat(String(piecePrice)) > 0 && parseFloat(String(sellingPrice)) <= parseFloat(String(piecePrice)))}
                  className="w-full rounded-lg bg-brand-600 py-3 text-sm font-bold text-white transition-all hover:bg-brand-700 active:scale-95 shadow-lg shadow-brand-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
