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

export type StaffRole = 'admin' | 'cashier' | 'storekeeper';

export interface StaffPermissions {
  canViewCostPrices: boolean;
  canApplyDiscounts: boolean;
  canCancelInvoices: boolean;
  canViewFinancialReports: boolean;
  canManageStock: boolean;
  canManageStaff: boolean;
  canManageDebts: boolean;
  canManageSuppliers: boolean;
  canPerformInventory: boolean;
  canEditProductPrices: boolean;
  maxDiscountPercentage?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  username?: string;
  role: StaffRole;
  pin: string; // 4-6 digit security PIN
  phone?: string;
  avatarColor?: string;
  isActive: boolean;
  customPermissions?: Partial<StaffPermissions>;
  permissions?: StaffPermissions;
  createdAt: any;
  lastLoginAt?: any;
}

export interface StaffSession {
  staff: StaffMember;
  loginTime: number;
  shiftId?: string;
  isLocked: boolean;
}

export interface ShiftRecord {
  id?: string;
  staffId: string;
  staffName: string;
  role: StaffRole;
  startTime: any;
  endTime?: any;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  totalSales?: number;
  invoicesCount?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface StaffActor {
  staffId: string;
  staffName: string;
  role: StaffRole;
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
  // RBAC & Staff Management Settings
  enableStaffAccounts?: boolean;
  autoLockMinutes?: number; // 0 = off, 1, 2, 5, 10 minutes
  requireAdminPinForVoid?: boolean;
  requireAdminPinForDiscount?: boolean;
  adminMasterPin?: string;
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

export type AuditAction = 'create' | 'update' | 'delete' | 'sale' | 'void' | 'stock_adjust' | 'shift_open' | 'shift_close' | 'login' | 'price_change';
export type AuditEntityType = 'product' | 'supplier' | 'debt' | 'inventory' | 'expense' | 'purchase' | 'invoice' | 'shift' | 'staff' | 'settings';

export interface AuditLog {
  id?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  performedBy?: StaffActor;
  details?: string;
  previousValue?: any;
  newValue?: any;
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

export interface GoodsReceiptItem {
  id: string;
  name: string;
  barcode?: string;
  quantity: number;
  unitType: 'piece' | 'carton';
  piecesPerBox: number;
  costPrice?: number;
  sellingPrice?: number;
  total?: number;
  matchedProductId?: string;
  matchedProductName?: string;
  copiedFromProductId?: string;
  isNewProduct?: boolean;
  originalInvoiceName?: string;
}

export interface GoodsReceipt {
  id?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  supplierId?: string;
  supplierName?: string;
  paymentMethod?: 'cash' | 'credit';
  status: 'pending' | 'approved' | 'rejected';
  items: GoodsReceiptItem[];
  totalAmount?: number;
  totalItemsCount: number;
  totalUnitsCount: number;
  submittedBy?: StaffActor;
  reviewedBy?: StaffActor;
  rejectedReason?: string;
  createdAt: any;
  approvedAt?: any;
}

