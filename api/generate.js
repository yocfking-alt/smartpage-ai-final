import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 1. إعدادات CORS وتجهيز الاستجابة
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error('API Key is missing');

        // استقبال البيانات من Builder.html
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        // تجهيز الصور
        const productImageArray = productImages || [];
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // نصوص العرض والشحن
        const shippingText = shippingOption === 'free' ? "توصيل مجاني لكامل الولايات" : `سعر التوصيل: ${customShippingPrice}`;
        const offerText = customOffer ? `<div class="hero-badge pulse-anim">${customOffer}</div>` : "";

        // --- تحضير السلايدر (HTML الهيكلي) ---
        let sliderSlidesHTML = `<img src="${MAIN_IMG_PLACEHOLDER}" class="hero-product-img active" id="main-product-img" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `\n<img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="hero-product-img hidden-slide" data-index="${i + 1}" style="display:none;">`;
        }

        // --- تحضير خيارات الألوان (مع دعم تغيير الخلفية الديناميكي) ---
        let variantsHTML = "";
        
        // 1. الألوان (مفتاح التصميم الديناميكي)
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `
            <div class="variant-group animate-item">
                <label class="variant-label">اختر اللون المفضل:</label>
                <div class="color-selector-wrapper">`;
            
            variants.colors.items.forEach((color, idx) => {
                let slideTarget = 'null';
                if (color.imgIndex !== "" && color.imgIndex !== null) {
                    slideTarget = parseInt(color.imgIndex) + 1;
                }
                // نمرر كود اللون (Hex) للدالة لتغيير الخلفية
                variantsHTML += `
                <div class="color-circle ${idx === 0 ? 'active' : ''}" 
                     style="background-color: ${color.hex}; box-shadow: 0 0 10px ${color.hex}80;" 
                     data-hex="${color.hex}"
                     data-name="${color.name}" 
                     onclick="selectColor(this, '${color.name}', '${color.hex}', ${slideTarget})">
                </div>`;
            });
            variantsHTML += `</div>
                <input type="hidden" id="selected-color" name="color" value="${variants.colors.items[0]?.name || ''}">
            </div>`;
        }

        // 2. المقاسات
        if (variants && variants.sizes && variants.sizes.enabled && variants.sizes.items.length > 0) {
            variantsHTML += `
            <div class="variant-group animate-item" style="margin-top: 15px;">
                <label class="variant-label">المقاس:</label>
                <div class="size-selector-wrapper">`;
            variants.sizes.items.forEach((size, idx) => {
                variantsHTML += `
                <div class="size-box ${idx === 0 ? 'active' : ''}" 
                     onclick="selectSize(this, '${size.name}')">
                     ${size.name}
                </div>`;
            });
            variantsHTML += `</div>
                <input type="hidden" id="selected-size" name="size" value="${variants.sizes.items[0]?.name || ''}">
            </div>`;
        }

        // --- CSS الستايل الاحترافي (Immersive Design) ---
        const immersiveStyles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;500;700;900&display=swap');
            
            :root {
                --bg-theme: #f4f4f4; /* سيتغير هذا المتغير ديناميكياً */
                --text-main: #1a1a1a;
                --glass-bg: rgba(255, 255, 255, 0.65);
                --glass-border: rgba(255, 255, 255, 0.4);
            }

            body { margin: 0; font-family: 'Cairo', sans-serif; background-color: var(--bg-theme); transition: background-color 0.8s ease; overflow-x: hidden; }
            
            /* --- تصميم الهيرو الغامر --- */
            .immersive-hero {
                position: relative;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                overflow: hidden;
            }

            /* النص العملاق في الخلفية */
            .big-bg-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 25vw;
                font-weight: 900;
                color: rgba(0,0,0,0.03);
                white-space: nowrap;
                z-index: 0;
                pointer-events: none;
                text-transform: uppercase;
                line-height: 0.8;
            }

            .content-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                max-width: 1400px;
                width: 100%;
                gap: 50px;
                z-index: 10;
                align-items: center;
            }

            /* قسم المنتج العائم */
            .product-visual-side {
                position: relative;
                height: 80vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .hero-product-img {
                max-width: 120%;
                max-height: 80vh;
                filter: drop-shadow(0 20px 40px rgba(0,0,0,0.25));
                z-index: 2;
                transition: transform 0.3s ease;
                /* GSAP سيتحكم في الحركة */
            }

            .floating-badge {
                position: absolute;
                top: 10%;
                right: 10%;
                background: rgba(255,255,255,0.9);
                padding: 15px 25px;
                border-radius: 50px;
                font-weight: bold;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                backdrop-filter: blur(10px);
                z-index: 5;
            }

            /* بطاقة الطلب الزجاجية (Glassmorphism) */
            .order-panel {
                background: var(--glass-bg);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border);
                border-radius: 30px;
                padding: 40px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.05);
                transform: translateY(0);
                transition: all 0.3s;
            }

            .product-title { font-size: 3.5rem; font-weight: 900; line-height: 1.1; margin-bottom: 10px; color: var(--text-main); }
            .product-price { font-size: 2.5rem; font-weight: 700; color: #333; margin-bottom: 20px; display: block; }
            
            /* خيارات الألوان */
            .color-selector-wrapper { display: flex; gap: 15px; margin-top: 10px; }
            .color-circle { 
                width: 40px; height: 40px; border-radius: 50%; cursor: pointer; 
                border: 3px solid transparent; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            }
            .color-circle.active { border-color: #fff; transform: scale(1.2); box-shadow: 0 0 0 2px #333 !important; }

            /* خيارات المقاسات */
            .size-selector-wrapper { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
            .size-box {
                padding: 10px 20px; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px;
                cursor: pointer; font-weight: bold; transition: all 0.2s; background: rgba(255,255,255,0.5);
            }
            .size-box.active { background: #000; color: #fff; border-color: #000; transform: translateY(-2px); }

            /* حقول الإدخال */
            .form-input {
                width: 100%; padding: 15px; margin-bottom: 15px;
                border: none; background: rgba(255,255,255,0.7); border-radius: 15px;
                font-family: 'Cairo'; font-size: 1rem; outline: none; transition: all 0.3s;
            }
            .form-input:focus { background: #fff; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

            .submit-btn {
                width: 100%; padding: 18px; background: #000; color: #fff;
                border: none; border-radius: 15px; font-size: 1.2rem; font-weight: bold;
                cursor: pointer; margin-top: 20px; transition: transform 0.2s, box-shadow 0.2s;
            }
            .submit-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }

            /* الموبايل */
            @media (max-width: 900px) {
                .content-grid { grid-template-columns: 1fr; gap: 30px; }
                .product-visual-side { height: 50vh; }
                .hero-product-img { max-height: 45vh; }
                .big-bg-text { font-size: 15vh; writing-mode: vertical-rl; left: 10%; }
            }
        </style>`;

        // --- البرومبت القوي (Prompt) ---
        // نطلب من الذكاء الاصطناعي دمج GSAP والمنطق الديناميكي
        const prompt = `
        You are a World-Class Creative Developer & UI/UX Expert.
        
        **Goal:** Create a high-end, immersive landing page for: "${productName}".
        **Style:** Inspired by Awwwards, Nike, and Apple product pages. Minimalist, Big Typography, Glassmorphism.
        
        **Key Technical Requirements:**
        1. **Library:** Include GSAP (GreenSock) via CDN for animations.
        2. **Dynamic Background:** The page background color MUST change smoothly when a color variant is selected.
        3. **Layout:** Split screen hero. Left: Order Form (Glass card). Right: Floating Product.
        4. **Animations:** - Product image floats/hovers gently (y-axis sine wave).
           - Elements fade in + slide up on load using GSAP.
           - Product image slides out/in when color changes.
        
        **Product Data:**
        - Name: ${productName}
        - Price: ${productPrice}
        - Features: ${productFeatures}
        - Description: ${designDescription}
        - Shipping: ${shippingText}
        - Offer: ${offerText}

        **Required HTML Structure:**
        Use this specific HTML for the Hero Section (Do not change IDs or Classes significantly):
        
        \`\`\`html
        <div class="immersive-hero">
            <div class="big-bg-text">${productName}</div>
            
            <div class="content-grid">
                <div class="product-visual-side">
                    ${sliderSlidesHTML}
                    <div class="floating-badge">
                        ${offerText || 'Best Seller'}
                        <div style="font-size: 0.8rem; opacity: 0.7;">Original Quality</div>
                    </div>
                </div>

                <div class="order-panel gs-reveal">
                    <img src="${LOGO_PLACEHOLDER}" style="height: 40px; margin-bottom: 20px; opacity: 0.8;">
                    <h1 class="product-title">${productName}</h1>
                    <div class="product-price">${productPrice} <span style="font-size:1rem; opacity:0.6; font-weight:normal">DZD</span></div>
                    <p style="opacity: 0.7; margin-bottom: 25px; line-height: 1.6;">${productFeatures.substring(0, 150)}...</p>

                    <form id="orderForm">
                        ${variantsHTML}
                        
                        <div style="margin-top: 25px;">
                            <label style="display:block; margin-bottom:8px; font-weight:bold; font-size:0.9rem;">معلومات التوصيل</label>
                            <input type="text" class="form-input" placeholder="الاسم الكامل" required>
                            <input type="tel" class="form-input" placeholder="رقم الهاتف" required>
                            <input type="text" class="form-input" placeholder="الولاية / العنوان" required>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; margin-bottom:20px; border-top:1px dashed rgba(0,0,0,0.1); padding-top:15px;">
                            <span style="font-weight:bold;">المجموع الكلي:</span>
                            <span style="font-weight:900; font-size:1.5rem;" id="total-display">${productPrice}</span>
                        </div>

                        <button type="submit" class="submit-btn">اطلب الآن - الدفع عند الاستلام</button>
                    </form>
                </div>
            </div>
        </div>
        
        <div class="details-section" style="background: white; position: relative; z-index: 20; padding: 50px 20px;">
           <h2 style="text-align:center; font-size:2.5rem; margin-bottom:40px;">آراء الزبائن</h2>
           <div class="fb-comments-container"></div> 
        </div>
        \`\`\`

        **Required JavaScript Logic (Inject this):**
        \`\`\`javascript
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
        <script>
            // 1. GSAP Animations Setup
            document.addEventListener("DOMContentLoaded", (event) => {
                gsap.from(".hero-product-img", {duration: 1.5, x: 100, opacity: 0, ease: "power3.out"});
                gsap.from(".gs-reveal", {duration: 1, y: 50, opacity: 0, delay: 0.3, ease: "power3.out"});
                gsap.from(".big-bg-text", {duration: 2, scale: 0.8, opacity: 0, ease: "power2.out"});
                
                // Floating Effect
                gsap.to(".hero-product-img", {y: -20, duration: 2, repeat: -1, yoyo: true, ease: "sine.inOut"});
            });

            // 2. Variant & Theme Logic
            function selectColor(el, name, hex, slideIndex) {
                // Update UI classes
                document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
                el.classList.add('active');
                
                // Update Input
                document.getElementById('selected-color').value = name;
                
                // *** DYNAMIC THEME CHANGE ***
                // Change background color based on selection, make it lighter/pastel
                const root = document.documentElement;
                root.style.setProperty('--bg-theme', hexToLight(hex));
                
                // Change Image if index exists
                if(slideIndex && slideIndex !== 'null') {
                    const imgs = document.querySelectorAll('.hero-product-img');
                    
                    // Simple crossfade using GSAP
                    gsap.to(imgs, {opacity: 0, duration: 0.2, onComplete: () => {
                        imgs.forEach(img => img.style.display = 'none');
                        const target = document.querySelector('.hero-product-img[data-index="'+slideIndex+'"]');
                        if(target) {
                            target.style.display = 'block';
                            gsap.to(target, {opacity: 1, duration: 0.5});
                        }
                    }});
                }
            }

            function selectSize(el, name) {
                document.querySelectorAll('.size-box').forEach(s => s.classList.remove('active'));
                el.classList.add('active');
                document.getElementById('selected-size').value = name;
            }

            // Helper to lighten color for background
            function hexToLight(hex) {
                // Simple logic to return a very light version of the hex, or fallback to gray
                return hex + '15'; // 15 is roughly 10% opacity in hex
            }
        </script>
        \`\`\`

        **Response Format:**
        Return ONLY valid JSON:
        {
            "html": "Complete HTML code including the CSS provided and JS",
            "liquid_code": "Shopify Liquid version",
            "schema": {}
        }
        
        Include the provided 'immersiveStyles' CSS at the top of the HTML.
        Generate the Facebook comments section with realistic Algerian/Arabic dialect reviews.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
            })
        });

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]?.content) throw new Error('AI Generation Failed');

        const text = data.candidates[0].content.parts[0].text;
        let aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''));

        // --- مرحلة الحقن والاستبدال (نفس المنطق السابق لضمان العمل) ---
        const finalProductImages = productImageArray.length > 0 ? productImageArray : ["https://via.placeholder.com/600"];
        const finalBrandLogo = brandLogo || "https://via.placeholder.com/100";

        // دالة استبدال الصور
        const replaceImages = (content) => {
            if (!content) return content;
            let result = content;
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            for (let i = 1; i < finalProductImages.length; i++) {
                result = result.split(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`).join(finalProductImages[i]);
            }
            return result;
        };

        // دالة حقن صور الأفاتار العشوائية
        const injectAvatars = (content) => {
             if (!content) return content;
             let c = content;
             const rand = () => Math.floor(Math.random() * 50);
             while(c.includes('[[MALE_IMG]]')) c = c.replace('[[MALE_IMG]]', `https://randomuser.me/api/portraits/men/${rand()}.jpg`);
             while(c.includes('[[FEMALE_IMG]]')) c = c.replace('[[FEMALE_IMG]]', `https://randomuser.me/api/portraits/women/${rand()}.jpg`);
             return c;
        };

        // دمج الستايل النهائي مع المخرجات
        const finalHTML = immersiveStyles + injectAvatars(replaceImages(aiResponse.html));
        const finalLiquid = injectAvatars(replaceImages(aiResponse.liquid_code));

        res.status(200).json({
            liquid_code: finalLiquid,
            schema: aiResponse.schema,
            html: finalHTML
        });

    } catch (error) {
        console.error("Generator Error:", error);
        res.status(500).json({ error: error.message });
    }
}
