import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "makhzouni API is running" });
  });

  app.post("/api/scan-invoice", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "الصورة مطلوبة للتحليل" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "مفتاح Gemini API غير مكوّن بالسيرفر" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
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
        error: "فشل تحليل الفاتورة بواسطة الذكاء الاصطناعي: " + (err.message || "خطأ غير معروف"),
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
