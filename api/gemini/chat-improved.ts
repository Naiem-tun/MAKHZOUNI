import { GoogleGenAI } from "@google/genai";

// نوع البيانات
interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  context: {
    products?: any[];
    totalInventoryValue?: number;
    topProduct?: any;
    lowStockProducts?: any[];
    recentTransactions?: any[];
  };
}

// تنظيف وتحقق من الإدخال
const sanitizeMessage = (msg: string): string => {
  return msg
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .slice(0, 1000);
};

const validateMessage = (msg: string): boolean => {
  const cleaned = sanitizeMessage(msg);
  return cleaned.length > 0 && cleaned.length <= 1000;
};

// تنسيق السياق بشكل احترافي
const formatContext = (context: ChatRequest['context']): string => {
  if (!context) return 'لا يوجد بيانات متاحة حالياً';

  const productCount = context.products?.length || 0;
  const lowStockCount = context.lowStockProducts?.length || 0;
  const topProductName = context.topProduct?.name || 'غير محدد';

  return `
═══════════════════════════════════
📊 ملخص المخزن الحالي:
═══════════════════════════════════
📦 عدد المنتجات: ${productCount}
💰 قيمة المخزون الكلية: ${context.totalInventoryValue?.toFixed(2) || '0'} د.ت
⭐ الأكثر مبيعاً: ${topProductName}
⚠️ المنتجات الناقصة: ${lowStockCount}

📋 آخر المعاملات:
${context.recentTransactions?.slice(0, 3)
  .map((t: any) => `  • ${t.productName}: ${t.type} بتاريخ ${t.date}`)
  .join('\n') || '  لا توجد معاملات حديثة'}
═══════════════════════════════════`;
};

// اختيار الإعدادات حسب نوع السؤال
const getOptimalConfig = (messageContent: string) => {
  const isAnalytical = /تحليل|مقارنة|إحصائيات|أرباح|نسبة|متوسط/.test(messageContent);
  
  return {
    temperature: isAnalytical ? 0.2 : 0.65,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 500,
  };
};

// System Instruction محسّن
const createSystemInstruction = (context: ChatRequest['context']): string => {
  return `أنت مساعد ذكي متخصص في إدارة المخازن لتطبيق "مخزوني".

🎯 PERSONALITY & TONE:
• احترافي وودود وموثوق
• إجاباتك مختصرة (جملة إلى ثلاث جمل)
• تستخدم اللغة العربية فقط
• تتجنب المصطلحات المعقدة

📌 DATA FOCUS:
• ركز فقط على بيانات المنتجات والمشتريات والمبيعات
• لا تتحدث عن الأمان أو التشفير أو التخزين التقني
• أجب مباشرة على السؤال بدون مقدمات طويلة

💡 CAPABILITIES:
1. الإجابة عن أسئلة الجرد والمخزون
2. مقارنة المنتجات والأسعار
3. تحليل المبيعات والأرباح
4. اقتراح منتجات جديدة

⚠️ CONSTRAINTS:
• لا تختلق بيانات غير موجودة
• اطلب توضيح إذا كان السؤال غامضاً
• استخدم العملة المحلية (د.ت)

📝 ACTION PROPOSAL FORMAT:
إذا لزم الحال، أضف هذا الإجراء في نهاية الرسالة:
---ACTIONS_PROPOSAL---
{
  "type": "add_product" | "update_product" | "adjust_stock",
  "data": { /* البيانات المطلوبة */ }
}
---ACTIONS_PROPOSAL_END---

${formatContext(context)}`;
};

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // التحقق من API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(400).json({ 
        error: "عذراً، لم يتم العثور على مفتاح API صالح. يرجى التأكد من إضافته في الإعدادات."
      });
    }

    // معالجة الطلب
    const { messages, context } = req.body as ChatRequest;

    // التحقق من الرسائل
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "لا توجد رسائل للمعالجة" });
    }

    // تنظيف وتصفية الرسائل
    const cleanedMessages = messages
      .map((msg: any) => ({
        ...msg,
        content: sanitizeMessage(msg.content || '')
      }))
      .filter(msg => validateMessage(msg.content));

    if (cleanedMessages.length === 0) {
      return res.status(400).json({ error: "الرسائل غير صحيحة أو فارغة" });
    }

    // تحويل الرسائل لصيغة Gemini
    const contents = cleanedMessages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // إنشاء العميل
    const ai = new GoogleGenAI({ apiKey });

    // اختيار الإعدادات المثلى
    const lastMessage = cleanedMessages[cleanedMessages.length - 1].content;
    const config = getOptimalConfig(lastMessage);

    // استدعاء Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: createSystemInstruction(context),
        ...config
      }
    });

    res.json({ 
      content: response.text,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Gemini API Error:", error);

    let errorMessage = "فشلت معالجة الطلب";
    const errString = error.message || String(error);

    if (error.status === 429 || errString.includes("429") || errString.includes("quota")) {
      errorMessage = "عذراً، لقد تجاوزت حد الطلبات المسموح. انتظر لحظات ثم حاول مجدداً.";
    } else if (errString.includes("401") || errString.includes("authentication")) {
      errorMessage = "مفتاح API غير صحيح أو منتهي الصلاحية.";
    } else {
      errorMessage = error.message || errorMessage;
    }

    res.status(500).json({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}
