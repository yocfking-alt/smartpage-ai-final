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
        // استقبال البيانات
        const { 
            productName, productFeatures, productPrice, 
            productImages, variants, brandLogo 
        } = req.body;

        // --- تحضير البيانات للقالب ---
        
        // 1. الصور
        const imgArray = productImages || [];
        const mainImg = imgArray.length > 0 ? imgArray[0] : "https://parspng.com/wp-content/uploads/2023/02/shoespng.parspng.com-12.png";
        
        // 2. الكلمة الخلفية العملاقة (نأخذ أول كلمة من اسم المنتج)
        const bigText = productName.split(' ')[0].toUpperCase() || "BRAND";

        // 3. تحضير مصفوفة المنتجات (Logic) لربط الألوان بالصور
        // سنحول بيانات الـ Builder إلى هيكل البيانات الذي يفهمه قالب Nike
        let productsData = [];

        if (variants && variants.colors && variants.colors.items.length > 0) {
            productsData = variants.colors.items.map((color, index) => {
                // تحديد الصورة: إذا اختار المستخدم صورة للون نضعها، وإلا نضع الصورة الرئيسية
                let variantImg = mainImg;
                if (color.imgIndex !== "" && color.imgIndex !== null && imgArray[color.imgIndex]) {
                    variantImg = imgArray[color.imgIndex];
                }

                return {
                    id: index,
                    title: `${productName} - ${color.name}`,
                    price: productPrice, // يمكن تعديل السعر إذا كان مختلفاً
                    color: color.hex,
                    img: variantImg,
                    // إنشاء تدرج لوني احترافي بناءً على لون المنتج
                    gradient: `radial-gradient(circle at center, ${color.hex} 0%, #000000 90%)`
                };
            });
        } else {
            // منتج افتراضي إذا لم توجد متغيرات
            productsData.push({
                id: 0,
                title: productName,
                price: productPrice,
                color: "#005CA9",
                img: mainImg,
                gradient: "radial-gradient(circle at center, #005CA9 0%, #010205 80%)"
            });
        }

        // تحويل المصفوفة لنص JSON ليتم حقنه داخل السكريبت
        const productsJSON = JSON.stringify(productsData);

        // --- القالب الاحترافي (Nike Style Template) ---
        // تم نسخ هذا الكود وتعديله ليقبل المتغيرات من ملفك المرفق ai_studio_code (30).html
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName}</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary-color: ${productsData[0].color};
            --bg-gradient: ${productsData[0].gradient};
            --text-color: #ffffff;
            --big-text-color: rgba(255, 255, 255, 0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }

        body {
            background: var(--bg-gradient);
            color: var(--text-color);
            height: 100vh;
            overflow: hidden;
            transition: background 0.8s ease;
        }

        nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 80px; z-index: 100; position: relative; }
        .logo img { height: 50px; object-fit: contain; filter: brightness(0) invert(1); } /* تحويل اللوجو للأبيض */
        
        .nav-links { list-style: none; display: flex; gap: 30px; }
        .nav-links li a { color: #fff; text-decoration: none; font-size: 14px; text-transform: uppercase; font-weight: 500; letter-spacing: 1px; transition: 0.3s; }
        .nav-links li a:hover { border-bottom: 2px solid #fff; padding-bottom: 5px; }

        .container { position: relative; display: flex; justify-content: space-between; align-items: center; height: calc(100vh - 80px); padding: 0 80px; }

        .big-text {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-family: 'Anton', sans-serif; font-size: 25vw; color: var(--big-text-color);
            z-index: 1; white-space: nowrap; letter-spacing: 10px; pointer-events: none;
        }

        .text-section { z-index: 10; width: 30%; }
        .product-title { font-size: 3.5rem; font-weight: 700; margin-bottom: 10px; line-height: 1.1; opacity: 0; animation: slideUp 0.8s forwards; }
        .price { font-size: 2rem; font-weight: 300; margin-bottom: 30px; display: block; opacity: 0; animation: slideUp 0.8s 0.2s forwards; }
        
        .btn {
            padding: 15px 40px; background: transparent; border: 2px solid #fff; color: #fff;
            font-weight: 600; cursor: pointer; text-transform: uppercase; border-radius: 30px;
            transition: 0.3s; display: inline-flex; align-items: center; gap: 10px;
            opacity: 0; animation: slideUp 0.8s 0.4s forwards;
        }
        .btn:hover { background: #fff; color: var(--primary-color); }

        /* تعديل CSS للصورة لتكون متجاوبة ومناسبة لأي منتج */
        .image-section {
            z-index: 20; position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -60%) rotate(-15deg);
            width: 45vw; max-width: 600px;
            transition: all 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55);
        }
        .image-section img { width: 100%; height: auto; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5)); }

        .details-section { z-index: 10; width: 25%; text-align: right; opacity: 0; animation: slideUp 0.8s 0.6s forwards; }
        .description { font-size: 14px; line-height: 1.6; margin-bottom: 20px; color: #ddd; }

        .controls {
            position: absolute; bottom: 50px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 20px; z-index: 30;
        }
        .control-btn {
            width: 50px; height: 50px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3);
            background: rgba(255,255,255,0.1); color: #fff; display: flex; justify-content: center; align-items: center;
            cursor: pointer; transition: 0.3s; backdrop-filter: blur(5px);
        }
        .control-btn:hover { background: #fff; color: #000; transform: scale(1.1); }

        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
            nav { padding: 20px; }
            .nav-links { display: none; }
            .container { flex-direction: column; text-align: center; padding-top: 20px; height: auto; }
            .image-section { width: 80vw; position: relative; left: auto; top: auto; transform: rotate(-5deg); margin: 40px 0; }
            .text-section, .details-section { width: 100%; text-align: center; }
            .big-text { font-size: 35vw; top: 30%; }
            .controls { position: relative; bottom: auto; margin-top: 30px; margin-bottom: 30px; }
            .product-title { font-size: 2.5rem; }
        }
    </style>
