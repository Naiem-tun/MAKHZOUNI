export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export interface UserSettings {
  currency: string;
  language: 'ar' | 'en';
  darkMode: boolean;
  storeName: string;
  showFinancials?: boolean;
  showFloatingTotals?: boolean;
  showSupplierSessionButton?: boolean;
  showShoppingList?: boolean;
  profitCalculationMethod?: 'markup' | 'margin';
  email?: string;
  displayName?: string;
  deletedCategories?: string[];
  catalogPin?: string;
  enablePurchasesReports?: boolean;
  requireSupplierSession?: boolean;
  defaultStockView?: 'pieces' | 'boxes';
  deleteDataPassword?: string;
  syncImages?: boolean;
  enablePOS?: boolean;
  enableAIInvoice?: boolean;
  enablePriceAudit?: boolean;
  posDeductInventory?: boolean;
  showCashierStockButton?: boolean;
  receiptLogo?: string;
  receiptThankYouMessage?: string;
  receiptPolicy?: string;
  receiptPaperSize?: '80mm' | '58mm';
  lastSuppliersClearDate?: any;
  cycleStartDay?: number;
  cycleEndDay?: number;
}

export interface CashTransaction {
  id?: string;
  type: 'in' | 'out' | 'purchase' | 'sale';
  amount: number;
  date: string;
  description: string;
  referenceId?: string;
  createdAt?: any;
}

export interface Product {
  id?: string;
  name: string;
  category: string;
  purchasePrice: number;
  costPrice?: number;
  sellingPrice: number;
  wholesalePrice?: number;
  quantity: number;
  posQuantity?: number;
  minQuantity: number;
  barcode?: string;
  barcode2?: string;
  unit?: string;
  piecesPerBox?: number;
  subItemsPerPiece?: number;
  boxPurchasePrice?: number;
  boxSellingPrice?: number;
  aliases?: string[];
  hasLocalImage?: boolean;
  hasCloudImage?: boolean;
  _copiedFromId?: string;
  isDraft?: boolean;
  priceVerified?: boolean;
  priceVerifiedAt?: any;
  updatedAt: any;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  typeOfGoods: string;
  transactionCount: number;
  visitDays?: number[];
  totalPaid?: number;
  updatedAt: any;
}

export interface SupplierTransaction {
  id?: string;
  supplierId: string;
  amount: number;
  date: any;
  note: string;
  updatedAt: any;
}

export interface Payment {
  amount: number;
  date: any;
  note?: string;
}

export interface DebtHistory {
  type: 'debt' | 'payment';
  amount: number;
  date: any;
  note?: string;
}

export interface Debt {
  id?: string;
  customerName: string;
  phone?: string;
  totalAmount: number;
  status: 'paid' | 'unpaid';
  type?: 'receivable' | 'payable';
  payments?: Payment[];
  history?: DebtHistory[];
  updatedAt: any;
}

export interface Category {
  id?: string;
  name: string;
  key?: string;
  icon?: string;
}

export interface Transaction {
  id?: string;
  productId: string;
  productName: string;
  type: 'purchase' | 'sale' | 'jard' | 'adjustment';
  quantityChange: number;
  price: number;
  amount?: number;
  supplierId?: string;
  supplierName?: string;
  date: any;
}

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  category: string;
  date: any;
  audited?: boolean;
}

export interface MonitoredProductHistory {
  date: any;
  quantity: number;
  type: 'start' | 'check' | 'purchase';
  note?: string;
  addedQuantity?: number;
}

export interface MonitoredProduct {
  id?: string;
  productId: string;
  name: string;
  initialQuantity: number;
  currentQuantity: number;
  startDate: any;
  lastCheckDate: any;
  history: MonitoredProductHistory[];
}

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditEntityType = 'product' | 'supplier' | 'debt' | 'inventory' | 'expense' | 'purchase';

export interface AuditLog {
  id?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  details?: string;
  timestamp: any;
}

export interface InvoiceItemData {
  productId: string;
  name: string;
  quantity: number;
  price: number; // selling price
  cost: number; // cost price (purchase price)
  total: number; // price * quantity
  profit: number; // (price - cost) * quantity
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  items: InvoiceItemData[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  createdAt: any;
}
