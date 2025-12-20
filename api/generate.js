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

        // استخدام الموديل المستقر والسريع - تعديل النموذج
        const GEMINI_MODEL = 'gemini-2.5-flash'; // تم التعديل
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // بناء النصوص الخاصة بالشحن والعرض
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // *****************************************************************
        // الـ Prompt المعدل لزيادة الإبداع وتقليل التكرار
        // *****************************************************************
        const prompt = `
أنت مدير إبداعي ومصمم صفحات هبوط محترف.

## 📋 **البيانات:**
- المنتج: ${productName}
- الفئة: ${productCategory}
- الجمهور المستهدف: ${targetAudience}
- الميزات: ${productFeatures}
- السعر: ${productPrice}
- ${shippingText} ${offerText}
- طلب التصميم: ${designDescription}

## 🎨 **مهمتك:**
إنشاء صفحة هبوط فريدة تمامًا ومختلفة عن أي صفحة سبق وإنشاؤها.

## ⚠️ **القواعد الإلزامية (يجب اتباعها):**

### **القسم الأول: الهيرو (يجب أن يكون مختلفًا تمامًا في كل مرة)**
مطلوب: هيرو جذاب وخلاق، لكن بشرط واحد فقط:
- يجب أن يكون مختلفًا في كل توليد (لا تكرر التصاميم السابقة)

**ممنوع استخدام:** 
- التصاميم النمطية المكررة
- نفس الألوان في كل مرة
- نفس التخطيط في كل مرة

**يجب أن يكون الهيرو:**
1. مختلفًا تمامًا في التصميم (لون، تخطيط، تأثيرات)
2. يحتوي على: عنوان رئيسي جذاب + وصف قصير + زر CTA
3. إبداعي في استخدام CSS (استخدم تأثيرات جديدة كل مرة)

### **القسم الثاني: استمارة الطلب (هذا ثابت ولا يتغير)**
يجب أن يكون مباشرًا بعد الهيرو ويحتوي على هذه الحقول بالضبط:

<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  
  <div class="form-group">
    <label>الإسم الكامل</label>
    <input type="text" placeholder="Nom et prénom" required>
  </div>
  
  <div class="form-group">
    <label>رقم الهاتف</label>
    <input type="tel" placeholder="Nombre" required>
  </div>
  
  <div class="form-group">
    <label>الولاية</label>
    <input type="text" placeholder="Wilaya" required>
  </div>
  
  <div class="form-group">
    <label>البلدية</label>
    <input type="text" placeholder="البلدية" required>
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

## 🚀 **باقي الصفحة: حرية إبداعية كاملة**
بعد هذين القسمين، لديك 100% حرية:
- أنشئ أي عدد من الأقسام بأي ترتيب
- استخدم أي تقنيات CSS/JS (3D، انيميشن، إلخ)
- كن مبدعًا ولا تكرر نفس التصاميم
- تصرف كالمهندس و خبير التثميم أدهشني و أذهلني بإبداعك الجديد في كل مرة

## 🎯 **لمنع التكرار:**
- تصرف كأنك فريق من مطورين الخبرغئ في التصميم و التسويق البصري
- غير لوحة الألوان بشكل جذري في كل توليد
- استخدم تقنيات CSS مختلفة (Grid, Flexbox, Animations)
- جرب اتجاهات تصميم مختلفة (Modern, Minimalist, Bold, Elegant)
- أضف عناصر تفاعلية فريدة

## 📤 **تنسيق الإخراج (يجب أن يكون JSON بهذا الشكل بالضبط):**
{
  "html": "كود HTML كامل مع <style> و <body>",
  "liquid_code": "كود Liquid لـShopify (بدون {% schema %})",
  "schema": {
    "name": "Landing Page",
    "settings": []
  }
}

**تنبيه مهم:** لا تكرر نفس تصميم الهيرو الذي استخدمته في المرات السابقة. كن مبدعًا وابتكر شيئًا جديدًا!
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json", 
                    temperature: 1.0, // زيادة temperature للإبداع
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
