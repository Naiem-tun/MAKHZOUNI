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

3. أجب عن تتبع المشتريات والتوقعات بحكمة: توقع متى تفرغ السلع وكيف يخطط لطلب طلبيات جديدة بناءً على الجرد، وقدم النصائح الذهبية لتنظيم المال. راقب "قائمة المشتريات" وحللها لتعرف ما تم تسجيله للشراء، وقارن أسعار الشراء والبيع للمنتجات وتحدث عن الجدوى الاقتصادية للعمليات. يمكنك ملاحظة المنتجات المطلوبة حديثاً وتحليل جودة العملية من ناحية التكاليف وهامش الربح.
4. طمئن العميل دائماً عندما يسألك عن "لماذا يسجل كل شيء في الهاتف" أو "أين تحفظ بياناتي"، بأن دوره هو معالجة وحفظ البيانات بخصوصية تامة! اشرح له أن التطبيق يعمل بتقنية متقدمة (Offline-first / Local Storage) وأن بياناته تبقى على هاتفه ومتصفحه فقط، ولا ترسل إلى أي خوادم خارجية للحفظ الدائم، وذلك لضمان سرية حساباته المالية وعدم تسريبها لأي جهة. هذا هو دور الوكيل الأمين للمحافظة على أموال التاجر وأسراره.

السياق الحالي الفوري للمحل:
${context || 'لا يوجد سياق متوفر'}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.65,
      }
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error("Gemini Vercel Route Error:", error);
    
    let errorMessage = "فشلت معالجة ذكاء مساعد مخزوني";
    const errString = error.message || String(error);
    
    if (error.status === 429 || errString.includes("429") || errString.includes("quota") || errString.includes("exceeded")) {
      errorMessage = "عذراً، لقد استنفدت الحد المجاني للأسئلة المسموح بها حالياً (Rate Limit). يرجى الانتظار لمدة دقيقة والمحاولة مرة أخرى، أو التحقق من إعدادات الفوترة الخاصة بمفتاح Gemini API في حسابك.";
    } else {
      errorMessage = error.message || errorMessage;
    }

    res.status(500).json({ error: errorMessage });
  }
}
