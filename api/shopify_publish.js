// api/shopify_publish.js - نسخة معدلة لـ Custom App
import fetch from 'node-fetch'; 

// استخدام الـ Access Token مباشرة (ضع التوكن الحقيقي هنا)
const SHOPIFY_ACCESS_TOKEN = "shpat_2a489cbbf8420&c6a37394bafde645b";

async function createShopifySection(shop, liquid_code, schema) {
    const sectionFilename = `smartpage-section-${Date.now()}`;
    const finalSectionLiquid = liquid_code + `\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}`;

    const assetUrl = `https://${shop}/admin/api/2023-10/themes/current/assets.json`;
    const assetBody = {
        "asset": {
            "key": `sections/${sectionFilename}.liquid`,
            "value": finalSectionLiquid
        }
    };

    console.log('Publishing section to:', assetUrl);
    
    const response = await fetch(assetUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify(assetBody),
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("Shopify API Error:", data);
        throw new Error(data.errors || `Shopify API error: ${response.status}`);
    }
    
    return { filename: sectionFilename, asset: data.asset };
}

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
        
        // النشر المباشر باستخدام الـ Access Token
        const result = await createShopifySection(shop, liquid_code, schema);
        
        console.log('Section published successfully:', result.filename);
        
        res.status(200).json({ 
            success: true, 
            message: `Section '${result.filename}' published successfully!`,
            filename: result.filename,
            shop: shop
        });

    } catch (error) {
        console.error("Publishing error:", error);
        res.status(500).json({ 
            error: error.message || 'Failed to publish section to Shopify.',
            details: 'Check if Access Token has write_themes permission'
        });
    }
}
