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

/**
 * Sends the invoice image to the backend server endpoint (/api/scan-invoice) for analysis via Gemini API.
 * No API keys or AI models are loaded on the client side.
 */
export async function scanInvoiceWithGemini(
  imagePreview: string,
  imageMime: string = "image/jpeg"
): Promise<ScanInvoiceResult> {
  try {
    const response = await fetch("/api/scan-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imagePreview,
        mimeType: imageMime || "image/jpeg",
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const result = await response.json();
      if (response.ok && result.success && result.data) {
        return result.data;
      }
      if (result.error) {
        throw new Error(result.error);
      }
    }

    if (!response.ok) {
      throw new Error(`خطأ في استجابة الخادم (${response.status})`);
    }

    throw new Error("تعذر قراءة بيانات الفاتورة من استجابة الخادم");
  } catch (err: any) {
    console.error("Error communicating with /api/scan-invoice:", err);
    if (err.message && !err.message.includes("Failed to fetch") && !err.message.includes("NetworkError")) {
      throw err;
    }
    throw new Error(
      "تعذر الاتصال بخدمة تحليل الفواتير بالذكاء الاصطناعي (السيرفر غير متوفر حالياً). يرجى التأكد من تشغيل السيرفر أو إدخال الفاتورة يدوياً."
    );
  }
}
