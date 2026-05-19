import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft,
  LayoutList,
  Package,
  Trash2
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../../lib/utils';
import { OperationType } from '../../types';
import { useAppContext } from '../../AppContext';
import { useCategories, categoryIcons } from '../../hooks/useCategories';

export const CategoriesManager = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const { user, settings, updateSettings } = useAppContext();
  const { customCategories: categories, categories: allCategories } = useCategories();
  const [newCatName, setNewCatName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Package');
  const [isAdding, setIsAdding] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const iconsList = Object.entries(categoryIcons).map(([name, icon]) => ({ name, icon }));

  const SelectedIconComp = categoryIcons[selectedIcon] || Package;

  const handleAddCategory = () => {
    if (!user || !newCatName.trim()) return;
    
    const name = newCatName.trim();
    const icon = selectedIcon;
    setNewCatName('');
    setSelectedIcon('Package');

    addDoc(collection(db, `users/${user.uid}/categories`), {
      name,
      icon,
      createdAt: serverTimestamp()
    }).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/categories`);
    });
  };

  const handleDeleteCategory = (id: string) => {
    if (!user) return;
    
    if (id.startsWith('default_')) {
      updateSettings({ deletedCategories: [...(settings.deletedCategories || []), id] });
    } else {
      deleteDoc(doc(db, `users/${user.uid}/categories`, id)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/categories/${id}`);
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <button onClick={onBack} className="h-10 w-10 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-right">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{t('manage_categories')}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('add_remove_categories')}</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 dark:bg-zinc-800">
          <LayoutList size={24} />
        </div>
      </header>

      {/* Add New Category */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
        <div className="flex gap-3">
          <button 
            onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
            className="h-14 w-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-brand-600 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm transition-all hover:border-brand-500/50"
          >
            <SelectedIconComp size={24} />
          </button>
          <input 
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            placeholder={t('new_category_placeholder')}
            className="flex-1 h-14 px-5 text-right rounded-2xl bg-white border border-zinc-200 outline-none focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:text-white shadow-sm"
          />
        </div>

        <AnimatePresence>
          {isIconPickerOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                {iconsList.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSelectedIcon(item.name);
                      setIsIconPickerOpen(false);
                    }}
                    className={`h-11 flex items-center justify-center rounded-xl transition-all ${
                      selectedIcon === item.name 
                        ? 'bg-brand-50 text-brand-600 border border-brand-200 dark:bg-brand-900/30 dark:border-brand-800 shadow-sm' 
                        : 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <item.icon size={20} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Categories List */}
      <div className="space-y-3 pb-24">
        <AnimatePresence mode="popLayout">
          {allCategories.map(cat => {
            const IconComp = categoryIcons[cat.icon] || Package;
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={cat.id}
                className="flex items-center justify-between p-3 pl-4 rounded-2xl bg-white border border-zinc-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                    <IconComp size={20} />
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-white text-base">{cat.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="h-10 w-10 flex items-center justify-center rounded-2xl text-white transition-all active:scale-90 shadow-sm"
                    style={{ backgroundColor: '#B34C36' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
