// api/shopify_publish.js - الآن يستخدم Access Token الخاص بالمتجر من MongoDB
import fetch from 'node-fetch';
import { connectToDatabase } from './db.js'; // استيراد دالة الاتصال بقاعدة البيانات

// تم إزالة قراءة SHOPIFY_ACCESS_TOKEN من متغيرات البيئة (انتقال لـ Public App)

/**
 * دالة تقوم بجلب Access Token الخاص بالمتجر من MongoDB.
 * @param {string} shop - اسم المتجر.
 * @returns {string} - Access Token.
 */
async function getShopAccessToken(shop) {
    const { db } = await connectToDatabase();
    const shopRecord = await db.collection('shops').findOne({ shop: shop });

    if (!shopRecord || !shopRecord.accessToken) {
        // إذا لم يكن رمز الوصول موجوداً، هذا يعني أن التطبيق لم يثبت بعد
        throw new Error("APP_NOT_INSTALLED"); 
    }
    return shopRecord.accessToken;
}

/**
 * دالة تقوم بنشر Section جديد كملف asset في متجر Shopify.
 */
async function createShopifySection(shop, liquid_code, schema) {
    
    // 1. جلب Access Token الخاص بهذا المتجر من قاعدة البيانات
    const accessToken = await getShopAccessToken(shop);
    
    // إنشاء اسم ملف فريد للقسم
    const sectionFilename = `smartpage-section-${Date.now()}`;
    
    // تجميع كود Liquid مع الـ Schema لإنشاء ملف .liquid الكامل
    const finalSectionLiquid = liquid_code + `\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}`;

    // نقطة نهاية API لنشر الأصول (Assets)
    const assetUrl = `https://${shop}/admin/api/2023-10/themes/current/assets.json`;
    
    const headers = {
        'X-Shopify-Access-Token': accessToken, // نستخدم الرمز الخاص بالمتجر من MongoDB
        'Content-Type': 'application/json'
    };
    
    const body = JSON.stringify({
        asset: {
            key: `sections/${sectionFilename}.liquid`,
            value: finalSectionLiquid
        }
    });

    const response = await fetch(assetUrl, {
        method: 'PUT',
        headers: headers,
        body: body,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        console.error("Shopify API Error:", data); 
        throw new Error(data.errors || `Shopify API error: ${response.status} - Could not publish section.`);
    }
    
    return { filename: `${sectionFilename}.liquid`, asset: data.asset };
}

/**
 * معالج طلب API الرئيسي لـ Vercel.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { shop, liquid_code, schema } = req.body;
    
    if (!shop || !liquid_code || !schema) {
        return res.status(400).json({ error: 'Missing shop, liquid_code, or schema.' });
    }

    try {
        console.log('Starting publish process for shop:', shop);
        
        // تنفيذ عملية النشر
        const result = await createShopifySection(shop, liquid_code, schema);
        
        console.log('Section published successfully:', result.filename);
        
        // إرسال استجابة نجاح
        res.status(200).json({ 
            success: true, 
            message: `Section '${result.filename}' published successfully!`,
            filename: result.filename,
            shop: shop
        });

    } catch (error) {
        console.error("Publishing error:", error);
        
        // ⚠️ التعامل مع حالة "التطبيق غير مثبت" (Public App Flow)
        if (error.message.includes("APP_NOT_INSTALLED")) {
            return res.status(403).json({
                error: "يرجى تثبيت التطبيق أولاً للمتجر الحالي. انقر على 'إضافة صفحتي على Shopify' لبدء التثبيت.",
                action_required: true // إرسال علامة للواجهة الأمامية لبدء OAuth
            });
        }

        // إرجاع خطأ 500 للمستخدم مع رسالة الخطأ
        res.status(500).json({ 
            success: false, 
            error: `فشل النشر: ${error.message}` 
        });
    }
}
