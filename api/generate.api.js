// api/generate.api.js - كود بسيط للتجربة
export default function handler(request, response) {
  response.status(200).json({
    message: "✅ API is working!",
    method: request.method,
    timestamp: new Date().toISOString()
  });
}
