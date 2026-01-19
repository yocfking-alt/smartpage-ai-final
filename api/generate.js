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

        const productImageArray = productImages || [];
        const mainProductImage = productImageArray.length > 0 ? productImageArray[0] : null;

        const GEMINI_MODEL = 'gemini-2.5-flash'; // استخدام موديل سريع
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // --- 1. تحضير شرائح السلايدر (ZEVANA Structure) ---
        // نستخدم index لضبط الترتيب الأولي
        let sliderSlidesHTML = `
            <div class="slider-card active" data-index="0" onclick="openLightbox(this)">
                <img src="${MAIN_IMG_PLACEHOLDER}" alt="${productName}">
            </div>`;
            
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `
            <div class="slider-card" data-index="${i}" onclick="openLightbox(this)">
                <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" alt="${productName} ${i}">
            </div>`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // --- تحضير المتغيرات (الألوان والمقاسات) ---
        let variantsHTML = "";

        // معالجة الألوان
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">اختر اللون:</label><div class="variants-wrapper colors-wrapper">`;
            variants.colors.items.forEach((color) => {
                // ملاحظة: الاندكس هنا يبدأ من 0 ليتوافق مع مصفوفة الجافاسكريبت الجديدة
                let slideTarget = 'null';
                if (color.imgIndex !== "" && color.imgIndex !== null && color.imgIndex !== undefined) {
                    slideTarget = parseInt(color.imgIndex); 
                }
                
                variantsHTML += `
                <div class="variant-option color-option" 
                     style="background-color: ${color.hex};" 
                     data-name="${color.name}" 
                     data-slide="${slideTarget}"
                     onclick="selectColor(this, '${color.name}', ${slideTarget})"
                     title="${color.name}">
                </div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-color" name="color" required> <span id="color-name-display" style="font-size:12px; color:#666;"></span></div>`;
        }

        // معالجة المقاسات
        if (variants && variants.sizes && variants.sizes.enabled && variants.sizes.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">المقاس:</label><div class="variants-wrapper sizes-wrapper">`;
            variants.sizes.items.forEach((size) => {
                variantsHTML += `
                <div class="variant-option size-option" 
                     data-name="${size.name}" 
                     onclick="selectSize(this, '${size.name}')">
                     ${size.name}
                </div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-size" name="size" required></div>`;
        }

        // --- CSS المدمج (ستايل ZEVANA الجديد) ---
        const fbStyles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;400;600&display=swap');

            :root { --bg-color: #ffffff; --comment-bg: #f0f2f5; --text-primary: #050505; --accent-gold: #D4AF37; }
            
            /* --- 1. ستايل السلايدر الجديد (Stacking Cards Style) --- */
            .product-viewer-container {
                position: relative;
                width: 100%;
                max-width: 100%;
                background-color: #050505; /* خلفية داكنة */
                padding: 40px 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 550px;
                margin-bottom: 30px;
            }

            .slider-stage {
                position: relative;
                width: 320px; /* عرض الكرت */
                height: 420px; /* ارتفاع الكرت */
                perspective: 1000px;
                margin-top: 20px;
            }

            .slider-card {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #fff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 15px 35px rgba(0,0,0,0.5);
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
                cursor: pointer;
                opacity: 0; /* مخفي افتراضياً */
                transform-origin: center bottom;
            }

            .slider-card img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            /* أزرار التحكم */
            .slider-controls {
                margin-top: 30px;
                display: flex;
                gap: 20px;
                z-index: 100;
            }

            .nav-btn {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                transition: all 0.3s ease;
            }

            .nav-btn:hover {
                background: white;
                color: black;
                border-color: white;
                transform: scale(1.1);
            }

            .slide-dots {
                display: flex;
                gap: 8px;
                margin-top: 20px;
            }
            .dot {
                width: 8px;
                height: 8px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                transition: 0.3s;
            }
            .dot.active { background: var(--accent-gold); width: 25px; border-radius: 10px; }

            /* Lightbox */
            .lightbox-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center; }
            .lightbox-modal.open { display: flex; animation: fadeIn 0.3s; }
            .lightbox-img { max-width: 90%; max-height: 90%; object-fit: contain; box-shadow: 0 0 20px rgba(255,255,255,0.1); }
            .close-lightbox { position: absolute; top: 30px; right: 30px; font-size: 40px; cursor: pointer; color: #fff; transition: 0.3s; }
            .close-lightbox:hover { color: var(--accent-gold); transform: rotate(90deg); }

            /* --- 2. ستايل خيارات المنتج --- */
            .variant-group { margin-bottom: 20px; }
            .variant-label { display: block; font-weight: 700; margin-bottom: 10px; font-size: 14px; font-family: 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 1px; }
            .variants-wrapper { display: flex; gap: 12px; flex-wrap: wrap; }
            
            .color-option { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #eee; cursor: pointer; transition: transform 0.2s; position: relative; }
            .color-option.selected { border: 2px solid #000; transform: scale(1.2); }
            .color-option.selected::after { content: ''; position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px; border: 1px solid #000; border-radius: 50%; }

            .size-option { padding: 10px 20px; border: 1px solid #ddd; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.3s; background: #fff; }
            .size-option:hover { border-color: #000; }
            .size-option.selected { background: #000; color: #fff; border-color: #000; }

            /* --- 3. الكمية والسعر --- */
            .qty-price-wrapper { display: flex; align-items: center; justify-content: space-between; padding: 20px 0; border-top: 1px solid #eee; margin-top: 20px; }
            .qty-control { display: flex; border: 1px solid #ddd; }
            .qty-btn { width: 40px; height: 40px; background: #fff; border: none; font-size: 18px; cursor: pointer; transition: 0.2s; }
            .qty-btn:hover { background: #f9f9f9; }
            .qty-input { width: 50px; text-align: center; border: none; font-weight: bold; font-size: 16px; outline: none; }
            .total-value { font-size: 22px; font-weight: 700; color: #000; font-family: 'Playfair Display', serif; }

            /* --- 4. Facebook Comments --- */
            .fb-reviews-section { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; padding: 20px; background: #fff; margin-top: 50px; border-top: 1px solid #eee; }
            .comment-row { display: flex; align-items: flex-start; margin-bottom: 20px; }
            .avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; margin-left: 10px; flex-shrink: 0; }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .comment-content { background: #f0f2f5; padding: 10px 15px; border-radius: 18px; position: relative; }
            .username { font-weight: 700; font-size: 14px; color: #050505; display: block; margin-bottom: 3px; }
            .text { font-size: 15px; color: #050505; line-height: 1.4; }
            .actions { font-size: 12px; color: #65676b; margin-top: 5px; margin-right: 15px; font-weight: 600; display: flex; gap: 15px; }
            .icon-love { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; width: 18px; height: 18px; }
            .reactions-float { position: absolute; bottom: -8px; right: 0; background: #fff; padding: 2px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; align-items: center; }
        </style>
        `;

        const prompt = `
Act as a UI/UX Designer & Conversion Expert.
Product: ${productName} (${productCategory}).
Audience: ${targetAudience}.
Features: ${productFeatures}.
Price: ${productPrice}.
Request: ${designDescription}.

## 🖼️ **The New Slider (ZEVANA Style)**
You must implement a specific "Stacking Cards" slider. 
The HTML structure is already prepared below.
Your job is to insert it into a high-converting landing page.

### **1. Slider HTML Structure:**
\`\`\`html
<div class="product-viewer-container">
    <div class="slider-stage">
        ${sliderSlidesHTML}
    </div>
    
    <div class="slider-controls">
        <button class="nav-btn prev" onclick="moveSlider(-1)">&#8592;</button>
        <button class="nav-btn next" onclick="moveSlider(1)">&#8594;</button>
    </div>
    <div class="slide-dots" id="dotsContainer">
        </div>
</div>

<div id="lightbox" class="lightbox-modal" onclick="closeLightbox()"><span class="close-lightbox">&times;</span><img id="lightbox-img" class="lightbox-img" src=""></div>
\`\`\`

### **2. Order Form Logic:**
Place this form immediately after the slider section.
\`\`\`html
<div class="customer-info-box" style="padding: 20px; max-width: 500px; margin: 0 auto;">
  <h3 style="font-family: 'Playfair Display', serif; text-align: center; font-size: 24px; margin-bottom: 20px;">اطلب الآن</h3>
  
  <div class="form-group"><label>الاسم الكامل</label><input type="text" placeholder="الاسم واللقب" required class="form-control"></div>
  <div class="form-group"><label>رقم الهاتف</label><input type="tel" placeholder="0XXXXXXXXX" required class="form-control"></div>
  <div class="form-group"><label>الولاية</label><input type="text" placeholder="الولاية" required class="form-control"></div>
  <div class="form-group"><label>البلدية</label><input type="text" placeholder="البلدية" required class="form-control"></div>
  
  ${variantsHTML}
  
  <div class="qty-price-wrapper">
      <div class="qty-control">
          <button type="button" class="qty-btn" onclick="updateQty(-1)">-</button>
          <input type="number" id="product-qty" class="qty-input" value="1" min="1" readonly>
          <button type="button" class="qty-btn" onclick="updateQty(1)">+</button>
      </div>
      <div class="total-price-box">
          <span class="total-label" style="font-size: 12px; color: #666;">المجموع الكلي:</span><br>
          <span class="total-value" id="total-price-display">${productPrice} DZD</span>
          <input type="hidden" id="final-total" name="total_price" value="${productPrice}">
      </div>
  </div>
  
  <button type="submit" class="submit-btn" style="width: 100%; background: #000; color: #fff; padding: 15px; border: none; font-weight: bold; font-size: 18px; margin-top: 15px; cursor: pointer;">تأكيد الطلب - الدفع عند الاستلام</button>
</div>
\`\`\`

### **3. JavaScript Logic (CRITICAL):**
Use this EXACT script to handle the "Stacking Cards" animation and Variants.
\`\`\`html
<script>
    // --- Stacking Slider Logic ---
    let currentIndex = 0;
    const cards = document.querySelectorAll('.slider-card');
    const totalSlides = cards.length;
    
    // Initialize Dots
    const dotsContainer = document.getElementById('dotsContainer');
    for(let i=0; i<totalSlides; i++) {
        let dot = document.createElement('div');
        dot.className = i === 0 ? 'dot active' : 'dot';
        dotsContainer.appendChild(dot);
    }
    const dots = document.querySelectorAll('.dot');

    function updateSlider() {
        cards.forEach((card, index) => {
            // Calculate distance from current index
            let offset = index - currentIndex;
            
            // Logic for looping visual effect (optional, simplified for stacking)
            if (index === currentIndex) {
                // Active Card
                card.style.transform = 'translateX(0) scale(1) translateZ(0)';
                card.style.opacity = '1';
                card.style.zIndex = '10';
                card.style.filter = 'brightness(1)';
            } else if (index > currentIndex) {
                // Next Cards (Stacked behind to the right)
                let scale = 1 - (offset * 0.1); 
                let translateX = offset * 20; // 20px spacing
                let translateZ = offset * -50;
                
                if (offset > 2) { card.style.opacity = '0'; } // Hide far cards
                else {
                    card.style.opacity = (1 - (offset * 0.3)).toString();
                    card.style.transform = \`translateX(\${translateX}px) scale(\${scale}) translateZ(\${translateZ}px)\`;
                    card.style.zIndex = (10 - offset).toString();
                }
            } else {
                // Previous Cards (Stacked behind to the left)
                // For this style, we often hide previous or stack them differently.
                // Let's stack them to the left fading out.
                card.style.transform = 'translateX(-100%) scale(0.8)';
                card.style.opacity = '0';
                card.style.zIndex = '0';
            }
        });
        
        // Update Dots
        dots.forEach(d => d.classList.remove('active'));
        if(dots[currentIndex]) dots[currentIndex].classList.add('active');
    }

    function moveSlider(direction) {
        currentIndex += direction;
        if (currentIndex < 0) currentIndex = totalSlides - 1;
        if (currentIndex >= totalSlides) currentIndex = 0;
        updateSlider();
    }

    // Initialize
    setTimeout(updateSlider, 100);

    // --- Lightbox ---
    function openLightbox(el) {
        if (!el.classList.contains('active')) return; // Only active card clickable
        const src = el.querySelector('img').src;
        document.getElementById('lightbox-img').src = src;
        document.getElementById('lightbox').classList.add('open');
    }
    function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

    // --- Variants Logic ---
    function selectColor(element, name, slideIndex) {
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selected-color').value = name;
        document.getElementById('color-name-display').innerText = name;
        
        // Jump to specific slide
        if(slideIndex !== null && !isNaN(slideIndex) && slideIndex < totalSlides) {
            currentIndex = slideIndex;
            updateSlider();
        }
    }

    function selectSize(element, name) {
        document.querySelectorAll('.size-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selected-size').value = name;
    }

    // --- Price Logic ---
    let basePrice = ${parseFloat(productPrice) || 0};
    let currentQty = 1;
    function updateQty(change) {
        currentQty += change;
        if(currentQty < 1) currentQty = 1;
        document.getElementById('product-qty').value = currentQty;
        
        let total = (basePrice * currentQty).toFixed(2);
        if(total.endsWith('.00')) total = parseInt(total);
        document.getElementById('total-price-display').innerText = total + ' DZD';
        document.getElementById('final-total').value = total;
    }
</script>
\`\`\`

### **4. Facebook Reviews:**
Use the provided CSS class \`fb-reviews-section\`. Create 3 realistic comments in Algerian dialect mixed with Arabic. Use \`[[MALE_IMG]]\` and \`[[FEMALE_IMG]]\` for avatars. Use only the provided \`icon-love\` for reactions.

### **5. Output:**
Return JSON:
{
  "html": "Full HTML code starting with style block",
  "liquid_code": "Shopify Liquid code",
  "schema": {}
}

Include the CSS styles provided at the beginning of the generated HTML.
${fbStyles}
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

        // --- معالجة الصور (الحقن) ---
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
            result = result.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            for (let i = 1; i < finalProductImages.length && i <= 6; i++) {
                const placeholder = `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
                result = result.split(placeholder).join(finalProductImages[i]);
            }
            return result;
        };

        aiResponse.html = injectAvatars(replaceImages(aiResponse.html));
        aiResponse.liquid_code = injectAvatars(replaceImages(aiResponse.liquid_code));

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
