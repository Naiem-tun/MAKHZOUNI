import { Product, Supplier, Category, Transaction, UserSettings, Expense, Debt } from '../types';

export const DEMO_SETTINGS: UserSettings = {
  currency: 'د.ت',
  language: 'ar',
  darkMode: false,
  storeName: 'متجر تجريبي (عرض ضيف)',
  showFinancials: true,
  showFloatingTotals: true,
  showSupplierSessionButton: true,
  showShoppingList: true,
  enablePOS: true,
  enableAIInvoice: true,
  enablePurchasesReports: true,
  defaultStockView: 'pieces'
};

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'مواد غذائية' },
  { id: 'cat-drinks', name: 'مشروبات وعصائر' },
  { id: 'cat-clean', name: 'مواد تنظيف' },
  { id: 'cat-sweets', name: 'حلويات وبسكويت' },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-prod-1',
    name: 'زيت زيتون بكر ممتاز 1 لتر',
    category: 'مواد غذائية',
    purchasePrice: 16.500,
    costPrice: 16.500,
    sellingPrice: 19.800,
    wholesalePrice: 18.500,
    quantity: 35,
    posQuantity: 35,
    minQuantity: 10,
    barcode: '6191234567890',
    unit: 'قارورة',
    piecesPerBox: 12,
    boxPurchasePrice: 198.000,
    boxSellingPrice: 237.600,
    updatedAt: new Date()
  },
  {
    id: 'demo-prod-2',
    name: 'قهوة مطحونة بن معطر 250 غ',
    category: 'مواد غذائية',
    purchasePrice: 4.800,
    costPrice: 4.800,
    sellingPrice: 6.200,
    wholesalePrice: 5.800,
    quantity: 6,
    posQuantity: 6,
    minQuantity: 12,
    barcode: '6199876543210',
    unit: 'علبة',
    piecesPerBox: 24,
    boxPurchasePrice: 115.200,
    boxSellingPrice: 148.800,
    updatedAt: new Date()
  },
  {
    id: 'demo-prod-3',
    name: 'مياه معدنية طبيعية 1.5 لتر',
    category: 'مشروبات وعصائر',
    purchasePrice: 0.650,
    costPrice: 0.650,
    sellingPrice: 0.900,
    wholesalePrice: 0.800,
    quantity: 120,
    posQuantity: 120,
    minQuantity: 30,
    barcode: '6191112223334',
    unit: 'قارورة',
    piecesPerBox: 6,
    boxPurchasePrice: 3.900,
    boxSellingPrice: 5.400,
    updatedAt: new Date()
  },
  {
    id: 'demo-prod-4',
    name: 'منظف أواني مركز بالليمون 1 لتر',
    category: 'مواد تنظيف',
    purchasePrice: 2.800,
    costPrice: 2.800,
    sellingPrice: 3.650,
    wholesalePrice: 3.300,
    quantity: 18,
    posQuantity: 18,
    minQuantity: 8,
    barcode: '6195556667778',
    unit: 'قارورة',
    piecesPerBox: 12,
    boxPurchasePrice: 33.600,
    boxSellingPrice: 43.800,
    updatedAt: new Date()
  },
  {
    id: 'demo-prod-5',
    name: 'بسكويت شوكولاتة محشو 150 غ',
    category: 'حلويات وبسكويت',
    purchasePrice: 1.100,
    costPrice: 1.100,
    sellingPrice: 1.500,
    wholesalePrice: 1.350,
    quantity: 4,
    posQuantity: 4,
    minQuantity: 15,
    barcode: '6199998887776',
    unit: 'قطعة',
    piecesPerBox: 30,
    boxPurchasePrice: 33.000,
    boxSellingPrice: 45.000,
    updatedAt: new Date()
  }
];

export const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: 'demo-sup-1',
    name: 'شركة تونس للتوزيع والمواد الغذائية',
    phone: '71 123 456',
    typeOfGoods: 'مواد غذائية وزيوت',
    transactionCount: 14,
    visitDays: [1, 4], // الإثنين والخميس
    totalPaid: 3420.500,
    updatedAt: new Date()
  },
  {
    id: 'demo-sup-2',
    name: 'مجمع المشروبات والمياه الوطنية',
    phone: '72 654 321',
    typeOfGoods: 'مشروبات ومياه معدنية',
    transactionCount: 8,
    visitDays: [2], // الثلاثاء
    totalPaid: 1850.000,
    updatedAt: new Date()
  }
];

export const DEMO_PURCHASES: Transaction[] = [
  {
    id: 'demo-tx-1',
    productId: 'demo-prod-1',
    productName: 'زيت زيتون بكر ممتاز 1 لتر',
    type: 'purchase',
    quantityChange: 24,
    price: 16.500,
    amount: 396.000,
    supplierId: 'demo-sup-1',
    supplierName: 'شركة تونس للتوزيع والمواد الغذائية',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-tx-2',
    productId: 'demo-prod-3',
    productName: 'مياه معدنية طبيعية 1.5 لتر',
    type: 'purchase',
    quantityChange: 60,
    price: 0.650,
    amount: 39.000,
    supplierId: 'demo-sup-2',
    supplierName: 'مجمع المشروبات والمياه الوطنية',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-tx-3',
    productId: 'demo-prod-4',
    productName: 'منظف أواني مركز بالليمون 1 لتر',
    type: 'purchase',
    quantityChange: 12,
    price: 2.800,
    amount: 33.600,
    supplierId: 'demo-sup-1',
    supplierName: 'شركة تونس للتوزيع والمواد الغذائية',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const DEMO_EXPENSES: Expense[] = [
  {
    id: 'demo-exp-1',
    description: 'فاتورة كهرباء المتجر',
    amount: 145.000,
    category: 'فواتير ومرافق',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    audited: true
  },
  {
    id: 'demo-exp-2',
    description: 'شراء أكياس تغليف ومطبوعات',
    amount: 38.500,
    category: 'مستلزمات عامة',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    audited: false
  }
];

export const DEMO_DEBTS: Debt[] = [
  {
    id: 'demo-debt-1',
    customerName: 'محمد الطاهر (حريف)',
    phone: '98 765 432',
    totalAmount: 68.500,
    status: 'unpaid',
    type: 'receivable',
    history: [
      {
        type: 'debt',
        amount: 68.500,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        note: 'باقي حساب مشتريات أسبوعية'
      }
    ],
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-debt-2',
    customerName: 'فاتن الماجري (حريفة)',
    phone: '24 112 233',
    totalAmount: 25.000,
    status: 'unpaid',
    type: 'receivable',
    history: [
      {
        type: 'debt',
        amount: 25.000,
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        note: 'دين مؤقت'
      }
    ],
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
];
