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

    const systemInstruction = `أنت هو المساعد الذكي لتطبيق "مخزوني".
تتكلم العربية. إجاباتك يجب أن تكون قصيرة جداً ومباشرة وبدون مقدمات طويلة.

أهدافك:
1. ركز فقط على بيانات "المنتجات" و"المشتريات" المرفقة في السياق.
2. لا تذكر أبداً أي تفاصيل عن حماية البيانات أو التخزين، أجب مباشرة على السؤال المطروح.
3. يمكنك مساعدة المستخدم في مقارنة المشتريات والمنتجات من حيث الأكثر مبيعاً وأسعار الجملة.

إذا طلب إضافة منتج (مثال: أضف حليب بسعر 2)، أدرج في النهاية:
---ACTIONS_PROPOSAL---
{
  "type": "add_product",
  "data": {
    "name": "الاسم",
    "category": "عام",
    "purchasePrice": 1.5,
    "sellingPrice": 2.0,
    "stock": 20,
    "minQuantity": 5,
    "barcode": ""
  }
}
---ACTIONS_PROPOSAL_END---

السياق الحالي للمحل:
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
