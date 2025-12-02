// api/shopify_callback.js - تطبيق Public App (OAuth)
import fetch from 'node-fetch';
import { connectToDatabase } from './db.js'; // لربط قاعدة البيانات وتخزين Access Token

// يجب إضافة هذه المتغيرات في Vercel (SHOPIFY_API_KEY و SHOPIFY_API_SECRET)
const { 
    HOST, 
    SHOPIFY_API_KEY, 
    SHOPIFY_API_SECRET 
} = process.env;

export default async function handler(req, res) {
    // نستقبل shop (اسم المتجر) و code (كود المصادقة) من Shopify
    const { shop, code } = req.query; 

    // التحقق من وجود البيانات الأساسية
    if (!shop || !code) {
        return res.status(400).send("Installation failed. Missing shop or authorization code.");
    }
    
    // التحقق من المتغيرات السرية
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !HOST) {
        console.error("Missing required environment variables.");
        return res.status(500).send("Missing required environment variables (SHOPIFY_API_KEY, SHOPIFY_API_SECRET, HOST).");
    }

    // 1. بناء طلب مبادلة الكود بـ Access Token
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
    
    const body = JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code, // كود المصادقة الذي أرسله Shopify
    });

    try {
        console.log(`Exchanging code for access token for shop: ${shop}`);
        
        // إرسال الطلب إلى Shopify
        const response = await fetch(accessTokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });

        const tokenData = await response.json();

        if (!response.ok || tokenData.error) {
            console.error("Token exchange failed:", tokenData.error_description || tokenData.error);
            // إرجاع خطأ إلى المستخدم
            return res.status(500).send(`Failed to get access token: ${tokenData.error_description || 'Unknown error'}`);
        }
        
        // 2. الحصول على رمز الوصول (Access Token)
        const accessToken = tokenData.access_token;
        const scopes = tokenData.scope; 

        if (!accessToken) {
            throw new Error("Access token not received in response from Shopify.");
        }

        // 3. تخزين رمز الوصول في قاعدة البيانات
        const { db } = await connectToDatabase(); 
        const collection = db.collection('shops'); 

        // تحديث أو إدخال رمز الوصول للمتجر
        await collection.updateOne(
            { shop: shop },
            { $set: { accessToken, scopes, installedAt: new Date() } },
            { upsert: true } 
        );
        
        console.log(`Access token stored successfully for shop: ${shop}`);

        // 4. التوجيه إلى صفحة الإكمال حيث سيتم النشر
        const successUrl = `${HOST}/publish_finish.html?shop=${shop}`;
        res.redirect(successUrl);

    } catch (error) {
        console.error("Callback handler error:", error);
        res.status(500).send(`Server error during OAuth process: ${error.message}`);
    }
}
