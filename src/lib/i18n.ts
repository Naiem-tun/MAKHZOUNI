import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  ar: {
    translation: {
      "dashboard": "لوحة التحكم",
      "products": "المنتجات",
      "suppliers": "الموردين",
      "debts": "الديون",
      "inventory": "الجرد",
      "reports": "التقارير",
      "settings": "الإعدادات",
      "total_products": "إجمالي المنتجات",
      "low_stock": "نواقص المخزون",
      "inventory_value": "قيمة المخزون",
      "total_expenses": "إجمالي المصاريف",
      "last_purchases": "آخر عمليات الشراء",
      "add_product": "إضافة منتج",
      "add_supplier": "إضافة مورد",
      "add_debt": "إضافة دين",
      "search": "بحث...",
      "all_categories": "كل الفئات",
      "name": "الاسم",
      "category": "الفئة",
      "purchase_price": "سعر الشراء",
      "selling_price": "سعر البيع",
      "quantity": "الكمية",
      "min_quantity": "الحد الأدنى",
      "save": "حفظ",
      "cancel": "إلغاء",
      "delete": "حذف",
      "edit": "تعديل",
      "lang": "اللغة",
      "dark_mode": "الوضع الليلي",
      "currency": "العملة",
      "login_with_google": "تسجيل الدخول باستخدام جوجل",
      "login_with_phone": "تسجيل الدخول برقم الهاتف",
      "phone_number": "رقم الهاتف",
      "send_code": "إرسال الكود",
      "verification_code": "كود التحقق",
      "verify_code": "تحقق من الكود",
      "invalid_phone": "رقم هاتف غير صالح",
      "invalid_code": "كود غير صالح",
      "loading": "جاري التحميل...",
      "welcome": "أهلاً بك في H.STORE",
      "logout": "تسجيل الخروج",
      "profits_revenue": "الأرباح والإيرادات",
      "category_analysis": "تحليل الفئات الاستراتيجي",
      "financial_stats": "إحصائيات المال",
      "user_guide": "دليل الاستخدام الذكي",
      "manage_categories": "إدارة الفئات",
      "data_export": "إدارة البيانات والتصدير",
      "paid": "خالص",
      "over_due": "عليه",
      "jard_monthly": "الجرد الشهري",
      "enter_actual_quantity": "أدخل الكمية الفعلية المتبقية في المخزن",
      "overall_progress": "التقدم الإجمالي",
      "current_stock": "المخزون الحالي",
      "you_are_offline_using_cached_data": "أنت غير متصل - تتصفح البيانات المسجلة"
    }
  },
  en: {
    translation: {
      "dashboard": "Dashboard",
      "products": "Products",
      "suppliers": "Suppliers",
      "debts": "Debts",
      "inventory": "Inventory",
      "reports": "Reports",
      "settings": "Settings",
      "total_products": "Total Products",
      "low_stock": "Low Stock",
      "inventory_value": "Inventory Value",
      "total_expenses": "Total Expenses",
      "last_purchases": "Last Purchases",
      "add_product": "Add Product",
      "add_supplier": "Add Supplier",
      "add_debt": "Add Debt",
      "search": "Search...",
      "all_categories": "All Categories",
      "name": "Name",
      "category": "Category",
      "purchase_price": "Purchase Price",
      "selling_price": "Selling Price",
      "quantity": "Quantity",
      "min_quantity": "Min Quantity",
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "lang": "Language",
      "dark_mode": "Dark Mode",
      "currency": "Currency",
      "login_with_google": "Login with Google",
      "welcome": "Welcome to H.STORE",
      "logout": "Logout",
      "profits_revenue": "Profits & Revenue",
      "category_analysis": "Strategic Category Analysis",
      "financial_stats": "Financial Stats",
      "user_guide": "User Guide",
      "manage_categories": "Manage Categories",
      "data_export": "Data & Export",
      "paid": "Settled",
      "over_due": "Owes",
      "jard_monthly": "Monthly Inventory",
      "enter_actual_quantity": "Enter actual quantity left in stock",
      "overall_progress": "Overall Progress",
      "current_stock": "Current Stock",
      "you_are_offline_using_cached_data": "You are offline - Using cached data"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
