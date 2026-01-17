import fetch from 'node-fetch';

export default async function handler(req, res) {
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

        const MAIN_IMG_PLACEHOLDER = "[[PRODUCT_IMAGE_MAIN_SRC]]";
        const LOGO_PLACEHOLDER = "[[BRAND_LOGO_SRC]]";
        
        // --- بناء بطاقات السلايدر الجديدة (Cards) ---
        let sliderCardsHTML = "";
        const finalImages = productImageArray.length > 0 ? productImageArray : [MAIN_IMG_PLACEHOLDER];
        
        finalImages.forEach((img, i) => {
            const imgSrc = i === 0 ? MAIN_IMG_PLACEHOLDER : `[[PRODUCT_IMAGE_${i + 1}_SRC]]`;
            sliderCardsHTML += `
            <div class="card" data-index="${i}">
                <img src="${imgSrc}" alt="${productName}" style="width:100%; height:100%; object-fit:cover;">
                <div class="card-info">
                    <h4>${productName}</h4>
                    <p>${productPrice} د.ج</p>
                </div>
            </div>`;
        });

        const totalSlidesCount = finalImages.length;
        const initialIndex = Math.floor(totalSlidesCount / 2);

        // --- منطق المتغيرات ---
        let variantsHTML = "";
        if (variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">اللون المفضل:</label><div class="variants-wrapper colors-wrapper">`;
            variants.colors.items.forEach((color) => {
                let slideTarget = color.imgIndex !== "" ? parseInt(color.imgIndex) : 'null';
                variantsHTML += `
                <div class="variant-option color-option" style="background-color: ${color.hex};" data-name="${color.name}" data-slide="${slideTarget}" onclick="selectColor(this, '${color.name}', ${slideTarget})" title="${color.name}"></div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-color" name="color" required> <span id="color-name-display" style="font-size:12px; color:#666;"></span></div>`;
        }

        if (variants && variants.sizes && variants.sizes.enabled && variants.sizes.items.length > 0) {
            variantsHTML += `<div class="form-group variant-group"><label class="variant-label">المقاس:</label><div class="variants-wrapper sizes-wrapper">`;
            variants.sizes.items.forEach((size) => {
                variantsHTML += `<div class="variant-option size-option" data-name="${size.name}" onclick="selectSize(this, '${size.name}')">${size.name}</div>`;
            });
            variantsHTML += `</div><input type="hidden" id="selected-size" name="size" required></div>`;
        }

        // --- التصميم المدمج (Zevana Style + Facebook) ---
        const combinedStyles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500&display=swap');
            :root { --bg-dark: #050505; --accent: #ffffff; }
            body { background-color: var(--bg-dark); color: #fff; font-family: 'Inter', sans-serif; overflow-x: hidden; margin: 0; }
            
            /* --- Zevana Hero Section --- */
            .hero-stage { position: relative; height: 100vh; width: 100vw; display: flex; flex-direction: column; overflow: hidden; }
            header { position: absolute; top: 0; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; opacity: 0; animation: fadeIn 2s ease-out 0.5s forwards; z-index: 100; box-sizing: border-box; }
            .logo-brand { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 500; display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; }
            .hero-text-container { position: absolute; top: 120px; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 60px; z-index: 90; pointer-events: none; box-sizing: border-box; }
            .small-desc { max-width: 300px; font-size: 12px; line-height: 1.6; color: #aaa; opacity: 0; transform: translateY(20px); animation: slideUpFade 2s ease-out 1s forwards; text-align: left; }
            .big-title { font-family: 'Playfair Display', serif; font-size: 42px; text-transform: uppercase; text-align: right; line-height: 1.1; opacity: 0; transform: translateY(20px); animation: slideUpFade 2s ease-out 1.5s forwards; }
            
            /* --- 3D Gallery --- */
            .gallery-stage { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; perspective: 1200px; z-index: 10; touch-action: pan-y; }
            .card { position: absolute; width: 260px; height: 380px; border-radius: 12px; background-color: #1a1a1a; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8); transition: all 1.5s cubic-bezier(0.2, 1, 0.3, 1); cursor: grab; opacity: 0; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.6); }
            .card-info { position: absolute; bottom: 0; left: 0; width: 100%; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); text-align: center; opacity: 0; transform: translateY(10px); transition: 0.8s ease 0.3s; }
            .card.active .card-info { opacity: 1; transform: translateY(0); }
            .card.active { cursor: zoom-in; }
            
            .slider-controls { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 30px; z-index: 100; opacity: 0; animation: fadeIn 2s ease-out 3s forwards; }
            .nav-btn { width: 50px; height: 50px; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; background: rgba(0,0,0,0.3); color: white; transition: 0.3s; }
            .nav-btn:hover { border-color: #fff; background: rgba(255,255,255,0.1); }
            
            /* --- Form & Other Styles --- */
            .content-section { background: #fff; color: #000; padding: 60px 20px; position: relative; z-index: 20; }
            .customer-info-box { max-width: 500px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); color: #333; }
            .form-group { margin-bottom: 15px; text-align: right; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; }
            .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; text-align: right; }
            
            /* Facebook Reviews (As requested in generate.js) */
            .fb-reviews-section { direction: rtl; max-width: 600px; margin: 40px auto; background: #fff; }
            .comment-row { display: flex; margin-bottom: 15px; }
            .avatar { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; margin-left: 10px; }
            .bubble { background: #f0f2f5; padding: 10px 15px; border-radius: 18px; position: relative; }
            .username { font-weight: bold; font-size: 13px; display: block; }
            .icon-love { width: 16px; height: 16px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23f02849"/><path d="M16 26c-0.6 0-1.2-0.2-1.6-0.6 -5.2-4.6-9.4-8.4-9.4-13.4 0-3 2.4-5.4 5.4-5.4 2.1 0 3.9 1.1 4.9 2.9l0.7 1.2 0.7-1.2c1-1.8 2.8-2.9 4.9-2.9 3 0 5.4 2.4 5.4 5.4 0 5-4.2 8.8-9.4 13.4 -0.4 0.4-1 0.6-1.6 0.6z" fill="white"/></svg>') no-repeat center/cover; }

            @keyframes fadeIn { to { opacity: 1; } }
            @keyframes slideUpFade { to { opacity: 1; transform: translateY(0); } }
            
            .variant-option { border: 2px solid #ddd; cursor: pointer; transition: 0.2s; }
            .color-option { width: 30px; height: 30px; border-radius: 50%; display: inline-block; margin: 5px; }
            .color-option.selected { border-color: #000; transform: scale(1.1); }
            .size-option { padding: 5px 15px; border-radius: 4px; display: inline-block; margin: 5px; font-weight: bold; }
            .size-option.selected { background: #000; color: #fff; }
        </style>
        `;

        const prompt = `
Act as a Senior Creative Director. Create a high-end luxury landing page for ${productName}.
Category: ${productCategory}. Price: ${productPrice}.

## 🖼️ **The Hero Slider (Zevana 3D Style):**
You MUST use this exact HTML structure for the Hero Section:

\`\`\`html
<section class="hero-stage">
    <header>
        <a href="#" class="logo-brand">
            <img src="${LOGO_PLACEHOLDER}" style="height:40px;">
        </a>
        <div style="font-size:12px; letter-spacing:2px; opacity:0.7;">COLLECTION 2024</div>
    </header>

    <div class="hero-text-container">
        <div class="small-desc">
            ${productFeatures.substring(0, 150)}... مصمم خصيصاً ليمنحك تجربة استثنائية تجمع بين الجمال والجودة العالية.
        </div>
        <div class="big-title">${productName}<br>ELEGANCE.</div>
    </div>

    <div class="gallery-stage" id="slider-stage">
        ${sliderCardsHTML}
    </div>

    <div class="slider-controls">
        <button class="nav-btn" onclick="changeSlide(-1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
        </button>
        <button class="nav-btn" onclick="changeSlide(1)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
        </button>
    </div>
</section>

<section class="content-section">
    <div class="customer-info-box">
        <h2 style="text-align:center; margin-bottom:20px;">أطلب الآن واحصل على العرض</h2>
        <div class="form-group"><label>الإسم الكامل</label><input type="text" placeholder="الاسم واللقب" required></div>
        <div class="form-group"><label>رقم الهاتف</label><input type="tel" placeholder="رقم الهاتف" required></div>
        <div class="form-group"><label>الولاية</label><input type="text" placeholder="الولاية" required></div>
        ${variantsHTML}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px dashed #ccc; padding-top:20px;">
            <span style="font-weight:bold;">المجموع:</span>
            <span id="total-price-display" style="font-size:20px; color:#d32f2f; font-weight:bold;">${productPrice} د.ج</span>
        </div>
        <button class="submit-btn" style="width:100%; background:#000; color:#fff; padding:15px; border:none; border-radius:6px; margin-top:20px; cursor:pointer; font-weight:bold; font-size:18px;">تأكيد الطلب</button>
    </div>

    </section>
\`\`\`

### **Important Instructions:**
1. Include the provided \`combinedStyles\`.
2. Implement the 3D Slider Logic precisely as defined in the provided script section.
3. Make sure the transition between cards is smooth (cubic-bezier).

### **The JavaScript Logic:**
Include this script to handle the Zevana movement:
\`\`\`html
<script>
    const cards = Array.from(document.querySelectorAll('.card'));
    let currentIndex = ${initialIndex};
    let isDragging = false; let startX = 0;

    function updateSlider(isInitial = false) {
        cards.forEach((card, index) => {
            const offset = index - currentIndex;
            let translateX = offset * 260; 
            let rotateY = offset * -15;    
            let scale = 1 - Math.abs(offset) * 0.15; 
            let zIndex = 10 - Math.abs(offset);
            
            if (offset === 0) { card.classList.add('active'); scale = 1.1; } 
            else { card.classList.remove('active'); }

            if (isInitial) { card.style.transitionDelay = (Math.abs(offset) * 0.5) + "s"; } 
            else { card.style.transitionDelay = "0s"; }

            card.style.opacity = 1 - Math.abs(offset) * 0.3;
            card.style.transform = "translate(-50%, -50%) translateX("+translateX+"px) scale("+scale+") rotateY("+rotateY+"deg)";
            card.style.zIndex = zIndex;
            card.style.pointerEvents = offset === 0 ? 'auto' : 'none';
        });
    }

    function changeSlide(dir) {
        currentIndex = Math.max(0, Math.min(cards.length - 1, currentIndex + dir));
        updateSlider();
    }

    function selectColor(el, name, index) {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('selected-color').value = name;
        if(index !== null && index !== undefined) {
            currentIndex = index;
            updateSlider();
        }
    }

    window.onload = () => { setTimeout(() => { updateSlider(true); }, 500); };
</script>
\`\`\`
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
            })
        });

        const data = await response.json();
        const aiResponseText = data.candidates[0].content.parts[0].text;
        const cleanedText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let aiResponse = JSON.parse(cleanedText);

        const finalProductImages = productImageArray.length > 0 ? productImageArray : ["https://via.placeholder.com/600x800"];
        const finalBrandLogo = brandLogo || "https://via.placeholder.com/150x50";

        const replaceImages = (content) => {
            if (!content) return content;
            let result = content.split(MAIN_IMG_PLACEHOLDER).join(finalProductImages[0]);
            result = result.split(LOGO_PLACEHOLDER).join(finalBrandLogo);
            for (let i = 1; i < finalProductImages.length; i++) {
                result = result.split(`[[PRODUCT_IMAGE_${i + 1}_SRC]]`).join(finalProductImages[i]);
            }
            return result;
        };

        const injectAvatars = (html) => {
            return html.replace(/\[\[MALE_IMG\]\]/g, () => `https://randomuser.me/api/portraits/men/${Math.floor(Math.random()*50)}.jpg`)
                       .replace(/\[\[FEMALE_IMG\]\]/g, () => `https://randomuser.me/api/portraits/women/${Math.floor(Math.random()*50)}.jpg`);
        };

        aiResponse.html = combinedStyles + injectAvatars(replaceImages(aiResponse.html));

        res.status(200).json(aiResponse);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
