import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { StaffMember, StaffRole, StaffPermissions, ShiftRecord, StaffSession } from '../types';
import { useAppContext } from '../AppContext';
import { hasPermission, DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { logAudit } from '../lib/auditLogger';

interface StaffAuthContextType {
  currentStaff: StaffMember | null;
  staffList: StaffMember[];
  isLocked: boolean;
  activeShift: ShiftRecord | null;
  isLoadingStaff: boolean;
  loginWithStaffPin: (staffId: string, pin: string) => Promise<{ success: boolean; staff?: StaffMember; error?: string }>;
  quickLoginWithPin: (pin: string) => Promise<{ success: boolean; staff?: StaffMember; error?: string }>;
  unlockScreen: (pin: string) => Promise<{ success: boolean; staff?: StaffMember; error?: string }>;
  lockScreen: () => void;
  logoutStaff: () => void;
  verifyAdminPin: (pin: string) => Promise<boolean>;
  addStaffMember: (staffData: Omit<StaffMember, 'id' | 'createdAt'>) => Promise<string>;
  updateStaffMember: (staffId: string, updates: Partial<StaffMember>) => Promise<void>;
  deleteStaffMember: (staffId: string) => Promise<void>;
  startShift: (openingCash: number, notes?: string) => Promise<string>;
  endShift: (closingCash: number, expectedCash?: number, notes?: string) => Promise<void>;
  checkPermission: (permission: keyof StaffPermissions) => boolean;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

const DEFAULT_ADMIN_STAFF: StaffMember = {
  id: 'admin-master',
  name: 'المدير العام',
  username: 'admin',
  role: 'admin',
  pin: '0000',
  avatarColor: '#f59e0b',
  isActive: true,
  createdAt: new Date().toISOString(),
};

export const StaffAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, settings, showToast } = useAppContext();

  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('cached_staff_list');
      return saved ? JSON.parse(saved) : [DEFAULT_ADMIN_STAFF];
    } catch {
      return [DEFAULT_ADMIN_STAFF];
    }
  });

  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(() => {
    try {
      const saved = localStorage.getItem('staff_session');
      if (saved) {
        const session: StaffSession = JSON.parse(saved);
        return session.staff || null;
      }
    } catch (e) {
      console.error('Failed to parse staff_session:', e);
    }
    return null;
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    // If not explicitly unlocked in current browser session, default to locked
    const sessionUnlocked = sessionStorage.getItem('staff_session_unlocked');
    if (sessionUnlocked === 'true') {
      try {
        const saved = localStorage.getItem('staff_session');
        if (saved) {
          const session: StaffSession = JSON.parse(saved);
          return !!session.isLocked;
        }
      } catch {
        // ignore
      }
      return false;
    }
    return true; // Lock by default on startup
  });

  const [activeShift, setActiveShift] = useState<ShiftRecord | null>(() => {
    try {
      const saved = localStorage.getItem('active_staff_shift');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentStaffRef = useRef<StaffMember | null>(currentStaff);

  useEffect(() => {
    currentStaffRef.current = currentStaff;
  }, [currentStaff]);

  const lockScreen = useCallback(() => {
    sessionStorage.removeItem('staff_session_unlocked');
    setIsLocked(true);
  }, []);

  const logoutStaff = useCallback(() => {
    const activeStaff = currentStaffRef.current;
    if (activeStaff) {
      logAudit('login', 'staff', activeStaff.id, activeStaff.name, 'تسجيل خروج الموظف', {
        performedBy: {
          staffId: activeStaff.id,
          staffName: activeStaff.name,
          role: activeStaff.role,
        },
      });
    }
    sessionStorage.removeItem('staff_session_unlocked');
    setCurrentStaff(null);
    setIsLocked(true);
    localStorage.removeItem('staff_session');
  }, []);

  // Sync staff members from Firestore
  useEffect(() => {
    if (!user) {
      setStaffList([DEFAULT_ADMIN_STAFF]);
      return;
    }

    setIsLoadingStaff(true);
    const staffColRef = collection(db, `users/${user.uid}/staff`);
    const q = query(staffColRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIsLoadingStaff(false);
        if (snapshot.empty) {
          // If Firestore has no staff yet, keep default admin and ensure it's seeded
          const initialList = [DEFAULT_ADMIN_STAFF];
          setStaffList(initialList);
          localStorage.setItem('cached_staff_list', JSON.stringify(initialList));
          
          // Seed the initial admin in Firestore
          setDoc(doc(db, `users/${user.uid}/staff`, DEFAULT_ADMIN_STAFF.id), {
            ...DEFAULT_ADMIN_STAFF,
            createdAt: serverTimestamp(),
          }).catch(console.error);
        } else {
          let list: StaffMember[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<StaffMember, 'id'>),
          }));

          // Ensure there is always at least one active Admin in the staff list
          const hasActiveAdmin = list.some((s) => s.role === 'admin' && s.isActive);
          if (!hasActiveAdmin) {
            list = [DEFAULT_ADMIN_STAFF, ...list];
          }

          // Sort so admin always comes first
          list.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return a.name.localeCompare(b.name, 'ar');
          });

          setStaffList(list);
          localStorage.setItem('cached_staff_list', JSON.stringify(list));

          // If current logged-in staff was updated, sync details using current ref (avoiding stale closure)
          const activeStaffId = currentStaffRef.current?.id;
          if (activeStaffId) {
            const updatedSelf = list.find((s) => s.id === activeStaffId);
            if (updatedSelf) {
              if (!updatedSelf.isActive) {
                // If deactivated, log them out
                logoutStaff();
                showToast('تم تعطيل حسابك من قبل الإدارة', 'error');
              } else {
                setCurrentStaff(updatedSelf);
              }
            }
          }
        }
      },
      (error) => {
        console.error('Staff onSnapshot error:', error);
        setIsLoadingStaff(false);
      }
    );

    return () => unsubscribe();
  }, [user, logoutStaff]);

  // Persist session changes
  useEffect(() => {
    if (currentStaff) {
      const session: StaffSession = {
        staff: currentStaff,
        loginTime: Date.now(),
        shiftId: activeShift?.id,
        isLocked,
      };
      localStorage.setItem('staff_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('staff_session');
    }
  }, [currentStaff, isLocked, activeShift]);

  // Persist active shift
  useEffect(() => {
    if (activeShift) {
      localStorage.setItem('active_staff_shift', JSON.stringify(activeShift));
    } else {
      localStorage.removeItem('active_staff_shift');
    }
  }, [activeShift]);

  // Auto-Lock Inactivity Timer using refs for maximum performance without re-subscribing
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastActivityTimestampRef = useRef(Date.now());

  const resetInactivityTimer = useCallback(() => {
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
    }

    const curStaff = currentStaffRef.current;
    const curLocked = isLockedRef.current;
    const curSettings = settingsRef.current;
    const autoLockMinutes = curSettings.autoLockMinutes ?? (curSettings.enableStaffAccounts ? 3 : 0);
    
    // If auto-lock is enabled (> 0) and we have a logged-in user who is not already locked
    if (autoLockMinutes > 0 && curStaff && !curLocked) {
      autoLockTimerRef.current = setTimeout(() => {
        setIsLocked(true);
      }, autoLockMinutes * 60 * 1000);
    }
  }, []);

  useEffect(() => {
    resetInactivityTimer();
  }, [currentStaff, isLocked, settings.autoLockMinutes, settings.enableStaffAccounts, resetInactivityTimer]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'click'];

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle to at most once every 3 seconds to ensure 0 UI lag
      if (now - lastActivityTimestampRef.current > 3000) {
        lastActivityTimestampRef.current = now;
        resetInactivityTimer();
      }
    };

    events.forEach((event) => window.addEventListener(event, handleUserActivity, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    };
  }, [resetInactivityTimer]);

  const loginWithStaffPin = async (
    staffId: string,
    pin: string
  ): Promise<{ success: boolean; staff?: StaffMember; error?: string }> => {
    // Find target staff, with fallback for admin IDs
    let targetStaff = staffList.find((s) => s.id === staffId);
    if (!targetStaff && (staffId === 'admin-master' || staffId === 'admin' || staffId === '')) {
      targetStaff = staffList.find((s) => s.role === 'admin' && s.isActive) || DEFAULT_ADMIN_STAFF;
    }

    if (!targetStaff) {
      return { success: false, error: 'الموظف غير موجود في النظام' };
    }
    if (!targetStaff.isActive) {
      return { success: false, error: 'هذا الحساب معطل حالياً، راجع المشرف' };
    }

    // Check PIN:
    // Staff accounts accept their exact configured PIN.
    // Admin accounts can also optionally accept settings.adminMasterPin if explicitly configured.
    const isAdminAccount = targetStaff.role === 'admin' || targetStaff.id === 'admin-master';
    const isPinValid =
      targetStaff.pin === pin ||
      (isAdminAccount && Boolean(settings.adminMasterPin && settings.adminMasterPin === pin));

    if (!isPinValid) {
      return { success: false, error: 'رمز الـ PIN غير صحيح' };
    }

    const freshStaff: StaffMember = { ...targetStaff };
    sessionStorage.setItem('staff_session_unlocked', 'true');
    setCurrentStaff(freshStaff);
    setIsLocked(false);

    // Save session immediately to localStorage for synchronous persistence
    localStorage.setItem(
      'staff_session',
      JSON.stringify({
        staff: freshStaff,
        loginTime: Date.now(),
        shiftId: activeShift?.id,
        isLocked: false,
      })
    );

    // Auto-redirect based on role
    if (freshStaff.role === 'cashier') {
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'pos' }));
    } else if (freshStaff.role === 'storekeeper') {
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'inventory' }));
    } else if (freshStaff.role === 'admin') {
      showToast(`مرحباً بك: ${freshStaff.name} (كامل الصلاحيات)`, 'success');
    }

    // Update lastLoginAt in Firestore
    if (user && db && targetStaff.id !== 'admin-master') {
      updateDoc(doc(db, `users/${user.uid}/staff`, targetStaff.id), {
        lastLoginAt: serverTimestamp(),
      }).catch(console.error);
    }

    logAudit('login', 'staff', targetStaff.id, targetStaff.name, `تسجيل دخول ناجح (${targetStaff.role})`, {
      performedBy: {
        staffId: targetStaff.id,
        staffName: targetStaff.name,
        role: targetStaff.role,
      },
    });

    return { success: true, staff: freshStaff };
  };

  const quickLoginWithPin = async (
    pin: string
  ): Promise<{ success: boolean; staff?: StaffMember; error?: string }> => {
    // 1. Direct match by PIN with active staff members
    let matchedStaff = staffList.find((s) => s.pin === pin && s.isActive);

    // 2. If no direct match and admin master PIN is configured in settings
    if (!matchedStaff && settings.adminMasterPin && settings.adminMasterPin === pin) {
      matchedStaff = staffList.find((s) => s.role === 'admin' && s.isActive) || DEFAULT_ADMIN_STAFF;
    }

    if (!matchedStaff) {
      return { success: false, error: 'رمز الـ PIN غير مطابق لأي موظف مسجل' };
    }

    const freshStaff: StaffMember = { ...matchedStaff };
    sessionStorage.setItem('staff_session_unlocked', 'true');
    setCurrentStaff(freshStaff);
    setIsLocked(false);

    localStorage.setItem(
      'staff_session',
      JSON.stringify({
        staff: freshStaff,
        loginTime: Date.now(),
        shiftId: activeShift?.id,
        isLocked: false,
      })
    );

    // Auto-redirect based on role
    if (freshStaff.role === 'cashier') {
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'pos' }));
    } else if (freshStaff.role === 'storekeeper') {
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'inventory' }));
    } else if (freshStaff.role === 'admin') {
      showToast(`مرحباً بك: ${freshStaff.name} (كامل الصلاحيات)`, 'success');
    }

    if (user && db && matchedStaff.id !== 'admin-master') {
      updateDoc(doc(db, `users/${user.uid}/staff`, matchedStaff.id), {
        lastLoginAt: serverTimestamp(),
      }).catch(console.error);
    }

    logAudit('login', 'staff', matchedStaff.id, matchedStaff.name, `تسجيل دخول سريع (${matchedStaff.role})`, {
      performedBy: {
        staffId: matchedStaff.id,
        staffName: matchedStaff.name,
        role: matchedStaff.role,
      },
    });

    return { success: true, staff: freshStaff };
  };

  const unlockScreen = async (pin: string): Promise<{ success: boolean; staff?: StaffMember; error?: string }> => {
    // 1. Check if the pin matches ANY active staff in the registered staff list
    const matchedStaff = staffList.find((s) => s.pin === pin && s.isActive);
    if (matchedStaff) {
      const freshStaff: StaffMember = { ...matchedStaff };
      sessionStorage.setItem('staff_session_unlocked', 'true');
      setCurrentStaff(freshStaff);
      setIsLocked(false);

      localStorage.setItem(
        'staff_session',
        JSON.stringify({
          staff: freshStaff,
          loginTime: Date.now(),
          shiftId: activeShift?.id,
          isLocked: false,
        })
      );

      // Auto-redirect based on role
      if (freshStaff.role === 'cashier') {
        window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'pos' }));
      } else if (freshStaff.role === 'storekeeper') {
        window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'inventory' }));
      }

      if (user && db && matchedStaff.id !== 'admin-master') {
        updateDoc(doc(db, `users/${user.uid}/staff`, matchedStaff.id), {
          lastLoginAt: serverTimestamp(),
        }).catch(console.error);
      }

      return { success: true, staff: freshStaff };
    }

    // 2. Master Admin Pin in settings fallback
    if (settings.adminMasterPin && settings.adminMasterPin === pin) {
      const adminStaff = staffList.find((s) => s.role === 'admin' && s.isActive) || DEFAULT_ADMIN_STAFF;
      const freshStaff: StaffMember = { ...adminStaff };
      sessionStorage.setItem('staff_session_unlocked', 'true');
      setCurrentStaff(freshStaff);
      setIsLocked(false);

      localStorage.setItem(
        'staff_session',
        JSON.stringify({
          staff: freshStaff,
          loginTime: Date.now(),
          shiftId: activeShift?.id,
          isLocked: false,
        })
      );

      showToast(`مرحباً بك: ${freshStaff.name} (كامل الصلاحيات)`, 'success');
      return { success: true, staff: freshStaff };
    }

    return { success: false, error: 'رمز الـ PIN غير صحيح لفتح الشاشة' };
  };

  const verifyAdminPin = async (pin: string): Promise<boolean> => {
    if (settings.adminMasterPin && settings.adminMasterPin === pin) {
      return true;
    }
    const hasAdminMatch = staffList.some((s) => s.role === 'admin' && s.pin === pin && s.isActive);
    if (hasAdminMatch) {
      return true;
    }
    // Only accept '0000' if no active admin is registered in the list
    const activeAdmins = staffList.filter((s) => s.role === 'admin' && s.isActive);
    if (activeAdmins.length === 0 && pin === '0000') {
      return true;
    }
    return false;
  };

  const addStaffMember = async (
    staffData: Omit<StaffMember, 'id' | 'createdAt'>
  ): Promise<string> => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const staffColRef = collection(db, `users/${user.uid}/staff`);
    const newDocRef = await addDoc(staffColRef, {
      ...staffData,
      createdAt: serverTimestamp(),
    });

    logAudit('create', 'staff', newDocRef.id, staffData.name, `إضافة موظف جديد بدور ${staffData.role}`);
    return newDocRef.id;
  };

  const updateStaffMember = async (
    staffId: string,
    updates: Partial<StaffMember>
  ): Promise<void> => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const staffDocRef = doc(db, `users/${user.uid}/staff`, staffId);
    await setDoc(
      staffDocRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    logAudit('update', 'staff', staffId, updates.name || 'موظف', 'تعديل بيانات الموظف والصلاحيات');
  };

  const deleteStaffMember = async (staffId: string): Promise<void> => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const target = staffList.find((s) => s.id === staffId);
    const staffDocRef = doc(db, `users/${user.uid}/staff`, staffId);
    await deleteDoc(staffDocRef);

    if (currentStaff?.id === staffId) {
      logoutStaff();
    }

    logAudit('delete', 'staff', staffId, target?.name || 'موظف', 'حذف حساب الموظف نهائياً');
  };

  const startShift = async (openingCash: number, notes?: string): Promise<string> => {
    if (!user || !currentStaff) throw new Error('لا يوجد موظف نشط لبدء الشفت');

    const shiftData: Omit<ShiftRecord, 'id'> = {
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      role: currentStaff.role,
      startTime: new Date().toISOString(),
      openingCash,
      status: 'open',
      notes: notes || '',
    };

    const shiftsColRef = collection(db, `users/${user.uid}/shifts`);
    const docRef = await addDoc(shiftsColRef, {
      ...shiftData,
      startTimeServer: serverTimestamp(),
    });

    const newShift: ShiftRecord = {
      id: docRef.id,
      ...shiftData,
    };
    setActiveShift(newShift);

    logAudit('shift_open', 'shift', docRef.id, `شفت ${currentStaff.name}`, `فتح شفت بمبلغ افتتاحي: ${openingCash}`, {
      performedBy: {
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        role: currentStaff.role,
      },
    });

    return docRef.id;
  };

  const endShift = async (
    closingCash: number,
    expectedCash: number = 0,
    notes?: string
  ): Promise<void> => {
    if (!user || !activeShift) return;

    const difference = closingCash - expectedCash;
    const shiftDocRef = doc(db, `users/${user.uid}/shifts`, activeShift.id!);

    await updateDoc(shiftDocRef, {
      closingCash,
      expectedCash,
      difference,
      endTime: new Date().toISOString(),
      endTimeServer: serverTimestamp(),
      status: 'closed',
      closingNotes: notes || '',
    });

    logAudit(
      'shift_close',
      'shift',
      activeShift.id!,
      `إغلاق شفت ${activeShift.staffName}`,
      `النقدية الفعلية: ${closingCash} - المتوقعة: ${expectedCash} - الفارق: ${difference}`,
      {
        performedBy: currentStaff
          ? {
              staffId: currentStaff.id,
              staffName: currentStaff.name,
              role: currentStaff.role,
            }
          : undefined,
      }
    );

    setActiveShift(null);
  };

  const checkPermission = useCallback(
    (permission: keyof StaffPermissions): boolean => {
      // If staff feature is completely disabled in settings, allow everything (single owner mode)
      if (settings.enableStaffAccounts === false && !currentStaff) {
        return true;
      }
      return hasPermission(currentStaff, permission);
    },
    [currentStaff, settings.enableStaffAccounts]
  );

  return (
    <StaffAuthContext.Provider
      value={{
        currentStaff,
        staffList,
        isLocked,
        activeShift,
        isLoadingStaff,
        loginWithStaffPin,
        quickLoginWithPin,
        unlockScreen,
        lockScreen,
        logoutStaff,
        verifyAdminPin,
        addStaffMember,
        updateStaffMember,
        deleteStaffMember,
        startShift,
        endShift,
        checkPermission,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
};

export const useStaffAuth = () => {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return context;
};
