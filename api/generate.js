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

## 🖼️ **تعليمات الصور:**
- الصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
- الشعار: \`${LOGO_PLACEHOLDER}\`
- للصور الإضافية استخدم: \`[[PRODUCT_IMAGE_2_SRC]]\`, \`[[PRODUCT_IMAGE_3_SRC]]\` ...إلخ.

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة تحتوي على جميع الصور المقدمة وتحقق أعلى معدلات التحويل.

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

### **3. قسم آراء العملاء (Facebook Style Reviews) - الواقعية القصوى:**
أريد تصميم هذا القسم ليشبه **تعليقات فيسبوك** تماماً.
- **المحتوى:** 4-6 تعليقات باللهجة الجزائرية (الدارجة) متنوعة وعفوية جداً.
- **الصور:** استخدم \`https://i.pravatar.cc/150?u=[RANDOM]\` لصور مختلفة.

**🎨 تأثير الشطب اليدوي (Scribble) - هام جداً:**
يجب تطبيق تأثير "شطب بالقلم" على الوجوه لإخفاء الملامح.
- الخطوط يجب أن تكون **رقيقة** (Thin lines)، عشوائية، سوداء.
- يجب أن **تخرج عن حدود الصورة** (Overflow) لتبدو واقعية جداً.
- **تحذير JSON:** عند كتابة كود SVG داخل CSS، تأكد من استخدام **Single Quotes** (') داخل الـ SVG string لتجنب كسر الـ JSON.

استخدم هذا الـ SVG بالتحديد داخل الـ CSS (لاحظ استخدام Single Quotes بالداخل):
\`background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,50 Q30,20 50,60 T90,30 M5,70 Q40,30 70,80 T95,20 M20,10 C40,90 60,90 80,10 M10,40 L90,70 M90,40 L10,70' stroke='%23000' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\`

**الهيكل المطلوب للتعليقات:**
\`\`\`html
<style>
  .fb-comments-section { background: #fff; padding: 20px; max-width: 600px; margin: 30px auto; direction: rtl; font-family: sans-serif; border-top: 1px solid #e5e5e5; }
  .fb-comment { display: flex; margin-bottom: 12px; gap: 8px; }
  /* Avatar Container: NO OVERFLOW HIDDEN allows scribble to go outside */
  .fb-avatar-container { position: relative; width: 38px; height: 38px; flex-shrink: 0; z-index: 1; }
  .fb-avatar { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  /* The THIN REALISTIC SCRIBBLE Effect Overlay */
  .fb-scribble-overlay {
      position: absolute;
      top: -20%; left: -20%; width: 140%; height: 140%; z-index: 10; pointer-events: none; opacity: 0.9;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,50 Q30,20 50,60 T90,30 M5,70 Q40,30 70,80 T95,20 M20,10 C40,90 60,90 80,10 M10,40 L90,70 M90,40 L10,70' stroke='%23000' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-size: contain; background-repeat: no-repeat; background-position: center;
      transform: rotate(var(--rotation, 0deg));
  }
  .fb-content-area { flex: 1; }
  .fb-bubble { background-color: #f0f2f5; padding: 8px 12px; border-radius: 18px; display: inline-block; }
  .fb-name { font-weight: 600; font-size: 13px; color: #050505; display: block; }
  .fb-text { font-size: 15px; color: #050505; line-height: 1.35; }
</style>

<div class="fb-comment">
    <div class="fb-avatar-container">
        <img src="https://i.pravatar.cc/150?u=[RANDOM]" class="fb-avatar">
        <div class="fb-scribble-overlay" style="--rotation: [RANDOM_DEG]deg;"></div>
    </div>
    <div class="fb-content-area">
        <div class="fb-bubble">
            <span class="fb-name">[NAME]</span>
            <span class="fb-text">[COMMENT]</span>
        </div>
    </div>
</div>
\`\`\`

### **4. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة (be careful with quotes inside strings)",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **حرية إبداعية:**
- صمم باقي الصفحة بحرية تامة.
- أضف عد تنازلي.
- أضف أقسام إضافية.
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
        //  FIX: Robust JSON Parsing Function
        //  دالة قوية لاستخراج JSON وتنظيفه من الأخطاء المحتملة
        // ***************************************************************
        const parseJSONSafely = (text) => {
            // محاولة 1: التنظيف البسيط
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                return JSON.parse(clean);
            } catch (e1) {
                // محاولة 2: البحث عن بداية ونهاية كائن JSON
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1) {
                    let jsonSubstring = text.substring(firstBrace, lastBrace + 1);
                    try {
                        return JSON.parse(jsonSubstring);
                    } catch (e2) {
                        console.error("JSON Parse Fail:", e2);
                        throw new Error("Failed to parse AI response. The content might contain special characters.");
                    }
                }
                throw e1;
            }
        };

        let aiResponse = parseJSONSafely(aiResponseText);

        // ***************************************************************
        // عملية الحقن واستبدال الصور
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
