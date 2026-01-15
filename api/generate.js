import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. ط¥ط¹ط¯ط§ط¯ط§طھ CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // ط§ط³طھظ‚ط¨ط§ظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        const productImageArray = productImages || [];
        const shippingText = shippingOption === 'free' ? "ط´ط­ظ† ظ…ط¬ط§ظ†ظٹ" : `ط§ظ„ط´ط­ظ†: ${customShippingPrice}`;
        const offerText = customOffer ? `ط¹ط±ط¶ ط®ط§طµ: ${customOffer}` : "";
        
        // طھط¬ظ‡ظٹط² ط§ظ„ط¨ظٹط§ظ†ط§طھ ظ„ظ„ظ…ظˆط¯ظٹظ„ (Data Injection)
        // ظ†ط±ط³ظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ ظƒظ€ JSON ظ„ظƒظٹ ظٹط³طھط·ظٹط¹ ط§ظ„ظ…ظˆط¯ظٹظ„ ط¨ظ†ط§ط، Logic ظ…ط®طµطµ
        const contextData = {
            images: productImageArray.map((_, i) => i === 0 ? "[[PRODUCT_IMAGE_MAIN_SRC]]" : `[[PRODUCT_IMAGE_${i + 1}_SRC]]`),
            colors: variants?.colors?.items || [],
            sizes: variants?.sizes?.items || [],
            price: productPrice,
            logo: "[[BRAND_LOGO_SRC]]"
        };

        // --- CSS ط§ظ„ظ…ط¯ظ…ط¬ (ظپظٹط³ط¨ظˆظƒ + ط³طھط§ظٹظ„ط§طھ ط£ط³ط§ط³ظٹط©) ---
        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --text-primary: #050505; --accent-color: #2563eb; }
            /* Facebook Reviews Style */
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; }
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 15px; position: relative; }
            .avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-left: 8px; flex-shrink: 0; }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { display: flex; flex-direction: column; max-width: 85%; }
            .bubble { background-color: #f0f2f5; padding: 8px 12px; border-radius: 18px; display: inline-block; position: relative; }
            .username { font-weight: 600; font-size: 13px; color: #050505; display: block; margin-bottom: 2px; }
            .text { font-size: 15px; color: #050505; line-height: 1.3; }
            .actions { display: flex; gap: 15px; margin-right: 12px; margin-top: 3px; font-size: 12px; color: #65676b; font-weight: 600; }
            .reactions-container { position: absolute; bottom: -8px; left: -15px; background-color: white; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); padding: 2px 4px; display: flex; align-items: center; height: 18px; z-index: 10; }
            .icon-love { width: 16px; height: 16px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }
        </style>
        `;

        // --- ط§ظ„ط¨ط±ظˆظ…ط¨طھ ط§ظ„ط°ظƒظٹ (The Intelligent Prompt) ---
        const prompt = `
        You are a Senior Creative Frontend Developer. 
        Product: ${productName}. Category: ${productCategory}.
        Target: ${targetAudience}. Style Request: ${designDescription}.
        Price: ${productPrice}. ${shippingText}. ${offerText}.

        Resource Data (JSON):
        ${JSON.stringify(contextData)}

        ## ًں§  CORE INSTRUCTION:
        Analyze the "Style Request". 
        **IF** the user asks for "Modern", "Creative", "Motion", "Futuristic", or "Interactive":
        --> You MUST build a **"Dynamic Hero Experience"** similar to high-end awards websites (Awwwards style).
        
        **Dynamic Hero Logic (The "Video Style"):**
        1. **Layout:** A full-height, centered layout.
        2. **Background:** A large circle or dynamic gradient shape that changes color based on the selected variant.
        3. **Product Image:** Positioned absolutely in the center. Large and high quality.
        4. **Interaction:** - Create a custom JavaScript function.
           - When a user clicks a color/flavor button:
             a) Rotate the product image (using CSS transform: rotate).
             b) Change the background color smoothly.
             c) Animate the product title/description (fade out/in).
        5. **No Standard Slider:** Do NOT use a basic left/right image slider for this mode. Make it feel app-like.

        **IF** the request is "Simple", "Standard", or unspecified:
        --> Use a clean, conversion-focused e-commerce layout with a standard gallery.

        ## ًں“‌ FORM REQUIREMENT (Mandatory for ALL styles):
        You MUST include this exact Arabic form structure inside the page (styled to match your theme):
        <div class="customer-info-box">
          <h3>ط§ط³طھظ…ط§ط±ط© ط§ظ„ط·ظ„ط¨</h3>
          <div class="form-group"><label>ط§ظ„ط¥ط³ظ… ط§ظ„ظƒط§ظ…ظ„</label><input type="text" required></div>
          <div class="form-group"><label>ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ</label><input type="tel" required></div>
          <div class="form-group"><label>ط§ظ„ظˆظ„ط§ظٹط©</label><input type="text" required></div>
          <div class="form-group"><label>ط§ظ„ط¨ظ„ط¯ظٹط©</label><input type="text" required></div>
          <div id="variant-selector-container"></div> 
          <div class="qty-price-wrapper">
             <button onclick="updateQty(-1)">-</button> <span id="qty">1</span> <button onclick="updateQty(1)">+</button>
             <span id="total-price">${productPrice}</span>
          </div>
          <button type="submit" class="submit-btn">طھط£ظƒظٹط¯ ط§ظ„ط·ظ„ط¨</button>
        </div>

        ## ًں—¨ï¸ڈ REVIEWS SECTION:
        Include a Facebook-style reviews section using the CSS provided in the system instruction. Use specific "Love" reactions only. Use placeholders [[MALE_IMG]] and [[FEMALE_IMG]].

        ## ًں› ï¸ڈ TECHNICAL OUTPUT:
        Return ONLY valid JSON:
        {
          "html": "Full HTML string with embedded CSS (<style>) and JS (<script>). Use Tailwind classes where possible.",
          "liquid_code": "The Shopify Liquid equivalent.",
          "schema": { "name": "Page", "settings": [] }
        }

        **Important:** - Integrate the provided 'fbStyles' CSS at the top of your HTML.
        - Ensure the JavaScript handles the variant selection logic (updating hidden inputs for the form).
        - If creating the "Interactive" mode, ensure you write the specific JS to handle the rotation and color changing logic based on the 'Resource Data' provided.
        `;

        const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // ط§ط³طھط®ط¯ط§ظ… ط£ط­ط¯ط« ظ…ظˆط¯ظٹظ„ ظ„ظ„ط³ط±ط¹ط© ظˆط§ظ„ط¯ظ‚ط©
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.9 // ط±ظپط¹ ط¯ط±ط¬ط© ط§ظ„ط¥ط¨ط¯ط§ط¹
                }
            })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini Error:", JSON.stringify(data));
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let aiResponse = JSON.parse(cleanedText);

        // ***************************************************************
        // ط¹ظ…ظ„ظٹط© ط§ظ„ط­ظ‚ظ† ظˆط§ط³طھط¨ط¯ط§ظ„ ط§ظ„طµظˆط± (Post-Processing)
        // ***************************************************************
        
        // طµظˆط± ط§ظپطھط±ط§ط¶ظٹط©
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
            while (content.includes('[[MALE_IMG]]')) content = content.replace('[[MALE_IMG]]', getRandomAvatar('male'));
            while (content.includes('[[FEMALE_IMG]]')) content = content.replace('[[FEMALE_IMG]]', getRandomAvatar('female'));
            return content;
        };

        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            // ط§ط³طھط¨ط¯ط§ظ„ ط§ظ„طµظˆط±ط© ط§ظ„ط±ط¦ظٹط³ظٹط©
            result = result.split("[[PRODUCT_IMAGE_MAIN_SRC]]").join(finalProductImages[0]);
            // ط§ط³طھط¨ط¯ط§ظ„ ط§ظ„ط´ط¹ط§ط±
            result = result.split("[[BRAND_LOGO_SRC]]").join(finalBrandLogo);
            // ط§ط³طھط¨ط¯ط§ظ„ ط§ظ„طµظˆط± ط§ظ„ط¥ط¶ط§ظپظٹط©
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                // ط¥ط°ط§ ظ„ظ… طھظƒظ† ظ‡ظ†ط§ظƒ طµظˆط±ط© ظƒط§ظپظٹط©طŒ ظ†ط³طھط®ط¯ظ… ط§ظ„طµظˆط±ط© ط§ظ„ط£ظˆظ„ظ‰ ط£ظˆ طµظˆط±ط© ظپط§ط±ط؛ط©
                const imgUrl = finalProductImages[i] || finalProductImages[0];
                result = result.split(placeholder).join(imgUrl);
            }
            return result;
        };

        // ط¯ظ…ط¬ ط§ظ„ط³طھط§ظٹظ„ط§طھ ط§ظ„ظ…ط³ط¨ظ‚ط© ظ…ط¹ ط§ظ„ظ†طھظٹط¬ط©
        const finalHtml = injectAvatars(replaceImages(fbStyles + aiResponse.html));
        const finalLiquid = injectAvatars(replaceImages(fbStyles + aiResponse.liquid_code));

        res.status(200).json({
            liquid_code: finalLiquid,
            schema: aiResponse.schema,
            html: finalHtml
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
