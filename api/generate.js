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
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // بناء التعليمات (Prompt)
        const prompt = `
Act as a Senior Creative Director and Web Developer.
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **Image Instructions:**
Use \`${MAIN_IMG_PLACEHOLDER}\` for the main image.
Use \`${LOGO_PLACEHOLDER}\` for the logo.
For extra images, create a gallery using:
${productImageArray.length > 1 ? 
  Array.from({length: Math.min(productImageArray.length - 1, 5)}, (_, i) => 
    `[[PRODUCT_IMAGE_${i + 2}_SRC]]`
  ).join(', ') 
  : 'No extra images'}

## 🎯 **Goal:**
Create a high-converting HTML landing page.

## ⚠️ **MANDATORY REQUIREMENTS:**

### **1. Header & Hero:**
- Must include Logo and Main Image.
- High quality headline.

### **2. Order Form (EXACT STRUCTURE):**
Place this EXACT form structure immediately after the Hero section:
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

### **3. Customer Reviews (FACEBOOK STYLE CLONE):**
You MUST create a section specifically for "Customer Reviews" that looks **exactly** like Facebook mobile comments.
**Do NOT** use generic testimonial cards. Use the specific CSS and HTML structure below.

**Content Requirements for Reviews:**
- Generate **4 to 5 unique reviews** specifically about "${productName}".
- **Language:** Mix between **Algerian Dialect (Darija)** and **Modern Standard Arabic**.
    - Example Darija: "لحقني لبارح يعطيك الصحة"، "ما شاء الله كاليتي طوب"، "السومة مساعدة".
    - Example Arabic: "منتج رائع ومصداقية في التعامل"، "وصلتني الطلبية في وقت قصير".
- **Names:** Use realistic Algerian names (e.g., "Amine Sadi", "Meriem Dz", "Fares Lamri", "أم أيمن").
- **Avatars:** Use random placeholder images: \`https://i.pravatar.cc/150?u=1\`, \`https://i.pravatar.cc/150?u=2\`, etc.
- **Stats:** Vary the time (e.g., "منذ 2 ساعة", "أمس", "2d") and like counts (3, 12, 40...).

**REQUIRED CSS for Reviews (Include this in your <style>):**
\`\`\`css
.fb-comments-container { max-width: 100%; background: #fff; padding: 20px 10px; direction: rtl; font-family: Helvetica, Arial, sans-serif; border-top: 1px solid #ddd; }
.fb-stats-bar { display: flex; justify-content: space-between; padding: 10px 5px; border-bottom: 1px solid #eee; color: #65676b; font-size: 14px; }
.fb-likes-count { display: flex; align-items: center; color: #050505; font-weight: bold; }
.fb-blue-thumb { background: #1877f2; color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; margin-left: 5px; }
.fb-comment-item { display: flex; margin-top: 15px; align-items: flex-start; }
.fb-avatar { width: 40px; height: 40px; border-radius: 50%; margin-left: 10px; background: #ddd; object-fit: cover;}
.fb-comment-content { flex: 1; }
.fb-user-header { display: flex; align-items: baseline; margin-bottom: 2px; }
.fb-username { font-weight: bold; color: #050505; font-size: 14px; margin-left: 5px; }
.fb-time { font-size: 12px; color: #65676b; }
.fb-comment-text { font-size: 15px; color: #050505; line-height: 1.3; margin-bottom: 5px; }
.fb-actions-bar { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #65676b; }
.fb-actions-right { display: flex; align-items: center; gap: 15px; }
.fb-action-link { font-weight: bold; cursor: pointer; }
.fb-likes-display { display: flex; align-items: center; }
.fb-view-reply { font-weight: bold; margin-top: 5px; cursor: pointer; display:flex; align-items:center; }
.fb-footer-input { margin-top: 20px; background: #f0f2f5; padding: 10px 15px; border-radius: 20px; color: #65676b; font-size: 15px; text-align: right; }
\`\`\`

**REQUIRED HTML Template for Reviews (Use this structure, populate with AI content):**
\`\`\`html
<div class="fb-comments-container">
    <div class="fb-stats-bar">
        <div class="fb-likes-count"><span>[Random Number like 2.4K]</span><div class="fb-blue-thumb">👍</div></div>
        <div>[Random Number] مشاركات</div>
    </div>
    
    <div class="fb-comment-item">
        <img src="https://i.pravatar.cc/150?u=[RandomID]" class="fb-avatar" alt="User">
        <div class="fb-comment-content">
            <div class="fb-user-header">
                <span class="fb-username">[AI Generated Algerian Name]</span>
                <span class="fb-time">[AI Time, e.g. 2h]</span>
            </div>
            <div class="fb-comment-text">
                [AI Generated Review about ${productName} in Algerian/Arabic]
            </div>
            <div class="fb-actions-bar">
                <div class="fb-actions-right">
                    <span class="fb-action-link">رد</span>
                    <div class="fb-likes-display"><span>[Random Small Number]</span> <div class="fb-blue-thumb" style="width:14px;height:14px;">👍</div></div>
                </div>
            </div>
             <div class="fb-view-reply">↪ عرض رد واحد</div>
        </div>
    </div>
    <div class="fb-footer-input">اكتب تعليقاً...</div>
</div>
\`\`\`

### **4. JSON Output Format:**
Return ONLY valid JSON:
{
  "html": "full HTML string",
  "liquid_code": "Shopify Liquid string",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **Creative Freedom:**
- Design the rest of the page (features, countdown, etc.) beautifully.
- Ensure the page is responsive.
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
                result = result.split(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`).join(finalProductImages[i]);
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
