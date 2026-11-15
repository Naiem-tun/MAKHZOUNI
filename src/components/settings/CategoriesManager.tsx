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
import { useFolioTheme } from '../folio/FolioPageChrome';

export const CategoriesManager = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const { user, settings, updateSettings } = useAppContext();
  const { categories: allCategories } = useCategories();
  const { theme } = useFolioTheme(Boolean(settings.darkMode), settings.folioThemeId);
  const [newCatName, setNewCatName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Package');
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
    <div className="max-w-4xl mx-auto space-y-5 pb-24" style={{ color: theme.text }}>
      <header
        className="flex items-center gap-3 border-b pb-4"
        style={{ borderColor: theme.border }}
      >
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 border flex items-center justify-center transition-colors cursor-pointer"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.textMuted }}>
            <span className="font-mono" style={{ color: theme.accent }}>SETTINGS · 01</span>
            <span>·</span>
            <span>{t('add_remove_categories')}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>
            {t('manage_categories')}
          </h1>
        </div>
        <div
          className="h-10 w-10 border flex items-center justify-center"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
            color: theme.accent,
          }}
        >
          <LayoutList size={20} />
        </div>
      </header>

      {/* Add New Category */}
      <div
        className="flex flex-col gap-3 p-4 border"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
            className="h-12 w-12 border flex items-center justify-center transition-colors cursor-pointer shrink-0"
            style={{
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.accent,
            }}
          >
            <SelectedIconComp size={22} />
          </button>
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            placeholder={t('new_category_placeholder')}
            className="flex-1 h-12 px-4 text-right border outline-none text-sm font-bold"
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.border,
              color: theme.text,
            }}
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={!newCatName.trim()}
            className="h-12 px-4 border text-xs font-black transition-opacity disabled:opacity-40 cursor-pointer shrink-0"
            style={{
              backgroundColor: theme.text,
              color: theme.surface,
              borderColor: theme.text,
            }}
          >
            إضافة
          </button>
        </div>

        <AnimatePresence>
          {isIconPickerOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 border"
                style={{ backgroundColor: theme.bg, borderColor: theme.border }}
              >
                {iconsList.map((item) => {
                  const active = selectedIcon === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setSelectedIcon(item.name);
                        setIsIconPickerOpen(false);
                      }}
                      className="h-10 flex items-center justify-center border transition-colors cursor-pointer"
                      style={
                        active
                          ? {
                              backgroundColor: theme.text,
                              color: theme.surface,
                              borderColor: theme.text,
                            }
                          : {
                              backgroundColor: theme.surface,
                              color: theme.textMuted,
                              borderColor: theme.border,
                            }
                      }
                    >
                      <item.icon size={18} />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Categories List */}
      <div
        className="border divide-y"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <AnimatePresence mode="popLayout">
          {allCategories.map((cat, index) => {
            const IconComp = categoryIcons[cat.icon] || Package;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                key={`${cat.id}-${index}`}
                className="flex items-center justify-between p-3"
                style={{ borderColor: theme.border }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 border flex items-center justify-center"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.accent,
                    }}
                  >
                    <IconComp size={18} />
                  </div>
                  <span className="font-bold text-sm" style={{ color: theme.text }}>
                    {cat.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="h-9 w-9 flex items-center justify-center border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.negative,
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
