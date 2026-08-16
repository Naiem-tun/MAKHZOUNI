import { GoogleGenAI, Type } from "@google/genai";

export interface ScanInvoiceResult {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  items?: Array<{
    name: string;
    barcode?: string;
    quantity: number;
    costPrice: number;
    total?: number;
    unit?: string;
    piecesPerBox?: number;
    suggestedCategory?: string;
  }>;
}

export async function scanInvoiceWithGemini(
  imagePreview: string,
  imageMime: string,
  customApiKey?: string
): Promise<ScanInvoiceResult> {
  const cleanBase64 = imagePreview.replace(/^data:image\/\w+;base64,/, "");

  // 1. Try server endpoint first
  try {
    const savedKey = customApiKey || localStorage.getItem("gemini_api_key") || "";
    const response = await fetch("/api/scan-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imagePreview,
        mimeType: imageMime || "image/jpeg",
        apiKey: savedKey || undefined,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const result = await response.json();
      if (response.ok && result.success && result.data) {
        return result.data;
      }
      if (result.error && !result.error.includes("404") && !result.error.includes("غير مكوّن")) {
        throw new Error(result.error);
      }
    }
  } catch (serverErr: any) {
    console.warn("Server API endpoint failed, trying direct client-side fallback:", serverErr);
  }

  // 2. Direct client-side fallback if server API is unavailable (e.g. static Vercel host)
  const clientKey =
    customApiKey ||
    localStorage.getItem("gemini_api_key") ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (!clientKey) {
    throw new Error(
      "KEY_REQUIRED: لم يتم العثور على مفتاح Gemini API في السيرفر أو المتصفح. يرجى إدخال مفتاح Gemini API للمتابعة."
    );
  }

  const ai = new GoogleGenAI({
    apiKey: clientKey,
  });

  const imagePart = {
    inlineData: {
      mimeType: imageMime || "image/jpeg",
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
  return data;
}
