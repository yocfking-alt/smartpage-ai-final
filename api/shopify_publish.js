// api/shopify_publish.js - نسخة معدلة وآمنة لتطبيق Custom App
import fetch from 'node-fetch'; 

// ✅ قراءة الـ Access Token من متغيرات البيئة (هذا هو التعديل الرئيسي)
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * دالة تقوم بنشر Section جديد كملف asset في متجر Shopify.
 * @param {string} shop - اسم المتجر (مثال: my-store.myshopify.com)
 * @param {string} liquid_code - كود Liquid الخاص بالقسم (Section)
 * @param {object} schema - كائن Schema JSON الخاص بالقسم
 * @returns {object} - كائن يحتوي على اسم الملف ونتائج النشر.
 */
async function createShopifySection(shop, liquid_code, schema) {
    
    // التحقق من وجود رمز الوصول قبل بدء الاتصال
    if (!SHOPIFY_ACCESS_TOKEN) {
        throw new Error("SHOPIFY_ACCESS_TOKEN is missing. Please set it in Vercel Environment Variables.");
    }
    
    // إنشاء اسم ملف فريد للقسم
    const sectionFilename = `smartpage-section-${Date.now()}`;
    
    // تجميع كود Liquid مع الـ Schema لإنشاء ملف .liquid الكامل
    const finalSectionLiquid = liquid_code + `\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}`;

    // نقطة نهاية API لنشر الأصول (Assets)
    const assetUrl = `https://${shop}/admin/api/2023-10/themes/current/assets.json`;
    
    // جسم الطلب (Body)
    const assetBody = {
        "asset": {
            "key": `sections/${sectionFilename}.liquid`, // المسار في مجلد sections
            "value": finalSectionLiquid
        }
    };

    console.log('Publishing section to:', assetUrl);
    
    const response = await fetch(assetUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            // استخدام الـ Access Token كصلاحية الوصول
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 
        },
        body: JSON.stringify(assetBody),
    });

    const data = await response.json();
    
    // التحقق من استجابة API (إذا لم تكن 2xx)
    if (!response.ok) {
        // تسجيل الخطأ لتظهر رسالة API في سجلات Vercel
        console.error("Shopify API Error:", data); 
        throw new Error(data.errors || `Shopify API error: ${response.status}`);
    }
    
    return { filename: sectionFilename, asset: data.asset };
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
        // إرجاع خطأ 500 للمستخدم مع رسالة الخطأ
        res.status(500).json({ 
            error: error.message || 'Failed to publish section to Shopify.',
            details: error.message
        });
    }
}
