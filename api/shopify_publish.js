// api/shopify_publish.js
import fetch from 'node-fetch'; 
import { connectToDatabase } from './db';

// الوظيفة الأساسية لنشر Section جديد في ثيم المتجر
async function createShopifySection(shop, accessToken, filename, finalSectionLiquid) {
    // API لملفات الثيم (Assets)
    const assetUrl = `https://${shop}/admin/api/2023-10/themes/current/assets.json`;

    const assetBody = {
        "asset": {
            // مسار ملف Section داخل الثيم
            "key": `sections/${filename}.liquid`, 
            "value": finalSectionLiquid
        }
    };

    const response = await fetch(assetUrl, {
        method: 'PUT', // نستخدم PUT لإنشاء أو تحديث الملف
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken, // استخدام المفتاح المحفوظ
        },
        body: JSON.stringify(assetBody),
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("Shopify Asset Creation Error:", data);
        throw new Error(data.errors || "Failed to create Shopify Section asset.");
    }
    return data.asset;
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // البيانات القادمة من builder.html
    const { shop, liquid_code, schema } = req.body;
    
    if (!shop || !liquid_code || !schema) {
        return res.status(400).json({ error: 'Missing shop, liquid_code, or schema.' });
    }
    
    // اسم فريد للمقطع لمنع التكرار
    const sectionFilename = `gemini-section-${Date.now()}`;
    
    // دمج Liquid و Schema في تنسيق Section النهائي الذي تفهمه Shopify
    const finalSectionLiquid = liquid_code + `\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}`;

    try {
        // 1. الحصول على Access Token من قاعدة البيانات
        const { db } = await connectToDatabase();
        const tokenRecord = await db.collection('tokens').findOne({ shop: shop });

        if (!tokenRecord || !tokenRecord.accessToken) {
            return res.status(403).json({ error: 'Access token not found. Please install the app first.' });
        }
        const accessToken = tokenRecord.accessToken;


        // 2. نشر ملف Section في ثيم العميل
        await createShopifySection(shop, accessToken, sectionFilename, finalSectionLiquid);

        
        // 3. النجاح
        res.status(200).json({ 
            success: true, 
            message: `Section '${sectionFilename}' published successfully.`,
            filename: sectionFilename
        });

    } catch (error) {
        console.error("Publishing error:", error);
        res.status(500).json({ error: error.message || 'Failed to publish section to Shopify.' });
    }
}
