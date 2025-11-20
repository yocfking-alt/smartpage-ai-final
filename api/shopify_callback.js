// api/shopify_callback.js - نسخة مبسطة
export default async function handler(req, res) {
  // في Custom App لا نحتاج عملية OAuth
  const { shop } = req.query;
  const { HOST } = process.env;

  if (!shop) {
    return res.status(400).send("Missing shop parameter");
  }

  // توجيه مباشر إلى صفحة النجاح
  res.redirect(`${HOST}/publish_finish.html?shop=${shop}`);
}
