// api/shopify_install.js - التطبيق العام (Public App) - بدء عملية المصادقة (OAuth)

import { URLSearchParams } from 'url';

// يجب إضافة هذه المتغيرات الجديدة في Vercel
const { 
    HOST, // مثال: https://smartpage-ai.vercel.app
    SHOPIFY_API_KEY, // Client ID من Partner Dashboard
    SCOPES // مثال: write_themes,read_themes
} = process.env;

export default function handler(req, res) {
    
    // هذا المسار يجب أن يتم الوصول إليه فقط عن طريق طلب GET من المتصفح لبدء التثبيت
    if (req.method !== 'GET') {
        return res.status(405).send("Method not allowed. Use GET to start installation.");
    }
    
    const shop = req.query.shop; // اسم المتجر (مثال: test-store.myshopify.com)
    
    // التحقق من المتغيرات الأساسية
    if (!shop || !SHOPIFY_API_KEY || !SCOPES || !HOST) {
        console.error("Missing required environment variables or query parameter.");
        return res.status(500).send("Missing required parameters (shop query) or environment variables (SHOPIFY_API_KEY, SCOPES, HOST).");
    }

    // 1. بناء رابط المصادقة (OAuth URL) لمتجر Shopify
    const params = new URLSearchParams({
        client_id: SHOPIFY_API_KEY,
        scope: SCOPES,
        // مسار العودة بعد التثبيت، يجب أن يكون مطابقاً لما تم تعيينه في Partner Dashboard
        redirect_uri: `${HOST}/api/shopify_callback`, 
        // رمز عشوائي للحماية من هجمات CSRF (مهم جداً!)
        state: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) 
    });

    const installUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;
    
    console.log('Starting OAuth Install:', installUrl);

    // 2. توجيه المستخدم إلى صفحة تثبيت Shopify الرسمية
    res.redirect(installUrl);
}
