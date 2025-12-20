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

        // استقبال البيانات بما في ذلك الصور
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImage, brandLogo 
        } = req.body;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // تعريف المتغيرات البديلة للصور
        // نستخدم نصوصاً مميزة ليعرف الذكاء الاصطناعي أين يضعها، ثم نستبدلها لاحقاً بالكود الحقيقي
        const IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";

        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **تعليمات الصور (مهم جداً):**
- لقد تم تزويدك بصورة للمنتج وشعار.
- في كود HTML و Liquid، **يجب** أن تستخدم هذا النص بالضبط كمصدر لصورة المنتج: \`${IMG_PLACEHOLDER}\`
- **يجب** أن تستخدم هذا النص بالضبط كمصدر للشعار: \`${LOGO_PLACEHOLDER}\`
- مثال: <img src="${IMG_PLACEHOLDER}" alt="Product Image" class="...">
- لا تستخدم صوراً من unsplash أو روابط خارجية، استخدم فقط النصوص البديلة أعلاه.

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة لتحقيق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو:**
- يتضمن الشعار (استخدم \`${LOGO_PLACEHOLDER}\`) في الأعلى أو في الهيدر.
- صورة المنتج الرئيسية (استخدم \`${IMG_PLACEHOLDER}\`) يجب أن تكون بارزة جداً.

### **2. استمارة الطلب (مباشرة بعد الهيرو):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية:
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
    <input type="text" placeholder="أدخل بلديتك" required>
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

### **3. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية كاملة:**
صمم باقي الصفحة بحرية تامة باستخدام CSS حديث وجذاب.
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.95
                }
            })
        });

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let aiResponse = JSON.parse(cleanedText);

        // ***************************************************************
        // عملية الحقن: استبدال الرموز بالصور الحقيقية (Base64)
        // ***************************************************************
        
        // صور افتراضية في حال لم يرفع المستخدم صوراً
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImage = productImage || defaultImg;
        const finalBrandLogo = brandLogo || defaultLogo;

        // دالة للاستبدال الآمن
        const replaceImages = (content) => {
            if (!content) return content;
            // استبدال عالمي لكل ظهور للرمز
            return content
                .split(IMG_PLACEHOLDER).join(finalProductImage)
                .split(LOGO_PLACEHOLDER).join(finalBrandLogo);
        };

        // تطبيق الاستبدال على HTML و Liquid Code
        aiResponse.html = replaceImages(aiResponse.html);
        aiResponse.liquid_code = replaceImages(aiResponse.liquid_code);

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
