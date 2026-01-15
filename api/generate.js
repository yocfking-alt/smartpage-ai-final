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
        
        // القالب الأصلي الذي تريد الحفاظ عليه (t.html)
        // ملاحظة: سنطلب من الذكاء الاصطناعي الالتزام بهذا الهيكل
        const TEMPLATE_STRUCTURE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl"> <head>
<meta charset="UTF-8" />
<title>Product Landing Page</title>
<link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&family=Cairo:wght@400;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', 'Orbitron', sans-serif; }
body { width: 100vw; height: 100vh; background: #0a0a0a; overflow: hidden; color: white; }
.hero { position: relative; width: 100%; height: 100%; background: radial-gradient(circle at center, rgba(255,255,255,0.1), transparent 55%), linear-gradient(180deg, #0b0b0b, #050505); transition: background 0.8s ease; }
.hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.85) 75%); pointer-events: none; }
nav { position: absolute; top: 0; width: 100%; padding: 2rem 4rem; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
.logo { font-size: 1.5rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
.nav-links { display: flex; gap: 3rem; }
.nav-links a { text-decoration: none; color: rgba(255,255,255,0.7); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; cursor: pointer; }
.nav-links a:hover, .nav-links a.active { color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); }
.content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; height: 80%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; z-index: 10; }
.big-text-bg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12vw; font-weight: 700; color: rgba(255,255,255,0.03); white-space: nowrap; z-index: 1; pointer-events: none; transition: color 0.5s ease; }
.shoe-container { position: relative; width: 100%; height: 50vh; display: flex; justify-content: center; align-items: center; z-index: 5; perspective: 1000px; }
.shoe-img { width: auto; height: 120%; object-fit: contain; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5)); transform: rotate(-15deg) translateY(0); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; position: absolute; }
.shoe-img.active { opacity: 1; transform: rotate(-15deg) translateY(-20px) scale(1.1); }
.info-box { margin-top: 2rem; z-index: 10; }
.shoe-name { font-size: 3rem; font-weight: 700; letter-spacing: 2px; margin-bottom: 0.5rem; opacity: 0; transform: translateY(20px); transition: all 0.6s ease; text-transform: uppercase; }
.price-tag { font-size: 1.5rem; color: rgba(255,255,255,0.8); margin-bottom: 1.5rem; font-family: 'Orbitron', sans-serif; }
.btn { padding: 1rem 2.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 1rem; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; transition: 0.4s; backdrop-filter: blur(5px); border-radius: 4px; text-decoration: none; display: inline-block; }
.btn:hover { background: #fff; color: #000; box-shadow: 0 0 20px rgba(255,255,255,0.4); }
.slider-controls { position: absolute; bottom: 3rem; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 4rem; z-index: 20; }
.dots { display: flex; gap: 1rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.2); cursor: pointer; transition: 0.3s; }
.dot.active { background: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.5); transform: scale(1.2); }
.pagination { display: flex; gap: 2rem; font-family: 'Orbitron', sans-serif; font-size: 0.9rem; color: rgba(255,255,255,0.4); }
.page-num { cursor: pointer; transition: 0.3s; position: relative; }
.page-num::after { content: ''; position: absolute; bottom: -5px; left: 0; width: 0; height: 2px; background: #fff; transition: 0.3s; }
.page-num.active { color: #fff; }
.page-num.active::after { width: 100%; }
.progress-bar { position: absolute; bottom: 0; left: 0; height: 4px; background: rgba(255,255,255,0.1); width: 100%; z-index: 100; }
.progress { height: 100%; background: #fff; width: 0%; transition: width 0.5s ease; position: relative; }
.progress::after { content: ''; position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; background: #fff; border-radius: 50%; box-shadow: 0 0 15px rgba(255,255,255,0.8); }
.arrow-btn { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 1.5rem; cursor: pointer; transition: 0.3s; }
.arrow-btn:hover { color: #fff; transform: scale(1.1); }
.hidden { display: none; }
</style>
</head>
<body>

<div class="hero">
    <nav>
        <div class="logo">[[BRAND_LOGO]]</div> <div class="nav-links">
            <a href="#" class="active">الرئيسية</a>
            <a href="#">المميزات</a>
            <a href="#">اطلب الآن</a>
        </div>
        <a href="#order" class="btn">شراء الآن</a>
    </nav>

    <div class="big-text-bg">[[PRODUCT_NAME_SHORT]]</div>

    <div class="content">
        <div class="shoe-container" id="shoeContainer">
            </div>

        <div class="info-box">
            <h1 class="shoe-name" id="shoeName">...</h1>
            <div class="price-tag" id="shoePrice">...</div>
            <p id="shoeDesc" style="color:rgba(255,255,255,0.6); margin-bottom:20px; max-width:500px; font-size:0.9rem; line-height:1.6;"></p>
            <a href="#order" class="btn">أضف للسلة <i class="ri-shopping-bag-3-line"></i></a>
        </div>
    </div>

    <div class="slider-controls">
        <button class="arrow-btn" id="prevBtn"><i class="ri-arrow-left-s-line"></i></button>
        <div class="dots" id="dotsContainer"></div>
        <button class="arrow-btn" id="nextBtn"><i class="ri-arrow-right-s-line"></i></button>
    </div>
    
    <div class="slider-controls" style="bottom: 7rem; justify-content: center; pointer-events: none;">
         <div class="pagination" id="pagesContainer" style="pointer-events: auto;"></div>
    </div>

    <div class="progress-bar"><div class="progress"></div></div>
</div>

<script>
    // DATA INJECTION POINT
    // The AI will generate this array based on user input
    const productData = [
        /* {
            name: "Product Variant 1",
            color: "#HEXCODE", // Muted color derived from image
            price: "$199",
            desc: "Short description...",
            img: "URL"
        }
        */
    ];

    let currentIndex = 0;
    const hero = document.querySelector('.hero');
    const shoeName = document.getElementById('shoeName');
    const bigText = document.querySelector('.big-text-bg');
    const shoeContainer = document.getElementById('shoeContainer');
    const dotsContainer = document.getElementById('dotsContainer');
    const pagesContainer = document.getElementById('pagesContainer');
    const progressBar = document.querySelector('.progress');
    const shoeDesc = document.getElementById('shoeDesc');
    const shoePrice = document.getElementById('shoePrice');

    function init() {
        // Create Images
        productData.forEach((item, index) => {
            const img = document.createElement('img');
            img.src = item.img;
            img.classList.add('shoe-img');
            if(index === 0) img.classList.add('active');
            shoeContainer.appendChild(img);

            // Dots
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if(index === 0) dot.classList.add('active');
            dot.dataset.index = index;
            dot.onclick = () => updateSlider(index);
            dotsContainer.appendChild(dot);

            // Pagination Numbers
            const page = document.createElement('div');
            page.classList.add('page-num');
            page.textContent = (index + 1).toString().padStart(2, '0');
            if(index === 0) page.classList.add('active');
            page.dataset.index = index;
            page.onclick = () => updateSlider(index);
            pagesContainer.appendChild(page);
        });

        updateSlider(0);
    }

    function updateSlider(index) {
        // Reset
        document.querySelectorAll('.shoe-img').forEach(img => img.classList.remove('active'));
        document.querySelectorAll('.dot').forEach(dot => dot.classList.remove('active'));
        document.querySelectorAll('.page-num').forEach(page => page.classList.remove('active'));

        // Set Active
        const images = document.querySelectorAll('.shoe-img');
        if(images[index]) images[index].classList.add('active');
        
        const dots = document.querySelectorAll('.dot');
        if(dots[index]) dots[index].classList.add('active');

        const pages = document.querySelectorAll('.page-num');
        if(pages[index]) pages[index].classList.add('active');

        // Update Text Content with Animation
        shoeName.style.opacity = 0;
        shoeName.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            shoeName.textContent = productData[index].name;
            shoeDesc.textContent = productData[index].desc;
            shoePrice.textContent = productData[index].price;
            
            shoeName.style.opacity = 1;
            shoeName.style.transform = 'translateY(0)';
        }, 300);

        // Update Colors (Muted/Dark Theme Logic)
        // We only use the color for subtle tints, keeping the background dark
        const color = productData[index].color;
        
        // Very subtle background tint
        hero.style.background = \`
            radial-gradient(circle at center, \${color}20, transparent 60%),
            linear-gradient(180deg, #0b0b0b, #050505)
        \`;
        
        // Tint the big text slightly
        bigText.style.color = \`\${color}15\`; // very low opacity

        // Progress Bar
        const progress = ((index + 1) / productData.length) * 100;
        progressBar.style.width = \`\${progress}%\`;
        progressBar.style.background = color; // Accent color on progress

        currentIndex = index;
    }

    document.getElementById('prevBtn').onclick = () => {
        let newIndex = currentIndex - 1;
        if(newIndex < 0) newIndex = productData.length - 1;
        updateSlider(newIndex);
    };

    document.getElementById('nextBtn').onclick = () => {
        let newIndex = currentIndex + 1;
        if(newIndex >= productData.length) newIndex = 0;
        updateSlider(newIndex);
    };

    // Auto rotate if desired
    // setInterval(() => document.getElementById('nextBtn').click(), 5000);

    init();
</script>
</body>
</html>
        `;

        const GEMINI_MODEL = 'gemini-2.5-flash'; 

        const prompt = `
        You are a world-class Frontend Developer and UI/UX Designer specialized in high-end, dark-themed luxury landing pages.
        
        YOUR TASK:
        Take the HTML/CSS/JS template provided below and inject the user's product data into it.
        You must NOT change the CSS structure or the layout.
        You MUST output the full valid HTML file.

        USER PRODUCT DATA:
        - Product Name: ${productName}
        - Features: ${productFeatures}
        - Description: ${designDescription || productCategory}
        - Price: ${productPrice}
        - Target Audience: ${targetAudience}
        - Images Available: ${productImageArray.length}

        INSTRUCTIONS:
        1. **HTML Structure**: Use the 'TEMPLATE_STRUCTURE' provided below exactly. Do not strip the <style> or <script> tags.
        2. **Content Injection**:
           - Replace '[[BRAND_LOGO]]' with the text "${productName}" (or an img tag if a logo URL is provided).
           - Replace '[[PRODUCT_NAME_SHORT]]' with a very short 1-2 word version of the product name for the background.
           - Locate the 'const productData = [...]' array in the script section. You MUST populate this array based on the user's images.
        3. **The 'productData' Logic**:
           - If the user provided multiple images, create an object for each image in the array.
           - 'name': Use the product name (you can add variation names like "Red Edition" if you detect colors, otherwise keep it standard).
           - 'desc': A short, punchy 1-sentence description in ARABIC (since the template is RTL).
           - 'price': "${productPrice}".
           - 'img': Use the placeholders [[PRODUCT_IMAGE_1_SRC]], [[PRODUCT_IMAGE_2_SRC]], etc. strictly.
           - 'color': Pick a HEX color that matches the product image but keep it muted/pastel (e.g., #ff5500 for orange, #4488ff for blue). DO NOT use neon colors. If unsure, use #ffffff.
        4. **Theme Preservation**:
           - Do NOT change the body background form #0a0a0a.
           - Ensure the gradients use the 'color' variable with low opacity (10% to 20%) as defined in the script template.
        
        TEMPLATE_STRUCTURE (Copy and Fill this):
        ${TEMPLATE_STRUCTURE}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('Gemini API returned no candidates');
        }

        let content = data.candidates[0].content.parts[0].text;
        
        // تنظيف الكود من علامات Markdown
        content = content.replace(/```html/g, '').replace(/```/g, '');

        // === دوال استبدال الصور ===
        const replaceImages = (htmlContent) => {
            let result = htmlContent;
            
            // استبدال الشعار إذا وجد
            if (brandLogo) {
               result = result.replace('[[BRAND_LOGO]]', `<img src="${brandLogo}" style="height:40px;">`);
            } else {
               // إذا لم يوجد شعار نضع الاسم كنص
               // (يتم التعامل معه داخل Gemini عادة، لكن كاحتياط)
            }

            // استبدال صور المنتج
            // ملاحظة: الـ Prompt أعلاه طلب من Gemini وضع Placeholders
            // [[PRODUCT_IMAGE_1_SRC]], [[PRODUCT_IMAGE_2_SRC]]
            
            productImageArray.forEach((imgUrl, index) => {
                const placeholder = `[[PRODUCT_IMAGE_${index + 1}_SRC]]`;
                // استبدال كل حالات الظهور
                result = result.split(placeholder).join(imgUrl);
            });

            // تنظيف أي placeholders متبقية لم يتم استبدالها (في حال وضع Gemini صوراً أكثر من الموجود)
            result = result.replace(/\[\[PRODUCT_IMAGE_\d+_SRC\]\]/g, 'https://via.placeholder.com/500x500/333/fff?text=No+Image');

            return result;
        };

        const finalHtml = replaceImages(content);

        // إرجاع النتيجة
        res.status(200).json({
            // بما أن القالب هو صفحة واحدة كاملة، نضعها في liquid_code و html
            liquid_code: finalHtml, 
            html: finalHtml,
            schema: "{}" // يمكن توليده إذا لزم الأمر
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
