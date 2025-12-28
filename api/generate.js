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

        // التعامل مع الصور المتعددة
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

        // --- CSS معدل ليظهر التعليقات كلقطات شاشة منفصلة ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px; background: #f9f9f9; margin-top: 30px; border-top: 1px solid #ddd; }
            
            /* تصميم لقطة الشاشة */
            .screenshot-wrapper {
                background: #fff;
                border: 1px solid #e1e1e1;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                max-width: 500px;
                margin-left: auto;
                margin-right: auto;
                position: relative;
                overflow: hidden;
            }
            /* شريط وهمي للهاتف لزيادة الواقعية */
            .fake-phone-header {
                border-bottom: 1px solid #f0f0f0;
                padding-bottom: 8px;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .fb-icon-mini { width: 16px; height: 16px; background-color: #1877f2; border-radius: 50%; display: inline-block; }
            .fb-text-mini { font-size: 10px; color: #65676b; font-weight: bold; }

            .comment-row { display: flex; align-items: flex-start; position: relative; z-index: 1; }
            .avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; margin-left: 10px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; width: 100%; }
            .bubble { background-color: var(--comment-bg); padding: 10px 15px; border-radius: 18px; display: inline-block; position: relative; width: fit-content; }
            .username { font-weight: 700; font-size: 14px; color: var(--text-primary); display: block; margin-bottom: 2px; cursor: pointer; }
            .text { font-size: 15px; color: var(--text-primary); line-height: 1.4; white-space: pre-wrap; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 5px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
            .time { font-weight: 400; }
            
            /* التفاعلات */
            .reactions-float { 
                position: absolute; 
                bottom: -10px; 
                left: -5px; 
                background: white; 
                border-radius: 12px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.15); 
                padding: 2px 4px; 
                display: flex; 
                align-items: center; 
            }
            .icon-love { width: 18px; height: 18px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
            .react-count { font-size: 12px; color: #65676b; margin-left: 4px; }
        </style>
        `;

        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **تعليمات الصور المتعددة:**
- استخدم \`${MAIN_IMG_PLACEHOLDER}\` للصورة الرئيسية.
- استخدم \`${LOGO_PLACEHOLDER}\` للشعار.
${productImageArray.length > 1 ? 
  Array.from({length: Math.min(productImageArray.length - 1, 5)}, (_, i) => 
    `  - الصورة ${i + 2}: استخدم \`[[PRODUCT_IMAGE_${i + 2}_SRC]]\``
  ).join('\n') 
  : ''}

## 🎯 **الهدف:**
إنشاء صفحة هبوط تحتوي على قسم آراء عملاء مميز جداً.

## ⚠️ **متطلبات إلزامية لقسم الآراء (Facebook Screenshots Style):**
يجب أن لا يكون القسم محادثة متصلة. بدلاً من ذلك، **أنشئ من 3 إلى 5 كتل منفصلة تماماً**، كل كتلة تمثل "لقطة شاشة" لتعليق إيجابي.

1. **الكمية:** أنشئ ما بين 3 إلى 5 مراجعات (Reviews).
2. **المحتوى:** تعليقات باللهجة الجزائرية الدارجة ممزوجة بالفصحى، تمدح المنتج بشدة.
3. **التصميم:** كل تعليق يجب أن يكون داخل \`div\` بالكلاس \`screenshot-wrapper\` لكي يبدو كصورة مقصوصة.
4. **الصور:**
   - للذكور: \`[[MALE_IMG]]\`
   - للإناث: \`[[FEMALE_IMG]]\`
5. **التفاعل:** استخدم أيقونة القلب فقط (\`icon-love\`).

### نموذج HTML لتعليق واحد (كرر هذا الهيكل 3-5 مرات بشكل منفصل):
\`\`\`html
<div class="screenshot-wrapper">
    <div class="fake-phone-header">
       <span class="fb-icon-mini"></span>
       <span class="fb-text-mini">Facebook</span>
    </div>

    <div class="comment-row">
        <div class="avatar"><img src="[[MALE_IMG]]" alt="User"></div> <div class="comment-content">
            <div class="bubble">
                <span class="username">اسم الزبون</span>
                <span class="text">التعليق هنا... (مثال: والله منتج روعة يعطيك الصحة)</span>
                
                <div class="reactions-float">
                    <div class="icon-love"></div>
                    <span class="react-count">24</span>
                </div>
            </div>
            <div class="actions">
                <span class="time">منذ 3 س</span>
                <span>أعجبني</span>
                <span>رد</span>
            </div>
        </div>
    </div>
</div>
\`\`\`

### **باقي الأقسام (استمارة الطلب، الهيرو، إلخ):**
- **الهيرو:** صورة المنتج + العنوان.
- **الاستمارة:** كما هو معتاد (الإسم، الهاتف، الولاية، البلدية، العنوان).
- تأكد من تضمين كود CSS (\`fbStyles\`) في بداية الـ HTML الناتج.

### **تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة",
  "liquid_code": "كود Shopify Liquid",
  "schema": { "name": "Landing Page", "settings": [] }
}

قم بدمج هذا الـ CSS في بداية الـ HTML الناتج:
${fbStyles}
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
        // عملية الحقن: استبدال الرموز (صور المنتج + صور الأشخاص)
        // ***************************************************************
        
        // صور افتراضية
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        // دالة الصور العشوائية (أشخاص حقيقيين)
        const getRandomAvatar = (gender) => {
            const randomId = Math.floor(Math.random() * 50); 
            const genderPath = gender === 'male' ? 'men' : 'women';
            return `https://randomuser.me/api/portraits/${genderPath}/${randomId}.jpg`;
        };

        // دالة حقن صور الأشخاص
        const injectAvatars = (htmlContent) => {
            if (!htmlContent) return htmlContent;
            let content = htmlContent;
            while (content.includes('[[MALE_IMG]]')) {
                content = content.replace('[[MALE_IMG]]', getRandomAvatar('male'));
            }
            while (content.includes('[[FEMALE_IMG]]')) {
                content = content.replace('[[FEMALE_IMG]]', getRandomAvatar('female'));
            }
            return content;
        };

        // دالة للاستبدال الآمن لصور المنتج
        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            // استبدال الصورة الرئيسية
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            // استبدال الشعار
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            // استبدال الصور الإضافية
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            return result;
        };

        // تطبيق الاستبدال وحقن الأفاتار على HTML و Liquid Code
        aiResponse.html = injectAvatars(replaceImages(aiResponse.html));
        aiResponse.liquid_code = injectAvatars(replaceImages(aiResponse.liquid_code));

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
