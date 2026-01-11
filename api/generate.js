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
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        // تجهيز الصور
        const productImageArray = productImages || [];
        // المتغيرات البديلة للصور (سيتم استبدالها لاحقاً لضمان عدم تكسر الروابط)
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // --- 1. تحديد نظام التصميم (Design System) بناءً على الفئة ---
        let designSystem = 'CLEAN_TECH'; // الافتراضي
        let bgTransition = 'background-color 0.5s ease';
        let mainBgDefault = '#f8f9fa';

        if (['fashion', 'shoes', 'sports'].includes(productCategory)) {
            designSystem = 'BOLD_IMPACT'; // ستايل نايكي
            mainBgDefault = '#e5e5e5'; 
        } else if (['food', 'beauty', 'health'].includes(productCategory)) {
            designSystem = 'FRESH_GLASS'; // ستايل العصائر
            mainBgDefault = '#ffe4e6'; // وردي فاتح مبدئي
        }

        // --- 2. بناء HTML للسلايدر (Slider Construction) ---
        let sliderSlidesHTML = `   <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 5; i++) {
            sliderSlidesHTML += `\n   <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // --- 3. بناء منطق المتغيرات (Variants Logic) بدقة ---
        // سنمرر كود اللون HEX إلى دالة JS لتغيير الخلفية
        let variantsHTML = "";
        
        // أ) الألوان
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `
            <div class="variant-wrapper">
                <label class="variant-title">اختر اللون:</label>
                <div class="color-options-container">`;
            
            variants.colors.items.forEach((color, idx) => {
                let slideTarget = 'null';
                if (color.imgIndex !== "" && color.imgIndex !== null) {
                    slideTarget = parseInt(color.imgIndex) + 1;
                }
                // *هام*: تمرير hexColor للدالة
                variantsHTML += `
                <div class="color-circle ${idx === 0 ? 'selected' : ''}" 
                     style="background-color: ${color.hex};" 
                     data-name="${color.name}" 
                     onclick="handleColorSelect(this, '${color.name}', ${slideTarget}, '${color.hex}')"
                     title="${color.name}">
                </div>`;
            });
            variantsHTML += `
                </div>
                <input type="hidden" id="selected-color" name="color" value="${variants.colors.items[0]?.name || ''}">
                <div id="color-name-display">${variants.colors.items[0]?.name || ''}</div>
            </div>`;
        }

        // ب) المقاسات
        if (variants && variants.sizes && variants.sizes.enabled && variants.sizes.items.length > 0) {
            variantsHTML += `
            <div class="variant-wrapper">
                <label class="variant-title">المقاس:</label>
                <div class="size-options-container">`;
            
            variants.sizes.items.forEach((size, idx) => {
                variantsHTML += `
                <div class="size-box ${idx === 0 ? 'selected' : ''}" 
                     onclick="handleSizeSelect(this, '${size.name}')">
                     ${size.name}
                </div>`;
            });
            variantsHTML += `
                </div>
                <input type="hidden" id="selected-size" name="size" value="${variants.sizes.items[0]?.name || ''}">
            </div>`;
        }

        // --- 4. CSS المتقدم (Dynamic Styles Injection) ---
        // يحتوي على ستايلين مختلفين تماماً يتم تفعيلهما حسب الفئة
        const dynamicStyles = `
        <style>
            :root {
                --bg-theme: ${mainBgDefault}; /* لون الخلفية المتغير */
                --text-theme: #1a1a1a; /* لون النص المتغير (أسود/أبيض) */
                --accent-color: #2563eb;
                --card-bg: rgba(255, 255, 255, 0.85);
            }
            * { box-sizing: border-box; transition: color 0.3s, background-color 0.5s ease; }
            body { 
                margin: 0; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background-color: var(--bg-theme); 
                color: var(--text-theme);
                overflow-x: hidden;
            }

            /* --- BOLD IMPACT STYLE (Nike/Shoes) --- */
            ${designSystem === 'BOLD_IMPACT' ? `
            .hero-section {
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            }
            .big-bg-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 25vw;
                font-weight: 900;
                color: rgba(0,0,0,0.05); /* شفاف جداً */
                z-index: 0;
                white-space: nowrap;
                line-height: 1;
                pointer-events: none;
                mix-blend-mode: overlay;
            }
            .product-visual-col {
                z-index: 10;
                transform: rotate(-10deg);
                transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .product-visual-col:hover { transform: rotate(0deg) scale(1.05); }
            .slider-img { 
                filter: drop-shadow(0 30px 50px rgba(0,0,0,0.4)); 
                max-height: 60vh;
            }
            ` : ''}

            /* --- FRESH GLASS STYLE (Juice/Beauty) --- */
            ${designSystem === 'FRESH_GLASS' ? `
            body {
                background: radial-gradient(circle at center, var(--bg-theme), #000000);
                color: #fff; /* افتراضي للستايل الداكن */
                min-height: 100vh;
            }
            .hero-section {
                padding: 100px 20px;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: center;
            }
            .glass-card {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                padding: 40px;
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
            }
            .slider-img {
                filter: drop-shadow(0 20px 30px rgba(0,0,0,0.3));
                animation: float 6s ease-in-out infinite;
            }
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-20px); }
                100% { transform: translateY(0px); }
            }
            ` : ''}

            /* --- Common Elements --- */
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                max-width: 1200px;
                margin: 0 auto;
                gap: 50px;
                align-items: center;
                z-index: 5;
                position: relative;
            }
            @media (max-width: 768px) { .main-grid { grid-template-columns: 1fr; text-align: center; } }

            /* Color Picker Styling */
            .color-options-container { display: flex; gap: 10px; margin: 10px 0; justify-content: var(--justify-controls, flex-start); }
            .color-circle {
                width: 35px; height: 35px; border-radius: 50%; cursor: pointer;
                border: 2px solid rgba(255,255,255,0.5);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                transition: transform 0.2s;
            }
            .color-circle:hover { transform: scale(1.1); }
            .color-circle.selected {
                border: 3px solid var(--text-theme);
                transform: scale(1.2);
            }
            
            /* Size Picker Styling */
            .size-options-container { display: flex; gap: 10px; flex-wrap: wrap; }
            .size-box {
                padding: 8px 16px; border: 1px solid var(--text-theme); border-radius: 4px;
                cursor: pointer; font-weight: bold; opacity: 0.7;
            }
            .size-box.selected { background: var(--text-theme); color: var(--bg-theme); opacity: 1; }

            /* Slider Hidden Logic */
            .slider-img { display: none; width: 100%; height: auto; object-fit: contain; }
            .slider-img.active { display: block; }
            
            /* Order Form */
            .order-form { 
                background: var(--card-bg); 
                padding: 30px; 
                border-radius: 20px; 
                color: #333; /* Always dark inside white card */
                text-align: right; direction: rtl;
            }
            .form-group { margin-bottom: 15px; }
            .form-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-top: 5px; }
            .submit-btn {
                width: 100%; padding: 15px;
                background: #000; color: #fff;
                font-size: 18px; font-weight: bold;
                border: none; border-radius: 8px; cursor: pointer;
                margin-top: 20px;
            }
            .submit-btn:hover { opacity: 0.9; }
        </style>
        `;

        // --- 5. Javascript Logic Injection (The Engine) ---
        // هذا الكود يتم تنفيذه في متصفح الزائر للتحكم في الألوان والحسابات
        const clientSideJS = `
        <script>
            // --- Slider Logic ---
            let currentSlide = 1;
            const totalSlides = ${totalSlidesCount};
            
            function changeSlide(index) {
                if (index > totalSlides) index = 1;
                if (index < 1) index = totalSlides;
                currentSlide = index;
                
                document.querySelectorAll('.slider-img').forEach(img => {
                    img.classList.remove('active');
                    if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active');
                });
            }

            // --- COLOR SYNC ENGINE (The Magic) ---
            function handleColorSelect(el, name, slideIndex, hexColor) {
                // 1. UI Update
                document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                
                document.getElementById('selected-color').value = name;
                document.getElementById('color-name-display').innerText = name;
                
                // 2. Slider Update
                if (slideIndex && !isNaN(slideIndex)) {
                    changeSlide(slideIndex);
                }
                
                // 3. BACKGROUND SYNC (تغيير خلفية الموقع)
                if (hexColor && hexColor !== 'undefined') {
                    document.documentElement.style.setProperty('--bg-theme', hexColor);
                    
                    // حساب التباين (Contrast Calculation)
                    // إذا كانت الخلفية غامقة، اجعل النص أبيض، والعكس صحيح
                    const rgb = hexToRgb(hexColor);
                    if (rgb) {
                        // Formula for brightness
                        const brightness = Math.round(((parseInt(rgb.r) * 299) + (parseInt(rgb.g) * 587) + (parseInt(rgb.b) * 114)) / 1000);
                        const textColor = (brightness > 125) ? '#000000' : '#ffffff';
                        const cardColor = (brightness > 125) ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)';
                        
                        document.documentElement.style.setProperty('--text-theme', textColor);
                        // document.documentElement.style.setProperty('--card-bg', cardColor);
                    }
                }
            }
            
            function handleSizeSelect(el, name) {
                document.querySelectorAll('.size-box').forEach(s => s.classList.remove('selected'));
                el.classList.add('selected');
                document.getElementById('selected-size').value = name;
            }

            function hexToRgb(hex) {
                var result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
            }

            // --- Price Logic ---
            let price = ${parseFloat(productPrice) || 0};
            function updateQty(n) {
                let input = document.getElementById('qty-input');
                let val = parseInt(input.value) + n;
                if(val < 1) val = 1;
                input.value = val;
                document.getElementById('total-price').innerText = (price * val).toFixed(2) + ' ${productPrice.replace(/[0-9.]/g, '') || '$'}';
            }
        </script>
        `;

        // --- 6. Prompt Engineering (توجيه Gemini) ---
        // نطلب منه فقط المحتوى التسويقي، أما الهيكل الأساسي فنحن نتحكم به
        const prompt = `
        Act as a Conversion Design Expert. You are building a high-end landing page for: ${productName}.
        Category: ${productCategory}. Price: ${productPrice}.
        
        The user wants a layout styled as: ${designSystem}.
        
        REQUIRED OUTPUT STRUCTURE (Return ONLY valid JSON):
        {
          "marketing_headline": "Catchy headline in Arabic",
          "marketing_subheadline": "Persuasive subtext in Arabic",
          "features_list": ["Feature 1", "Feature 2", "Feature 3"],
          "description_html": "HTML paragraph describing the product passionately",
          "reviews": [
             {"user": "Name", "text": "Review text", "gender": "male/female"}
          ]
        }
        `;

        // استدعاء Gemini
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        const aiContent = JSON.parse(data.candidates[0].content.parts[0].text);

        // --- 7. تجميع الصفحة النهائية (Final Assembly) ---
        // نقوم بدمج الـ CSS + الـ HTML الهيكلي + محتوى AI + كود JS
        
        const bigTextWord = productName.split(' ')[0] || 'BRAND';
        
        const fullHTML = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${productName}</title>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
            ${dynamicStyles}
        </style> </head>
        <body>
            
            <section class="hero-section">
                ${designSystem === 'BOLD_IMPACT' ? `<div class="big-bg-text">${bigTextWord}</div>` : ''}
                
                <div class="main-grid">
                    <div class="product-visual-col">
                        <div class="slider-wrapper">
                            ${sliderSlidesHTML}
                        </div>
                    </div>

                    <div class="info-col ${designSystem === 'FRESH_GLASS' ? 'glass-card' : ''}">
                        <img src="${LOGO_PLACEHOLDER}" style="max-height: 50px; margin-bottom: 20px;">
                        <h1 style="font-size: 3rem; line-height: 1.1; margin-bottom: 10px;">${aiContent.marketing_headline}</h1>
                        <p style="font-size: 1.2rem; opacity: 0.8;">${aiContent.marketing_subheadline}</p>
                        
                        <div class="price-tag" style="font-size: 2rem; font-weight: bold; margin: 20px 0; color: var(--accent-color);">
                            ${productPrice}
                        </div>

                        ${variantsHTML}

                        <div class="order-form" style="margin-top: 30px;">
                            <h3><i class="fas fa-shopping-bag"></i> اطلب الآن</h3>
                            <div class="form-group">
                                <input type="text" class="form-input" placeholder="الاسم الكامل" required>
                            </div>
                            <div class="form-group">
                                <input type="tel" class="form-input" placeholder="رقم الهاتف" required>
                            </div>
                            <div class="form-group">
                                <input type="text" class="form-input" placeholder="العنوان / الولاية" required>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button onclick="updateQty(-1)" style="width:30px; height:30px;">-</button>
                                    <input id="qty-input" value="1" style="width: 40px; text-align: center;" readonly>
                                    <button onclick="updateQty(1)" style="width:30px; height:30px;">+</button>
                                </div>
                                <div id="total-price" style="font-weight: bold;">${productPrice}</div>
                            </div>

                            <button class="submit-btn">تأكيد الطلب - الدفع عند الاستلام</button>
                        </div>
                    </div>
                </div>
            </section>

            <section style="padding: 50px 20px; background: rgba(255,255,255,0.9); color: #000;">
                <div style="max-width: 800px; margin: 0 auto; text-align: center;">
                    <h2>لماذا هذا المنتج؟</h2>
                    <p>${aiContent.description_html}</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px;">
                        ${aiContent.features_list.map(f => `
                            <div style="padding: 20px; background: #f5f5f5; border-radius: 10px;">
                                <i class="fas fa-check-circle" style="color: green; font-size: 20px;"></i>
                                <h3 style="margin-top: 10px;">${f}</h3>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>

            ${clientSideJS}
        </body>
        </html>
        `;

        // --- 8. معالجة الصور النهائية (Image Replacement) ---
        // استبدال الرموز بالبيانات الحقيقية
        const defaultImg = "https://via.placeholder.com/600x600?text=Product";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || "https://via.placeholder.com/150x50?text=Brand";

        let finalHTML = fullHTML
            .replace(MAIN_IMG_PLACEHOLDER, finalProductImages[0])
            .replace(LOGO_PLACEHOLDER, finalBrandLogo);

        for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
            finalHTML = finalHTML.replace(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`, finalProductImages[i]);
        }

        // إرجاع النتيجة
        res.status(200).json({
            liquid_code: finalHTML, // في هذه المرحلة نرسل HTML جاهز
            schema: {}, 
            html: finalHTML
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
