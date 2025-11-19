// api/shopify_install.js

export default function handler(req, res) {
  // قراءة المتغيرات من Vercel:
  const { SHOPIFY_API_KEY, SCOPES, HOST } = process.env;
  const SHOP = req.query.shop; // يتم إرسال اسم المتجر كـ query parameter

  if (!SHOPIFY_API_KEY || !SCOPES || !HOST || !SHOP) {
    // خطأ: لا يمكن إتمام العملية لعدم وجود مفاتيح (تحقق من Vercel)
    return res.status(500).send("Missing required environment variables or shop query parameter.");
  }

  // يجب أن يكون رابط إعادة التوجيه هو الرابط الحي على Vercel
  const redirectUri = `${HOST}/api/shopify_callback`;
  
  // بناء رابط المصادقة الذي يرسل المستخدم إلى Shopify
  const installUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}`;

  // توجيه العميل لبدء المصادقة
  res.redirect(installUrl);
}
