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

export const getCountBreakdown = (total: number, piecesPerBox: number) => {
  if (piecesPerBox <= 1) return total.toString();
  const boxes = Math.floor(total / piecesPerBox);
  const pieces = total % piecesPerBox;
  if (boxes > 0 && pieces > 0) return `${boxes}c + ${pieces}p`;
  if (boxes > 0) return `${boxes}c`;
  return `${pieces}p`;
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
  if (typeof val === 'number') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof val === 'string') {
    // Try to parse DD/MM/YYYY or DD-MM-YYYY
    const parts = val.split(/[/-]/);
    if (parts.length === 3 && parts[0].length <= 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const parsedStr = new Date(year, month, day);
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
  return date.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'en-GB', options);
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
