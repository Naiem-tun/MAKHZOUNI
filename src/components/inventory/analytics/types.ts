import { UserSettings, Supplier, SupplierTransaction, Debt } from '../../../types';

export interface InventoryAnalyticsProps {
  inventoryReports: any[];
  products: any[];
  purchases: any[];
  supplierTransactions?: SupplierTransaction[];
  suppliers?: Supplier[];
  debts?: Debt[];
  settings: UserSettings;
}

export type TimeHorizon = 'cycle' | '3months' | '6months' | 'all';

export type AnalyticsSubTab = 
  | 'diagnostic' 
  | 'folio'
  | 'overview' 
  | 'categories' 
  | 'velocity' 
  | 'purchases' 
  | 'suppliers' 
  | 'shrinkage' 
  | 'trends';

export interface AnalyzedItem {
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  sellPrice: number;
  currentStock: number;
  liveCurrentStock: number;
  recordedReportStock: number;
  estimatedConsumedSinceInventory: number;
  soldQty: number;
  dailyVelocity: number;
  weeklyVelocity: number;
  piecesPerBox: number;
  weeklyBoxesVelocity: number | null;
  dailyBoxesVelocity: number | null;
  daysForOneBox: number | null;
  daysUntilStockout: number;
  revenue: number;
  profit: number;
  returnPerDinar: number;
  isDeadStock: boolean;
  deadCapital: number;
  stockStatus: 'depleted' | 'critical' | 'healthy' | 'excess' | 'stagnant';
  batchCount: number;
  isSurplus: boolean;
  surplusQuantity: number;
  surplusCostValue: number;
  prevStock: number | null;
  isDeletedFromStore: boolean;
  reportSellPrice: number;
  reportCostPrice: number;
  liveSellPrice: number;
  liveCostPrice: number;
}

export interface SummaryMetrics {
  totalRevenue: number;
  totalProfit: number;
  totalRemainingValue: number;
  totalExpenses: number;
  netProfit: number;
  totalSoldPieces: number;
  deadStockCount: number;
  deadStockCapital: number;
  criticalStockCount: number;
  growthRevenuePct: number | null;
  growthProfitPct: number | null;
  surplusValue: number;
  surplusCount: number;
  damageLoss: number;
}

export interface DiagnosticIndicator {
  id: string;
  title: string;
  value: string;
  status: 'excellent' | 'good' | 'neutral' | 'bad';
  statusLabel: string;
  details: string;
  advice: string;
}

export interface StoreHealthDiagnostic {
  score: number;
  scoreTitle: string;
  scoreBadge: string;
  scoreColor: string;
  scoreBg: string;
  scoreRing: string;
  indicators: DiagnosticIndicator[];
  story: string;
  curRev: number;
  prevRev: number | null;
  revPctChange: number | null;
  curNet: number;
  prevNet: number | null;
  netPctChange: number | null;
  curExpenses: number;
  curStock: number;
  prevStock: number | null;
  stockPctChange: number | null;
}

export interface MacroStrategicDiagnostic {
  count: number;
  periodName: string;
  macroScore: number;
  macroTitle: string;
  macroBadge: string;
  macroColor: string;
  macroBg: string;
  macroRing: string;
  story: string;
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  totalNetProfit: number;
  totalShrinkage: number;
  avgRevenuePerCycle: number;
  avgProfitPerCycle: number;
  avgNetPerCycle: number;
  avgExpensesPerCycle: number;
  startRev: number;
  endRev: number;
  revGrowthPct: number | null;
  startNet: number;
  endNet: number;
  netGrowthPct: number | null;
  startStock: number;
  endStock: number;
  stockGrowthPct: number | null;
  expenseRatio: number;
  avgDaysBetweenAudits: number;
  peakCycle: any;
  lowestCycle: any;
  indicators: DiagnosticIndicator[];
  reports: any[];
}

