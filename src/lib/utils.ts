import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { OperationType, type FirestoreErrorInfo } from "../types";
import { auth } from "./firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, symbol: string = 'TND', language: string = 'ar') {
  try {
    return amount.toLocaleString(language === 'ar' ? 'ar-TN' : 'en-US', {
      style: 'currency',
      currency: symbol,
      minimumFractionDigits: symbol === 'TND' ? 3 : 2,
      maximumFractionDigits: symbol === 'TND' ? 3 : 2,
    });
  } catch (e) {
    const formattedNum = amount.toLocaleString(language === 'ar' ? 'ar-TN' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return language === 'ar' ? `${formattedNum} ${symbol}` : `${symbol} ${formattedNum}`;
  }
}

export function safeParseFloat(val: any): number {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * تقريب مالي دقيق وآمن لـ 3 خانات عشرية (المليم التونسي / العملات المالية)
 * يمنع تراكم أخطاء الفاصلة العائمة (IEEE 754 Floating Point Precision issues)
 */
export function roundMoney(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num) || !isFinite(num)) return 0;
  if (Math.abs(num) < 0.00001) return 0;
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return Math.abs(rounded) < 0.00001 ? 0 : rounded;
}

export function cleanQuantity(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return 0;
  // If absolute value is smaller than 1e-5 (e.g. -1.6653345369377348e-16), snap to 0
  if (Math.abs(num) < 0.00001) return 0;
  // Round to 4 decimal places to eliminate IEEE-754 precision noise (like 0.8000000000000007)
  const rounded = Math.round((num + Number.EPSILON) * 10000) / 10000;
  return Math.abs(rounded) < 0.00001 ? 0 : rounded;
}

export function formatQuantity(val: any, maxDecimals: number = 3): string {
  const cleaned = cleanQuantity(val);
  if (cleaned === 0) return '0';
  const fixed = cleaned.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

export function sanitizeProduct<T extends Record<string, any>>(prod: T): T {
  if (!prod) return prod;
  const sanitized = { ...prod } as any;
  if ('quantity' in prod) {
    sanitized.quantity = cleanQuantity(prod.quantity);
  }
  if ('posQuantity' in prod) {
    sanitized.posQuantity = cleanQuantity(prod.posQuantity);
  }
  if ('minQuantity' in prod) {
    sanitized.minQuantity = cleanQuantity(prod.minQuantity);
  }
  if ('purchasePrice' in prod && typeof prod.purchasePrice === 'number') {
    sanitized.purchasePrice = parseFloat(prod.purchasePrice.toFixed(3));
  }
  if ('sellingPrice' in prod && typeof prod.sellingPrice === 'number') {
    sanitized.sellingPrice = parseFloat(prod.sellingPrice.toFixed(3));
  }
  if ('boxPurchasePrice' in prod && typeof prod.boxPurchasePrice === 'number') {
    sanitized.boxPurchasePrice = parseFloat(prod.boxPurchasePrice.toFixed(3));
  }
  return sanitized;
}

export const getCountBreakdown = (total: number, piecesPerBox: number) => {
  const cleanTotal = cleanQuantity(total);
  if (piecesPerBox <= 1) return formatQuantity(cleanTotal);
  const boxes = Math.floor(cleanTotal / piecesPerBox);
  const pieces = cleanQuantity(cleanTotal % piecesPerBox);
  if (boxes > 0 && pieces > 0) return `${boxes}c + ${formatQuantity(pieces)}p`;
  if (boxes > 0) return `${boxes}c`;
  return `${formatQuantity(pieces)}p`;
};

export function safeParseDate(val: any): Date {
  if (!val) return new Date(0); // If truly missing, return 1970
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (val.toDate && typeof val.toDate === 'function') {
    const rawDate = val.toDate();
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return rawDate;
    }
  }
  // Handle Firestore Timestamp plain objects ({ seconds: ..., nanoseconds: ... } or { _seconds: ... })
  if (val && typeof val === 'object') {
    if (typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof val._seconds === 'number') {
      const d = new Date(val._seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (typeof val === 'number') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Try YYYY-MM-DD format (set to midday to prevent timezone shift across date boundary)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      const parsedStr = new Date(y, m - 1, d, 12, 0, 0);
      if (!isNaN(parsedStr.getTime())) return parsedStr;
    }
    // Try to parse DD/MM/YYYY or DD-MM-YYYY
    const parts = trimmed.split(/[/-]/);
    if (parts.length === 3 && parts[0].length <= 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const parsedStr = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(parsedStr.getTime())) return parsedStr;
      }
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(0);
}

export function formatAppDate(date: Date, language: string, t: any, options?: Intl.DateTimeFormatOptions): string {
  // Check if it's the 1970 timestamp which implies an unknown/missing date
  if (date.getTime() === 0) {
    return t('unknown_date');
  }
  const formatted = date.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-GB', options);
  // Remove invisible LTR/RTL marks that break numeric date rendering
  return formatted.replace(/[\u200E\u200F\u061C\u202A-\u202C\u2066-\u2069]/g, '');
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function safeDispatchEvent(name: string, detail?: any) {
  try {
    // Attempt standard constructor
    const event = new CustomEvent(name, { detail, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
  } catch (e) {
    // Fallback for environments where CustomEvent constructor is illegal or restricted
    try {
      const event = document.createEvent('CustomEvent');
      event.initCustomEvent(name, true, true, detail);
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Failed to dispatch event:', name, err);
    }
  }
}

/**
 * Commits a large array of Firestore write operations by splitting them into batches
 * conforming to Firestore's 500 operations per batch limit (using safe chunk size of 400).
 */
export async function commitBatchesInChunks(
  db: any,
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    ref: any;
    data?: any;
  }>,
  createBatchFn: (firestoreInstance: any) => any
): Promise<void> {
  if (!operations || operations.length === 0) return;
  const CHUNK_SIZE = 400; // Well below 500 limit
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = createBatchFn(db);
    for (const op of chunk) {
      if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}
