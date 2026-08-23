const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: 'Method Not Allowed',
    };
  }

  const query = event.queryStringParameters || {};
  const id = query.id || query.url;
  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: 'Missing id parameter',
    };
  }

  const safeFilename = path.basename(id).replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!safeFilename) {
    return {
      statusCode: 400,
      headers,
      body: 'Invalid filename',
    };
  }

  try {
    let imageBuffer = null;

    // 1. Primary storage: Retrieve exact key using Netlify Blobs "uploads" store
    try {
      const { getStore } = require('@netlify/blobs');
      const store = getStore('uploads');
      const blobData = await store.get(safeFilename, { type: 'arrayBuffer' });
      if (blobData) {
        imageBuffer = Buffer.from(blobData);
      }
    } catch (blobErr) {
      console.warn('Netlify Blobs fetch failed, trying local storage fallback:', blobErr.message);
    }

    // 2. Local dev fallback
    if (!imageBuffer) {
      const tmpPath = path.join('/tmp', safeFilename);
      const uploadsPath = path.join(process.cwd(), 'uploads', safeFilename);

      if (fs.existsSync(tmpPath)) {
        imageBuffer = fs.readFileSync(tmpPath);
      } else if (fs.existsSync(uploadsPath)) {
        imageBuffer = fs.readFileSync(uploadsPath);
      }
    }

    if (!imageBuffer) {
      return {
        statusCode: 404,
        headers,
        body: 'File not found',
      };
    }

    const responseHeaders = {
      ...headers,
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };

    const isDownload = query.download === '1' || query.download === 'true';

    if (isDownload) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const uniqueTag = safeFilename.replace(/^strip_/, '').replace(/\.png$/, '');
      const uniqueFilename = `GestureSnap-PhotoStrip-${dateStr}-${uniqueTag}.png`;

      responseHeaders['Content-Disposition'] = `attachment; filename="${uniqueFilename}"`;
    } else {
      // Preview mode: return Content-Disposition: inline
      responseHeaders['Content-Disposition'] = 'inline';
    }

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: imageBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Download Netlify function error:', error);
    return {
      statusCode: 500,
      headers,
      body: 'Internal Server Error',
    };
  }
};
