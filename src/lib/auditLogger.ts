import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditAction, AuditEntityType } from '../types';

export const logAudit = async (
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  entityName: string,
  details?: string
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const auditRef = collection(db, `users/${user.uid}/auditLogs`);
    await addDoc(auditRef, {
      action,
      entityType,
      entityId,
      entityName,
      details: details || null,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
};
