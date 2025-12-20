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
            customOffer, productImage, brandLogo 
        } = req.body;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // تعريف المتغيرات البديلة للصور
        const IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";

        // ***************************************************************
        // 🔥 البرومبت المطور (The Super Prompt)
        // ***************************************************************
        const prompt = `
Act as a World-Class Creative Developer & UI/UX Expert (Awwwards Level).
Your goal: Build a HIGH-END, INTERACTIVE Landing Page for: ${productName}.
Category: ${productCategory}. Audience: ${targetAudience}.
Context: ${productFeatures}. Price: ${productPrice}. ${shippingText}. ${offerText}.
User Vibe Request: ${designDescription}.

## 🖼️ CRITICAL IMAGE RULES:
- Main Product Image: \`${IMG_PLACEHOLDER}\`
- Brand Logo: \`${LOGO_PLACEHOLDER}\`
- **BACKGROUND REMOVAL TRICK**: Since the image might have a white background, you MUST write CSS to blend it. 
  - IF the page background is light, use \`mix-blend-mode: multiply;\` on the product image.
  - OR place the product inside a standard shape (Circle/Blob) with \`overflow: visible\`.
  - Add a strong \`filter: drop-shadow(0 20px 30px rgba(0,0,0,0.3));\` to create depth and 3D feel.

## 🎨 VISUAL CONCEPTS (Pick ONE Randomly to ensure variety):
1. **The "Orbital" Concept:** The product floats in the center. Background elements rotate slowly behind it.
2. **The "Split Screen" Concept:** HUGE typography on one side, HUGE product on the other that rotates on hover.
3. **The "Glassmorphism" Concept:** Deep gradient background with frosted glass cards for the form and details.
4. **The "Scroll-Trigger" Concept:** The product stays fixed (sticky) while features scroll past it.

## ⚡ INTERACTIVITY (Like the Video Style):
- Write custom **JavaScript** inside the HTML.
- **Hero Animation:** The product image must have an entrance animation (e.g., slide up + rotate, or scale up).
- **Mouse Movement:** Add a "Parallax Effect". When the mouse moves, the product image should tilt or move slightly opposite to the cursor.
- **Floating Elements:** Add decorative CSS shapes (blobs, circles) behind the product that animate/pulse.

## 📝 FORM STRUCTURE (Mandatory):
The order form must be styled elegantly (Glassmorphism or Minimalist Clean) and include EXACTLY these fields with Arabic placeholders:
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <div class="form-group"><label>الإسم الكامل</label><input type="text" placeholder="الاسم واللقب" required></div>
  <div class="form-group"><label>رقم الهاتف</label><input type="tel" placeholder="رقم الهاتف" required></div>
  <div class="form-group"><label>الولاية</label><input type="text" placeholder="الولاية" required></div>
  <div class="form-group"><label>البلدية</label><input type="text" placeholder="البلدية" required></div>
  <div class="form-group"><label>العنوان</label><input type="text" placeholder="العنوان بالتفصيل" required></div>
  <div class="price-tag">السعر: ${productPrice} DZD</div>
  <button type="submit" class="submit-btn">تأكيد الطلب (الدفع عند الاستلام)</button>
</div>

## 🛠️ OUTPUT FORMAT:
Return ONLY a valid JSON object without markdown:
{
  "html": "FULL HTML string including <style> for advanced CSS and <script> for animations",
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
                    temperature: 1.0 // زيادة الحرارة لزيادة الإبداع والتنوع
                }
            })
        });

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Failed to generate content from AI');
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let aiResponse;
        try {
             aiResponse = JSON.parse(cleanedText);
        } catch (e) {
            console.error("JSON Parse Error:", cleanedText);
            throw new Error("AI returned invalid JSON format.");
        }

        // ***************************************************************
        // استبدال الصور
        // ***************************************************************
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";

        const finalProductImage = productImage || defaultImg;
        const finalBrandLogo = brandLogo || defaultLogo;

        const replaceImages = (content) => {
            if (!content) return content;
            return content
                .split(IMG_PLACEHOLDER).join(finalProductImage)
                .split(LOGO_PLACEHOLDER).join(finalBrandLogo);
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
