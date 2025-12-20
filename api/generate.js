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

        // استقبال البيانات بما في ذلك مصفوفة الصور
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
        } = req.body;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // صور افتراضية في حال لم يرفع المستخدم صوراً
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImages = productImages && productImages.length > 0 ? productImages : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        // إنشاء placeholders للصور المتعددة
        const imagePlaceholders = [];
        if (finalProductImages && finalProductImages.length > 0) {
            for (let i = 0; i < finalProductImages.length; i++) {
                imagePlaceholders.push(`[[PRODUCT_IMAGE_${i}_SRC]]`);
            }
        }

        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **تعليمات الصور (مهم جداً):**
لديك ${finalProductImages.length} صورة للمنتج وشعار العلامة التجارية.

### **تعليمات تقنية للصور:**
${imagePlaceholders.map((ph, i) => `- صورة المنتج ${i + 1}: استخدم \`${ph}\``).join('\n')}
- شعار العلامة التجارية: استخدم \`[[BRAND_LOGO_SRC]]\`

### **متطلبات عرض الصور:**
1. يجب استخدام مكتبة Swiper لعرض جميع صور المنتج كسلايدر تفاعلي
2. تضمين CDN مكتبة Swiper في الكود:
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
   <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
3. تصميم السلايدر:
   - عرض كامل العرض في قسم الهيرو
   - مؤشرات (pagination) أسفل الصور
   - أزرار تنقل (next/prev) مع أيقونات جميلة
   - إمكانية السحب بالأصابع
   - تأثير انتقال fade أو slide
   - تكرار لانهائي (loop)
4. إضافة معرض صور مصغرة (thumbnails) أسفل السلايدر الرئيسي
5. الصورة الأولى هي الرئيسية ويجب أن تكون بارزة

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة بمجموعة صور تفاعلية لتحقيق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو مع السلايدر:**
- تضمين سلايدر Swiper يعرض كل صور المنتج
- كل شريحة (slide) تحتوي على صورة واحدة بحجم كبير وجودة عالية
- شعار المتجر في أعلى الصفحة (استخدم \`[[BRAND_LOGO_SRC]]\`)
- زر دعوة للإجراء واضح

### **2. معرض الصور المصغرة:**
- تحت السلايدر الرئيسي، أضف صفاً من الصور المصغرة
- عند النقر على صورة مصغرة، تنتقل إلى تلك الصورة في السلايدر الرئيسي
- الصورة النشطة يجب أن يكون لها تأكيد مرئي

### **3. استمارة الطلب (مباشرة بعد الهيرو):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية:
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  
  <div class="form-group">
    <label>الإسم الكامل</label>
    <input type="text" placeholder="الاسم الكامل" required>
  </div>
  
  <div class="form-group">
    <label>رقم الهاتف</label>
    <input type="tel" placeholder="رقم الهاتف" required>
  </div>
  
  <div class="form-group">
    <label>الولاية</label>
    <input type="text" placeholder="الولاية" required>
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

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية كاملة:**
صمم باقي الصفحة بحرية تامة باستخدام CSS حديث وجذاب.
استخدم ألوان متناسقة وخطوط عربية جميلة.
أضف تأثيرات تفاعلية عند التمرير.
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
        
        // دالة للاستبدال الآمن
        const replaceImages = (content) => {
            if (!content) return content;
            
            let result = content;
            
            // استبدال كل placeholder بالصورة المناسبة
            imagePlaceholders.forEach((placeholder, index) => {
                const imageSrc = finalProductImages[index] || defaultImg;
                result = result.split(placeholder).join(imageSrc);
            });
            
            // استبدال الشعار
            result = result.split('[[BRAND_LOGO_SRC]]').join(finalBrandLogo);
            
            return result;
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
