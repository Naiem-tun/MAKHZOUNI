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
  { id: 'default_general', name: 'مواد غذائية عامة', icon: 'ShoppingBag' },
  { id: 'default_dairy', name: 'ألبان وبيض', icon: 'Milk' },
  { id: 'default_drinks', name: 'مشروبات', icon: 'CupSoda' },
  { id: 'default_sweets', name: 'حلويات وبسكويت', icon: 'Cookie' },
  { id: 'default_legumes', name: 'بقوليات وعجين', icon: 'Wheat' },
  { id: 'default_spices', name: 'توابل وهريسة', icon: 'Flame' },
  { id: 'default_cleaning', name: 'مواد تنظيف', icon: 'Sparkles' },
  { id: 'default_gas', name: 'غاز', icon: 'Flame' },
  { id: 'default_tobacco', name: 'تبغ وسجائر', icon: 'Cigarette' },
  { id: 'default_dry_fruits', name: 'فواكه جافة', icon: 'Nut' },
  { id: 'default_veg', name: 'خضر وغلال', icon: 'Apple' },
  { id: 'default_other', name: 'أخرى', icon: 'Package' },
];

export function useCategories() {
  const { settings, categories } = useAppContext();

  const activeDefaultCategories = defaultCategories.filter(
    c => !(settings.deletedCategories || []).includes(c.id)
  );

  const allCategories = [...categories, ...activeDefaultCategories];

  return { categories: allCategories, customCategories: categories, loading: false };
}
