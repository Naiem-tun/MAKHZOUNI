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
  const { categories } = useCategories(); // use custom + default categories via hook
  
  // Local lists for Context
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);

  // Focus and comparison states
  const [assistantMode, setAssistantMode] = useState<'all' | 'category' | 'compare'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct1, setSelectedProduct1] = useState<string>('');
  const [selectedProduct2, setSelectedProduct2] = useState<string>('');
  const [compareCategoryFilter, setCompareCategoryFilter] = useState<string>('all');
  const [compareSearchFilter, setCompareSearchFilter] = useState<string>('');
  
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

  // Filtered products for comparison dropdowns
  const filteredCompareProducts = products.filter(p => {
    const matchesCategory = compareCategoryFilter === 'all' || p.category === compareCategoryFilter;
    const matchesSearch = !compareSearchFilter.trim() || p.name.toLowerCase().includes(compareSearchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
      // Build current local state of app to feed Gemini Context based on focus mode
      let filteredProducts = products;
      let contextNote = '';

      if (assistantMode === 'category' && selectedCategory !== 'all') {
        filteredProducts = products.filter(p => p.category === selectedCategory);
        contextNote = `ملاحظة: لقد اختار المستخدم التركيز على فئة "${selectedCategory}" للمقارنة واتخاذ قرارات الاستثمار. يرجى التجاوب وتوجيه النصيحة بخصوص هذه الفئة فقط لزيادة الدقة والفعالية وتجنب تشتيت العميل بالأصناف الأخرى.`;
      } else if (assistantMode === 'compare') {
        filteredProducts = products.filter(p => p.name === selectedProduct1 || p.name === selectedProduct2);
        contextNote = `ملاحظة هامة جداً لنجاح التاجر: يقوم المستخدم حالياً بمقارنة تفصيلية دقيقة لاتخاذ قرار شراء واستثمار بين المنتج الأول: "${selectedProduct1 || 'غير محدد'}" والمنتج الثاني: "${selectedProduct2 || 'غير محدد'}". ركز على مقارنة الربحية والمخزون الحالي وأسعار المبيعات والشراء وأي صفقات تاريخية متاحة لهما لتحدد أيهما أفضل للاستثمار وشراء كمية إضافية!`;
      }

      const fullStockDetails = filteredProducts.map(p => {
        const boxContext = (p.piecesPerBox && p.boxPurchasePrice) 
          ? ` | سعر كرتونة: ${p.boxPurchasePrice} | قطع بالكرتونة: ${p.piecesPerBox}` 
          : '';
        return `- '${p.name}' | الفئة: ${p.category || 'عام'} | جرد قطع: ${p.quantity || 0} | شراء قطعة: ${p.purchasePrice || 0} | بيع قطعة: ${p.sellingPrice || 0}${boxContext}`;
      }).join('\n');

      let filteredPurchases = purchases;
      if (assistantMode === 'category' && selectedCategory !== 'all') {
        const catPrdNames = new Set(filteredProducts.map(p => p.name));
        filteredPurchases = purchases.filter(p => catPrdNames.has(p.productName));
      } else if (assistantMode === 'compare') {
        filteredPurchases = purchases.filter(p => p.productName === selectedProduct1 || p.productName === selectedProduct2);
      }

      const recentPurchasesStr = filteredPurchases.map(p => {
        let dateStr = '';
        if (p.parsedDate) {
          dateStr = new Date(p.parsedDate).toLocaleDateString('ar-TN');
        }
        return `- ${p.productName || 'غير معروف'} | المورد: ${p.supplierName || 'غير مسجل'} | الكمية: ${p.qtyAdded || 0} | الإجمالي: ${p.amount || 0} | التاريخ: ${dateStr}`;
      }).join('\n');

      const contextString = `
[قاعدة أساسية وحاسمة]: الإجابات ونصائح الجدوى والشراء يجب أن تكون دائماً بحساب "الكرتونة" (سعر الكرتونة وعدد القطع بها) وليس "القطعة الفردية" لتوجيه المورد للبيع بالجملة بشكل صحيح!

[تفضيلات واستراتيجية التاجر - التزم بها دائماً بحذافيرها]:
1. الحد الأدنى للربح: التاجر يفضل دائماً نسبة ربح 15% كحد أدنى في أي حسابات لجدوى الاستثمار (البيع والشراء).
2. سياسة التخزين: التاجر يرفض بشدة شراء كميات تكفي لأكثر من شهر واحد. تجنب اقتراح كميات ضخمة تركد في المخزن.
3. مؤشر الدوران السريع: افترض دائماً أن "وجود كمية كبيرة حالية من منتج معين في المخزون تعني أن ذلك المنتج لديه سرعة دوران ومبيعات أعلى". اعتمد على هذا الافتراض لتقدير استهلاك الشهر إذا لم تتوفر بيانات المبيعات.
4. حساب الوحدات الموزونة (مثل الكغ): تعامل مع الوزن بحسب تسجيل التاجر (إذا كان مسجلاً بالقطعة، فالقطعة هي الوحدة).
5. المبدأ التجاري الأساسي: اتبع قاعدة عثمان بن عفان (كنت أعالج وأنمي، ولا أزدري ربحاً، ولا أشتري شيخاً، وأجعل الرأس رأسين) - بمعنى: شجع التاجر على عدم احتقار الربح القليل (البيع السريع والدوران)، وتجنب البضاعة الكاسدة (الشيخ)، وإعادة استثمار الأرباح لمضاعفة رأس المال.

تتضمن البيانات الحالية للمقارنة والتحليل:
${contextNote}

الأصناف المعنية للتوجيه:
${fullStockDetails || 'لا يوجد منتجات متاحة في هذا النطاق حالياً'}

المشتريات والطلبيات السابقة المرتبطة بهذه الأصناف:
${recentPurchasesStr || 'لا يوجد صفقات سابقة مسجلة لها'}
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
        <span>احصل على مقارنات فورية وتوجيه استثماري دقيق للأصناف ووفر استهلاك الـ Tokens بتحديد مجال التركيز.</span>
      </div>

      {/* Assistant Focus Panel */}
      <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-800/20 border-b border-zinc-150 dark:border-zinc-800 flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Layers size={14} className="text-brand-500 animate-pulse" />
            نطاق تركيز المساعد (توفير الـ Tokens وتعميق دقة القرار):
          </span>
          <div className="flex gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setAssistantMode('all');
                setSelectedCategory('all');
                setSelectedProduct1('');
                setSelectedProduct2('');
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                assistantMode === 'all' 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 hover:bg-zinc-200 dark:hover:bg-zinc-750 dark:text-zinc-350'
              }`}
            >
              كامل المحل
            </button>
            <button
              type="button"
              onClick={() => {
                setAssistantMode('category');
                setSelectedProduct1('');
                setSelectedProduct2('');
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                assistantMode === 'category' 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 hover:bg-zinc-200 dark:hover:bg-zinc-750 dark:text-zinc-350'
              }`}
            >
              فئة محددة 📂
            </button>
            <button
              type="button"
              onClick={() => {
                setAssistantMode('compare');
                setSelectedCategory('all');
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                assistantMode === 'compare' 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-650 hover:bg-zinc-200 dark:hover:bg-zinc-750 dark:text-zinc-350'
              }`}
            >
              مقارنة صنفين ⚖️
            </button>
          </div>
        </div>

        {assistantMode === 'category' && (
          <div className="flex flex-col gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-xl transition-all">
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">اختر الفئة المستهدفة للتحليل:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-850 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">كل الفئات (يتم إرسال كامل المخزون العريض)</option>
              {categories.map((c, index) => (
                <option key={`${c.id || c.name}-${index}`} value={c.name}>{c.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed font-medium">
              💡 حالياً ستتم الأسئلة والنقاش والتحليل بتركيز كامل على منتجات فئة <strong>"{selectedCategory === 'all' ? 'الكل' : selectedCategory}"</strong> فقط! هذا يمنع تجاوز الحد الأقصى للـ Tokens ويمنحك إجابة مركزة وسريعة.
            </p>
          </div>
        )}

        {assistantMode === 'compare' && (
          <div className="flex flex-col gap-2.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-xl transition-all">
            <div className="flex flex-col gap-1.5 p-2 bg-zinc-50/50 dark:bg-zinc-800/20 rounded-lg border border-zinc-100/50 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                ⚡ لتسهيل البحث، فلتر القوائم بالبحث أو الفئة:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-zinc-450 dark:text-zinc-500">الفئة:</span>
                  <select
                    value={compareCategoryFilter}
                    onChange={(e) => setCompareCategoryFilter(e.target.value)}
                    className="w-full px-2 py-1 bg-white dark:bg-zinc-800 text-[11px] text-zinc-800 dark:text-zinc-250 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="all">كل الفئات 📂</option>
                    {categories.map((c, index) => (
                      <option key={`${c.id || c.name}-${index}`} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-zinc-450 dark:text-zinc-500">ابحث بالاسم:</span>
                  <input
                    type="text"
                    placeholder="اكتب للبحث..."
                    value={compareSearchFilter}
                    onChange={(e) => setCompareSearchFilter(e.target.value)}
                    className="w-full px-2 py-1 bg-white dark:bg-zinc-800 text-[11px] text-zinc-800 dark:text-zinc-250 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            <label className="text-[11px] font-semibold text-zinc-650 dark:text-zinc-350">اختر السلعتين اللتين تود اتخاذ قرار استثماري والتحليل المقارن بينهما:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-400">المنتج الأول (A):</span>
                <select
                  value={selectedProduct1}
                  onChange={(e) => setSelectedProduct1(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-850 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">-- اختر السلعة الأولى --</option>
                  {filteredCompareProducts.map((p, index) => (
                    <option key={`${p.id}-${index}`} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-400">المنتج الثاني (B):</span>
                <select
                  value={selectedProduct2}
                  onChange={(e) => setSelectedProduct2(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-850 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">-- اختر السلعة الثانية --</option>
                  {filteredCompareProducts.map((p, index) => (
                    <option key={`${p.id}-${index}`} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedProduct1 && selectedProduct2 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-semibold">
                ✨ تم إعداد الذكاء الاصطناعي للمقارنة المباشرة والرياضية بين <strong>"{selectedProduct1}"</strong> و <strong>"{selectedProduct2}"</strong>. اسأله الآن: "أي المنتجَين تنصحني بزيادة الكمية منه ولماذا؟"
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                🔒 يرجى اختيار السلعتين من القائمة المنسدلة أعلاه لتزويد المساعد بالمعلومات الحصرية الخاصة بهما فوراً.
              </p>
            )}
          </div>
        )}
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
