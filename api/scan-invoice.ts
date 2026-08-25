import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, mimeType } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: "الصورة مطلوبة للتحليل" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "مفتاح Gemini API غير مكوّن في السيرفر. يرجى التأكد من ضبط متغير البيئة GEMINI_API_KEY." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
    });

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: cleanBase64,
      },
    };

    const promptText = `قم بتحليل هذه الفاتورة (فاتورة شراء / توريد من مورد) واستخراج كافة التفاصيل بدقة بالغة باللغة العربية.
استخرج:
1. اسم المورد (supplierName).
2. رقم الفاتورة (invoiceNumber) إن وجد، وإلا اتركه فارغاً.
3. تاريخ الفاتورة (invoiceDate) بصيغة YYYY-MM-DD إن وجد.
4. إجمالي مبلغ الفاتورة (totalAmount).
5. قائمة المنتجات المذكورة (items):
   - name: اسم المنتج بدقة كما هو مكتوب بالفاتورة.
   - barcode: الباركود إذا كان مكتوباً بالفاتورة، وإلا اتركه فارغاً.
   - quantity: الكمية المشتراة المذكورة بالفاتورة.
   - costPrice: سعر الشراء للوحدة الواحدة المذكورة بالفاتورة (مثلاً سعر الكرتونة إذا كانت كرتونة، أو سعر القطعة إذا كانت قطعة).
   - total: إجمالي السعر لهذا البند.
   - unit: الوحدة المذكورة مثل (كرتونة، صندوق، طرد، قطعة، حبة، كغ).
   - piecesPerBox: عدد القطع في الكرتونة أو الصندوق إذا كان مذكوراً بوضوح أو مستنتجاً من اسم المنتج (مثلاً 24P تعني 24 قطعة، 12x100g تعني 12 قطعة، كرتون 24 تعني 24)، وإلا ضع 1.
   - suggestedCategory: التصنيف المقترح للمنتج.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: {
        parts: [imagePart, { text: promptText }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplierName: { type: Type.STRING, description: "اسم المورد" },
            invoiceNumber: { type: Type.STRING, description: "رقم الفاتورة" },
            invoiceDate: { type: Type.STRING, description: "تاريخ الفاتورة" },
            totalAmount: { type: Type.NUMBER, description: "المبلغ الإجمالي" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "اسم المنتج" },
                  barcode: { type: Type.STRING, description: "الباركود" },
                  quantity: { type: Type.NUMBER, description: "الكمية" },
                  costPrice: { type: Type.NUMBER, description: "سعر الشراء الفردي المذكور بالفاتورة" },
                  total: { type: Type.NUMBER, description: "الإجمالي للبند" },
                  unit: { type: Type.STRING, description: "الوحدة المذكورة بالفاتورة" },
                  piecesPerBox: { type: Type.NUMBER, description: "عدد القطع في الكرتونة" },
                  suggestedCategory: { type: Type.STRING, description: "التصنيف المقترح" },
                },
                required: ["name", "quantity", "costPrice"],
              },
            },
          },
          required: ["supplierName", "items"],
        },
      },
    });

    let jsonText = response.text || "{}";
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const data = JSON.parse(jsonText);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("Error scanning invoice:", err);
    res.status(500).json({
      error: "فشل تحليل الفاتورة: " + (err.message || "خطأ غير معروف"),
    });
  }
}
