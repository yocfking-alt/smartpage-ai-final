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
        
        const GEMINI_MODEL = 'gemini-2.5-flash'; 
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        
        const shippingText = shippingOption === 'free' ? "شحن مجاني" : `الشحن: ${customShippingPrice}`;
        const offerText = customOffer ? `عرض خاص: ${customOffer}` : "";

        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // --- تحضير السلايدر ---
        let sliderSlidesHTML = `   <img src="${MAIN_IMG_PLACEHOLDER}" class="slider-img active" data-index="1">`;
        for (let i = 1; i < productImageArray.length && i <= 6; i++) {
            sliderSlidesHTML += `\n   <img src="[[PRODUCT_IMAGE_${i + 1}_SRC]]" class="slider-img" data-index="${i + 1}">`;
        }
        const totalSlidesCount = Math.max(productImageArray.length, 1);

        // --- تحضير المتغيرات (الألوان والمقاسات) ---
        let variantsHTML = "";

        // معالجة الألوان
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">اللون:</label><div class="variants-wrapper colors-wrapper">`;
            variants.colors.items.forEach((color) => {
                let slideTarget = 'null';
                if (color.imgIndex !== "" && color.imgIndex !== null && color.imgIndex !== undefined) {
                    slideTarget = parseInt(color.imgIndex) + 1;
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
            variantsHTML += `</div><input type="hidden" id="selected-color" name="color" required> <span id="color-name-display" style="font-size:12px; color:#666; margin-top:5px; display:block;"></span></div>`;
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

        // --- CSS الأساسي المحسن (Modern/Ridestore Vibe) ---
        const baseStyles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Poppins:wght@300;400;500;700&display=swap');
            
            :root {
                --primary-color: #1a1a1a; 
                --accent-color: #216fdb;
                --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                --glass-bg: rgba(255, 255, 255, 0.85);
                --glass-border: 1px solid rgba(255, 255, 255, 0.6);
                --shadow-soft: 0 10px 30px rgba(0,0,0,0.08);
                --radius-lg: 20px;
                --radius-md: 12px;
                --font-ar: 'Cairo', sans-serif;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; outline: none; }
            body { font-family: var(--font-ar); background: #f8f9fa; color: #333; overflow-x: hidden; line-height: 1.6; }
            
            /* --- تحسينات عامة للجودة --- */
            h1, h2, h3 { font-weight: 800; letter-spacing: -0.5px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
            
            /* --- ستايل السلايدر (Clean & Modern) --- */
            .product-viewer-container { 
                position: relative; width: 100%; border-radius: var(--radius-lg); 
                overflow: hidden; background: #fff; box-shadow: var(--shadow-soft);
                margin-bottom: 25px; transition: transform 0.3s;
            }
            .slider-wrapper { position: relative; width: 100%; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #fff 0%, #f0f0f0 100%); }
            .slider-img { display: none; max-width: 90%; max-height: 90%; object-fit: contain; filter: drop-shadow(0 15px 25px rgba(0,0,0,0.15)); transition: 0.4s ease; }
            .slider-img.active { display: block; animation: floatIn 0.5s ease-out; }
            @keyframes floatIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            
            .zoom-btn { position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.9); border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 10; transition: 0.2s; }
            .zoom-btn:hover { transform: scale(1.1); }
            
            .slider-controls { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 15px; background: #fff; }
            .nav-btn { background: none; border: 1px solid #eee; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; }
            .nav-btn:hover { background: #000; color: #fff; border-color: #000; }
            
            .lightbox-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
            .lightbox-modal.open { display: flex; animation: fadeIn 0.3s; }
            .lightbox-img { max-width: 90%; max-height: 90vh; object-fit: contain; }
            .close-lightbox { position: absolute; top: 30px; right: 30px; color: #fff; font-size: 40px; cursor: pointer; }

            /* --- ستايل الخيارات (Variants) والكمية --- */
            .variant-group { margin-bottom: 20px; }
            .variant-label { font-weight: 700; margin-bottom: 10px; font-size: 0.95rem; color: #555; display: flex; justify-content: space-between; }
            .variants-wrapper { display: flex; gap: 12px; flex-wrap: wrap; }
            
            .color-option { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; box-shadow: 0 2px 5px rgba(0,0,0,0.1); transition: transform 0.2s, border-color 0.2s; }
            .color-option.selected { transform: scale(1.2); border-color: #fff; box-shadow: 0 0 0 2px #000; }
            
            .size-option { padding: 10px 20px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; background: #fff; }
            .size-option.selected { background: #000; color: #fff; border-color: #000; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transform: translateY(-2px); }
            
            .qty-price-wrapper { background: #f8f9fa; padding: 20px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; margin-top: 25px; border: 1px solid #eee; }
            .qty-control { display: flex; align-items: center; background: #fff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); padding: 5px; }
            .qty-btn { width: 35px; height: 35px; background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: #555; }
            .qty-input { width: 40px; text-align: center; border: none; font-weight: bold; font-size: 1.1rem; }
            
            .total-value { font-size: 1.5rem; font-weight: 800; color: #000; }
            .submit-btn { 
                width: 100%; padding: 18px; border: none; border-radius: var(--radius-md); 
                background: linear-gradient(90deg, #000 0%, #333 100%); 
                color: #fff; font-size: 1.2rem; font-weight: 700; cursor: pointer; 
                margin-top: 25px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); 
                transition: transform 0.2s, box-shadow 0.2s; 
                text-transform: uppercase; letter-spacing: 1px;
            }
            .submit-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0,0,0,0.3); }

            /* --- ستايل الفيسبوك (محسن) --- */
            .fb-reviews-section { background: #fff; padding: 40px 20px; margin-top: 50px; border-top: 1px solid #eee; }
            .fb-title { text-align: center; margin-bottom: 30px; font-size: 1.5rem; color: #1c1e21; }
            .comment-row { display: flex; gap: 12px; margin-bottom: 20px; }
            .avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 1px solid #eee; flex-shrink: 0; }
            .avatar img { width: 100%; height: 100%; object-fit: cover; }
            .bubble { background: #f0f2f5; padding: 10px 15px; border-radius: 18px; position: relative; display: inline-block; min-width: 150px; }
            .username { font-weight: 700; font-size: 0.9rem; color: #050505; display: block; margin-bottom: 4px; }
            .text { font-size: 0.95rem; color: #050505; line-height: 1.4; }
            .actions { margin-top: 5px; font-size: 0.8rem; color: #65676b; display: flex; gap: 15px; padding-right: 15px; font-weight: 600; }
            .icon-love { background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') center/cover; width: 18px; height: 18px; display: inline-block; vertical-align: middle; }
            .reactions-container { position: absolute; bottom: -8px; left: -5px; background: #fff; padding: 2px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 4px; padding-right: 4px; }
            .react-count { font-size: 0.75rem; color: #65676b; }
        </style>
        `;

        const prompt = `
You are a **World-Class UI/UX Designer** and **Conversion Rate Optimization (CRO) Expert**.
Your task is to generate a **High-End, Modern Landing Page** for a product, similar to top-tier brands like *Ridestore, Nike, or Apple*.

**Product Details:**
- Name: ${productName}
- Category: ${productCategory}
- Target: ${targetAudience}
- Features: ${productFeatures}
- Price: ${productPrice} DZD
- Shipping: ${shippingText}
- Offer: ${offerText}
- Design Request: ${designDescription}

## 🎨 **Visual Style & Aesthetics (STRICT):**
1.  **Immersive Design:** Use large typography, whitespace, and high-quality visuals.
2.  **Modern UI Elements:** Use **Glassmorphism** (translucent backgrounds), rounded corners (20px), and subtle gradients.
3.  **Typography:** Use the font 'Cairo' (Arabic) and 'Poppins' (English). Make headings bold and impactful.
4.  **Color Palette:** Auto-generate a premium color palette based on the product (e.g., if it's winter gear, use cool blues/whites/blacks).
5.  **Responsiveness:** The layout MUST be fully responsive.
    - **Desktop:** Split screen layout (Product visual on one side, details/form on the other) OR a centered container with a wide hero section.
    - **Mobile:** Vertical stack (Hero Image -> Title -> Price -> Form). Sticky "Buy Now" button is a plus.

## 🧱 **Required Page Structure:**

### **1. Header:**
- Simple, transparent header with the Brand Logo (${LOGO_PLACEHOLDER}).

### **2. Hero Section (The Most Important Part):**
- Must look engaging.
- **Left/Center:** Product Title (Huge Font), Price (highlighted), and a short punchy description.
- **Right/Center:** **INSERT THE SLIDER CODE HERE EXACTLY AS PROVIDED BELOW.**

#### **Slider HTML Code (DO NOT MODIFY THE STRUCTURE):**
\`\`\`html
<div class="product-viewer-container">
    <button class="zoom-btn" onclick="openLightbox()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
    <div class="slider-wrapper">
        ${sliderSlidesHTML}
    </div>
    <div class="slider-controls">
        <button class="nav-btn prev" onclick="changeSlide(-1)">&#10094;</button>
        <span id="slideCounter" style="font-weight:bold; font-family:'Poppins';">1 / ${totalSlidesCount}</span>
        <button class="nav-btn next" onclick="changeSlide(1)">&#10095;</button>
    </div>
</div>
<div id="lightbox" class="lightbox-modal" onclick="closeLightbox()"><span class="close-lightbox">&times;</span><img id="lightbox-img" class="lightbox-img" src=""></div>
\`\`\`

### **3. Order Form (High Conversion):**
- Place this **immediately** visible (above the fold on desktop if possible, or right after the image on mobile).
- Style it like a **Premium Card** (White background, shadow, padding).
- Use this HTML structure for the form fields:

\`\`\`html
<div class="order-card" style="background:#fff; padding:30px; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.1);">
  <h3 style="margin-bottom:20px; text-align:center;">اطلب الآن واستفد من العرض</h3>
  
  <!-- Inputs with modern floating labels or simple styling -->
  <div class="form-group" style="margin-bottom:15px;">
    <label style="display:block; margin-bottom:5px; font-weight:600;">الإسم الكامل</label>
    <input type="text" placeholder="الاسم واللقب" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
  </div>
  
  <div class="form-group" style="margin-bottom:15px;">
    <label style="display:block; margin-bottom:5px; font-weight:600;">رقم الهاتف</label>
    <input type="tel" placeholder="05/06/07..." required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
  </div>
  
  <div class="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
      <div class="form-group" style="margin-bottom:15px;">
        <label style="display:block; margin-bottom:5px; font-weight:600;">الولاية</label>
        <input type="text" placeholder="الولاية" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
      </div>
      <div class="form-group" style="margin-bottom:15px;">
        <label style="display:block; margin-bottom:5px; font-weight:600;">البلدية</label>
        <input type="text" placeholder="البلدية" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
      </div>
  </div>

  ${variantsHTML}

  <div class="qty-price-wrapper">
      <div class="qty-control">
          <button type="button" class="qty-btn" onclick="updateQty(-1)">-</button>
          <input type="number" id="product-qty" class="qty-input" value="1" min="1" readonly>
          <button type="button" class="qty-btn" onclick="updateQty(1)">+</button>
      </div>
      <div class="total-price-box">
          <span style="display:block; font-size:12px; color:#666;">المجموع الكلي:</span>
          <span class="total-value" id="total-price-display">${productPrice} DA</span>
          <input type="hidden" id="final-total" name="total_price" value="${productPrice}">
      </div>
  </div>
  
  <button type="submit" class="submit-btn">تأكيد الطلب الآن <i class="fas fa-arrow-left" style="margin-right:10px;"></i></button>
  <p style="text-align:center; margin-top:15px; font-size:12px; color:#888;"><i class="fas fa-lock"></i> الدفع عند الاستلام - ضمان الرضا 100%</p>
</div>
\`\`\`

### **4. Extra Sections (Creative Freedom):**
- **Features Section:** Use icons (FontAwesome classes provided: \`fas fa-star\`, \`fas fa-shipping-fast\`, etc.) with grid layout.
- **Urgency:** Add a countdown timer styling or a "Limited Stock" bar.
- **Visuals:** Use parallax effects or large background sections if fitting.

### **5. Social Proof (Facebook Style):**
- Place the provided Facebook Reviews HTML code here.
- Make sure it looks like a clean section separated from the rest.
- **Use the specific HTML structure for reviews:**
\`\`\`html
<div class="fb-reviews-section">
    <h2 class="fb-title">آراء الزبائن على فيسبوك</h2>
    <div class="comment-thread" style="max-width:600px; margin:0 auto;">
        <!-- Generate 3-4 realistic comments here using [[MALE_IMG]] or [[FEMALE_IMG]] for avatars -->
        <!-- Example: -->
        <div class="comment-row">
            <div class="avatar"><img src="[[FEMALE_IMG]]"></div>
            <div class="comment-content">
                <div class="bubble">
                    <span class="username">سارة بن علي</span>
                    <span class="text">المنتج وصلني في يومين، نوعية ممتازة يعطيك الصحة! 😍</span>
                    <div class="reactions-container">
                        <div class="icon-love"></div> <span class="react-count">24</span>
                    </div>
                </div>
                <div class="actions"><span>2 س</span> <span>أعجبني</span> <span>رد</span></div>
            </div>
        </div>
    </div>
</div>
\`\`\`

### **6. JavaScript Logic (Must Include):**
Embed this exact script at the end of the body:
\`\`\`html
<script>
    // Slider Logic
    let currentSlide = 1; const totalSlides = ${totalSlidesCount};
    function changeSlide(d) { currentSlide += d; if (currentSlide > totalSlides) currentSlide = 1; if (currentSlide < 1) currentSlide = totalSlides; updateSlider(); }
    function updateSlider() { 
        document.querySelectorAll('.slider-img').forEach(img => { 
            img.classList.remove('active'); 
            if(parseInt(img.dataset.index) === currentSlide) img.classList.add('active'); 
        });
        document.getElementById('slideCounter').innerText = currentSlide + ' / ' + totalSlides; 
    }
    function goToSlide(index) { if(index && index >= 1 && index <= totalSlides) { currentSlide = index; updateSlider(); } }
    function openLightbox() { document.getElementById('lightbox-img').src = document.querySelector('.slider-img.active').src; document.getElementById('lightbox').classList.add('open'); }
    function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

    // Variants Logic
    function selectColor(el, name, slideIndex) {
        document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('selected-color').value = name;
        document.getElementById('color-name-display').innerText = name;
        if(slideIndex !== null && slideIndex !== 'null') goToSlide(slideIndex);
    }
    function selectSize(el, name) {
        document.querySelectorAll('.size-option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('selected-size').value = name;
    }

    // Price Logic
    let basePrice = ${parseFloat(productPrice) || 0};
    let currentQty = 1;
    function updateQty(change) {
        currentQty += change;
        if(currentQty < 1) currentQty = 1;
        document.getElementById('product-qty').value = currentQty;
        let total = (basePrice * currentQty).toFixed(2);
        if(total.endsWith('.00')) total = parseInt(total);
        document.getElementById('total-price-display').innerText = total + ' DA';
        document.getElementById('final-total').value = total;
    }
</script>
\`\`\`

## 📤 **Output Format:**
Return ONLY valid JSON:
{
  "html": "Complete HTML string starting with the provided CSS styles",
  "liquid_code": "Shopify Liquid version",
  "schema": { "name": "Landing Page", "settings": [] }
}

**IMPORTANT:** Start the HTML field with the \`${baseStyles}\` provided above.
`;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.9 // High creativity for design
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

        // --- معالجة الصور (Injection) ---
        const defaultImg = "https://via.placeholder.com/600x600?text=Product";
        const defaultLogo = "https://via.placeholder.com/150x50?text=Brand";
        const finalProductImages = productImageArray.length > 0 ? productImageArray : [defaultImg];
        const finalBrandLogo = brandLogo || defaultLogo;

        const getRandomAvatar = (gender) => {
            const randomId = Math.floor(Math.random() * 70); 
            const genderPath = gender === 'male' ? 'men' : 'women';
            return `https://randomuser.me/api/portraits/${genderPath}/${randomId}.jpg`;
        };

        const injectAvatars = (htmlContent) => {
            if (!htmlContent) return htmlContent;
            let content = htmlContent;
            // استبدال ذكي ومتعدد
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
                result = result.split(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`).join(finalProductImages[i]);
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
