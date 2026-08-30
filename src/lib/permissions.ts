import { StaffRole, StaffPermissions, StaffMember } from '../types';

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  admin: {
    canViewCostPrices: true,
    canApplyDiscounts: true,
    canCancelInvoices: true,
    canViewFinancialReports: true,
    canManageStock: true,
    canManageStaff: true,
    canManageDebts: true,
    canManageSuppliers: true,
    canPerformInventory: true,
    canEditProductPrices: true,
    maxDiscountPercentage: 100,
  },
  cashier: {
    canViewCostPrices: false,
    canApplyDiscounts: true,
    canCancelInvoices: false,
    canViewFinancialReports: false,
    canManageStock: false,
    canManageStaff: false,
    canManageDebts: true, // Can record debt payment or create customer debt at POS
    canManageSuppliers: false,
    canPerformInventory: false,
    canEditProductPrices: false,
    maxDiscountPercentage: 10,
  },
  storekeeper: {
    canViewCostPrices: false,
    canApplyDiscounts: false,
    canCancelInvoices: false,
    canViewFinancialReports: false,
    canManageStock: true,
    canManageStaff: false,
    canManageDebts: false,
    canManageSuppliers: true, // For receiving purchases
    canPerformInventory: true,
    canEditProductPrices: false,
    maxDiscountPercentage: 0,
  },
};

export const ROLE_LABELS: Record<StaffRole, { ar: string; en: string; descriptionAr: string; color: string; badgeBg: string }> = {
  admin: {
    ar: 'المدير / المشرف',
    en: 'Admin / Manager',
    descriptionAr: 'صلاحيات كاملة، الإدارة والتقارير المالية والديون وإدارة الطاقم',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  cashier: {
    ar: 'الكاشير',
    en: 'Cashier',
    descriptionAr: 'واجهة بيع سريعة، تسجيل المقبوضات، خدمة جهز واستلم بدون رؤية الأرباح وأسعار الشراء',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  storekeeper: {
    ar: 'مسؤول المخزن',
    en: 'Storekeeper',
    descriptionAr: 'جرد المخزون، إدخال بضائع وفواتير الموردين، تحديث الكميات',
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: 'صلاحيات كاملة، الإدارة والتقارير المالية والديون وإدارة الطاقم',
  cashier: 'واجهة بيع سريعة، تسجيل المقبوضات، بدون رؤية الأرباح وأسعار الشراء',
  storekeeper: 'جرد المخزون، إدخال بضائع وفواتير الموردين، وتحديث الكميات',
};

export const hasPermission = (
  staff: StaffMember | null | undefined,
  permission: keyof StaffPermissions
): boolean => {
  if (!staff) {
    return false;
  }

  // If custom override is defined on the member
  if (staff.customPermissions && staff.customPermissions[permission] !== undefined) {
    return !!staff.customPermissions[permission];
  }

  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[staff.role] || DEFAULT_ROLE_PERMISSIONS.cashier;
  return !!roleDefaults[permission];
};
