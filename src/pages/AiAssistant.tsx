import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Bot, 
  User, 
  AlertCircle, 
  Check, 
  Plus, 
  TrendingUp, 
  BookOpen, 
  Wallet, 
  Info,
  Layers,
  HelpCircle,
  Package,
  Calendar
} from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { safeParseDate } from '../lib/utils';

interface Message {
  role: 'user' | 'model';
  content: string;
  isAction?: boolean;
  actionData?: any;
  actionStatus?: 'pending' | 'success' | 'failed';
}

export default function AiAssistant() {
  const { t } = useTranslation();
  const { user, settings, showToast } = useAppContext();
  const { categories } = useAppContext(); // use shared categories 
  
  // Local lists for Context
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(`makhzouni_ai_chat_${user?.uid || 'default'}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        role: 'model',
        content: `أهلاً بك في **مساعد مخزوني الذكي**! ✨ 
أنا وكيل الذكاء الاصطناعي الخاص بك والمصمم لمساعدتك في إدارة هذا المحل بكل ذكاء وسهولة.

**ماذا يمكنني أن أفعل لك؟**
1. 📊 **تحليل المخزون**: أخبرك بالمنتجات الأكثر مبيعاً أو التي أوشكت كميتها على النفاد.
2. 💸 **تتبع المصاريف والديون**: أحسب لك إجمالي مصاريفك وديونك وأرشدك بكيفية خفض التكاليف.
3. ✍️ **تسجيل تلقائي سريع**: يمكنك كتابة "أضف منتج حليب وعصير بسعر شراء 1 وسعر بيع 1.5 وعين الجرد 20" وسأقوم بتجهيز البطاقة لك بلمحة بصر لتأكيدها بضغطة واحدة!

*ملاحظة هامة 🔒: جميع محادثاتنا وذاكرتي مخزنة محلياً في متصفحك بشكل آمن، ويمكنك مسحها بالكامل في أي وقت بضغطة زر واحدة.*`
      }
    ];
  });
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Firestore data for prompt context
  useEffect(() => {
    if (!user) return;

    const unsubProducts = onSnapshot(collection(db, `users/${user.uid}/products`), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubExpenses = onSnapshot(collection(db, `users/${user.uid}/expenses`), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDebts = onSnapshot(collection(db, `users/${user.uid}/debts`), (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubShoppingList = onSnapshot(collection(db, `users/${user.uid}/smart_list`), (snap) => {
      setShoppingList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const purchasesQuery = query(
      collection(db, `users/${user.uid}/purchases`),
      orderBy('date', 'desc'),
      limit(200)
    );
    const unsubPurchases = onSnapshot(purchasesQuery, (snap) => {
      const parsed = snap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          parsedDate: safeParseDate(data.date).getTime() 
        };
      });
      parsed.sort((a, b) => b.parsedDate - a.parsedDate);
      setPurchases(parsed.slice(0, 30));
    });

    return () => {
      unsubProducts();
      unsubExpenses();
      unsubDebts();
      unsubShoppingList();
      unsubPurchases();
    };
  }, [user]);

  // Persist memory
  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`makhzouni_ai_chat_${user.uid}`, JSON.stringify(messages));
    }
  }, [messages, user]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Quick Action Handler
  const handleQuickAction = (text: string) => {
    setInputMessage(text);
    sendMessage(text);
  };

  // Parse server response for JSON Actions Proposals
  const parseActionProposal = (text: string): { cleanText: string; actionData: any } => {
    const startTag = '---ACTIONS_PROPOSAL---';
    const endTag = '---ACTIONS_PROPOSAL_END---';

    const startIndex = text.indexOf(startTag);
    const endIndex = text.indexOf(endTag);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const cleanText = (text.substring(0, startIndex) + text.substring(endIndex + endTag.length)).trim();
      const jsonStr = text.substring(startIndex + startTag.length, endIndex).trim();
      try {
        const actionData = JSON.parse(jsonStr);
        return { cleanText, actionData };
      } catch (e) {
        console.error('Error parsing proposal JSON', e);
      }
    }
    return { cleanText: text, actionData: null };
  };

  // Send Message
  const sendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    if (!overrideText) {
      setInputMessage('');
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Build current local state of app to feed Gemini Context
      const lowStockList = products.filter(p => (p.quantity || 0) <= (p.minQuantity || 5));
      const totalExpensesAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const totalRemainingDebt = debts.reduce((sum, d) => sum + (Number(d.remainingAmount !== undefined ? d.remainingAmount : d.amount) || 0), 0);
      const availableCategories = categories.map(c => c.name).join(', ') || 'عام، ألبان، مواد غذائية';

      const shoppingListDetails = shoppingList.map(item => 
        `- ${item.type === 'product' ? 'منتج للإضافة:' : 'ملاحظة:'} ${item.text}`
      ).join('\n');

      const fullStockDetails = products.map(p => 
        `- '${p.name}' | جرد: ${p.quantity || 0} | شراء: ${p.purchasePrice || 0} | بيع: ${p.sellingPrice || 0}`
      ).join('\n');

      const recentPurchasesStr = purchases.map(p => {
        let dateStr = '';
        if (p.parsedDate) {
          dateStr = new Date(p.parsedDate).toLocaleDateString('ar-TN');
        }
        return `- ${p.productName || 'غير معروف'} | المورد: ${p.supplierName || 'غير مسجل'} | الكمية: ${p.qtyAdded || 0} | الإجمالي: ${p.amount || 0} | التاريخ: ${dateStr}`;
      }).join('\n');

      const contextString = `
تتضمن البيانات الحالية:
المنتجات:
${fullStockDetails || 'لا يوجد'}

أحدث المشتريات:
${recentPurchasesStr || 'لا يوجد'}
      `;

      // Make API call to backend server
      const chatPayload = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: chatPayload,
          context: contextString
        })
      });

      if (!response.ok) {
        let errMessage = 'فشل الاتصال بالذكاء الاصطناعي';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMessage = errData.error;
          }
        } catch (e) {}
        throw new Error(errMessage);
      }

      const data = await response.json();
      const botResponseRaw = data.content || '';

      const { cleanText, actionData } = parseActionProposal(botResponseRaw);

      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: cleanText,
          isAction: !!actionData,
          actionData: actionData,
          actionStatus: actionData ? 'pending' : undefined
        }
      ]);

    } catch (error: any) {
      console.error(error);
      const isApiKeyIssue = error.message?.toLowerCase().includes('api key') || 
                           error.message?.toLowerCase().includes('apikey') ||
                           error.message?.toLowerCase().includes('api_key');
      
      const friendlyFeedback = isApiKeyIssue
        ? `⚠️ **خطأ في مفتاح الـ API لـ Gemini:**
مفتاح API الموفر غير صالح أو مفقود. لتفعيل الوكيل الذكي بنجاح:
1. اذهب لقائمة **الإعدادات (Settings)** في الجزء السفلي الأيمن من نافذة AI Studio.
2. اضغط على قسم **Secrets / Keys**.
3. أضف مفتاح API صالح لـ Google AI Studio تحت اسم المتغير \`GEMINI_API_KEY\`.
4. بعد الحفظ، يرجى تحديث الصفحة وإعادة التجربة.`
        : `عذراً، حدث خطأ أثناء محاولة الاتصال بـ Gemini:
_${error.message || 'خطأ غير معروف'}_

يرجى التأكد من جودة اتصال الإنترنت أو تحديث الصفحة وإعادة المحاولة.`;

      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: friendlyFeedback
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle action proposal approval (Executes actual Firestore write)
  const handleExecuteAction = async (msgIndex: number, actionData: any) => {
    if (!user) return;
    try {
      // Update message UI status to loading first
      setMessages(prev => {
        const copy = [...prev];
        copy[msgIndex] = { ...copy[msgIndex], actionStatus: 'pending' };
        return copy;
      });

      if (actionData.type === 'add_product') {
        const newProduct = {
          name: actionData.data.name || 'منتج مقترح',
          category: actionData.data.category || 'عام',
          purchasePrice: Number(actionData.data.purchasePrice) || 0,
          sellingPrice: Number(actionData.data.sellingPrice) || 0,
          quantity: Number(actionData.data.stock) || 0,
          minQuantity: Number(actionData.data.minQuantity) || 5,
          barcode: actionData.data.barcode || '',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, `users/${user.uid}/products`), newProduct);
        showToast(`تمت إضافة منتج "${newProduct.name}" بنجاح! 🎉`);
      } else if (actionData.type === 'add_expense') {
        const newExpense = {
          description: actionData.data.description || 'مصروف مقترح',
          amount: Number(actionData.data.amount) || 0,
          category: actionData.data.category || 'أخرى',
          date: serverTimestamp(),
          audited: false
        };

        await addDoc(collection(db, `users/${user.uid}/expenses`), newExpense);
        showToast(`تم تسجيل مصروف بقيمة ${newExpense.amount} دينار بنجاح! 💸`);
      }

      // Mark message action status as successful
      setMessages(prev => {
        const copy = [...prev];
        copy[msgIndex] = { ...copy[msgIndex], actionStatus: 'success' };
        return copy;
      });

    } catch (err) {
      console.error("Failed to execute proposal action:", err);
      showToast("فشلت عملية الإضافة الذكية");
      setMessages(prev => {
        const copy = [...prev];
        copy[msgIndex] = { ...copy[msgIndex], actionStatus: 'failed' };
        return copy;
      });
    }
  };

  // Clear Chat History (Control Memory)
  const clearChatMemory = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في إعادة تعيين المحادثة ومسح ذاكرة المساعد بالكامل؟')) {
      const resetMessages: Message[] = [
        {
          role: 'model',
          content: 'تم مسح ذاكرة المساعد وإعادة تعيين الجلسة بنجاح! 🔒 أهلاً بك من جديد، كيف يمكنني مساعدتك الآن؟'
        }
      ];
      setMessages(resetMessages);
      if (user?.uid) {
        localStorage.removeItem(`makhzouni_ai_chat_${user.uid}`);
      }
      showToast('تم مسح الذاكرة المحلية بالكامل');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-14rem)] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm overflow-hidden" id="ai-assistant-page">
      {/* Page Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 rounded-xl dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-white">الوكيل الذكي ✨</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">مساعد إحصائيات وقارئ محادثات ذكي يمنحك بيانات وإضافات فورية</p>
          </div>
        </div>
        <button
          onClick={clearChatMemory}
          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center"
          title="مسح المحادثة بالكامل"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Info Notice Badge */}
      <div className="px-4 py-2 bg-blue-50/60 dark:bg-blue-950/10 border-b border-blue-100/40 dark:border-blue-900/20 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
        <Info size={14} className="shrink-0" />
        <span>جميع البيانات والتحليلات ومعالجات النصوص مجانية بالكامل ومحفوظة محلياً بخصوصية تامة.</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 max-w-[85%] ${
                msg.role === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
              }`}
            >
              <div className={`p-2.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' 
                  : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              }`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>

              <div className="space-y-3">
                {/* Text Bubble */}
                <div className={`px-4 py-3 rounded-2xl leading-relaxed text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-zinc-150 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-tr-none'
                    : 'bg-zinc-50 border border-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:border-zinc-800 dark:text-zinc-200 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>

                {/* Structured Interactive Widget Actions */}
                {msg.isAction && msg.actionData && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="border border-brand-200/60 bg-brand-50/10 dark:border-brand-900/30 dark:bg-brand-950/5 rounded-2xl p-4 space-y-3 shadow-sm w-full max-w-sm"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400">
                      <Sparkles size={14} />
                      <span>
                        {msg.actionData.type === 'add_product' 
                          ? 'مقترح ذكي: إضافة صنف جديد للمخزون' 
                          : 'مقترح ذكي: تسجيل مصروف جديد'}
                      </span>
                    </div>

                    {msg.actionData.type === 'add_product' ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                          <span className="text-zinc-400">اسم المنتج:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{msg.actionData.data.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                          <span className="text-zinc-400">التصنيف:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{msg.actionData.data.category || 'عام'}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                          <span className="text-zinc-400">سعر المنتج بالشراء / البيع:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {msg.actionData.data.purchasePrice} د / {msg.actionData.data.sellingPrice} د
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">الجرد الأولي / الأدنى:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {msg.actionData.data.stock || 0} قطعة /حد تنبيه {msg.actionData.data.minQuantity || 5}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                          <span className="text-zinc-400">الوصف:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{msg.actionData.data.description}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                          <span className="text-zinc-400">القيمة المالية:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-amber-600 dark:text-amber-400">
                            {msg.actionData.data.amount} د.ت
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">التصنيف الفرعي:</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{msg.actionData.data.category || 'أخرى'}</span>
                        </div>
                      </div>
                    )}

                    {/* Button Confirmation Flow */}
                    {msg.actionStatus === 'pending' ? (
                      <button
                        onClick={() => handleExecuteAction(index, msg.actionData)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Plus size={14} />
                        <span>موافقة وإضافة إلى السجلات الآن ✨</span>
                      </button>
                    ) : msg.actionStatus === 'success' ? (
                      <div className="py-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-100/40 dark:border-emerald-900/20">
                        <Check size={14} />
                        <span>تمت الإضافة بنجاح إلى قاعدة المبيعات!</span>
                      </div>
                    ) : (
                      <div className="py-2 bg-zinc-50 text-zinc-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                        <AlertCircle size={14} />
                        <span>فشلت العملية، يرجى إعادة المحاولة.</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] ml-auto">
            <div className="p-2.5 h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <Bot size={18} className="animate-bounce" />
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-1.5 items-center py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce delay-200" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce delay-300" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Preset / Quick actions Panel */}
      <div className="p-3 border-t border-zinc-100/50 dark:border-zinc-800/50 flex gap-2 overflow-x-auto no-scrollbar bg-zinc-50/20 dark:bg-zinc-900/10">
        <button
          onClick={() => handleQuickAction("ما هي المنتجات التي تقترب كلياً من النفاد وتحتاج طلبية؟")}
          className="shrink-0 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border border-zinc-200/30 dark:border-zinc-700/30 active:scale-95"
        >
          <Package size={13} className="text-zinc-400" />
          <span>المنتجات الناقصة 📦</span>
        </button>
        <button
          onClick={() => handleQuickAction("حلل لي إحصائيات مصاريف وديون المحل الحالية وقدم لي نصيحة لتقليلها")}
          className="shrink-0 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border border-zinc-200/30 dark:border-zinc-700/30 active:scale-95"
        >
          <TrendingUp size={13} className="text-zinc-400" />
          <span>المصاريف الحالية 📊</span>
        </button>
        <button
          onClick={() => handleQuickAction("أريد تسجيل منتج جديد بسعر شراء 1 وسعر بيع 1.5 وجرد 40")}
          className="shrink-0 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border border-zinc-200/30 dark:border-zinc-700/30 active:scale-95"
        >
          <Plus size={13} className="text-emerald-500" />
          <span>تسجيل صنف سريع ➕</span>
        </button>
        <button
          onClick={() => handleQuickAction("أضف بسرعة مصروف بقيمة 50 دينار للمطبوعات والأوراق")}
          className="shrink-0 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border border-zinc-200/30 dark:border-zinc-700/30 active:scale-95"
        >
          <Wallet size={13} className="text-amber-500" />
          <span>تسجيل مصروف سريع 💸</span>
        </button>
      </div>

      {/* Input Message Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2 items-center"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="اسأل الوكيل عن أي معلومات، أو سجل منتجات ومصاريف بصوتك أو كتابة..."
          className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-500 border border-zinc-200/60 dark:border-zinc-800 text-sm"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer font-bold active:scale-95 hover:shadow"
        >
          <Send size={18} className="translate-x-[-1px] rotate-180" />
        </button>
      </form>
    </div>
  );
}
