import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { AuditLog } from '../types';
import { formatAppDate, safeParseDate } from '../lib/utils';
import { Activity, Plus, Edit2, Trash2, Package, Truck, CreditCard, ClipboardCheck, Wallet, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

export default function AuditLogs() {
  const { t } = useTranslation();
  const { settings } = useAppContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/auditLogs`),
      orderBy('timestamp', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: AuditLog[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus size={16} className="text-green-500" />;
      case 'update': return <Edit2 size={16} className="text-blue-500" />;
      case 'delete': return <Trash2 size={16} className="text-red-500" />;
      default: return <Activity size={16} className="text-zinc-500" />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'product': return <Package size={16} />;
      case 'supplier': return <Truck size={16} />;
      case 'debt': return <CreditCard size={16} />;
      case 'inventory': return <ClipboardCheck size={16} />;
      case 'expense': return <Wallet size={16} />;
      case 'purchase': return <ShoppingCart size={16} />;
      default: return <Activity size={16} />;
    }
  };

  const getActionName = (action: string) => {
    switch (action) {
      case 'create': return t('created') || 'إضافة';
      case 'update': return t('updated') || 'تعديل';
      case 'delete': return t('deleted') || 'حذف';
      default: return action;
    }
  };

  const getEntityName = (entityType: string) => {
    switch (entityType) {
      case 'product': return t('product') || 'منتج';
      case 'supplier': return t('supplier') || 'مورد';
      case 'debt': return t('debt') || 'دين';
      case 'inventory': return t('inventory') || 'جرد';
      case 'expense': return t('expense') || 'مصروف';
      case 'purchase': return t('purchase') || 'شراء';
      default: return entityType;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 rounded-xl flex items-center justify-center">
          <Activity size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {t('audit_logs') || 'سجل النشاطات'}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('audit_logs_subtitle') || 'تتبع جميع العمليات والتغييرات في النظام'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">
            <Activity className="animate-spin mx-auto mb-2 text-brand-500" size={24} />
            <p>{t('loading')}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Activity size={32} className="text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
              {t('no_audit_logs') || 'لا توجد نشاطات'}
            </h3>
            <p className="text-sm text-zinc-500">
              {t('no_audit_logs_desc') || 'لم يتم تسجيل أي عمليات بعد'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative">
                  {getEntityIcon(log.entityType)}
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-0.5">
                    {getActionIcon(log.action)}
                  </div>
                </div>
                
                <div className="flex-grow min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <span className={clsx(
                      "shrink-0 text-xs font-bold px-2 py-0.5 rounded-md",
                      log.action === 'create' ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                      log.action === 'update' ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                      "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                    )}>
                      {getActionName(log.action)}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white break-words whitespace-normal">
                      {getEntityName(log.entityType)}: {log.entityName}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words whitespace-normal mt-0.5">
                      {log.details}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-medium text-zinc-900 dark:text-white">
                    {formatAppDate(log.timestamp?.toDate() || new Date(), settings?.language || 'ar', t, {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
