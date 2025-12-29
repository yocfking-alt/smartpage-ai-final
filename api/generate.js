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

        // ملاحظة: تأكد من أن اسم الموديل صحيح ومتاح لحسابك
        const GEMINI_MODEL = 'gemini-2.0-flash'; // تم التحديث لنسخة مستقرة، يمكنك إرجاعها لـ 2.5 إذا كان لديك وصول
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

        // --- CSS المعدل: تصميم المعرض (Slider) ليبدو كلقطات شاشة ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px 0; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; overflow: hidden; }
            
            /* حاوية السلايدر */
            .reviews-slider-container { position: relative; max-width: 600px; margin: 0 auto; }
            
            /* الشريحة الواحدة (تبدو كلقطة شاشة) */
            .review-slide { display: none; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); animation: fadeEffect 0.6s; }
            .review-slide.active { display: block; }
            
            /* محتوى التعليقات داخل الشريحة */
            .comment-thread { position: relative; }
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
            
            /* أزرار التنقل (أسهم) */
            .slider-nav-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.9); border: 1px solid #ddd; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); z-index: 5; transition: all 0.2s; font-size: 20px; color: #333; user-select: none; }
            .slider-nav-btn:hover { background: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
            .prev-btn { left: -20px; }
            .next-btn { right: -20px; }
            
            /* مؤشرات النقاط */
            .slider-dots { text-align: center; margin-top: 15px; }
            .dot { cursor: pointer; height: 8px; width: 8px; margin: 0 4px; background-color: #bbb; border-radius: 50%; display: inline-block; transition: background-color 0.3s; }
            .dot.active { background-color: var(--blue-link); transform: scale(1.2); }
            
            @keyframes fadeEffect { from {opacity: 0.4} to {opacity: 1} }
            
            /* أيقونة القلب */
            .icon-love { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
            
            @media (max-width: 600px) {
                .prev-btn { left: 0; }
                .next-btn { right: 0; }
            }
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

## 🖼️ **تعليمات الصور المتعددة (مهم جداً):**
لقد تم تزويدك بعدة صور للمنتج (${productImageArray.length} صور) وشعار.
**يجب اتباع التعليمات التالية بدقة:**
1. استخدم \`${MAIN_IMG_PLACEHOLDER}\` للصورة الرئيسية.
2. استخدم \`${LOGO_PLACEHOLDER}\` للشعار.
3. أنشئ معرضاً للصور الإضافية باستخدام الرموز \`[[PRODUCT_IMAGE_N_SRC]]\`.

## 🎯 **الهدف:**
إنشاء صفحة هبوط فريدة ومبدعة.

## ⚠️ **متطلبات إلزامية لقسم آراء العملاء (نظام السلايدر):**
بدلاً من قائمة طويلة، أريد **معرض صور (Carousel)** للتعليقات.
1. **الهيكل:** أنشئ "سلايدر" يحتوي على **3 إلى 5 شرائح (Slides)**.
2. **المحتوى:** كل شريحة (Slide) يجب أن تبدو كلقطة شاشة (Screenshot) وتحتوي بداخلها على **3 إلى 5 تعليقات مختلفة**.
3. **التصميم:** استخدم أكواد CSS المرفقة (fbStyles).
4. **التفاعل:** استخدم أيقونة القلب فقط (\`icon-love\`).
5. **الصور الشخصية:** استخدم \`[[MALE_IMG]]\` و \`[[FEMALE_IMG]]\`.

### **هيكل الـ HTML المطلوب لقسم التعليقات:**
يجب أن يكون القسم بهذا الشكل الدقيق ليعمل السلايدر:

\`\`\`html
<div class="fb-reviews-section">
    <h3 style="text-align:center; margin-bottom:20px;">آراء زبائننا السعداء</h3>
    
    <div class="reviews-slider-container">
        <div class="review-slide active fade">
            <div class="comment-thread">
                </div>
        </div>

        <div class="review-slide fade">
            <div class="comment-thread">
                </div>
        </div>
        
        <a class="slider-nav-btn prev-btn" onclick="plusSlides(-1)">&#10094;</a>
        <a class="slider-nav-btn next-btn" onclick="plusSlides(1)">&#10095;</a>
    </div>
    
    <div class="slider-dots">
        <span class="dot active" onclick="currentSlide(1)"></span>
        <span class="dot" onclick="currentSlide(2)"></span>
        </div>

    <script>
        let slideIndex = 1;
        // سيتم استدعاء showSlides تلقائياً في الأسفل
        function plusSlides(n) { showSlides(slideIndex += n); }
        function currentSlide(n) { showSlides(slideIndex = n); }
        function showSlides(n) {
            let i;
            let slides = document.getElementsByClassName("review-slide");
            let dots = document.getElementsByClassName("dot");
            if (n > slides.length) {slideIndex = 1}    
            if (n < 1) {slideIndex = slides.length}
            for (i = 0; i < slides.length; i++) { slides[i].style.display = "none"; slides[i].className = slides[i].className.replace(" active", ""); }
            for (i = 0; i < dots.length; i++) { dots[i].className = dots[i].className.replace(" active", ""); }
            slides[slideIndex-1].style.display = "block";  
            slides[slideIndex-1].className += " active";
            if(dots.length > 0) dots[slideIndex-1].className += " active";
        }
    </script>
</div>
\`\`\`

### ** باقي الصفحة:**
- **قسم الهيرو:** مع الشعار والصورة الرئيسية.
- **استمارة الطلب:** نفس الحقول المطلوبة سابقاً (الاسم، الهاتف، الولاية، البلدية، العنوان).
- صمم باقي الأقسام بحرية.
- **هام:** قم بتضمين كود CSS (\`fbStyles\`) في بداية الـ HTML.

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
        
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const getRandomAvatar = (gender) => {
            const randomId = Math.floor(Math.random() * 50); 
            const genderPath = gender === 'male' ? 'men' : 'women';
            return `https://randomuser.me/api/portraits/${genderPath}/${randomId}.jpg`;
        };

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
