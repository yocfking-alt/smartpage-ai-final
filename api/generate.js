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

        // --- CSS الخاص بتعليقات الفيسبوك (تحديث: نظام السلايدر واللقطات) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px 10px; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; overflow: hidden; }
            
            /* حاوية السلايدر */
            .reviews-slider-wrapper { position: relative; max-width: 600px; margin: 0 auto; }
            .reviews-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; gap: 20px; padding-bottom: 20px; scrollbar-width: none; }
            .reviews-track::-webkit-scrollbar { display: none; }
            
            /* تصميم الشريحة (لتظهر كلقطة شاشة) */
            .review-slide { flex: 0 0 100%; scroll-snap-align: center; background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid #e1e1e1; overflow: hidden; position: relative; min-height: 300px; }
            .screenshot-header { background: #fff; padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 12px; font-weight: bold; }
            .screenshot-header::before { content: 'Facebook Comments'; flex-grow: 1; }
            .screenshot-content { padding: 15px; background: #fff; }

            /* أزرار التنقل */
            .slider-nav-btn { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; background: rgba(255,255,255,0.9); border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.2); border: none; cursor: pointer; z-index: 10; font-size: 20px; color: #333; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .slider-nav-btn:hover { background: #fff; transform: translateY(-50%) scale(1.1); }
            .slider-nav-btn.prev { left: 10px; }
            .slider-nav-btn.next { right: 10px; }

            /* تنسيق التعليقات */
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 1; }
            .avatar { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-left: 8px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; max-width: 88%; }
            .bubble { background-color: var(--comment-bg); padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; }
            .username { font-weight: 600; font-size: 13px; color: var(--text-primary); display: block; margin-bottom: 2px; }
            .text { font-size: 14px; color: var(--text-primary); line-height: 1.3; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
            
            /* أيقونة القلب */
            .reactions-container { position: absolute; bottom: -8px; left: -10px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px 4px; display: flex; align-items: center; height: 18px; z-index: 10; }
            .icon-love { width: 16px; height: 16px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
        </style>
        <script>
            function moveReviewSlide(direction) {
                const track = document.querySelector('.reviews-track');
                const slideWidth = track.querySelector('.review-slide').offsetWidth;
                track.scrollBy({ left: direction * slideWidth * -1, behavior: 'smooth' }); // -1 for RTL support adjustment if needed, usually direct mapping for scrollLeft
            }
        </script>
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
- الصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
- الصور الإضافية: ${galleryPlaceholders || "لا توجد"}
- الشعار: \`${LOGO_PLACEHOLDER}\`

## 🎯 **الهدف:**
إنشاء صفحة هبوط تحتوي على قسم آراء عملاء مبتكر على شكل "سلايدر لقطات شاشة".

## ⚠️ **متطلبات قسم آراء العملاء (محدث):**
يجب أن يكون القسم عبارة عن **معرض صور قابل للسحب (Slider)**.
1. **الهيكل:** قم بإنشاء 3 إلى 5 "شرائح" (Slides).
2. **المظهر:** كل شريحة يجب أن تبدو وكأنها **لقطة شاشة (Screenshot)** لمحادثة فيسبوك مختلفة.
3. **المحتوى:**
   - داخل كل شريحة، ضع من 3 إلى 5 تعليقات مختلفة.
   - استخدم اللهجة الجزائرية الممزوجة بالفصحى.
   - استخدم \`[[MALE_IMG]]\` و \`[[FEMALE_IMG]]\` للصور.
   - استخدم أيقونة القلب فقط (\`icon-love\`) للتفاعلات.

### هيكل HTML المطلوب للسلايدر (يرجى اتباعه بدقة):
\`\`\`html
<div class="fb-reviews-section">
    <h3 style="text-align:center; margin-bottom:20px;">آراء زبائننا السعداء</h3>
    <div class="reviews-slider-wrapper">
        <button class="slider-nav-btn next" onclick="moveReviewSlide(1)">&#10095;</button>
        <button class="slider-nav-btn prev" onclick="moveReviewSlide(-1)">&#10094;</button>
        
        <div class="reviews-track">
            <div class="review-slide">
                <div class="screenshot-header">تم التقاطها الآن • تعليقات فيسبوك</div>
                <div class="screenshot-content">
                    <div class="comment-row">...</div>
                    <div class="comment-row">...</div>
                    <div class="comment-row">...</div>
                </div>
            </div>

            <div class="review-slide">
                <div class="screenshot-header">منذ ساعة • تعليقات فيسبوك</div>
                <div class="screenshot-content">
                    <div class="comment-row">...</div>
                </div>
            </div>

            </div>
    </div>
</div>
\`\`\`

## **متطلبات الأقسام الأخرى:**
1. **الهيرو:** صورة المنتج \`${MAIN_IMG_PLACEHOLDER}\` بارزة + الشعار.
2. **استمارة الطلب:** نفس الحقول السابقة (الإسم، الهاتف، الولاية، البلدية، العنوان).
3. **التصميم العام:** استخدم CSS الحديث المدمج في \`fbStyles\`.

**هام جداً:** قم بدمج كود CSS (\`fbStyles\`) الذي سأزودك به في بداية الـ HTML الناتج.
أعد كائن JSON فقط: { "html": "...", "liquid_code": "...", "schema": ... }

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
