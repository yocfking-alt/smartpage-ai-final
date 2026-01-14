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
    if (!GEMINI_API_KEY) throw new Error('API Key missing');

    const {
      productName,
      productFeatures,
      productPrice,
      productCategory,
      targetAudience,
      designDescription,
      shippingOption,
      customShippingPrice,
      customOffer,
      productImages,
      brandLogo,
      variants
    } = req.body;

    const productImageArray = productImages || [];
    const finalProductImages = productImageArray.length ? productImageArray : ['https://via.placeholder.com/800x1000/4ECDC4/FFFFFF?text=Product+Image'];
    const finalBrandLogo = brandLogo || 'https://via.placeholder.com/150x50/FFFFFF/333333?text=Logo';

    // 1) نصّ الشحن والعرض
    const shippingText = shippingOption === 'free' ? 'شحن مجاني' : `الشحن: ${customShippingPrice}`;
    const offerText = customOffer ? `عرض خاص: ${customOffer}` : '';

    // 2) بناء بيانات الألوان (للتبديل والتدرّجات)
    let colorData = [];
    if (variants?.colors?.enabled && variants.colors.items.length) {
      colorData = variants.colors.items.map((c, idx) => {
        const imgIndex = c.imgIndex !== '' && c.imgIndex !== null ? parseInt(c.imgIndex) : 0;
        return {
          name: c.name,
          hex: c.hex,
          mainImage: finalProductImages[imgIndex] || finalProductImages[0],
          bgStart: lightenColor(c.hex, 30),
          bgEnd: darkenColor(c.hex, 20),
          accent: c.hex
        };
      });
    } else {
      // افتراضي: تركوازي
      colorData = [{
        name: 'TURQUOISE',
        hex: '#61e2e6',
        mainImage: finalProductImages[0],
        bgStart: '#4abdc2',
        bgEnd: '#2d849a',
        accent: '#61e2e6'
      }];
    }

    // 3) بناء خيارات المقاسات
    let sizes = [];
    if (variants?.sizes?.enabled && variants.sizes.items.length) {
      sizes = variants.sizes.items.map(s => s.name);
    } else {
      sizes = ['S', 'M', 'L', 'XL'];
    }

    // 4) دمج كل شيء في قالب te.html
    const teLikeTemplate = buildTeLikeTemplate({
      productName,
      productPrice,
      colorData,
      sizes,
      finalBrandLogo,
      shippingText,
      offerText,
      productFeatures
    });

    // 5) Liquid مشابه لكن بصيغة Shopify
    const liquidCode = buildLiquidVersion({
      productName,
      productPrice,
      colorData,
      sizes,
      finalBrandLogo,
      shippingText,
      offerText,
      productFeatures
    });

    // 6) الإخراج
    res.status(200).json({
      html: teLikeTemplate,
      liquid_code: liquidCode,
      schema: {
        name: 'AI Landing Page (Te Style)',
        settings: []
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
}

// ------------------- دوال مساعدة -------------------

function buildTeLikeTemplate({ productName, productPrice, colorData, sizes, finalBrandLogo, shippingText, offerText, productFeatures }) {
  const firstColor = colorData[0];
  const sizeButtons = sizes.map(s => `<button class="size-btn">${s}</button>`).join('');
  const colorSwatches = colorData.map((c, i) =>
    `<div class="color-swatch swatch-${i}" data-index="${i}" style="background:${c.hex};"></div>`
  ).join('');
  const thumbCards = colorData.slice(1).map((c, i) =>
    `<div class="thumbnail-card" data-index="${i + 1}"><img src="${c.mainImage}" alt="${c.name}"></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient-start: ${firstColor.bgStart};
      --bg-gradient-end: ${firstColor.bgEnd};
      --accent-color: ${firstColor.accent};
      --text-light: #ffffff;
      --text-dim: rgba(255, 255, 255, 0.7);
      --font-main: 'Montserrat', sans-serif;
    }
    *{margin:0;padding:0;box-sizing:border-box;}
    body,html{height:100%;font-family:var(--font-main);color:var(--text-light);overflow-x:hidden;background:linear-gradient(135deg,var(--bg-gradient-start),var(--bg-gradient-end));display:flex;justify-content:center;align-items:center;padding:20px;transition:background 0.6s ease;}
    .container{width:100%;max-width:1400px;height:95vh;min-height:700px;background:rgba(255,255,255,0.05);border-radius:30px;backdrop-filter:blur(10px);border:2px solid rgba(255,255,255,0.1);padding:30px 50px;position:relative;display:flex;flex-direction:column;}
    header{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;flex-wrap:wrap;}
    .logo{font-weight:800;font-size:1.5rem;display:flex;align-items:center;}
    .logo span{margin-right:8px;color:var(--accent-color);}
    .nav-links{display:flex;gap:30px;list-style:none;flex-wrap:wrap;}
    .nav-links li a{text-decoration:none;color:var(--text-dim);font-weight:600;font-size:.9rem;transition:color .3s;}
    .nav-links li a:hover{color:var(--text-light);}
    .user-actions{display:flex;gap:15px;flex-wrap:wrap;}
    .icon-btn{background:rgba(255,255,255,0.1);border:none;padding:10px 15px;border-radius:20px;color:var(--text-light);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;}
    .main-content{display:grid;grid-template-columns:1fr 1.2fr 0.4fr;height:100%;align-items:center;position:relative;}
    .product-details{z-index:5;}
    .brand-label{background:rgba(255,255,255,0.1);padding:5px 15px;border-radius:15px;font-size:.8rem;font-weight:600;display:inline-block;margin-bottom:20px;}
    .product-title{font-size:3.5rem;font-weight:800;line-height:1.1;margin-bottom:30px;text-transform:uppercase;}
    .product-title span{display:block;color:var(--accent-color);transition:color .5s ease;}
    .option-group{margin-bottom:25px;}
    .option-label{display:block;font-weight:600;margin-bottom:10px;font-size:.9rem;}
    .size-selector{display:flex;gap:10px;flex-wrap:wrap;}
    .size-btn{width:40px;height:40px;border-radius:12px;border:none;background:rgba(255,255,255,0.1);color:var(--text-light);font-weight:600;cursor:pointer;transition:all .3s;}
    .size-btn.active,.size-btn:hover{background:var(--text-light);color:#333;}
    .color-selector{display:flex;gap:15px;flex-wrap:wrap;}
    .color-swatch{width:35px;height:35px;border-radius:10px;cursor:pointer;position:relative;transition:transform .3s;}
    .color-swatch.active::after{content:'';position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border:2px solid var(--text-light);border-radius:14px;}
    .color-swatch:hover{transform:scale(1.1);}
    .buy-action{display:flex;align-items:center;margin-top:50px;gap:20px;}
    .polygon-btn{width:80px;height:80px;background:transparent;border:2px solid var(--accent-color);clip-path:polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%);display:flex;justify-content:center;align-items:center;cursor:pointer;transition:all .3s;}
    .polygon-btn:hover{background:var(--accent-color);}
    .polygon-btn i{font-size:1.5rem;transform:rotate(-45deg);}
    .price-info{font-weight:600;}
    .price-info span{display:block;font-size:.8rem;color:var(--text-dim);margin-bottom:5px;}
    .price-value{font-size:1.8rem;font-weight:800;}
    .product-showcase{position:relative;height:100%;display:flex;justify-content:center;align-items:center;}
    .bg-shape{position:absolute;top:50%;left:50%;width:80%;height:80%;background:linear-gradient(45deg,var(--accent-color),transparent);opacity:.2;transform:translate(-50%,-50%) rotate(15deg);border-radius:100px;z-index:1;transition:all .6s ease;}
    .main-image{width:110%;height:auto;object-fit:contain;z-index:2;transition:opacity .5s ease,transform .5s ease;}
    .main-image.fade-out{opacity:0;transform:scale(0.95);}
    .sidebar-right{display:flex;flex-direction:column;justify-content:center;align-items:flex-end;height:100%;padding-left:20px;position:relative;}
    .thumbnail-carousel{display:flex;flex-direction:column;gap:20px;margin-bottom:100px;}
    .thumbnail-card{width:120px;height:140px;background:rgba(255,255,255,0.1);border-radius:20px;padding:10px;display:flex;justify-content:center;align-items:center;cursor:pointer;transition:transform .3s;opacity:.6;}
    .thumbnail-card.active-thumb{opacity:1;transform:scale(1.05);border:2px solid var(--accent-color);}
    .thumbnail-card img{width:90%;height:auto;}
    .pagination{position:absolute;top:60%;right:0;font-weight:600;color:var(--text-dim);transform:rotate(90deg);transform-origin:right bottom;white-space:nowrap;}
    .pagination span{color:var(--text-light);}
    .social-proof{position:absolute;bottom:0;right:0;text-align:right;}
    .customer-count{font-size:2rem;font-weight:800;display:block;}
    .customer-label{color:var(--text-dim);font-size:.9rem;}
    @media(max-width:1200px){
      .container{height:auto;min-height:600px;padding:25px 40px;}
      .product-title{font-size:2.8rem;}
      .main-content{grid-template-columns:1fr 1fr 0.5fr;gap:30px;}
      .main-image{width:100%;}
      .thumbnail-card{width:100px;height:120px;}
      .polygon-btn{width:70px;height:70px;}
      .price-value{font-size:1.6rem;}
    }
    @media(max-width:992px){
      .container{padding:20px 30px;min-height:550px;}
      .product-title{font-size:2.2rem;}
      .main-content{grid-template-columns:1fr 1fr 0.4fr;gap:20px;}
      .main-image{width:95%;}
      .thumbnail-carousel{gap:15px;margin-bottom:80px;}
      .thumbnail-card{width:90px;height:110px;}
      .pagination{font-size:.9rem;}
      .customer-count{font-size:1.8rem;}
      .buy-action{margin-top:30px;flex-wrap:wrap;}
      .nav-links{gap:15px;}
    }
    @media(max-width:768px){
      body{padding:10px;}
      .container{padding:15px 20px;min-height:500px;border-radius:20px;}
      header{flex-direction:row;justify-content:space-between;margin-bottom:30px;}
      .logo{font-size:1.2rem;}
      .nav-links{gap:10px;justify-content:center;margin:10px 0;}
      .nav-links li a{font-size:.8rem;}
      .user-actions{gap:10px;}
      .icon-btn{padding:8px 12px;font-size:.8rem;}
      .product-title{font-size:1.8rem;margin-bottom:20px;}
      .main-content{grid-template-columns:1fr 1fr 0.4fr;gap:15px;align-items:start;}
      .product-details{grid-column:1/span 2;}
      .product-showcase{grid-column:1/span 3;grid-row:2;height:300px;margin-top:20px;}
      .sidebar-right{grid-column:3;grid-row:1;padding-left:10px;align-items:flex-end;}
      .main-image{width:85%;}
      .thumbnail-carousel{flex-direction:column;gap:10px;margin-bottom:50px;}
      .thumbnail-card{width:70px;height:85px;}
      .pagination{position:static;transform:none;margin-bottom:10px;order:2;}
      .social-proof{position:static;text-align:right;order:3;}
      .size-btn{width:35px;height:35px;}
      .color-swatch{width:30px;height:30px;}
      .polygon-btn{width:60px;height:60px;}
      .price-value{font-size:1.4rem;}
    }
    @media(max-width:480px){
      .container{padding:12px 15px;min-height:450px;}
      .product-title{font-size:1.5rem;}
      .main-content{grid-template-columns:1fr .8fr .3fr;gap:10px;}
      .product-showcase{height:250px;}
      .main-image{width:80%;}
      .thumbnail-card{width:60px;height:75px;}
      .customer-count{font-size:1.5rem;}
      .price-value{font-size:1.2rem;}
      .option-label{font-size:.8rem;}
    }
  </style>
</head>
<body>
<div class="container">
  <header>
    <div class="logo"><span>✦</span> ridestore</div>
    <ul class="nav-links">
      <li><a href="#">STORY</a></li><li><a href="#">NEW ARRIVALS</a></li><li><a href="#">CLOTHING</a></li><li><a href="#">SHOP</a></li>
    </ul>
    <div class="user-actions">
      <button class="icon-btn">Isla</button>
      <button class="icon-btn">CART 🛒</button>
    </div>
  </header>
  <main class="main-content">
    <section class="product-details">
      <span class="brand-label">MONTEC</span>
      <h1 class="product-title">${productName} <span id="color-title">${colorData[0].name}</span></h1>
      <div class="option-group">
        <span class="option-label">SIZE</span>
        <div class="size-selector">${sizeButtons}</div>
      </div>
      <div class="option-group">
        <span class="option-label">COLOR</span>
        <div class="color-selector">${colorSwatches}</div>
      </div>
      <div class="buy-action">
        <div class="polygon-btn"><i>→</i></div>
        <div class="price-info">
          <span>BUY NOW</span>
          <div class="price-value">${productPrice}</div>
        </div>
      </div>
    </section>
    <section class="product-showcase">
      <div class="bg-shape"></div>
      <img src="${firstColor.mainImage}" alt="${productName}" class="main-image" id="main-product-image">
    </section>
    <section class="sidebar-right">
      <div class="thumbnail-carousel">${thumbCards}</div>
      <div class="pagination"><span id="current-page">01</span> — ${String(colorData.length).padStart(2,'0')}</div>
      <div class="social-proof">
        <span class="customer-count">500K</span>
        <span class="customer-label">Happy Customers</span>
      </div>
    </section>
  </main>
</div>
<script>
  const colorData = ${JSON.stringify(colorData)};
  const productData = colorData.map((c,i)=>({...c,name:c.name,mainImage:c.mainImage,thumbImage:c.mainImage,bgStart:c.bgStart,bgEnd:c.bgEnd,accent:c.accent}));
  const mainImageEl = document.getElementById('main-product-image');
  const colorTitleEl = document.getElementById('color-title');
  const root = document.documentElement;
  const paginationEl = document.getElementById('current-page');
  function updateProductState(idx){
    const data = productData[idx];
    root.style.setProperty('--bg-gradient-start',data.bgStart);
    root.style.setProperty('--bg-gradient-end',data.bgEnd);
    root.style.setProperty('--accent-color',data.accent);
    colorTitleEl.textContent = data.name;
    paginationEl.textContent = String(idx+1).padStart(2,'0');
    mainImageEl.classList.add('fade-out');
    setTimeout(()=>{mainImageEl.src=data.mainImage;mainImageEl.classList.remove('fade-out');},500);
    document.querySelectorAll('.color-swatch').forEach((s,i)=>s.classList.toggle('active',i===idx));
    document.querySelectorAll('.thumbnail-card').forEach((t,i)=>t.classList.toggle('active-thumb',i===idx-1));
  }
  document.querySelectorAll('.color-swatch').forEach((s,i)=>s.addEventListener('click',()=>updateProductState(i)));
  document.querySelectorAll('.thumbnail-card').forEach((t,i)=>t.addEventListener('click',()=>updateProductState(i+1)));
  updateProductState(0);
</script>
</body>
</html>`;
}

function buildLiquidVersion(opts) {
  // نفس القالب أعلاه لكن نضع {{ }} لاحقاً لاحتياجات Shopify
  return opts.liquid_code || `<!-- Shopify Liquid Version -->`;
}

// ------------------- أدوات الألوان -------------------
function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function darkenColor(hex, percent) {
  return lightenColor(hex, -percent);
}
