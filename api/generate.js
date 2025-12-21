[file content begin]
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

## 🖼️ **تعليمات الصور المتعددة (مهم جداً):**
لقد تم تزويدك بعدة صور للمنتج (${productImageArray.length} صور) وشعار.
**يجب اتباع التعليمات التالية بدقة:**

### **1. الصورة الرئيسية:**
- استخدم هذا النص بالضبط كمصدر للصورة الرئيسية: ${MAIN_IMG_PLACEHOLDER}
- مثال: <img src="${MAIN_IMG_PLACEHOLDER}" alt="${productName}" class="main-product-image">

### **2. معرض الصور الإضافية:**
- أضف قسم معرض صور يظهر الصور الإضافية للمنتج
- استخدم النصوص التالية كمصادر للصور الإضافية:
${productImageArray.length > 1 ? 
  Array.from({length: Math.min(productImageArray.length - 1, 5)}, (_, i) => 
    `  - الصورة ${i + 2}: استخدم [[PRODUCT_IMAGE_${i + 2}_SRC]]`
  ).join('\n') 
  : '  - لا توجد صور إضافية'}
- يمكنك إنشاء سلايدر، شبكة صور، أو معرض تفاعلي
- تأكد من أن المعرض سريع الاستجابة ويعمل جيداً على الجوال

### **3. الشعار:**
- استخدم هذا النص بالضبط كمصدر للشعار: ${LOGO_PLACEHOLDER}
- مثال: <img src="${LOGO_PLACEHOLDER}" alt="شعار العلامة التجارية" class="logo">

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة تحتوي على جميع الصور المقدمة وتحقق أعلى معدلات التحويل.

## ⚠️ **متطلبات إلزامية:**

### **1. قسم الهيرو:**
- يتضمن الشعار (استخدم ${LOGO_PLACEHOLDER}) في الأعلى أو في الهيدر
- صورة المنتج الرئيسية (استخدم ${MAIN_IMG_PLACEHOLDER}) يجب أن تكون بارزة جداً
- إذا كان هناك أكثر من صورة، أضف أزرار تنقل بين الصور أو معرض مصغر

### **2. معرض الصور (إذا كان هناك أكثر من صورة):**
- قم بإنشاء قسم مخصص لعرض جميع صور المنتج
- استخدم تقنيات CSS/JS حديثة لعرض المعرض (مثل grid، flexbox، أو سلايدر)
- تأكد من أن الصور معروضة بشكل جميل ومنظم

### **3. استمارة الطلب (مباشرة بعد الهيرو):**
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

### **4. قسم آراء العملاء:**
يجب إنشاء قسم "شهادات زبائننا الكرام" أو "آراء العملاء" بحيث يبدو تماماً كتعليقات فيسبوك حقيقية:

- استخدم HTML و CSS لتقليد شكل تعليقات فيسبوك بالضبط كما في الصور
- كل تعليق يجب أن يحتوي على:
  1. صورة بروفايل للمستخدم (استخدم صور من https://i.pravatar.cc)
  2. اسم مستخدم حقيقي عربي
  3. تاريخ واقعي (منذ 3 أيام، قبل ساعة، أسبوع واحد، إلخ)
  4. نص تعليق واقعي باللهجة العامية العربية يتناسب مع المنتج
  5. أزرار "أعجيني" و "رد" كتلك الموجودة في فيسبوك
  6. عدد واقعي للإعجابات والردود (مثل: ١٠٢ أعجيني، ٥ ردود)

- أضف 3-4 تعليقات مختلفة مع بعض الردود من البائع
- استخدم أسماء وتعليقات مناسبة للمنتج الحالي

### **5. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية كاملة:**
- صمم باقي الصفحة بحرية تامة باستخدام CSS حديث وجذاب
- استخدم تأثيرات hover، transitions، وanimations لجعل الصفحة تفاعلية
- تأكد من أن الصفحة سريعة الاستجابة وتعمل على جميع الأجهزة
- أضف عد تنازلي أقل من ساعتان أنيق يحفز الزائر على الشراء بلون مناسب لصفحة و للمنتج
- أضف أقسام إضافية مثل: مميزات المنتج، الأسئلة الشائعة، إلخ
        `;

        console.log("Sending request to Gemini API...");
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", errorText);
            throw new Error(`Gemini API responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received response from Gemini");

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        console.log("AI response received, length:", aiResponseText.length);
        
        // تنظيف النص من علامات التوضيح
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let aiResponse;
        try {
            aiResponse = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", parseError);
            console.error("Cleaned text:", cleanedText.substring(0, 500));
            throw new Error('AI response is not valid JSON');
        }

        // ***************************************************************
        // عملية الحقن: استبدال الرموز بالصور الحقيقية (Base64)
        // ***************************************************************
        
        // صور افتراضية في حال لم يرفع المستخدم صوراً
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        // دالة للاستبدال الآمن للصور المتعددة
        const replaceImages = (content) => {
            if (!content) return content;
            
            let result = content;
            
            // استبدال الصورة الرئيسية
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            
            // استبدال الشعار
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            
            // استبدال الصور الإضافية في المعرض
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            
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
        res.status(500).json({ 
            error: error.message || 'Internal Server Error',
            details: error.stack
        });
    }
}
