import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditAction, AuditEntityType, StaffActor } from '../types';

export const getCurrentStaffSessionActor = (): StaffActor | undefined => {
  try {
    const saved = localStorage.getItem('staff_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.staff) {
        return {
          staffId: parsed.staff.id,
          staffName: parsed.staff.name,
          role: parsed.staff.role,
        };
      }
    }
  } catch (e) {
    // Ignore error
  }
  return undefined;
};

export const logAudit = async (
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  entityName: string,
  details?: string,
  extra?: {
    performedBy?: StaffActor;
    previousValue?: any;
    newValue?: any;
  }
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const actor = extra?.performedBy || getCurrentStaffSessionActor();

    const auditRef = collection(db, `users/${user.uid}/auditLogs`);
    await addDoc(auditRef, {
      action,
      entityType,
      entityId,
      entityName,
      details: details || null,
      performedBy: actor || null,
      previousValue: extra?.previousValue || null,
      newValue: extra?.newValue || null,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
};

