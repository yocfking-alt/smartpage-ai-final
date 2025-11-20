// api/shopify_install.js - نسخة معدلة لـ Custom App
export default function handler(req, res) {
  const { HOST } = process.env;
  const SHOP = req.query.shop;

  if (!SHOP) {
    return res.status(400).send("Missing shop parameter");
  }

  // توجيه مباشر إلى صفحة النجاح مع تخزين بيانات المتجر
  const successUrl = `${HOST}/publish_finish.html?shop=${SHOP}`;
  
  console.log('Custom App Install - Redirecting to:', successUrl);
  res.redirect(successUrl);
}
