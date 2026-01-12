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
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        const productImageArray = productImages || [];
        
        // --- تحضير بيانات المتغيرات (Variants Logic) ---
        // سنقوم ببناء مصفوفة JSON ليفهمها الذكاء الاصطناعي ويستخدمها في كود JS
        let variantsDataForPrompt = [];
        
        if (variants && variants.colors && variants.colors.items.length > 0) {
            variantsDataForPrompt = variants.colors.items.map((color, index) => {
                // ربط الصورة باللون (إذا وجد اندكس للصورة، وإلا نستخدم الصورة الرئيسية)
                let imgRef = `[[PRODUCT_IMAGE_MAIN_SRC]]`;
                if (color.imgIndex !== "" && color.imgIndex !== null) {
                    // +1 لأن المستخدم يرى الصور 1,2,3 بينما المصفوفة 0,1,2
                    imgRef = `[[PRODUCT_IMAGE_${parseInt(color.imgIndex) + 1}_SRC]]`;
                }
                
                return {
                    id: index,
                    name: color.name,
                    hex: color.hex,
                    image: imgRef,
                    // إنشاء تدرج لوني بناءً على لون المنتج
                    gradient: `radial-gradient(circle at center, ${color.hex} 0%, #000000 90%)`
                };
            });
        } else {
            // إذا لم تكن هناك ألوان، نضع عنصر افتراضي واحد
            variantsDataForPrompt.push({
                id: 0,
                name: "Default",
                hex: "#333333",
                image: "[[PRODUCT_IMAGE_MAIN_SRC]]",
                gradient: "radial-gradient(circle at center, #444444 0%, #000000 90%)"
            });
        }

        const variantsJsonString = JSON.stringify(variantsDataForPrompt);
        
        // الكلمة الأولى من اسم المنتج للنص الخلفي العملاق
        const bigBackgroundText = productName.split(' ')[0] || "BRAND";

        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        // --- البرومبت الهندسي الجديد (The Professional Prompt) ---
        const prompt = `
        You are a World-Class UI/UX Developer. Your goal is to generate a High-End, Award-Winning Landing Page similar to Nike/Apple product pages.
        
        **Product Context:**
        - Name: ${productName}
        - Price: ${productPrice}
        - Description: ${productFeatures}
        - Offer: ${customOffer || 'None'}
        - User Style Request: ${designDescription}

        **Technical Requirement (Strictly Follow This Structure):**
        Create a Single Page Application (SPA) feel using Vanilla JS and CSS variables.
        
        **1. The Layout (Visual Hierarchy):**
        - **Background:** Must use a CSS radial-gradient that changes dynamically based on the selected variant.
        - **Big Text:** Place the word "${bigBackgroundText}" as a giant, low-opacity text behind the product image (font-size: 20vw+).
        - **Hero Image:** The product image must be large, centered, floating, and have a high-quality drop-shadow.
        - **Transitions:** All changes (Image, Color, Text) must be animated (Smooth transitions, not instant jumps).

        **2. Data Injection:**
        Use this EXACT JSON data for the JavaScript 'products' array. Do not generate your own data, use this:
        ${variantsJsonString}

        **3. Required HTML/JS Structure:**
        - Use CSS Variables: :root { --primary-color: #...; --bg-gradient: ...; }
        - Create a JS function 'changeVariant(index)' that:
          a. Updates the --primary-color and --bg-gradient variables.
          b. Animates the Main Image (e.g., slide out/fade out -> change src -> slide in/fade in).
          c. Updates the texts (Name, Price).
          d. Updates the active class on color selectors.

        **4. Styling (CSS):**
        - Font: Use 'Poppins' or 'Anton' for headings.
        - Glassmorphism: Use rgba(255, 255, 255, 0.1) with backdrop-filter: blur(10px) for cards/buttons.
        - Buttons: Modern, rounded, with hover effects matching the --primary-color.

        **Output Format:**
        Return ONLY a JSON object:
        {
          "html": "Full HTML code with embedded CSS and JS",
          "liquid_code": "Shopify Liquid version",
          "schema": {}
        }
        
        **Important:** - Ensure the JavaScript logic handles the 'variantsJsonString' provided above perfectly.
        - The image placeholders are [[PRODUCT_IMAGE_MAIN_SRC]], [[PRODUCT_IMAGE_2_SRC]], etc. Keep them exactly as is.
        - Logo placeholder is [[BRAND_LOGO_SRC]].
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.8
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

        // --- عملية الحقن (Injection) ---
        const defaultImg = "https://via.placeholder.com/600x600?text=Product";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Logo";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            // استبدال الصورة الرئيسية
            result = result.split('[[PRODUCT_IMAGE_MAIN_SRC]]').join(finalProductImages[0]);
            result = result.split('[[BRAND_LOGO_SRC]]').join(finalBrandLogo);
            // استبدال باقي الصور
            for (let i = 1; i < finalProductImages.length && i <= 10; i++) {
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
