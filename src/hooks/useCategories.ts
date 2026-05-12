import { useAppContext } from '../AppContext';
import { 
  Package, Cookie, Coffee, Milk, Apple, Trash2, Zap, LayoutList, 
  Beef, Pizza, GlassWater, Cherry, Candy, IceCream, Grape, 
  Banana, Carrot, Nut, Cigarette, Heart, Home, ShoppingBag, 
  Printer, Monitor, Smartphone, Check, Fish, Flame, 
  CupSoda, Wheat, Sprout, Egg, Leaf, Sparkles
} from 'lucide-react';

export const categoryIcons: Record<string, any> = {
  Package,
  Coffee,
  Apple,
  Milk,
  Beef,
  Cookie,
  Fish,
  Pizza,
  GlassWater,
  CupSoda,
  Cherry,
  Candy,
  IceCream,
  Grape,
  Banana,
  Carrot,
  Wheat,
  Sprout,
  Nut,
  Egg,
  Cigarette,
  Sparkles,
  Flame,
  Zap,
  Leaf,
  Heart,
  Home,
  ShoppingBag,
  Printer,
  Monitor,
  Smartphone,
  Check
};

export const defaultCategories = [
  { id: 'default_general', name: 'مواد غذائية عامة', key: 'cat_general', icon: 'ShoppingBag' },
  { id: 'default_dairy', name: 'ألبان وبيض', key: 'cat_dairy', icon: 'Milk' },
  { id: 'default_drinks', name: 'مشروبات', key: 'cat_drinks', icon: 'CupSoda' },
  { id: 'default_sweets', name: 'حلويات وبسكويت', key: 'cat_sweets', icon: 'Cookie' },
  { id: 'default_legumes', name: 'بقوليات وعجين', key: 'cat_legumes', icon: 'Wheat' },
  { id: 'default_spices', name: 'توابل وهريسة', key: 'cat_spices', icon: 'Flame' },
  { id: 'default_cleaning', name: 'مواد تنظيف', key: 'cat_cleaning', icon: 'Sparkles' },
  { id: 'default_gas', name: 'غاز', key: 'cat_gas', icon: 'Flame' },
  { id: 'default_tobacco', name: 'تبغ وسجائر', key: 'cat_tobacco', icon: 'Cigarette' },
  { id: 'default_dry_fruits', name: 'فواكه جافة', key: 'cat_dry_fruits', icon: 'Nut' },
  { id: 'default_veg', name: 'خضر وغلال', key: 'cat_veg', icon: 'Apple' },
  { id: 'default_other', name: 'أخرى', key: 'cat_other', icon: 'Package' },
];

export function useCategories() {
  const { settings, categories } = useAppContext();

  const activeDefaultCategories = defaultCategories.filter(
    c => !(settings.deletedCategories || []).includes(c.id)
  );

  const allCategories = [...categories, ...activeDefaultCategories];

  return { categories: allCategories, customCategories: categories, loading: false };
}
