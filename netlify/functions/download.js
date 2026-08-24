try { require('dotenv').config(); } catch (e) {}
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.');
    return {
      statusCode: 500,
      headers,
      body: 'Server configuration error',
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Retrieve file buffer from Supabase Storage public "GestureSnap" bucket
    const { data: blobData, error: downloadError } = await supabase.storage
      .from('GestureSnap')
      .download(safeFilename);

    if (downloadError || !blobData) {
      console.error('Supabase Storage download error:', downloadError ? downloadError.message : 'File not found');
      return {
        statusCode: 404,
        headers,
        body: 'File not found',
      };
    }

    const arrayBuffer = await blobData.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';

    const responseHeaders = {
      ...headers,
      'Content-Type': contentType,
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
      // Preview mode: display image inline in browser
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
