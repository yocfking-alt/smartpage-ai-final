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
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        const productImageArray = productImages || [];
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        // تعريف المتغيرات البديلة للصور
        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // --- تحضير شرائح السلايدر ---
        let sliderSlidesHTML = `   <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length; i++) {
            sliderSlidesHTML += `\n   <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // --- تحضير خيارات الألوان والمقاسات (منهجية te.js) ---
        let variantsHTML = "";
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">اللون المفضل:</label><div class="variants-wrapper">`;
            variants.colors.items.forEach((color) => {
                let slideTarget = (color.imgIndex !== "" && color.imgIndex !== null) ? parseInt(color.imgIndex) + 1 : 'null';
                variantsHTML += `<div class="variant-option color-option" style="background-color: ${color.hex};" data-name="${color.name}" onclick="selectColor(this, '${color.name}', ${slideTarget})"></div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-color" name="color" required><span id="color-name-display" style="font-size:12px; color:#666; margin-top:5px; display:block;"></span></div>`;
        }

        if (variants && variants.sizes && variants.sizes.enabled && variants.sizes.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">المقاس:</label><div class="variants-wrapper">`;
            variants.sizes.items.forEach((size) => {
                variantsHTML += `<div class="variant-option size-option" onclick="selectSize(this, '${size.name}')">${size.name}</div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-size" name="size" required></div>`;
        }

        const fbStyles = `
        <style>
            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --text-secondary: #65676b; --blue-link: #216fdb; --line-color: #eaebef; }
            .product-viewer-container { position: relative; width: 100%; max-width: 500px; margin: 0 auto 30px auto; background-color: #f9f9f9; overflow: hidden; border-radius: 8px; direction: ltr; }
            .slider-wrapper { position: relative; width: 100%; min-height: 400px; display: flex; align-items: center; justify-content: center; background-color: #f4f4f4; }
            .slider-img { display: none; width: 100%; height: auto; object-fit: contain; }
            .slider-img.active { display: block; animation: fadeIn 0.4s; }
            @keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }
            .slider-controls { display: flex; align-items: center; justify-content: center; padding: 15px 0; gap: 20px; }
            .nav-btn { background: none; border: none; cursor: pointer; font-size: 22px; color: #666; }
            .slide-counter { font-size: 16px; color: #333; }
            .variant-group { margin-bottom: 15px; }
            .variants-wrapper { display: flex; gap: 10px; flex-wrap: wrap; }
            .variant-option { cursor: pointer; border: 2px solid #ddd; transition: 0.2s; }
            .color-option { width: 35px; height: 35px; border-radius: 50%; }
            .color-option.selected { border-color: #000; transform: scale(1.1); box-shadow: 0 0 5px rgba(0,0,0,0.2); }
            .size-option { padding: 8px 15px; border-radius: 4px; background: #fff; }
            .size-option.selected { background: #000; color: #fff; border-color: #000; }
            .qty-price-wrapper { display: flex; align-items: center; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd; }
            .qty-control { display: flex; border: 1px solid #ddd; border-radius: 4px; }
            .qty-btn { width: 35px; height: 35px; border: none; cursor: pointer; }
            .qty-input { width: 40px; text-align: center; border: none; font-weight: bold; }
            .total-value { font-size: 18px; font-weight: bold; color: #d32f2f; }
            .fb-reviews-section { direction: rtl; padding: 20px; background: #fff; margin-top: 30px; border-top: 1px solid #ddd; font-family: sans-serif; }
            .comment-row { display: flex; margin-bottom: 15px; }
            .avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-left: 8px; }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .bubble { background: #f0f2f5; padding: 8px 12px; border-radius: 18px; position: relative; }
            .username { font-weight: 600; font-size: 13px; display: block; }
            .reactions-container { position: absolute; bottom: -8px; left: -10px; background: #fff; border-radius: 10px; padding: 2px 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.2); display: flex; align-items: center; }
            .icon-love { width: 14px; height: 14px; background: red; border-radius: 50%; margin-left: 3px; }
        </style>
        `;

        const prompt = `
        Act as a Conversion Expert. Create a Landing Page for ${productName} in Arabic.
        Use this Slider HTML for the main product image area:
        <div class="product-viewer-container">
            <div class="slider-wrapper">${sliderSlidesHTML}</div>
            <div class="slider-controls">
                <button class="nav-btn" onclick="changeSlide(-1)">&#10094;</button>
                <span class="slide-counter" id="slideCounter">1 / ${totalSlidesCount}</span>
                <button class="nav-btn" onclick="changeSlide(1)">&#10095;</button>
            </div>
        </div>

        In the Order Form, use this variants and price logic:
        <div class="customer-info-box">
            ${variantsHTML}
            <div class="qty-price-wrapper">
                <div class="qty-control">
                    <button type="button" class="qty-btn" onclick="updateQty(-1)">-</button>
                    <input type="number" id="product-qty" class="qty-input" value="1" readonly>
                    <button type="button" class="qty-btn" onclick="updateQty(1)">+</button>
                </div>
                <div class="total-price-box">
                    <span class="total-value" id="total-price-display">${productPrice} دينار</span>
                    <input type="hidden" id="final-total" name="total_price" value="${productPrice}">
                </div>
            </div>
            <button type="submit" class="submit-btn">تأكيد الطلب</button>
        </div>

        Include Facebook-style reviews with Heart icons only. 
        Important: Add this EXACT script at the end of HTML:
        <script>
            let currentSlide = 1; const totalSlides = ${totalSlidesCount};
            function changeSlide(d) { currentSlide += d; if (currentSlide > totalSlides) currentSlide = 1; if (currentSlide < 1) currentSlide = totalSlides; updateSlider(); }
            function updateSlider() { 
                document.querySelectorAll('.slider-img').forEach(img => { 
                    img.classList.remove('active'); 
                    if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active'); 
                });
                document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides; 
            }
            function selectColor(el, name, slide) {
                document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                document.getElementById('selected-color').value = name;
                document.getElementById('color-name-display').innerText = name;
                if(slide && slide !== 'null') { currentSlide = slide; updateSlider(); }
            }
            function selectSize(el, name) {
                document.querySelectorAll('.size-option').forEach(s => s.classList.remove('selected'));
                el.classList.add('selected');
                document.getElementById('selected-size').value = name;
            }
            let basePrice = ${parseFloat(productPrice) || 0};
            function updateQty(c) {
                let q = document.getElementById('product-qty');
                let val = parseInt(q.value) + c;
                if(val < 1) val = 1;
                q.value = val;
                let total = (basePrice * val).toFixed(2);
                document.getElementById('total-price-display').innerText = total + ' دينار';
                document.getElementById('final-total').value = total;
            }
        </script>

        Return JSON: {"html": "...", "liquid_code": "...", "schema": {}}
        Combine this CSS at start: ${fbStyles}
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
            })
        });

        const data = await response.json();
        const aiResponse = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim());

        // --- عملية الاستبدال النهائية (الحل الجذري للصور المكسورة) ---
        const finalBrandLogo = brandLogo || "https://via.placeholder.com/150x50";
        
        const applyReplacements = (text) => {
            let result = text;
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            result = result.split(MAIN_IMG_PLACEHOLDER).join(productImageArray[0] || "");
            
            for (let i = 0; i < productImageArray.length; i++) {
                const p = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(p).join(productImageArray[i]);
            }

            // حقن الأفاتار
            while (result.includes('[[MALE_IMG]]')) result = result.replace('[[MALE_IMG]]', `https://randomuser.me/api/portraits/men/${Math.floor(Math.random()*50)}.jpg`);
            while (result.includes('[[FEMALE_IMG]]')) result = result.replace('[[FEMALE_IMG]]', `https://randomuser.me/api/portraits/women/${Math.floor(Math.random()*50)}.jpg`);
            
            return result;
        };

        aiResponse.html = applyReplacements(aiResponse.html);
        aiResponse.liquid_code = applyReplacements(aiResponse.liquid_code);

        res.status(200).json(aiResponse);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
