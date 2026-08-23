const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    let body = {};
    if (event.body) {
      try {
        const rawBody = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf-8')
          : event.body;
        body = JSON.parse(rawBody);
      } catch (e) {
        body = {};
      }
    }

    const image = body.image;
    if (!image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data provided' }),
      };
    }

    const filename = `strip_${Date.now()}.png`;
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Store image in Netlify Blobs storage
    try {
      const { getStore } = require('@netlify/blobs');
      const store = getStore('uploads');
      await store.set(filename, buffer);
    } catch (blobErr) {
      console.warn('Netlify Blobs upload failed or not configured, using local fallback:', blobErr.message);
    }

    // Local filesystem fallback (/tmp for serverless runtime, uploads/ for local dev)
    try {
      const tmpPath = path.join('/tmp', filename);
      fs.writeFileSync(tmpPath, buffer);
    } catch (e) {}

    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      }
    } catch (e) {}

    // Determine host for QR URL dynamically using event headers
    const reqHeaders = event.headers || {};
    const protocol = reqHeaders['x-forwarded-proto'] || 'https';
    const host = reqHeaders['x-forwarded-host'] || reqHeaders['host'] || 'localhost:8888';

    const downloadPath = `/download.html?id=${filename}`;
    const fullQrUrl = `${protocol}://${host}${downloadPath}`;

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        id: filename,
        downloadUrl: downloadPath,
        fullQrUrl: fullQrUrl,
      }),
    };
  } catch (error) {
    console.error('Upload Netlify function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
