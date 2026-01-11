import fetch from 'node-fetch';

export default async function handler(req, res) {
    // إعدادات CORS
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
            productName, productFeatures, productPrice, productImages, brandLogo, variants, customOffer 
        } = req.body;

        const productImageArray = productImages || [];
        const finalBrandLogo = brandLogo || "https://via.placeholder.com/100";

        // 1. تحضير بيانات الصور للذكاء الاصطناعي كمرجع
        let imagesContext = "";
        productImageArray.forEach((url, i) => {
            imagesContext += `Image ${i+1}: [[PRODUCT_IMAGE_${i+1}]]\n`;
        });

        // 2. البرومبت العملاق (هذا هو عقل الموقع)
        const prompt = `
        You are a Senior Creative Web Developer. Create an ultra-premium, high-converting landing page for "${productName}".
        
        STYLE GUIDELINES:
        - Theme: Immersive Digital Experience (like Nike/Apple).
        - Typography: Use "Cairo" font. Huge bold titles (8vw to 10vw) behind the product.
        - Layout: Hero section must have the product floating on the right and a glassmorphism order card on the left.
        - Color Palette: Dynamic. The page starts with a neutral light gray, but changes to the variant color when selected.
        
        TECHNICAL REQUIREMENTS:
        - Animations: Use GSAP (GreenSock). Make the product float with a sine-wave animation. Elements should fade and slide up.
        - Interactive Variants: When a color is clicked:
            1. Change the background of the entire body to a light pastel version of that color.
            2. Smoothly transition the product image to the one corresponding to that color.
        - Components:
            1. Immersive Hero with floating product and big bg text.
            2. "Trust Bar" with icons.
            3. Detailed features with high-quality cards.
            4. Facebook-style reviews section with Arabic names and Algerian dialect.

        IMAGE PLACEHOLDERS:
        - Main Logo: [[LOGO]]
        - Product Images: Use [[PRODUCT_IMAGE_1]], [[PRODUCT_IMAGE_2]], etc.
        - Avatars: Use [[MALE_IMG]] and [[FEMALE_IMG]].

        RETURN ONLY VALID JSON:
        {
          "html": "...", 
          "liquid_code": "...",
          "schema": {}
        }
        `;

        // 3. الاتصال بـ Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.8 }
            })
        });

        const data = await response.json();
        if (!data.candidates) throw new Error("Gemini Error: " + JSON.stringify(data));
        
        let aiText = data.candidates[0].content.parts[0].text;
        let aiResponse = JSON.parse(aiText.replace(/```json/g, '').replace(/```/g, ''));

        // 4. محرك حقن البيانات (Data Injection Engine)
        // هذا الجزء هو الذي يمنع "انكسار الصور"
        let finalHTML = aiResponse.html;
        let finalLiquid = aiResponse.liquid_code;

        // استبدال اللوجو
        finalHTML = finalHTML.split('[[LOGO]]').join(finalBrandLogo);
        finalLiquid = finalLiquid.split('[[LOGO]]').join(finalBrandLogo);

        // استبدال صور المنتج يدوياً لضمان الدقة
        productImageArray.forEach((imgUrl, index) => {
            const placeholder = `[[PRODUCT_IMAGE_${index + 1}]]`;
            finalHTML = finalHTML.split(placeholder).join(imgUrl);
            finalLiquid = finalLiquid.split(placeholder).join(imgUrl);
        });

        // حقن الأفاتار للتعليقات
        const finalizeContent = (text) => {
            return text
                .replace(/\[\[MALE_IMG\]\]/g, () => `https://randomuser.me/api/portraits/men/${Math.floor(Math.random()*70)}.jpg`)
                .replace(/\[\[FEMALE_IMG\]\]/g, () => `https://randomuser.me/api/portraits/women/${Math.floor(Math.random()*70)}.jpg`);
        };

        res.status(200).json({
            html: finalizeContent(finalHTML),
            liquid_code: finalizeContent(finalLiquid),
            schema: aiResponse.schema
        });

    } catch (error) {
        console.error("SERVER ERROR:", error);
        res.status(500).json({ error: error.message });
    }
}
