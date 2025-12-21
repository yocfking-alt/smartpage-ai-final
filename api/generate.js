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
        
        // التعديل هنا: تحديث التعليمات (Prompt) لتشمل تصميم فيسبوك واللهجة الجزائرية
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
إنشاء صفحة هبوط كاملة واحترافية (HTML/Tailwind CSS).

## ⚠️ **المتطلبات الإلزامية:**

### **1. قسم الهيرو والاستمارة:**
- كما هو معتاد، شعار + صورة رئيسية + استمارة طلب مفصلة (الاسم، الهاتف، الولاية، البلدية).

### **2. قسم آراء العملاء (مهم جداً - Facebook Style):**
يجب تصميم قسم "آراء العملاء" ليبدو تماماً مثل **تعليقات فيسبوك (Facebook Mobile Comments)**.
- **التصميم:** استخدم Tailwind CSS لمحاكاة شكل فيسبوك (صورة دائرية صغيرة + اسم بخط عريض + فقاعة تعليق رمادية فاتحة + أزرار "أعجبني/رد" وهمية أسفل التعليق).
- **اللغة:** اكتب 4 إلى 6 تعليقات متنوعة جداً. يجب أن يكون الخليط:
  - 60% **باللهجة الجزائرية الدارجة** (مثال: "يعطيك الصحة خويا، وصلني فور"، "سلعة شابة بزاف"، "الله يبارك ما شاء الله").
  - 40% **باللغة العربية الفصحى البسيطة** (مثال: "منتج رائع ومصداقية في التوصيل"، "شكرا لكم وصلني الطلب").
- **المحتوى:** يجب أن تكون التعليقات **متغيرة ومخصصة لهذا المنتج بالتحديد** (${productName}). لا تستخدم تعليقات عامة. اذكر تفاصيل من ميزات المنتج.
- **الأسماء والصور:** استخدم أسماء جزائرية واقعية (مثل: Amine, Lamia, Mohamed, Nina DZ) واستخدم صور بروفايل عشوائية من \`https://i.pravatar.cc/150?u=a\` (غيّر الحرف الأخير لكل صورة لتختلف).

### **3. باقي الصفحة:**
- صمم باقي الأقسام بحرية (مميزات، فوائد، عد تنازلي).

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة مع Tailwind CSS",
  "liquid_code": "كود Shopify Liquid",
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
                    temperature: 0.95 // حرارة عالية لضمان تنوع التعليقات في كل مرة
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
        // عملية الحقن (نفس الكود السابق)
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
