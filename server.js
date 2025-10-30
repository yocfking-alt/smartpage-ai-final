// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

// قراءة المنفذ من متغيرات البيئة (ضروري لـ Railway)
const port = process.env.PORT || 3000; 

const app = express();

// تفعيل CORS للسماح بالطلبات من أي واجهة (للتشغيل المحلي)
app.use(cors({ origin: '*', methods: ['POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));

// تحليل JSON بحد أكبر (20MB) للصور المشفرة
app.use(bodyParser.json({ limit: "20mb" }));

// 🛑 تم تعديل المسار هنا ليصبح "/api/generate"
app.post("/api/generate", async (req, res) => {
  try {
    const { productName, productFeatures, productPrice, productCategory, targetAudience, designDescription } = req.body;

    // فحص المدخلات الأساسية
    if (!productName || !productFeatures || !productPrice) {
      return res.status(400).json({ error: "Missing required product data (name, features, or price)." });
    }

    const prompt = `
أنت مصمم ويب محترف ومطور واجهات أمامية. قم بإنشاء صفحة هبوط HTML كاملة وجذابة لمنتج باستخدام المعلومات التالية:

**معلومات المنتج:**
- الاسم: ${productName}
- السعر: ${productPrice}
- الفئة: ${productCategory || 'beauty'}
- الجمهور المستهدف: ${targetAudience || 'women'}
- المميزات: ${productFeatures}

**متطلبات التصميم:**
${designDescription || 'تصميم عصري وجذاب يتناسب مع المنتج'}

**المتطلبات الفنية:**
- استخدم HTML و CSS حديث
- تصميم متجاوب يعمل على جميع الأجهزة
- ألوان جذابة ومناسبة للمنتج
- أزرار واضحة ودعوات للعمل
- قسم للمميزات والعروض
- صور وأيقونات مناسبة (استخدم روابط صور من unsplash أو placehold.co)

**الهيكل المقترح:**
- هيدر جذاب مع عنوان المنتج
- قسم المميزات الرئيسية
- قسم التسعير والعروض
- قسم testimonials
- فوتر مع معلومات الاتصال

يرجى إنشاء كود HTML كامل وجاهز للاستخدام بدون أي شرح إضافي.
`;

    // استدعاء DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: 'أنت مساعد AI متخصص في تصميم صفحات الويب. قم بإخراج كود HTML فقط بدون أي شرح إضافي.' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const html = data.choices[0].message.content.trim();
    
    res.json({ html });
  } catch (err) {
    console.error("❌ Error generating page:", err.message);
    res.status(500).json({ error: `Failed to generate page. Detail: ${err.message}` });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
