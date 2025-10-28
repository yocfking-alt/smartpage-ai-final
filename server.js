// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

// قراءة المنفذ من متغيرات البيئة (ضروري لـ Railway)
const port = process.env.PORT || 3000; 

const app = express();

// تفعيل CORS للسماح بالطلبات من أي واجهة (للتشغيل المحلي)
app.use(cors({ origin: '*', methods: ['POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));

// تحليل JSON بحد أكبر (20MB) للصور المشفرة
app.use(bodyParser.json({ limit: "20mb" }));

// تهيئة OpenAI (يتم قراءة المفتاح تلقائيًا من متغير البيئة)
const client = new OpenAI(); 

// المسار الفعلي لـ API
app.post("/generate", async (req, res) => {
  try {
    const { imageBase64, productName, productFeatures, productPrice } = req.body;

    // فحص المدخلات الأساسية
    if (!imageBase64 || !productName || !productFeatures) {
      return res.status(400).json({ error: "Missing required product data (image, name, or features)." });
    }

    const prompt = `
You are a professional web designer AI.
Generate a full, modern, responsive HTML landing page for this product.
Include a hero section, features section, call-to-action, and pricing.
Use colors that match the product image.

Product name: ${productName}
Product features: ${productFeatures}
Product price: ${productPrice || "Not specified"}.

Output ONLY valid HTML (no explanations, no markdown).
    `;
    
    // استدعاء OpenAI
    const result = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert web designer AI that outputs HTML only." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: `data:image/jpeg;base64,${imageBase64}` }, 
          ],
        },
      ],
      max_tokens: 3000, 
    });

    const html = result.choices[0].message.content.trim();
    res.json({ html });
  } catch (err) {
    console.error("❌ Error generating page:", err.message);
    res.status(500).json({ error: `Failed to generate page. Detail: ${err.message}` });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
