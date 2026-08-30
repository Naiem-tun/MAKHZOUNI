import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Key, 
  Lock, 
  Unlock,
  Check, 
  X, 
  Edit3, 
  Trash2, 
  UserCheck, 
  UserX, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ShieldAlert, 
  ShieldCheck,
  Phone, 
  ShoppingBag, 
  Layers,
  Search,
  ArrowRight
} from 'lucide-react';
import { useStaffAuth } from '../contexts/StaffAuthContext';
import { useAppContext } from '../AppContext';
import { StaffMember, StaffRole } from '../types';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { PinPad } from '../components/auth/PinPad';

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
];

export default function StaffManagement() {
  const { t } = useTranslation();
  const { showToast, setActiveTab, settings } = useAppContext();
  const { 
    staffList, 
    currentStaff, 
    checkPermission, 
    addStaffMember, 
    updateStaffMember, 
    deleteStaffMember 
  } = useStaffAuth();

  // Admin PIN Gate State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('staff_mgmt_unlocked') === 'true';
  });
  const [gatePin, setGatePin] = useState('');
  const [gateError, setGateError] = useState('');
  const [isGateSubmitting, setIsGateSubmitting] = useState(false);
  const [showGateDigits, setShowGateDigits] = useState(false);

  // Modals & Forms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('cashier');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [showPinInList, setShowPinInList] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Update browser URL / History state to /staff
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({ isInnerTab: true }, '', '/staff');
      } catch {
        // Fallback for strict sandbox
      }
    }
  }, []);

  // Handle Admin PIN Gate Submission
  const handleGatePinChange = (enteredPin: string) => {
    setGatePin(enteredPin);
    setGateError('');

    if (enteredPin.length === 4) {
      setIsGateSubmitting(true);
      setTimeout(() => {
        // Find matching admin member or fallback default '0000' only if no custom admin exists
        const adminMembers = staffList.filter((s) => s.role === 'admin' && s.isActive);
        const isValidAdmin = 
          (adminMembers.length === 0 && enteredPin === '0000') ||
          adminMembers.some((a) => a.pin === enteredPin) ||
          (currentStaff?.role === 'admin' && currentStaff.pin === enteredPin) ||
          Boolean(settings.adminMasterPin && settings.adminMasterPin === enteredPin);

        if (isValidAdmin) {
          setIsUnlocked(true);
          sessionStorage.setItem('staff_mgmt_unlocked', 'true');
          setGateError('');
          showToast('تم التحقق من صلاحية المدير بنجاح', 'success');
        } else {
          setGateError('رمز الـ PIN غير صحيح. يجب إدخال رمز المدير العام.');
          setTimeout(() => setGatePin(''), 600);
        }
        setIsGateSubmitting(false);
      }, 200);
    }
  };

  const handleLockPage = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('staff_mgmt_unlocked');
    setGatePin('');
    showToast('تم قفل صفحة إدارة الطاقم', 'info');
  };

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setName('');
    setRole('cashier');
    setPin('');
    setPhone('');
    setSelectedColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setName(staff.name);
    setRole(staff.role);
    setPin(staff.pin);
    setPhone(staff.phone || '');
    setSelectedColor(staff.avatarColor || AVATAR_COLORS[0]);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('يرجى إدخال اسم الموظف');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setFormError('رمز الـ PIN يجب أن يتكون من 4 أرقام بالضبط');
      return;
    }

    // Check for duplicate PIN with other active members
    const pinConflict = staffList.some(
      (s) => s.pin === pin && s.id !== editingStaff?.id
    );
    if (pinConflict) {
      setFormError('رمز الـ PIN مستخدم بالفعل من قبل موظف آخر، يرجى اختيار رمز مختلف');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        await updateStaffMember(editingStaff.id, {
          name: name.trim(),
          role,
          pin,
          phone: phone.trim() || undefined,
          avatarColor: selectedColor,
          permissions: DEFAULT_ROLE_PERMISSIONS[role],
        });
        showToast('تم تحديث بيانات الموظف بنجاح', 'success');
      } else {
        await addStaffMember({
          name: name.trim(),
          role,
          pin,
          phone: phone.trim() || undefined,
          avatarColor: selectedColor,
          isActive: true,
          permissions: DEFAULT_ROLE_PERMISSIONS[role],
        });
        showToast('تمت إضافة الموظف الجديد بنجاح', 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء حفظ بيانات الموظف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    if (staff.id === currentStaff?.id && staff.isActive) {
      showToast('لا يمكنك تعطيل حسابك النشط حالياً', 'error');
      return;
    }

    try {
      const newStatus = !staff.isActive;
      await updateStaffMember(staff.id, { isActive: newStatus });
      showToast(newStatus ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب', 'info');
    } catch {
      showToast('فشل تغيير حالة الحساب', 'error');
    }
  };

  const handleDelete = async (staffId: string) => {
    if (staffId === currentStaff?.id) {
      showToast('لا يمكنك حذف الحساب المسجل به حالياً', 'error');
      return;
    }

    try {
      await deleteStaffMember(staffId);
      setIsDeletingId(null);
      showToast('تم حذف الموظف بنجاح', 'success');
    } catch {
      showToast('فشل حذف حساب الموظف', 'error');
    }
  };

  const togglePinVisibility = (staffId: string) => {
    setShowPinInList((prev) => ({ ...prev, [staffId]: !prev[staffId] }));
  };

  // Filtered staff list
  const filteredStaffList = staffList.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.phone && s.phone.includes(searchQuery));
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Admin PIN Gate View
  if (!isUnlocked) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
            <ShieldCheck size={32} />
          </div>

          <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-1">
            إدارة الطاقم والصلاحيات
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-5 leading-relaxed">
            هذه الصفحة محمية. أدخل رمز الـ PIN الخاص بالمدير العام لتأكيد الصلاحية وإدارة حسابات الموظفين.
          </p>

          {(!staffList.some(s => s.role === 'admin' && s.isActive && s.pin !== '0000')) && (
            <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
              <span>الرمز المبدئي للمدير:</span>
              <span className="font-mono font-bold tracking-wider bg-blue-600 text-white px-1.5 py-0.5 rounded">0000</span>
            </div>
          )}

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 mb-4">
            <PinPad
              pin={gatePin}
              onChange={handleGatePinChange}
              disabled={isGateSubmitting}
              isError={!!gateError}
              errorMessage={gateError}
              showDigits={showGateDigits}
              onToggleShowDigits={() => setShowGateDigits(!showGateDigits)}
            />
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <ArrowRight size={14} />
              <span>العودة لصفحة المنتجات</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Unlocked Full Staff Management View
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Action & Navigation Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                إدارة طاقم العمل والصلاحيات
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                <Unlock size={11} />
                مفتوح للمدير
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              إضافة وتعديل بيانات الكاشير، مسؤولي المخزن، والمدراء مع تخصيص رموز الـ PIN
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleLockPage}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            title="قفل الصفحة"
          >
            <Lock size={15} />
            <span>قفل الصفحة</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95"
          >
            <UserPlus size={16} />
            <span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      {/* Roles Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between font-bold text-sm text-purple-900 dark:text-purple-300 mb-1">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-purple-600" />
              <span>المدير (Admin)</span>
            </div>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full font-mono">
              {staffList.filter(s => s.role === 'admin').length}
            </span>
          </div>
          <p className="text-xs text-purple-700/80 dark:text-purple-400 leading-relaxed">
            صلاحيات كاملة للتقارير المالية، هوامش الربح، إدارة الأسعار، وتعديل بيانات الطاقم.
          </p>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between font-bold text-sm text-emerald-900 dark:text-emerald-300 mb-1">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-emerald-600" />
              <span>الكاشير (Cashier)</span>
            </div>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full font-mono">
              {staffList.filter(s => s.role === 'cashier').length}
            </span>
          </div>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400 leading-relaxed">
            البيع ونقاط البيع وإصدار الفواتير مع حجب أسعار الشراء والتقارير المالية الحساسة.
          </p>
        </div>

        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/50 p-4 rounded-2xl">
          <div className="flex items-center justify-between font-bold text-sm text-blue-900 dark:text-blue-300 mb-1">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <span>مسؤول المخزن (Storekeeper)</span>
            </div>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full font-mono">
              {staffList.filter(s => s.role === 'storekeeper').length}
            </span>
          </div>
          <p className="text-xs text-blue-700/80 dark:text-blue-400 leading-relaxed">
            الجرد وإدارة الكميات والموردين مع حظر الوصول لنقاط البيع والتقارير المالية.
          </p>
        </div>
      </div>

      {/* Staff Members Management Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
              قائمة الموظفين
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {filteredStaffList.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-hidden"
            >
              <option value="all">كل الأدوار</option>
              <option value="cashier">الكاشير</option>
              <option value="storekeeper">المخزن</option>
              <option value="admin">المدراء</option>
            </select>
          </div>
        </div>

        {filteredStaffList.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 dark:text-zinc-500">
            <Users size={44} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium mb-3">لا يوجد موظفون مطابقون</p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm"
            >
              <UserPlus size={15} />
              <span>إضافة أول موظف الآن</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filteredStaffList.map((staff) => {
              const roleInfo = ROLE_LABELS[staff.role] || ROLE_LABELS.cashier;
              const isCurrent = staff.id === currentStaff?.id;
              const isPinVisible = !!showPinInList[staff.id];

              return (
                <div
                  key={staff.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                    !staff.isActive ? 'opacity-60 bg-zinc-50/50 dark:bg-zinc-950/40' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-2xl text-base font-black text-white flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: staff.avatarColor || '#3b82f6' }}
                    >
                      {staff.name.slice(0, 2)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">
                          {staff.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            حسابك الحالي
                          </span>
                        )}
                        {!staff.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                            معطل
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleInfo.badgeBg}`}>
                          {roleInfo.ar}
                        </span>
                        {staff.phone && (
                          <span className="text-zinc-400 flex items-center gap-1 font-mono text-[11px]">
                            <Phone size={11} />
                            {staff.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & PIN */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                    {/* PIN preview box */}
                    <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 font-mono text-xs">
                      <Key size={13} className="text-zinc-400" />
                      <span className="font-bold tracking-widest text-zinc-800 dark:text-zinc-200">
                        {isPinVisible ? staff.pin : '••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePinVisibility(staff.id)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                        title={isPinVisible ? 'إخفاء الرمز' : 'إظهار الرمز'}
                      >
                        {isPinVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    {/* Active/Inactive Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(staff)}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
                        staff.isActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'
                      }`}
                      title={staff.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                    >
                      {staff.isActive ? <UserCheck size={16} /> : <UserX size={16} />}
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(staff)}
                      className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition"
                      title="تعديل البيانات والـ PIN"
                    >
                      <Edit3 size={16} />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setIsDeletingId(staff.id)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition"
                      title="حذف الحساب"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Staff Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    {editingStaff ? <Edit3 size={16} /> : <UserPlus size={16} />}
                  </div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                    {editingStaff ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    اسم الموظف *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد محمد (كاشير الصباح)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    الدور والصلاحيات *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cashier', 'storekeeper', 'admin'] as StaffRole[]).map((r) => {
                      const info = ROLE_LABELS[r];
                      const isSelected = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300 font-bold shadow-xs'
                              : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <span className="text-xs">{info.ar}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>

                {/* PIN Code */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    رمز الـ PIN للدخول (4 أرقام) *
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="0000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    يستخدم هذا الرمز لتسجيل الدخول السريع وفك قفل شاشة الكاشير.
                  </p>
                </div>

                {/* Phone (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                {/* Avatar Color */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    لون التمييز البصري
                  </label>
                  <div className="flex items-center gap-2">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-7 h-7 rounded-full transition flex items-center justify-center ${
                          selectedColor === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {selectedColor === c && <Check size={14} className="text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'جاري الحفظ...' : editingStaff ? 'تحديث البيانات' : 'إضافة الموظف'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} />
              </div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white mb-1">
                تأكيد حذف الموظف
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
                هل أنت متأكد من حذف هذا الحساب؟ لن يتمكن الموظف من تسجيل الدخول باستخدام رمز الـ PIN مجدداً.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeletingId(null)}
                  className="flex-1 py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(isDeletingId)}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
                >
                  تأكيد الحذف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
