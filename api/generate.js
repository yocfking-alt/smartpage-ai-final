import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // استقبال البيانات من الواجهة الأمامية
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, customOffer
        } = req.body;

        // استخدام الموديل المستقر والسريع
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء النصوص الخاصة بالشحن والعرض
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // *****************************************************************
        // الـ Prompt الجديد مع استمارة الطلب المطلوبة
        // *****************************************************************
        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة لتحقيق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية (يجب اتباعها بدقة):**

### **1. قسم الهيرو (القسم الأول والأساسي):**
- يجب أن يكون أول قسم يراه المستخدم
- يتضمن: عنوان إبداعي (H1) + وصف ثانوي + زر دعوة رئيسي
- التصميم: استخدام تأثيرات CSS متقدمة (glassmorphism, animations, gradients, etc.)

### **2. استمارة الطلب (مباشرة بعد الهيرو):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية:
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  
  <div class="form-group">
    <label>الإسم الكامل</label>
    <input type="text" placeholder="أدخل اسمك الكامل" required>
  </div>
  
  <div class="form-group">
    <label>رقم الهاتف</label>
    <input type="tel" placeholder="+213 أدخل رقم هاتفك" required>
  </div>
  
  <div class="form-group">
    <label>الولاية</label>
    <input type="text" placeholder="أدخل ولايتك" required>
    <!-- ملاحظة: لا تستخدم قائمة منسدلة select، استخدم input نصي فقط -->
  </div>
  
  <div class="form-group">
    <label>البلدية</label>
    <input type="text" placeholder="أدخل بلديتك" required>
    <!-- ملاحظة: لا تستخدم قائمة منسدلة select، استخدم input نصي فقط -->
  </div>
  
  <div class="form-group">
    <label>الموقع / العنوان</label>
    <input type="text" placeholder="أدخل عنوانك بالتفصيل" required>
  </div>
  
  <div class="price-display">
    <p>سعر المنتج: ${productPrice} دينار</p>
  </div>
  
  <button type="submit" class="submit-btn">تأكيد الطلب</button>
</div>

### **3. تنسيق الإخراج - حاسم (يجب أن يكون دقيقًا):**
يجب أن تعيد كائن JSON صارمًا يحتوي على هذه المفاتيح الثلاثة فقط:
{
  "html": "سلسلة HTML كاملة تحتوي على <style> في الرأس و<body> للمحتوى",
  "liquid_code": "كود قالب Shopify Liquid (بدون {% schema %})",
  "schema": {
    "name": "Landing Page",
    "settings": [
      // إنشاء الإعدادات المناسبة هنا
    ]
  }
}

## 🚀 **حرية إبداعية كاملة (للباقي من الصفحة):**
بعد الأقسام المطلوبة أعلاه، لديك 100% حرية إبداعية:
- أنشئ أي عدد من الأقسام الفريدة
- استخدم أي أنماط تخطيط وتصميم (parallax, 3D, interactive, etc.)
- فاجئني بمحفزات نفسية مبتكرة
- لا توجد قيود على ترتيب أو محتوى الأقسام
- كسر الأنماط التقليدية لتحقيق تحويل أفضل

## 🎨 **إرشادات التصميم (ليست قيودًا):**
- استخدم أيقونات FontAwesome 6
- اكتب CSS مخصص (بدون قوالب)
- تصميم متجاوب بالكامل للهاتف المحمول
- CSS حديث (Grid, Flexbox, CSS Variables)
- فكر في سيكولوجية الألوان المناسبة للمنتج

## 🔧 **ملاحظات تقنية:**
- مفتاح \`html\`: للمعاينة الحية (HTML كامل وقائم بذاته)
- مفتاح \`liquid_code\`: لـShopify (استخدم صيغة Liquid مثل {{ product.title }})
- مفتاح \`schema\>: إعدادات لمحرر قوالب Shopify
- أعد فقط كائن JSON، بدون أي نص إضافي

**تذكر:** فقط هيكل الهيرو، حقول استمارة الطلب، وتنسيق الإخراج ثابتة. كل شيء آخر يجب أن يكون مبدعًا وفريدًا في كل مرة!
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json", 
                    temperature: 0.95,
                    topP: 0.95,
                    topK: 40
                }
            })
        });

        const data = await response.json();

        // معالجة الأخطاء من Gemini
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini Error:", data);
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        
        // تنظيف النص من علامات Markdown إذا وجدت
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResponse = JSON.parse(cleanedText);

        // إرسال النتيجة بنفس الهيكل
        res.status(200).json({
            liquid_code: aiResponse.liquid_code,
            schema: aiResponse.schema,
            html: aiResponse.html
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