</head>
<body>

    <nav>
        <div class="logo">
            ${brandLogo ? `<img src="${brandLogo}" alt="Brand Logo">` : '<h2 style="color:white;">BRAND</h2>'}
        </div>
        <ul class="nav-links">
            <li><a href="#">Home</a></li>
            <li><a href="#">Products</a></li>
            <li><a href="#">About</a></li>
            <li><a href="#">Contact</a></li>
        </ul>
        <div class="nav-icons" style="color: white; font-size: 1.2rem;">
            <i class="fas fa-shopping-bag"></i>
        </div>
    </nav>

    <div class="big-text">${bigText}</div>

    <div class="container">
        <div class="text-section">
            <h1 class="product-title" id="title">${productsData[0].title}</h1>
            <span class="price" id="price">${productsData[0].price}</span>
            <button class="btn">
                Add to Cart <i class="fas fa-cart-plus"></i>
            </button>
        </div>

        <div class="image-section">
            <img src="${productsData[0].img}" alt="Product Image" id="shoe-img">
        </div>

        <div class="details-section">
            <h3 style="margin-bottom: 10px; color: white;">Description</h3>
            <p class="description">
                ${productFeatures}
            </p>
            <div style="margin-top: 20px;">
                <span style="display:block; font-size: 12px; color: #aaa; margin-bottom: 5px;">Select Variant:</span>
                <div id="dots-container" style="display: flex; justify-content: flex-end; gap: 10px;">
                    </div>
            </div>
        </div>

        <div class="controls">
            <div class="control-btn" onclick="changeProduct('prev')"><i class="fas fa-arrow-left"></i></div>
            <div class="control-btn" onclick="changeProduct('next')"><i class="fas fa-arrow-right"></i></div>
        </div>
    </div>

    <script>
        // حقن البيانات الحقيقية من الخادم هنا
        const products = ${productsJSON};

        let currentIndex = 0;
        
        const titleEl = document.getElementById('title');
        const priceEl = document.getElementById('price');
        const shoeImg = document.getElementById('shoe-img');
        const root = document.documentElement;
        const dotsContainer = document.getElementById('dots-container');

        // إنشاء نقاط اختيار الألوان
        function renderDots() {
            dotsContainer.innerHTML = '';
            products.forEach((p, idx) => {
                const dot = document.createElement('div');
                dot.style.width = '20px';
                dot.style.height = '20px';
                dot.style.borderRadius = '50%';
                dot.style.backgroundColor = p.color;
                dot.style.border = idx === currentIndex ? '2px solid white' : 'none';
                dot.style.cursor = 'pointer';
                dot.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
                dot.onclick = () => {
                    // تحديد الاتجاه بناء على الفهرس
                    const dir = idx > currentIndex ? 'next' : 'prev';
                    // تعيين الفهرس المطلوب مباشرة ولكن عبر دالة التغيير للحصول على الانيميشن
                    // سنقوم بعمل خدعة بسيطة: تحديث المتغير ثم استدعاء الدالة
                    currentIndex = idx; 
                    // نعيد الفهرس خطوة للوراء أو للأمام لنستخدم دالة التغيير (اختياري)
                    // أو ننادي دالة التحديث مباشرة. هنا سنقوم بالتحديث المباشر:
                    updateUI(idx);
                };
                dotsContainer.appendChild(dot);
            });
        }
        
        renderDots();

        function updateUI(index) {
            const product = products[index];

            // 1. حركة الخروج
            shoeImg.style.transform = "translate(-200%, -60%) rotate(-45deg)";
            shoeImg.style.opacity = "0";

            setTimeout(() => {
                // 2. تحديث البيانات
                root.style.setProperty('--primary-color', product.color);
                root.style.setProperty('--bg-gradient', product.gradient);
                
                titleEl.textContent = product.title;
                priceEl.textContent = product.price;
                shoeImg.src = product.img;

                // تحديث النقاط
                renderDots();

                // 3. إعادة التموضع للدخول (من الجهة المقابلة)
                shoeImg.style.transition = "none";
                shoeImg.style.transform = "translate(200%, -60%) rotate(45deg)";
                
                setTimeout(() => {
                    // 4. حركة الدخول
                    shoeImg.style.transition = "all 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)";
                    shoeImg.style.transform = "translate(-50%, -60%) rotate(-15deg)";
                    shoeImg.style.opacity = "1";
                }, 50);

            }, 400);
        }

        function changeProduct(direction) {
            if (direction === 'next') {
                currentIndex = (currentIndex + 1) % products.length;
            } else {
                currentIndex = (currentIndex - 1 + products.length) % products.length;
            }
            updateUI(currentIndex);
        }
    </script>
</body>
</html>
        `;

        // إرجاع النتيجة
        res.status(200).json({
            html: htmlTemplate,
            liquid_code: htmlTemplate, // يمكن توليد ليكويد لاحقاً إذا أردت
            schema: {}
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
