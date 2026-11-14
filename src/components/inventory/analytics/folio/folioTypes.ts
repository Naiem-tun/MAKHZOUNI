export interface FolioTheme {
  id: string;
  name: string;
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  series: [string, string, string, string, string];
  positive: string;
  neutral: string;
  negative: string;
}

export interface FolioProductRecord {
  id: string;
  name: string;
  barcode: string;
  category: string;
  supplierName: string;
  costPrice: number;
  sellPrice: number;
  previousCost: number;
  stockQty: number;
  minQty: number;
  soldQty: number;
  stockValue: number;
  revenueValue: number;
  profitValue: number;
  marginPct: number;
  velocityScore: number;
  status: 'healthy' | 'low' | 'depleted' | 'stagnant';
  trendDirection: 'increasing' | 'unchanged' | 'decreasing';
  sparkline: number[];
}

export interface FolioCategoryRow {
  category: string;
  count: number;
  sharePct: number;
  totalValue: number;
  avgPrice: number;
  avgMarginPct: number;
  revenue: number;
  profit: number;
}

export interface FolioDumbbellItem {
  id: string;
  label: string;
  category: string;
  baselineVal: number;
  currentVal: number;
  deltaVal: number;
  deltaPct: number;
}

export interface FolioTimelineEvent {
  id: string;
  dateLabel: string;
  shortLabel: string;
  value: number;
  secondaryValue: number;
  title: string;
  description: string;
}

export interface FolioStackedPeriod {
  id: string;
  label: string;
  total: number;
  segments: {
    key: string;
    label: string;
    value: number;
    pct: number;
  }[];
}

export interface FolioHeatmapRow {
  category: string;
  cells: {
    key: string;
    label: string;
    score: number; // 0-100 normalized intensity
    displayValue: string;
  }[];
  overallScore: number;
}

export interface FolioDivergingRow {
  category: string;
  totalCount: number;
  excellentPct: number; // > 25% margin
  goodPct: number;      // 12-25% margin
  tightPct: number;     // 1-12% margin
  riskPct: number;      // <= 0% margin or depleted/stagnant
  healthScore: number;
}

export interface FolioScatterPoint {
  id: string;
  name: string;
  category: string;
  x: number; // quantity or daily velocity
  y: number; // margin %
  value: number;
}

export interface FolioDataset {
  mode: 'comparative' | 'live';
  modeLabel: string;
  modeDescription: string;
  totalProducts: number;
  totalCategories: number;
  totalValue: number;
  avgMarginPct: number;
  products: FolioProductRecord[];
  categories: FolioCategoryRow[];
  topCategoriesList: string[];
  dumbbellItems: FolioDumbbellItem[];
  dumbbellLabels: {
    baseline: string;
    current: string;
    unit: string;
  };
  timelineEvents: FolioTimelineEvent[];
  timelineUnitLabel: string;
  stackedPeriods: FolioStackedPeriod[];
  stackedSeriesMeta: { key: string; label: string }[];
  heatmapRows: FolioHeatmapRow[];
  heatmapColumns: { key: string; label: string }[];
  divergingRows: FolioDivergingRow[];
  scatterPoints: FolioScatterPoint[];
  scatterAxisLabels: { x: string; y: string };
}
