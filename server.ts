import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy lazy-initialization to avoid crash if GEMINI_API_KEY is not set on load
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Warning: GEMINI_API_KEY is missing in the environment variables.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "makhzouni API is running" });
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const isMissingOrPlaceholder = !apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY";

      if (isMissingOrPlaceholder) {
        return res.status(400).json({ 
          error: "عذراً، لم يتم العثور على مفتاح API صالح. يرجى التأكد من إضافته في إعدادات مساحة العمل (Secrets) وإعادة المحاولة."
        });
      }

      const { messages, context } = req.body;
      const client = getGenAI();

      // Convert messages to Gemini SDK contents format
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
4. انتبه جداً لبيانات التعبئة والتغليف؛ إذا كان للمنتج "عبوة الصندوق (الكرتونة)" وسعر شراء الصندوق، فاستخدم هذه الأرقام بدقة فائقة عند تقديم نصائح الشراء والاستثمار وحساب الأرباح. على سبيل المثال: إذا كانت عبوة الكرتونة 24 قطعة، فإن طلب شراء "3 كرتونة" يعني شراء 72 قطعة. احسب دائماً تكاليف الشراء بضرب سعر الكرتونة، وقارنها بأرباح بيع القطع الفردية لتقدم للتاجر نصيحة استثمارية حقيقية خالية من التناقضات الحسابية.

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

السياق:
${context}
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.65,
        }
      });

      res.json({ content: response.text });
    } catch (error: any) {
      console.error("Gemini Proxy Route Error:", error);
      
      let errorMessage = "فشلت معالجة ذكاء مساعد مخزوني";
      const errString = error.message || String(error);
      
      if (error.status === 429 || errString.includes("429") || errString.includes("quota") || errString.includes("exceeded")) {
        errorMessage = "عذراً، لقد استنفدت الحد المجاني للأسئلة المسموح بها حالياً (Rate Limit). يرجى الانتظار لمدة دقيقة والمحاولة مرة أخرى، أو التحقق من خطة الحساب الخاصة بك.";
      } else {
        errorMessage = error.message || errorMessage;
      }

      res.status(500).json({ error: errorMessage });
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
