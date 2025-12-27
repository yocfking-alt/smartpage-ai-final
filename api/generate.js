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

        // استقبال البيانات بما في ذلك الصور المتعددة
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
        } = req.body;

        // التعامل مع الصور المتعددة (نصي للتوافق مع الإصدارات السابقة)
        const productImageArray = productImages || [];
        const mainProductImage = productImageArray.length > 0 ? productImageArray[0] : null;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // تعريف المتغيرات البديلة للصور
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // إنشاء نصوص بديلة للصور الإضافية
        let galleryPlaceholders = "";
        for (let i = 1; i < productImageArray.length && i <= 5; i++) {
            galleryPlaceholders += `[[PRODUCT_IMAGE_${i + 1}_SRC]] `;
        }

        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **تعليمات الصور المتعددة:**
لقد تم تزويدك بعدة صور للمنتج (${productImageArray.length} صور) وشعار.

### **1. الصورة الرئيسية:**
- استخدم هذا النص بالضبط كمصدر للصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`

### **2. معرض الصور الإضافية:**
- أضف قسم معرض صور يظهر الصور الإضافية للمنتج (إن وجدت).
- استخدم النصوص التالية كمصادر للصور الإضافية:
${productImageArray.length > 1 ? 
  Array.from({length: Math.min(productImageArray.length - 1, 5)}, (_, i) => 
    `  - الصورة ${i + 2}: استخدم \`[[PRODUCT_IMAGE_${i + 2}_SRC]]\``
  ).join('\n') 
  : '  - لا توجد صور إضافية'}

### **3. الشعار:**
- استخدم هذا النص بالضبط كمصدر للشعار: \`${LOGO_PLACEHOLDER}\`

## 🎯 **الهدف:**
إنشاء صفحة هبوط تحقق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو:**
- يتضمن الشعار وصورة المنتج الرئيسية بشكل بارز.

### **2. استمارة الطلب (مباشرة بعد الهيرو):**
يجب أن تحتوي على هذا الهيكل الدقيق للحقول باللغة العربية:
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  <div class="form-group"><label>الإسم الكامل</label><input type="text" placeholder="Nom et prénom" required></div>
  <div class="form-group"><label>رقم الهاتف</label><input type="tel" placeholder="Nombre" required></div>
  <div class="form-group"><label>الولاية</label><input type="text" placeholder="Wilaya" required></div>
  <div class="form-group"><label>البلدية</label><input type="text" placeholder="أدخل بلديتك" required></div>
  <div class="form-group"><label>الموقع / العنوان</label><input type="text" placeholder="أدخل عنوانك بالتفصيل" required></div>
  <div class="price-display"><p>سعر المنتج: ${productPrice} دينار</p></div>
  <button type="submit" class="submit-btn">تأكيد الطلب</button>
</div>

### **3. قسم آراء العملاء (Customer Reviews) - هام جداً:**
أريد تصميم هذا القسم بدقة ليبدو وكأنه **تعليقات فيسبوك حقيقية (Facebook Comments UI)**.
- العنوان الرئيسي للقسم: "شهادات زبائننا الكرام" أو "ماذا قالوا عن منتجنا؟"
- **التصميم:**
  - يجب أن يكون لكل تعليق صورة دائرية (Avatar) على اليمين.
  - بجانب الصورة، "فقاعة" (Bubble) رمادية فاتحة (Background: #f0f2f5) تحتوي على اسم المستخدم ونص التعليق.
  - تحت الفقاعة، أضف روابط صغيرة: "أعجبني . رد . منذ [وقت]" لتبدو واقعية.
  - أضف أيقونات تفاعل (قلب أحمر صغير أو لايك) أسفل الفقاعة لإضفاء المصداقية.

- **المحتوى (يجب توليده بذكاء):**
  - قم بتوليد 4 إلى 6 تعليقات مختلفة تماماً ومناسبة لمنتج "${productName}".
  - **اللغة:** اخلط بين **اللهجة الجزائرية الدارجة** (مثل: "يعطيكم الصحة"، "وصلتني مريقلة"، "فور"، "خدمة شابة") وبين **اللغة العربية الفصحى** (مثل: "منتج رائع"، "جودة ممتازة").
  
- **الصور والأسماء (توزيع 50/50):**
  - **للذكور:** اختر أسماء جزائرية/عربية للذكور. للصورة استخدم الرابط التالي (مع تغيير الرقم X عشوائياً بين 1 و 50): \`https://randomuser.me/api/portraits/men/X.jpg\` (مثال: men/22.jpg).
  - **للإناث:** اختر أسماء جزائرية/عربية للإناث. للصورة استخدم الرابط التالي (مع تغيير الرقم X عشوائياً بين 1 و 50): \`https://randomuser.me/api/portraits/women/X.jpg\` (مثال: women/45.jpg).
  - تأكد من أن التعليق يتناسب مع جنس صاحب التعليق.

- **CSS الخاص بالتعليقات:**
  أضف CSS مخصص داخل التاق <style> لهذا القسم ليحاكي فيسبوك (font-family, border-radius للفقاعة 18px، حجم خط الاسم bold 13px، لون الخلفية #f0f2f5، إلخ).

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية:**
- صمم باقي الصفحة بحرية تامة.
- أضف عد تنازلي.
- أضف مميزات المنتج والأسئلة الشائعة.
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
        // عملية الحقن: استبدال الرموز بالصور الحقيقية
        // ***************************************************************
        
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            return result;
        };

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
