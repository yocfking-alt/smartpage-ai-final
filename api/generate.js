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
        const GEMINI_MODEL = 'gemini-2.0-flash'; // استخدام موديل سريع وذكي
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // تعريف المتغيرات البديلة للصور
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // تجهيز قائمة الصور الإضافية للprompt
        const additionalImagesPrompt = productImageArray.length > 1 
            ? Array.from({length: Math.min(productImageArray.length - 1, 5)}, (_, i) => `Image ${i + 2}: [[PRODUCT_IMAGE_${i + 2}_SRC]]`).join(', ')
            : 'No additional images';

        const prompt = `
        Act as a Senior UI/UX Designer and Conversion Copywriter specialized in the Algerian market.
        
        **PRODUCT DETAILS:**
        - Name: ${productName}
        - Category: ${productCategory}
        - Features: ${productFeatures}
        - Price: ${productPrice} (${shippingText})
        - Audience: ${targetAudience}
        - User Request: ${designDescription}

        **IMAGES:**
        - Main Image: ${MAIN_IMG_PLACEHOLDER}
        - Logo: ${LOGO_PLACEHOLDER}
        - Gallery Images: ${additionalImagesPrompt}

        **OBJECTIVE:**
        Generate a high-converting HTML Landing Page (single file).

        ## ⚠️ CRITICAL REQUIREMENT: "FACEBOOK-STYLE" REVIEWS SECTION
        You MUST generate a specific "Customer Reviews" section that looks EXACTLY like a Facebook comment thread.
        
        **1. INJECT THIS EXACT CSS INTO THE <STYLE> TAG:**
        \`\`\`css
        /* FB Comments CSS */
        .comment-thread { max-width: 600px; margin: 20px auto; position: relative; direction: rtl; font-family: system-ui, -apple-system, sans-serif; }
        .thread-line-container { position: absolute; right: 25px; top: 50px; bottom: 30px; width: 2px; background-color: #eaebef; z-index: 0; }
        .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 1; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-left: 8px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.1); background: #fff; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .comment-content { display: flex; flex-direction: column; max-width: 85%; }
        .bubble { background-color: #f0f2f5; padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; }
        .username { font-weight: 600; font-size: 13px; color: #050505; display: block; margin-bottom: 2px; }
        .text { font-size: 15px; color: #050505; line-height: 1.3; }
        .actions { display: flex; gap: 10px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: #65676b; font-weight: 600; }
        .reactions-container { position: absolute; bottom: -10px; left: -10px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px; display: flex; align-items: center; height: 18px; z-index: 10; }
        .react-icon.icon-love { width: 16px; height: 16px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
        .react-count { font-size: 11px; color: #65676b; margin-left: 4px; margin-right: 2px; }
        .view-replies { display: flex; align-items: center; font-weight: 600; font-size: 14px; color: #65676b; margin: 10px 0; padding-right: 50px; position: relative; cursor: pointer; }
        .view-replies::before { content: ''; position: absolute; right: 25px; top: 50%; width: 20px; height: 2px; background-color: #eaebef; border-bottom-left-radius: 10px; }
        \`\`\`

        **2. GENERATE THE REVIEWS HTML (Dynamic Content):**
        - Create a container `<div class="comment-thread">`.
        - Add `<div class="thread-line-container"></div>` at the top inside.
        - Generate **5 realistic reviews** for "${productName}".
        - **Language:** Mix Algerian Darija (e.g., "Machaallah", "Top", "Service rapide", "Haja chaba") and Arabic.
        - **Gender Split:** 50% Male, 50% Female.
        - **Avatars:** Use \`https://randomuser.me/api/portraits/men/[1-99].jpg\` for men and \`women/[1-99].jpg\` for women. (Pick random numbers).
        - **Reactions:** EVERY comment must have the `.reactions-container` with ONLY the `.icon-love` inside.
        - **Structure:** Use the exact HTML classes defined in the CSS above (.comment-row, .bubble, .username, .text, .actions, .icon-love).
        - Add "View replies" separators occasionally to simulate the thread look.

        ## MANDATORY SECTIONS:
        1. **Hero Section:** High converting, showing Main Image and Logo.
        2. **Order Form:**
           <div class="customer-info-box">
             <h3>استمارة الطلب</h3>
             <p>المرجو إدخال معلوماتك الخاصة بك</p>
             <div class="form-group"><label>الإسم الكامل</label><input type="text" placeholder="الاسم واللقب" required></div>
             <div class="form-group"><label>رقم الهاتف</label><input type="tel" placeholder="رقم الهاتف" required></div>
             <div class="form-group"><label>الولاية</label><input type="text" placeholder="الولاية" required></div>
             <div class="form-group"><label>البلدية</label><input type="text" placeholder="البلدية" required></div>
             <div class="price-display"><p>سعر المنتج: ${productPrice} د.ج</p></div>
             <button type="submit" class="submit-btn">تأكيد الطلب</button>
           </div>
        3. **Reviews Section:** (As defined above).

        **OUTPUT FORMAT:**
        Return ONLY a JSON object:
        {
          "html": "The full HTML code",
          "liquid_code": "The Shopify Liquid code (same structure)",
          "schema": { "name": "LP", "settings": [] }
        }
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.85 // High creativity for varied reviews
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
        // عملية حقن الصور الحقيقية
        // ***************************************************************
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            
            // استبدال الصور الأساسية
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            
            // استبدال صور المعرض
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
