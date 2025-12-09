// api/db.js
import { MongoClient } from 'mongodb';

// المفسر سيقرأ هذا من متغيرات البيئة في Vercel
const MONGODB_URI = process.env.MONGO_DB_URL;
const DB_NAME = 'shopify-gemini-db'; 

if (!MONGODB_URI) {
  throw new Error('Please define the MONGO_DB_URL environment variable.');
}

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // ربط قاعدة البيانات
  const client = await MongoClient.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// أضف هذه الدالة في نهاية db.js
export async function initDatabase() {
    const { db } = await connectToDatabase();
    
    try {
        // إنشاء collection للبيانات المؤقتة مع TTL
        await db.collection('temp_sections').createIndex(
            { created_at: 1 },
            { expireAfterSeconds: 1800 } // 30 دقيقة
        );
        
        console.log('Database collections initialized');
    } catch (error) {
        console.warn('Could not create indexes:', error.message);
    }
}
