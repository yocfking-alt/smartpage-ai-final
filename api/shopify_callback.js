import fetch from 'node-fetch';
import { connectToDatabase } from './db.js';

const { HOST, SHOPIFY_API_KEY, SHOPIFY_API_SECRET } = process.env;

export default async function handler(req, res) {
    const { shop, code, state } = req.query;
    
    if (!shop || !code) {
        return res.status(400).send("Missing shop or authorization code.");
    }
    
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !HOST) {
        return res.status(500).send("Missing environment variables.");
    }

    try {
        // فك تشفير state
        let data_key = null;
        if (state) {
            try {
                const stateDecoded = Buffer.from(state, 'base64').toString();
                const stateObj = JSON.parse(stateDecoded);
                data_key = stateObj.data_key;
                console.log('Decoded data_key:', data_key);
            } catch (e) {
                console.warn('Could not decode state:', e.message);
            }
        }
        
        // استبدال الكود بـ Access Token
        const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;
        
        const response = await fetch(accessTokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: SHOPIFY_API_KEY,
                client_secret: SHOPIFY_API_SECRET,
                code
            }),
        });

        const tokenData = await response.json();
        
        if (!response.ok || tokenData.error) {
            console.error("Token exchange failed:", tokenData);
            return res.status(500).send(`Failed to get access token: ${tokenData.error_description || 'Unknown error'}`);
        }
        
        const accessToken = tokenData.access_token;
        const scopes = tokenData.scope;

        if (!accessToken) {
            throw new Error("Access token not received.");
        }

        // حفظ Access Token في قاعدة البيانات
        const { db } = await connectToDatabase();
        await db.collection('shops').updateOne(
            { shop: shop },
            { $set: { 
                accessToken, 
                scopes, 
                installedAt: new Date(),
                lastAuth: new Date()
            }},
            { upsert: true }
        );
        
        console.log(`Access token stored for shop: ${shop}`);
        
        // تحديث حالة البيانات إذا كان هناك data_key
        if (data_key) {
            await db.collection('temp_sections').updateOne(
                { data_key, shop },
                { $set: { 
                    status: 'oauth_complete',
                    oauth_completed_at: new Date()
                }}
            );
        }
        
        // التوجيه إلى صفحة النشر
        const redirectUrl = `${HOST}/publish_finish.html?shop=${encodeURIComponent(shop)}${data_key ? `&data_key=${data_key}` : ''}`;
        res.redirect(redirectUrl);

    } catch (error) {
        console.error("Callback handler error:", error);
        res.status(500).send(`Server error: ${error.message}`);
    }
}
