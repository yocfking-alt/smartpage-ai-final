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

        // استقبال البيانات
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
        } = req.body;

        const productImageArray = productImages || [];
        const mainProductImage = productImageArray.length > 0 ? productImageArray[0] : null;

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

        // --- CSS الخاص بتعليقات الفيسبوك (من ملف t.html) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; }
            .comment-thread { max-width: 600px; margin: 0 auto; position: relative; }
            .thread-line-container { position: absolute; right: 25px; top: 50px; bottom: 30px; width: 2px; background-color: var(--line-color); z-index: 0; }
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 1; }
            .avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-left: 8px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; max-width: 85%; }
            .bubble { background-color: var(--comment-bg); padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; }
            .username { font-weight: 600; font-size: 13px; color: var(--text-primary); display: block; margin-bottom: 2px; cursor: pointer; }
            .text { font-size: 15px; color: var(--text-primary); line-height: 1.3; white-space: pre-wrap; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
            .action-link { cursor: pointer; text-decoration: none; color: var(--text-secondary); }
            .time { font-weight: 400; }
            .reactions-container { position: absolute; bottom: -8px; left: -15px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px 4px; display: flex; align-items: center; height: 18px; z-index: 10; }
            .react-icon { width: 16px; height: 16px; border: 2px solid #fff; border-radius: 50%; }
            .react-count { font-size: 11px; color: var(--text-secondary); margin-left: 4px; margin-right: 2px; }
            .view-replies { display: flex; align-items: center; font-weight: 600; font-size: 14px; color: var(--text-primary); margin: 10px 0; padding-right: 50px; position: relative; cursor: pointer; }
            .view-replies::before { content: ''; position: absolute; right: 25px; top: 50%; width: 20px; height: 2px; background-color: var(--line-color); border-bottom-left-radius: 10px; }
            .icon-love { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
            .icon-like { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%231877F2"/><path d="M16 8c-4.42 0-8 3.58-8 8 0 4.42 3.58 8 8 8h4.42v-5.58h-2.58v-3.42h2.58v-2.2c0-2.55 1.52-3.96 3.84-3.96 1.11 0 2.27 0.2 2.27 0.2v2.5h-1.28c-1.26 0-1.65 0.79-1.65 1.59v1.87h2.82l-0.45 3.42h-2.37v5.58c3.08-1.32 5.22-4.38 5.22-7.94 0-4.42-3.58-8-8-8z" fill="white"/></svg>') no-repeat center/cover; } 
        </style>
        `;

        const prompt = `
Act as a Senior Creative Director and Conversion Expert for the Algerian Market.
Product: ${productName}.
Category: ${productCategory}.
Context: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.

## 🎯 المهمة الأساسية:
إنشاء صفحة هبوط كاملة (HTML/JSON) مع التركيز بشكل خاص جداً على **قسم "آراء العملاء"** الذي يجب أن يحاكي تصميم تعليقات فيسبوك بدقة متناهية.

## 🖼️ تعليمات الصور:
1. الصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
2. صور المعرض: استخدم \`[[PRODUCT_IMAGE_X_SRC]]\`
3. الشعار: \`${LOGO_PLACEHOLDER}\`

## 💬 تعليمات قسم آراء العملاء (هام جداً - Facebook Style):
يجب أن يبدو القسم كأنه مأخوذ (Screenshot) من نقاش حقيقي على فيسبوك حول المنتج.
1. **التصميم:** استخدم أكواد CSS المرفقة في المتغير \`fbStyles\`.
2. **المحتوى:** أنشئ 4-6 تعليقات واقعية جداً.
   - امزج بين **الدارجة الجزائرية** (مثل: "الله يبارك"، "سلعة شابة"، "وصلتني في وقتها") و **العربية الفصحى البسيطة**.
   - التعليقات يجب أن تمدح المنتج وتؤكد المصداقية.
3. **الصور والأسماء:**
   - **للذكور:** استخدم الاسم العربي المناسب واستخدم الرمز \`[[MALE_IMG]]\` في مصدر الصورة \`src\`.
   - **للإناث:** استخدم الاسم العربي المناسب واستخدم الرمز \`[[FEMALE_IMG]]\` في مصدر الصورة \`src\`.
   - نوّع الأسماء (مثال: "Reda Usmh", "أريج الزهور", "Amine Dz", "Oum Walid", etc).
4. **التفاعل:**
   - أضف أيقونات تفاعل (قلب/لايك) بأرقام عشوائية.
   - أضف "عرض الردود السابقة" بين بعض التعليقات لزيادة الواقعية.

### نموذج HTML لتعليق واحد (كرر هذا النمط مع تغيير البيانات):
\`\`\`html
<div class="comment-row">
    <div class="avatar"><img src="[[FEMALE_IMG]]" alt="User"></div>
    <div class="comment-content">
        <div class="bubble">
            <span class="username">اسم المستخدم</span>
            <span class="text">نص التعليق هنا...</span>
            <div class="reactions-container">
                <div class="react-icon icon-love"></div>
                <span class="react-count">15</span>
            </div>
        </div>
        <div class="actions">
            <span class="time">منذ ساعتين</span>
            <span class="action-link">أعجبني</span>
            <span class="action-link">رد</span>
        </div>
    </div>
</div>
\`\`\`

## ⚠️ هيكل الصفحة المطلوب:
1. **الهيدر:** الشعار.
2. **المنتج:** الصورة الرئيسية + السعر + زر الشراء.
3. **استمارة الطلب:** (نفس الحقول المعتادة: الاسم، الهاتف، الولاية، البلدية).
4. **قسم آراء العملاء (Facebook Comments):**
   - ابدأ بـ \`<div class="fb-reviews-section"><h3>آراء زبائننا الكرام</h3><div class="comment-thread"><div class="thread-line-container"></div>\`
   - ضع التعليقات هنا.
   - أغلق الـ divs.
   - **مهم:** قم بتضمين كود CSS (\`fbStyles\`) الذي سأزودك به في بداية الـ HTML.

## تنسيق الإخراج (JSON Only):
{
  "html": "كود HTML الكامل بما في ذلك الستايل",
  "liquid_code": "كود Liquid",
  "schema": { ... }
}

قم بدمج هذا الـ CSS في بداية الـ HTML الناتج:
${fbStyles}
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.95 }
            })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]) throw new Error('AI Generation Failed');

        const cleanedText = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
        let aiResponse = JSON.parse(cleanedText);

        // ***************************************************************
        // الحقن والاستبدال (الصور + صور البروفايل العشوائية)
        // ***************************************************************

        // 1. إعداد الصور العشوائية (50 ذكر / 50 أنثى)
        // نستخدم randomuser.me للحصول على صور حقيقية وثابتة عبر الـ IDs
        const getRandomAvatar = (gender) => {
            const randomId = Math.floor(Math.random() * 50); // رقم عشوائي بين 0 و 49
            const genderPath = gender === 'male' ? 'men' : 'women';
            return `https://randomuser.me/api/portraits/${genderPath}/${randomId}.jpg`;
        };

        const injectAvatars = (htmlContent) => {
            let content = htmlContent;
            // استبدال كل ظهور لـ [[MALE_IMG]] بصورة مختلفة
            while (content.includes('[[MALE_IMG]]')) {
                content = content.replace('[[MALE_IMG]]', getRandomAvatar('male'));
            }
            // استبدال كل ظهور لـ [[FEMALE_IMG]] بصورة مختلفة
            while (content.includes('[[FEMALE_IMG]]')) {
                content = content.replace('[[FEMALE_IMG]]', getRandomAvatar('female'));
            }
            return content;
        };

        // 2. إعداد صور المنتج
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const replaceProductImages = (content) => {
            if (!content) return content;
            let result = content;
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                result = result.split(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`).join(finalProductImages[i]);
            }
            return result;
        };

        // تنفيذ الاستبدالات
        aiResponse.html = injectAvatars(replaceProductImages(aiResponse.html));
        aiResponse.liquid_code = injectAvatars(replaceProductImages(aiResponse.liquid_code));

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
