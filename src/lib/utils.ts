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
