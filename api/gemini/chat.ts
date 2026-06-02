import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS configuration if needed
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
    const apiKey = process.env.GEMINI_API_KEY;
    const isMissingOrPlaceholder = !apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY";

    if (isMissingOrPlaceholder) {
      return res.status(400).json({ 
        error: "عذراً، لم يتم العثور على مفتاح API صالح. يرجى التأكد من إضافته في إعدادات مساحة العمل (Secrets) وإعادة المحاولة."
      });
    }

    const { messages, context } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });

    const contents = (messages || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || '' }]
    }));

    const systemInstruction = `أنت هو "الوكيل الذكي" المساعد الذكي المدمج في تطبيق "مخزوني" لإدارة المحلات المستودعات والجرد.
تتكلم العربية بطلاقة وبأسلوب منسق، مهني ومحفز ومساعد للغاية.

أهدافك وقواعد عملك الأساسية:
1. اقرأ السياق (Context) المرفق لك بعناية واهتمام شديد. فهو يحتوي على المنتجات الحالية، والمنتجات الناقصة، وإجمالي المصاريف والعمليات، وإجمالي الديون المتبقية. استخدم هذه الأرقام الدقيقة للإجابة بدقة بالغة وبأسلوب تحليلي ثاقب ومفيد.
2. إذا طلب المستخدم أو ألمح إلى رغبته في إضافة منتج أو مصروف، مثل ("أضف حليب بسعر بيع 2 دينار وبسعر شراء 1.5 وجرد 20")، قم بالإجابة مهنئاً ومباركاً له ثم صِغ هذا التغيير وأدرج في نهاية رسالتك كتلة JSON دقيقة تبدأ بالتحديد بـ "---ACTIONS_PROPOSAL---" وتنتهي بـ "---ACTIONS_PROPOSAL_END---". هذه الكتلة ستتحول فوراً في واجهته إلى بطاقة تفاعلية جاهزة بلمسة زر لتأكيد الإضافة الآمنة!

النماذج والخواص المطلوبة للكتل:

أ) بالنسبة لإضافة منتج (add_product):
---ACTIONS_PROPOSAL---
{
  "type": "add_product",
  "data": {
    "name": "اسم المنتج المقترح (بالعربية)",
    "category": "تصنيف المنتج المتوفر المناسب، أو عام",
    "purchasePrice": 1.5,
    "sellingPrice": 2.0,
    "stock": 20,
    "minQuantity": 5,
    "barcode": ""
  }
}
---ACTIONS_PROPOSAL_END---

ب) بالنسبة لإضافة مصروف (add_expense):
---ACTIONS_PROPOSAL---
{
  "type": "add_expense",
  "data": {
    "amount": 50.0,
    "description": "تفاصيل ووصف المصروف",
    "category": "أخرى"
  }
}
---ACTIONS_PROPOSAL_END---

3. أجب عن تتبع المشتريات والتوقعات بحكمة: توقع متى تفرغ السلع وكيف يخطط لطلب طلبيات جديدة بناءً على الجرد، وقدم النصائح الذهبية لتنظيم المال.
4. طمئن العميل بأنك لا تقرأ إلا الجداول الموضحة هنا محلياً، وبأن ذاكرتك مخزنة بالكامل وجالسة بداخل متصفحه الشخصي (Local Storage) فلا أحد يطلع عليها، وبأن استخدامه ومساعدته مجانية تماماً!

السياق الحالي الفوري للمحل:
${context || 'لا يوجد سياق متوفر'}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.65,
      }
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error("Gemini Vercel Route Error:", error);
    res.status(500).json({ error: error.message || "فشلت معالجة ذكاء مساعد مخزوني" });
  }
}
