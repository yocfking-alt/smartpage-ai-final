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

        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
        } = req.body;

        const productImageArray = productImages || [];
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // تم تحديث الـ Prompt لحل مشكلة JSON Error
        const prompt = `
Act as a Senior Creative Director and Web Developer. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
Design Request: ${designDescription}.

## 🖼️ **تعليمات الصور:**
- الصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
- الشعار: \`${LOGO_PLACEHOLDER}\`
- صور المعرض: استخدم \`[[PRODUCT_IMAGE_X_SRC]]\` حيث X هو رقم الصورة (2, 3...).

## 🎯 **الهدف:**
إنشاء صفحة هبوط كاملة واحترافية.

## ⚠️ **المتطلبات الإلزامية:**

### **1. قسم الهيرو والاستمارة:**
- شعار + صورة رئيسية + استمارة طلب مفصلة (الاسم، الهاتف، الولاية، البلدية).

### **2. قسم آراء العملاء (Facebook Style):**
- تصميم يشبه تعليقات فيسبوك (صورة دائرية + اسم عريض + خلفية رمادية للتعليق).
- اكتب 4-6 تعليقات متنوعة:
  - 60% لهجة جزائرية (أمثلة: "يعطيك الصحة"، "فور"، "سلعة شابة").
  - 40% عربية فصحى بسيطة.
- استخدم أسماء جزائرية واقعية وصور بروفايل من \`https://i.pravatar.cc/150?u=x\` (غيّر x لصور مختلفة).

### **3. تقنية ومهم جداً (JSON Formatting):**
- **يجب أن يكون كود HTML و Liquid مضغوطاً (Minified) في سطر واحد.**
- **لا تستخدم أبداً أحرف سطر جديد (New Lines) حقيقية داخل قيم الـ JSON.**
- إذا احتجت لسطر جديد، استخدم الرمز \`\\n\`.

### **4. تنسيق الإخراج:**
أعد كائن JSON صالح فقط (Valid JSON Object):
{
  "html": "سلسلة HTML كاملة في سطر واحد",
  "liquid_code": "كود Liquid في سطر واحد",
  "schema": { "name": "Landing Page", "settings": [] }
}
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
        
        // ***************************************************************
        // دالة تنظيف متقدمة لإصلاح خطأ Bad Control Character
        // ***************************************************************
        const cleanAndParseJSON = (str) => {
            // 1. إزالة كود ماركداون
            let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // 2. محاولة إصلاح الأحرف المخفية التي تكسر الـ JSON
            // هذا التعبير النمطي يزيل الأحرف التحكمية (Control Characters) ما عدا المسافات المسموحة
            cleaned = cleaned.replace(/[\u0000-\u001F]+/g, (match) => {
                // السماح فقط بـ \n (New Line) و \t (Tab) و \r
                if (match === '\n' || match === '\r' || match === '\t') return match; 
                return ''; // حذف أي حرف تحكم آخر يسبب المشكلة
            });

            return JSON.parse(cleaned);
        };

        let aiResponse;
        try {
            aiResponse = cleanAndParseJSON(aiResponseText);
        } catch (parseError) {
            console.error("JSON Parse Error Raw Text:", aiResponseText);
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }

        // ***************************************************************
        // عملية الحقن (Images Injection)
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
