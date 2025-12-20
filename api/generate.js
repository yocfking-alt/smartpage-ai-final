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

        // استقبال البيانات (تمت إعادة brandLogo واستقبال productImages كمصفوفة)
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo 
        } = req.body;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // معالجة الصور: التأكد من أنها مصفوفة
        const imagesArray = Array.isArray(productImages) && productImages.length > 0 ? productImages : [];
        
        // منطق بناء تعليمات الصور (Slider vs Single Image)
        let imagesInstruction = "";
        if (imagesArray.length > 1) {
            imagesInstruction = `
            The user provided ${imagesArray.length} product images.
            You MUST create a responsive image slider/carousel using Splide.js (library is already included).
            Generate HTML structure for exactly ${imagesArray.length} slides.
            Use these placeholders for the slides:
            ${imagesArray.map((_, i) => `- Slide ${i + 1}: src="[[IMG_${i}]]"`).join('\n')}
            Initialize the Splide slider in a <script> tag at the end.
            `;
        } else {
            imagesInstruction = `
            The user provided 1 product image.
            Use this placeholder for the main product image: "[[IMG_0]]".
            Make it prominent in the Hero section.
            `;
        }

        // تعريف رمز الشعار (كما كان في الكود الأصلي)
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";

        const prompt = `
Act as a Senior Creative Director and Conversion Expert. 
Analyze this product: ${productName}. 
Category: ${productCategory}. 
Target Audience: ${targetAudience}.
Context/Features: ${productFeatures}.
Price: ${productPrice}. ${shippingText}. ${offerText}.
User Design Request: ${designDescription}.

## 🖼️ **Image & Logo Instructions (CRITICAL):**
- **Logo:** Use exactly \`${LOGO_PLACEHOLDER}\` for the brand logo source. Place it in the Header or top of Hero.
- **Product Images:** ${imagesInstruction}
- Do NOT use unsplash or external links. ONLY use the placeholders provided.

## 🎯 **Goal:**
Create a high-converting landing page.

## ⚠️ **Mandatory Requirements:**

### **1. Hero Section:**
- Include the logo (\`${LOGO_PLACEHOLDER}\`).
- Display the product image(s) prominently (or the slider if multiple images).

### **2. Order Form (Directly after Hero):**
Must contain this EXACT Arabic form structure:
<div class="customer-info-box">
  <h3>استمارة الطلب</h3>
  <p>المرجو إدخال معلوماتك الخاصة بك</p>
  
  <div class="form-group">
    <label>الإسم الكامل</label>
    <input type="text" placeholder="Nom et prénom" required>
  </div>
  
  <div class="form-group">
    <label>رقم الهاتف</label>
    <input type="tel" placeholder="Nombre" required>
  </div>
  
  <div class="form-group">
    <label>الولاية</label>
    <input type="text" placeholder="Wilaya" required>
  </div>
  
  <div class="form-group">
    <label>البلدية</label>
    <input type="text" placeholder="أدخل بلديتك" required>
  </div>
  
  <div class="form-group">
    <label>الموقع / العنوان</label>
    <input type="text" placeholder="أدخل عنوانك بالتفصيل" required>
  </div>
  
  <div class="price-display">
    <p>سعر المنتج: ${productPrice} دينار</p>
  </div>
  
  <button type="submit" class="submit-btn">تأكيد الطلب</button>
</div>

### **3. Output Format:**
Return ONLY a JSON object:
{
  "html": "Full HTML string",
  "liquid_code": "Shopify Liquid code",
  "schema": { "name": "Landing Page", "settings": [] }
}

## 🚀 **Creative Freedom:**
Design the rest of the page freely using modern CSS.
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
        // عملية الحقن: استبدال الرموز بالصور الحقيقية
        // ***************************************************************
        
        const defaultImg = "https://via.placeholder.com/600x600?text=Product+Image";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo"; // صورة احتياطية للشعار

        const finalBrandLogo = brandLogo || defaultLogo;

        const replaceImages = (content) => {
            if (!content) return content;
            let updatedContent = content;

            // 1. استبدال الشعار (كما كان سابقاً)
            updatedContent = updatedContent.split(LOGO_PLACEHOLDER).join(finalBrandLogo);

            // 2. استبدال صور المنتج (الجديد: دعم المصفوفة)
            if (imagesArray.length > 0) {
                imagesArray.forEach((img, index) => {
                    const placeholder = `[[IMG_${index}]]`;
                    updatedContent = updatedContent.split(placeholder).join(img);
                });
            } else {
                updatedContent = updatedContent.split('[[IMG_0]]').join(defaultImg);
            }

            return updatedContent;
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
