import React from 'react';
import { Package } from 'lucide-react';
import { useCategories, categoryIcons } from '../../hooks/useCategories';
import { cn } from '../../lib/utils';

export const ProductIcon = ({ category: catName, className }: { category?: string, className?: string }) => {
  const { categories } = useCategories();
  const category = categories.find(c => c.name === catName);
  const iconName = category?.icon || 'Package';
  const Icon = categoryIcons[iconName] || Package;

  return (
    <div className={cn(
      "w-9 h-9 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/20 border border-brand-100/20 dark:border-brand-900/10 flex items-center justify-center shrink-0 shadow-sm", 
      className
    )}>
      <Icon size={16} />
    </div>
  );
};