export interface CycleHighlights {
  starProfitItem: AnalyzedItem | null;
  starVelocityItem: AnalyzedItem | null;
  heaviestDeadStock: AnalyzedItem | null;
}

export interface MarketDebtsStats {
  unpaidCustomerDebts: number;
  customerDebtCount: number;
  unpaidSupplierDebts: number;
  supplierDebtCount: number;
}

export interface CategoryBreakdownItem {
  category: string;
  itemCount: number;
  revenue: number;
  profit: number;
  remainingValue: number;
  cogs: number;
  revPct: number;
  profPct: number;
  profitMargin: number;
  returnOnDinar: number;
}

export interface ParetoAnalysis {
  topItems: AnalyzedItem[];
  topItemsCount: number;
  totalItemsCount: number;
  topItemsProfit: number;
  totalStoreProfit: number;
  profitSharePct: number;
  itemsSharePct: number;
}

export interface MarginSqueezeItem {
  id?: string;
  name: string;
  barcode: string;
  category: string;
  previousCost: number;
  currentCost: number;
  costDiff: number;
  sellingPrice: number;
  currentMarginPct: number;
  previousMarginPct: number;
  marginLostPct: number;
  suggestedSellingPrice: number;
  unitsSoldOrStock: number;
  estimatedLoss: number;
  reason: 'supplier_hike' | 'negative_margin';
}

export interface MarginSqueezeAnalysis {
  items: MarginSqueezeItem[];
  count: number;
  totalEstimatedLoss: number;
}

export interface DayInvoiceItem {
  id: string;
  name: string;
  barcode?: string;
  qtyAdded: number;
  price: number;
  amount: number;
  numBoxes?: number;
  boxPrice?: number;
  piecesPerBox?: number;
  note?: string;
}

export interface DayInvoice {
  id: string;
  invoiceNumber: string;
  hasExplicitInvoiceNumber: boolean;
  supplierId?: string;
  supplierName: string;
  category: string;
  totalAmount: number;
  totalPieces: number;
  itemsCount: number;
  items: DayInvoiceItem[];
  date: Date;
}

export interface DayPurchasesGroup {
  key: string;
  date: Date;
  total: number;
  totalPieces: number;
  totalItems: number;
  invoicesCount: number;
  invoices: DayInvoice[];
  categoriesBreakdown: Record<string, { total: number; count: number; pieces: number }>;
  suppliersBreakdown: Record<string, { total: number; count: number; pieces: number; invoicesCount: number }>;
}

export interface SupplierPerformanceItem {
  productId: string;
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  sellPrice: number;
  unitProfit: number;
  marginPct: number;
  currentStockQty: number;
  currentStockCost: number;
  currentStockProfit: number;
}

export interface CalculatedSupplier {
  supplierId: string;
  supplierName: string;
  phone: string;
  typeOfGoods: string;
  recentTxDate: Date | null;
  currentStockCost: number;
  currentStockProfit: number;
  currentStockPieces: number;
  currentStockItemsCount: number;
  avgMargin: number;
  items: SupplierPerformanceItem[];
  isUnassigned: boolean;
}

export interface SupplierPerformanceData {
  suppliers: CalculatedSupplier[];
  allSuppliersCount: number;
  suppliersWithStockCount: number;
  grandCurrentStockCost: number;
  grandCurrentStockProfit: number;
  grandCurrentStockPieces: number;
  grandCurrentStockMargin: number;
  topProfitSupplier: CalculatedSupplier | null;
  topCostSupplier: CalculatedSupplier | null;
  topVolumeSupplier: CalculatedSupplier | null;
  topPiecesSupplier: CalculatedSupplier | null;
  topMarginSupplier: CalculatedSupplier | null;
  totalSuppliersCount: number;
}

export interface MultiInventoryTrendItem {
  id: string | number;
  name: string;
  shortName: string;
  fullDate: string;
  revenue: number;
  profit: number;
  netProfit: number;
  stockValue: number;
  expenses: number;
  isPeak: boolean;
}
