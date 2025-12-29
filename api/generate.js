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
        
        // --- CSS الخاص بتعليقات الفيسبوك (تصميم سلايدر + سكرين شوت + قلوب) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            
            .fb-reviews-section { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                direction: rtl; 
                padding: 20px 0; 
                background: #f9f9f9; 
                margin-top: 30px; 
                border-top: 1px solid #ddd; 
                text-align: center;
                overflow: hidden; /* لمنع ظهور شريط التمرير للصفحة */
            }

            .fb-reviews-title { margin-bottom: 20px; font-size: 1.5rem; font-weight: bold; color: #333; }

            /* --- SLIDER STYLES --- */
            .reviews-slider-container {
                position: relative;
                max-width: 500px; /* عرض الهاتف */
                margin: 0 auto;
                overflow: hidden;
            }

            .reviews-track {
                display: flex;
                transition: transform 0.4s ease-in-out;
                width: 100%;
            }

            .review-slide {
                min-width: 100%;
                flex-shrink: 0;
                padding: 10px;
                box-sizing: border-box;
            }

            .slider-arrow {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(255,255,255,0.9);
                border: 1px solid #ddd;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                font-size: 18px;
                user-select: none;
            }
            .slider-arrow:hover { background: #fff; }
            .prev-arrow { left: 10px; }
            .next-arrow { right: 10px; }

            /* --- SCREENSHOT CARD DESIGN --- */
            .fb-screenshot-card {
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                overflow: hidden;
                text-align: right;
                position: relative;
                min-height: 400px;
            }

            .fb-fake-header {
                padding: 10px 15px;
                border-bottom: 1px solid #eee;
                font-size: 12px;
                color: #65676b;
                display: flex;
                justify-content: space-between;
                background: #fff;
            }

            .comment-thread { padding: 10px 15px 20px 15px; position: relative; }
            .thread-line-container { position: absolute; right: 40px; top: 15px; bottom: 30px; width: 2px; background-color: var(--line-color); z-index: 0; }
            
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 1; }
            .avatar { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-left: 10px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; max-width: 88%; }
            .bubble { background-color: var(--comment-bg); padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; min-width: 120px; }
            .username { font-weight: 600; font-size: 13px; color: var(--text-primary); display: block; margin-bottom: 2px; cursor: pointer; }
            .text { font-size: 14px; color: var(--text-primary); line-height: 1.3; white-space: pre-wrap; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: var(--text-secondary); font-weight: 600; }
            
            .reactions-container { position: absolute; bottom: -8px; left: -10px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px 4px; display: flex; align-items: center; height: 18px; z-index: 10; }
            .react-icon { width: 16px; height: 16px; border: 2px solid #fff; border-radius: 50%; }
            .react-count { font-size: 11px; color: var(--text-secondary); margin-left: 4px; margin-right: 2px; }
            
            .icon-love { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
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
1. الصورة الرئيسية: \`${MAIN_IMG_PLACEHOLDER}\`
2. صور المعرض: \`[[PRODUCT_IMAGE_X_SRC]]\`
3. الشعار: \`${LOGO_PLACEHOLDER}\`

## ⚠️ **متطلبات إلزامية:**

### **1. استمارة الطلب:**
(نفس الهيكل المعتاد مع حقول: الاسم، الهاتف، الولاية، البلدية، العنوان، السعر).

### **2. قسم آراء العملاء (نظام السلايدر - Slider):**
يجب إنشاء قسم تفاعلي يعرض "لقطات شاشة" لتعليقات فيسبوك داخل نظام سلايدر (Carousel).

**الهيكل المطلوب (HTML):**
يجب أن يكون الكود دقيقاً ليعمل السلايدر:
\`\`\`html
<div class="fb-reviews-section">
    <h3 class="fb-reviews-title">تجارب زبائننا الكرام</h3>
    
    <div class="reviews-slider-container">
        <div class="slider-arrow next-arrow" onclick="moveSlide(1)">&#10095;</div>
        <div class="slider-arrow prev-arrow" onclick="moveSlide(-1)">&#10094;</div>

        <div class="reviews-track" id="reviewsTrack">
            
            <div class="review-slide">
                <div class="fb-screenshot-card">
                    <div class="fb-fake-header">أحدث التعليقات ▾</div>
                    <div class="comment-thread">
                        <div class="thread-line-container"></div>
                        </div>
                </div>
            </div>

            <div class="review-slide">
                <div class="fb-screenshot-card">
                    <div class="fb-fake-header">التعليقات الأكثر ملاءمة ▾</div>
                    <div class="comment-thread">
                         <div class="thread-line-container"></div>
                        </div>
                </div>
            </div>

            <div class="review-slide">
                 <div class="fb-screenshot-card">
                    <div class="fb-fake-header">كل التعليقات ▾</div>
                    <div class="comment-thread">
                         <div class="thread-line-container"></div>
                        </div>
                </div>
            </div>

            </div>
    </div>

    <script>
        let currentSlide = 0;
        function moveSlide(direction) {
            const track = document.getElementById('reviewsTrack');
            const slides = document.querySelectorAll('.review-slide');
            const totalSlides = slides.length;
            
            currentSlide += direction;
            
            if (currentSlide >= totalSlides) { currentSlide = 0; }
            if (currentSlide < 0) { currentSlide = totalSlides - 1; }
            
            // التعامل مع RTL (من اليمين لليسار)
            const offset = currentSlide * 100;
            track.style.transform = 'translateX(' + offset + '%)';
        }
    </script>
</div>
\`\`\`

**تعليمات المحتوى:**
1. **العدد:** أنشئ 4 شرائح (Slides) مختلفة.
2. **التعليقات:** داخل كل شريحة، ضع من 3 إلى 5 تعليقات.
3. **التنوع:** يجب أن تكون التعليقات مختلفة في كل شريحة (رجال، نساء، لهجة جزائرية، فصحى).
4. **التفاعل:** استخدم **القلوب فقط** (`icon-love`) كرمز تفاعل.

### **3. تنسيق الإخراج:**
أعد كائن JSON فقط:
{
  "html": "سلسلة HTML كاملة (تتضمن CSS و Script)",
  "liquid_code": "كود Shopify Liquid",
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
