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
        // استقبال البيانات من Builder
        const { 
            productName, productFeatures, productPrice, productCategory,
            targetAudience, designDescription, shippingOption, customShippingPrice, 
            customOffer, productImages, brandLogo, variants 
        } = req.body;

        // التعامل مع الصور
        const images = productImages || [];
        const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/500x500?text=Product';
        const logoSrc = brandLogo || '';

        // استخراج الكلمة الأولى من اسم المنتج لاستخدامها كنص خلفية عملاق
        const bigBackgroundText = productName ? productName.split(' ')[0].toUpperCase() : 'BRAND';

        // --- بناء مصفوفة المنتجات (السلايدات) بناءً على المدخلات ---
        // سنحاول دمج الصور مع الألوان المختارة لإنشاء تجربة مثل قالب Nike
        let slidesData = [];
        
        // التحقق مما إذا كان هناك متغيرات ألوان
        const hasColors = variants && variants.colors && variants.colors.enabled && variants.colors.items.length > 0;
        
        if (hasColors) {
            // إذا اختار المستخدم ألواناً، ننشئ شريحة لكل لون
            slidesData = variants.colors.items.map((color, index) => {
                // محاولة ربط الصورة باللون إذا تم تحديدها، وإلا نستخدم الصورة المرتبطة بالترتيب
                const imgIndex = color.imgIndex !== "" && color.imgIndex !== null ? parseInt(color.imgIndex) : (index % images.length);
                const slideImg = images[imgIndex] || mainImage;
                
                // توليد تدرج لوني بناءً على لون المستخدم
                // نقوم بتفتيح وتغميق اللون المختار لعمل Radial Gradient
                return {
                    id: index + 1,
                    title: `${productName} - ${color.name}`,
                    price: productPrice,
                    color: color.hex, // لون الأزرار
                    // تدرج لوني ذكي يعتمد على لون الهيكس المختار
                    gradient: `radial-gradient(circle, ${lightenColor(color.hex, 20)} 0%, ${darkenColor(color.hex, 40)} 100%)`, 
                    image: slideImg,
                    desc: productFeatures
                };
            });
        } else {
            // إذا لم يحدد ألوان، نستخدم الصور المرفوعة فقط ونولد ألوان افتراضية (أزرق داكن احترافي)
            slidesData = images.map((img, index) => {
                return {
                    id: index + 1,
                    title: productName,
                    price: productPrice,
                    color: "#0c4da2",
                    gradient: `radial-gradient(circle, #1a60c7 0%, #002b66 100%)`,
                    image: img,
                    desc: productFeatures
                };
            });
        }

        // إذا لم يكن هناك صور أو بيانات كافية، نضع شريحة افتراضية واحدة
        if (slidesData.length === 0) {
            slidesData.push({
                id: 1,
                title: productName,
                price: productPrice,
                color: "#0c4da2",
                gradient: `radial-gradient(circle, #1a60c7 0%, #002b66 100%)`,
                image: mainImage,
                desc: productFeatures
            });
        }

        // تحويل مصفوفة البيانات إلى سلسلة JSON لزرعها في الجافاسكريبت
        const slidesJson = JSON.stringify(slidesData);

        // --- بناء كود HTML ---
        // سنستخدم القالب الذي قدمته بالضبط مع حقن المتغيرات
        
        const generatedHTML = `
<!DOCTYPE html>
<html lang="ar" dir="ltr"> <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - Official Store</title>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --primary-color: ${slidesData[0].color};
            --text-color: #ffffff;
            --bg-gradient: ${slidesData[0].gradient};
            --transition-speed: 0.5s;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        
        /* دعم العربية في النصوص */
        .ar-text { font-family: 'Cairo', sans-serif !important; direction: rtl; }

        body {
            background: var(--bg-gradient);
            color: var(--text-color);
            min-height: 100vh;
            overflow-x: hidden;
            transition: background 0.8s ease;
        }

        /* Navbar */
        header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 20px 5%; z-index: 100; position: relative;
        }
        .logo img { height: 40px; object-fit: contain; filter: brightness(0) invert(1); }
        .logo-text { font-size: 1.5rem; font-weight: bold; font-style: italic; }
        .nav-links ul { display: flex; list-style: none; gap: 30px; }
        .nav-links a { text-decoration: none; color: rgba(255, 255, 255, 0.7); font-weight: 500; text-transform: uppercase; font-size: 0.9rem; transition: 0.3s; }
        .nav-links a:hover { color: #fff; }

        /* Layout */
        .container {
            position: relative; width: 100%; min-height: calc(100vh - 80px);
            display: flex; align-items: center; justify-content: center;
            padding-bottom: 50px;
        }
        @media (max-width: 900px) { .container { flex-direction: column; text-align: center; height: auto; padding-top: 50px; } }

        /* Big Text */
        .big-text {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-family: 'Anton', sans-serif; font-size: 20vw;
            color: rgba(255, 255, 255, 0.05); z-index: 1;
            letter-spacing: 10px; pointer-events: none; white-space: nowrap;
        }

        .content-wrapper {
            display: flex; justify-content: space-between; align-items: center;
            width: 90%; max-width: 1400px; z-index: 10;
        }
        @media (max-width: 900px) { .content-wrapper { flex-direction: column-reverse; gap: 40px; } }

        /* Info Sections */
        .left-info, .right-info { width: 25%; }
        @media (max-width: 900px) { .left-info, .right-info { width: 100%; text-align: center; } }

        .product-title { font-size: 3rem; font-weight: 600; line-height: 1.1; margin-bottom: 10px; text-transform: capitalize; text-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .product-price { font-size: 2rem; font-weight: 300; margin-bottom: 30px; opacity: 0.9; }
        
        .btn {
            padding: 12px 35px; background: rgba(255,255,255,0.1); backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.5); color: #fff; font-weight: 600;
            text-transform: uppercase; cursor: pointer; border-radius: 30px;
            transition: 0.3s; display: inline-flex; align-items: center; gap: 10px;
            font-size: 1rem;
        }
        .btn:hover { background: #fff; color: var(--primary-color); transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }

        /* Center Image */
        .center-image { width: 45%; position: relative; display: flex; justify-content: center; align-items: center; }
        @media (max-width: 900px) { .center-image { width: 100%; height: 350px; } }

        .circle-bg {
            position: absolute; width: 450px; height: 450px; border-radius: 50%;
            background: rgba(255, 255, 255, 0.1); z-index: -1;
            box-shadow: 0 0 50px rgba(0,0,0,0.2); transition: 0.5s;
        }
        @media (max-width: 600px) { .circle-bg { width: 300px; height: 300px; } }

        .product-img {
            width: 110%; max-width: 650px; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5));
            transform: rotate(-15deg); transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            object-fit: contain;
        }
        .product-img.animate { animation: floatShoe 0.6s ease-out forwards; }

        @keyframes floatShoe {
            0% { transform: rotate(-15deg) scale(0.8) translateY(50px); opacity: 0; }
            100% { transform: rotate(-15deg) scale(1) translateY(0); opacity: 1; }
        }

        .description { font-size: 0.95rem; line-height: 1.7; opacity: 0.9; margin-bottom: 25px; max-width: 400px; }

        /* Controls */
        .controls {
            position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 20px; z-index: 20;
        }
        .control-btn {
            width: 50px; height: 50px; border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.1);
            color: #fff; display: flex; justify-content: center; align-items: center;
            cursor: pointer; transition: 0.3s;
        }
        .control-btn:hover { background: #fff; color: var(--primary-color); }

        /* --- Modal Checkout Form --- */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 999; display: none;
            justify-content: center; align-items: center; opacity: 0; transition: 0.3s;
        }
        .modal-overlay.open { display: flex; opacity: 1; }
        
        .order-card {
            background: white; color: #333; width: 90%; max-width: 500px;
            border-radius: 20px; padding: 30px; position: relative;
            transform: translateY(50px); transition: 0.4s;
        }
        .modal-overlay.open .order-card { transform: translateY(0); }
        
        .close-modal { position: absolute; top: 15px; right: 20px; font-size: 24px; cursor: pointer; color: #555; }
        .order-title { text-align: center; font-size: 1.5rem; margin-bottom: 20px; color: var(--primary-color); font-family: 'Cairo', sans-serif; }
        
        .form-group { margin-bottom: 15px; text-align: right; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-family: 'Cairo'; font-size: 0.9rem; }
        .form-group input { 
            width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;
            font-family: 'Cairo'; outline: none; transition: 0.3s;
        }
        .form-group input:focus { border-color: var(--primary-color); }
        
        .submit-btn {
            width: 100%; padding: 15px; background: var(--primary-color); color: white;
            border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold;
            cursor: pointer; font-family: 'Cairo'; transition: 0.3s;
        }
        .submit-btn:hover { filter: brightness(1.1); }

    </style>
</head>
<body>

    <header>
        <div class="logo">
            ${logoSrc ? `<img src="${logoSrc}" alt="Brand Logo">` : `<div class="logo-text">${productName.split(' ')[0]}</div>`}
        </div>
        <nav class="nav-links">
            <ul>
                <li><a href="#" class="active">Product</a></li>
                <li><a href="#details">Details</a></li>
                <li><a href="#reviews">Reviews</a></li>
            </ul>
        </nav>
        <div class="nav-icons" onclick="openOrderForm()">
            <i class="fa-solid fa-bag-shopping"></i>
        </div>
    </header>

    <div class="container">
        
        <div class="big-text">${bigBackgroundText}</div>

        <div class="content-wrapper">
            
            <div class="left-info">
                <h1 class="product-title fade-in" id="title">${slidesData[0].title}</h1>
                <h2 class="product-price fade-in" id="price">${productPrice}</h2>
                <button class="btn fade-in" onclick="openOrderForm()">
                    ORDER NOW <i class="fa-solid fa-cart-arrow-down"></i>
                </button>
                ${customOffer ? `<div style="margin-top:15px; color:#ffdd57; font-weight:bold;">${customOffer}</div>` : ''}
            </div>

            <div class="center-image">
                <div class="circle-bg" id="circleBg"></div>
                <img src="${slidesData[0].image}" class="product-img img-animate" id="productImage" alt="${productName}">
            </div>

            <div class="right-info">
                <p class="description fade-in ar-text" id="desc">
                    ${productFeatures.substring(0, 150)}...
                </p>
                <div class="btn" onclick="openOrderForm()" style="width: auto; font-size: 0.8rem; padding: 10px 20px;">
                    <i class="fa-solid fa-bolt"></i> FAST SHIPPING
                </div>
            </div>

        </div>

        <div class="controls">
            <div class="control-btn" onclick="prevSlide()"><i class="fa-solid fa-arrow-left"></i></div>
            <div class="control-btn" onclick="nextSlide()"><i class="fa-solid fa-arrow-right"></i></div>
        </div>

    </div>

    <div class="modal-overlay" id="orderModal">
        <div class="order-card">
            <span class="close-modal" onclick="closeOrderForm()">&times;</span>
            <h3 class="order-title">إتمام الطلب</h3>
            <form id="checkoutForm">
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" placeholder="أدخل اسمك" required>
                </div>
                <div class="form-group">
                    <label>رقم الهاتف</label>
                    <input type="tel" placeholder="0XXXXXXXXX" required>
                </div>
                <div class="form-group">
                    <label>العنوان / الولاية</label>
                    <input type="text" placeholder="عنوان التوصيل" required>
                </div>
                
                <input type="hidden" id="selected_variant" name="variant" value="${slidesData[0].title}">
                
                <div class="form-group" style="display:flex; justify-content:space-between; margin-top:10px;">
                    <span>السعر:</span>
                    <strong style="color:var(--primary-color)">${productPrice}</strong>
                </div>

                <button type="submit" class="submit-btn">تأكيد الطلب</button>
            </form>
        </div>
    </div>

    <script>
        // === حقن البيانات من السيرفر ===
        const products = ${slidesJson};
        let currentIndex = 0;

        // Elements
        const body = document.querySelector('body');
        const root = document.documentElement;
        const titleEl = document.getElementById('title');
        const priceEl = document.getElementById('price');
        const imgEl = document.getElementById('productImage');
        const descEl = document.getElementById('desc');
        const circleBg = document.getElementById('circleBg');
        const variantInput = document.getElementById('selected_variant');

        function updateSlide() {
            const product = products[currentIndex];

            // 1. Background & Colors
            body.style.background = product.gradient;
            root.style.setProperty('--primary-color', product.color);
            
            // 2. Text Content
            titleEl.innerText = product.title;
            imgEl.src = product.image;
            variantInput.value = product.title; // Update hidden input for form
            
            // 3. Animation Reset
            imgEl.classList.remove('img-animate');
            void imgEl.offsetWidth; // Trigger reflow
            imgEl.classList.add('img-animate');

            // 4. Circle Animation
            circleBg.style.transform = 'scale(0.8)';
            setTimeout(() => circleBg.style.transform = 'scale(1)', 300);
        }

        function nextSlide() {
            currentIndex++;
            if (currentIndex >= products.length) currentIndex = 0;
            updateSlide();
        }

        function prevSlide() {
            currentIndex--;
            if (currentIndex < 0) currentIndex = products.length - 1;
            updateSlide();
        }

        // Modal Logic
        function openOrderForm() {
            document.getElementById('orderModal').classList.add('open');
        }
        function closeOrderForm() {
            document.getElementById('orderModal').classList.remove('open');
        }
        
        // Close modal on outside click
        document.getElementById('orderModal').addEventListener('click', function(e) {
            if (e.target === this) closeOrderForm();
        });

        // Form Submit Simulation
        document.getElementById('checkoutForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('.submit-btn');
            const originalText = btn.innerText;
            btn.innerText = 'جاري الطلب...';
            btn.style.opacity = '0.7';
            
            setTimeout(() => {
                btn.innerText = 'تم الطلب بنجاح!';
                btn.style.background = '#27ae60';
                setTimeout(() => {
                    closeOrderForm();
                    btn.innerText = originalText;
                    btn.style.background = 'var(--primary-color)';
                    alert('شكراً لك! سيتم الاتصال بك قريباً.');
                }, 1500);
            }, 1000);
        });
    </script>
</body>
</html>
        `;

        // إرسال الرد
        res.status(200).json({
            liquid_code: "", // لا نحتاج ليكويد حالياً لأننا نولد HTML كامل
            schema: { "name": "Nike Style Landing", "settings": [] },
            html: generatedHTML
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

// --- دوال مساعدة لتوليد الألوان (Gradient Generation) ---

function lightenColor(col, amt) {
    return changeColorAmt(col, amt);
}

function darkenColor(col, amt) {
    return changeColorAmt(col, -amt);
}

function changeColorAmt(col, amt) {
    let usePound = false;
    if (col[0] == "#") {
        col = col.slice(1);
        usePound = true;
    }
    let num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}
