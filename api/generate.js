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

        // ***************************************************************
        //  التعليمات المحدثة لضمان محاكاة فيسبوك واللهجة الجزائرية
        // ***************************************************************
        const prompt = `
Act as a Senior Web Designer & Algerian Marketing Expert.
Create a high-converting Landing Page for: ${productName}.
Category: ${productCategory}.
Audience: ${targetAudience}.
Price: ${productPrice} DZD. ${shippingText}. ${offerText}.

## 🛑 STRICT INSTRUCTION: FACEBOOK COMMENTS SECTION (REVIEWS)
You MUST generate a "Customer Reviews" section that looks **EXACTLY** like Facebook Mobile App comments (Screenshots).

### 1. Visual Design Rules (CSS Injection):
- Use a clean white container.
- **Comment Bubble:** Use Background color \`#F0F2F5\`, Border-radius \`18px\`, Color \`#050505\`.
- **Layout:** Avatar on the right (RTL), Name bold, Text inside the bubble.
- **Interactions:** Below the bubble, add small text: "أعجبني · رد · منذ [Time]" in color \`#65676B\`.
- **Reactions:** Simulate small floating reaction icons (Like/Love) under some comments.

### 2. Content & Language (Algerian Context):
- Generate 4 to 5 unique comments specifically about "${productName}".
- **Dialect Mix:**
  - **60% Algerian Darija:** Use terms like "Ya3tikom saha", "Top", "Haja chabba", "Waslatni f waqtha", "Merci", "Rabi ybarek".
  - **40% Modern Standard Arabic:** Use terms like "منتج رائع", "مصداقية", "أنصح به".
- **Context:** The comments MUST mention specific features of the product (e.g., if it's Honey, talk about taste; if it's a Watch, talk about quality).
- **Identities:** Use realistic Algerian names (e.g., Mohamed Amine, Sarah, Rym, Yacine, Lamia).
- **Avatars:** Use \`https://ui-avatars.com/api/?name=[Name]&background=random&color=fff\` for avatars.

### 3. Mandatory Structure:
1. **Hero Section:** Title, Price, Order Button, Main Image (${MAIN_IMG_PLACEHOLDER}).
2. **Order Form:** Standard Algerian delivery form (Name, Phone, Wilaya, Baladiya).
3. **Facebook Comments Section:** As described above.
4. **Gallery:** If extra images exist using [[PRODUCT_IMAGE_X_SRC]].

## Output Format:
Return ONLY a JSON object:
{
  "html": "Full HTML with embedded CSS for the Facebook style",
  "liquid_code": "Shopify Liquid version",
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
                    temperature: 0.95 // High creativity for varied comments every time
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
        // استبدال الصور
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
