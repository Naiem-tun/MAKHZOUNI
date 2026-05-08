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
  email?: string;
  displayName?: string;
  deletedCategories?: string[];
}

export interface Product {
  id?: string;
  name: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minQuantity: number;
  barcode?: string;
  barcode2?: string;
  piecesPerBox?: number;
  boxPurchasePrice?: number;
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
}

export interface DebtHistory {
  type: 'debt' | 'payment';
  amount: number;
  date: any;
}

export interface Debt {
  id?: string;
  customerName: string;
  phone?: string;
  totalAmount: number;
  status: 'paid' | 'unpaid';
  payments?: Payment[];
  history?: DebtHistory[];
  updatedAt: any;
}

export interface Category {
  id?: string;
  name: string;
}

export interface Transaction {
  id?: string;
  productId: string;
  productName: string;
  type: 'purchase' | 'sale' | 'jard' | 'adjustment';
  quantityChange: number;
  price: number;
  date: any;
}

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  category: string;
  date: any;
}
