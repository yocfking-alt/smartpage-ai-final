import { URLSearchParams } from 'url';

const { HOST, SHOPIFY_API_KEY, SCOPES } = process.env;

export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).send("Method not allowed. Use GET to start installation.");
    }
    
    const shop = req.query.shop;
    const data_key = req.query.data_key || null;
    
    if (!shop || !SHOPIFY_API_KEY || !SCOPES || !HOST) {
        console.error("Missing required parameters.");
        return res.status(500).send("Missing required parameters.");
    }

    // إنشاء state مشفر يحتوي على data_key
    const stateObject = {
        random: Math.random().toString(36).substring(2, 15),
        data_key: data_key,
        timestamp: Date.now()
    };
    
    const encodedState = Buffer.from(JSON.stringify(stateObject)).toString('base64');
    
    const params = new URLSearchParams({
        client_id: SHOPIFY_API_KEY,
        scope: SCOPES,
        redirect_uri: `${HOST}/api/shopify_callback`,
        state: encodedState
    });

    const installUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;
    
    console.log('Starting OAuth with data_key:', data_key ? 'YES' : 'NO');
    res.redirect(installUrl);
}
