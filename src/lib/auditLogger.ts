import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditAction, AuditEntityType } from '../types';

export const logAudit = async (
  action: AuditAction,
  entityType: AuditEntityType,
  entityId?: string | null,
  entityName?: string | null,
  details?: string | null
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    // Guard against any undefined fields to prevent Firestore addDoc() errors
    const safeAction = String(action || 'update').slice(0, 50);
    const safeEntityType = String(entityType || 'other').slice(0, 100);
    const safeEntityId = String(entityId || 'unknown').slice(0, 128);
    const rawName = entityName != null ? String(entityName).trim() : '';
    const safeEntityName = (rawName || 'غير محدد').slice(0, 200);
    const safeDetails = details != null && String(details).trim() !== '' 
      ? String(details).slice(0, 2000) 
      : null;

    const auditRef = collection(db, `users/${user.uid}/auditLogs`);
    await addDoc(auditRef, {
      action: safeAction,
      entityType: safeEntityType,
      entityId: safeEntityId,
      entityName: safeEntityName,
      details: safeDetails,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
};
