// api/shopify_callback.js
import fetch from 'node-fetch'; 
import { connectToDatabase } from './db';

export default async function handler(req, res) {
  const { code, shop } = req.query;
  // قراءة مفاتيحك السرية من Vercel
  // تم إضافة HOST لضمان وجود نطاق تطبيقك الخارجي لعملية التوجيه
  const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, HOST } = process.env;

  if (!code || !shop) {
    return res.status(400).send("Missing required parameters in callback.");
  }
  
  if (!SHOPIFY_API_SECRET || !HOST) {
    return res.status(500).send("Missing required environment variables (SHOPIFY_API_SECRET or HOST).");
  }

  // 1. بناء رابط استبدال الرمز (Token Exchange URL)
  const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
  
  const body = JSON.stringify({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  });

  try {
    // طلب Access Token من Shopify
    const response = await fetch(accessTokenRequestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const data = await response.json();

    if (data.error) {
      console.error('Shopify Access Token Error:', data);
      return res.status(500).send('Failed to get Access Token from Shopify.');
    }

    const accessToken = data.access_token;

    // 2. حفظ Access Token في قاعدة بيانات MongoDB
    const { db } = await connectToDatabase();
    
    // حفظ البيانات في مجموعة (Collection) باسم 'tokens'
    await db.collection('tokens').updateOne(
      { shop: shop },
      { $set: { accessToken: accessToken, installDate: new Date() } },
      { upsert: true } // أنشئ السجل إذا لم يكن موجوداً
    );

    // *************************************************************
    // 3. التوجيه النهائي: إرسال العميل إلى صفحة إتمام النشر الخارجية
    // تم التعديل للتوجيه إلى publish_finish.html على نطاق تطبيقك (HOST)
    // *************************************************************
    res.redirect(`${HOST}/publish_finish.html?shop=${shop}`); 

  } catch (error) {
    console.error('Shopify Callback Server Error:', error);
    res.status(500).send('Internal Server Error during token exchange or database operation.');
  }
}
