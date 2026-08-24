const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.');
      return {
        statusCode: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'Server configuration error: Supabase credentials missing.',
        }),
      };
    }

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

    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `strip_${Date.now()}_${uniqueSuffix}.png`;
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const reqHeaders = event.headers || {};
    const getHeader = (name) => {
      const lower = name.toLowerCase();
      for (const key of Object.keys(reqHeaders)) {
        if (key.toLowerCase() === lower) return reqHeaders[key];
      }
      return null;
    };

    const rawHost = getHeader('x-forwarded-host') || getHeader('host') || '';
    const protocol = getHeader('x-forwarded-proto') || 'https';

    const PRODUCTION_ORIGIN = 'https://gesturesnap2.netlify.app';
    let baseUrl = PRODUCTION_ORIGIN;

    if (
      rawHost &&
      !rawHost.includes('localhost') &&
      !rawHost.includes('127.0.0.1') &&
      !rawHost.startsWith('192.168.') &&
      !rawHost.startsWith('10.') &&
      !rawHost.includes('supabase')
    ) {
      baseUrl = `${protocol}://${rawHost}`;
    } else if (process.env.URL && !process.env.URL.includes('localhost')) {
      baseUrl = process.env.URL;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Upload image buffer to Supabase Storage public "GestureSnap" bucket
    const { error: uploadError } = await supabase.storage
      .from('GestureSnap')
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Storage upload failed:', uploadError.message || uploadError);
      return {
        statusCode: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'Supabase Storage upload failed: ' + (uploadError.message || 'Unknown storage error'),
        }),
      };
    }

    // Retrieve public URL for uploaded photo strip
    const { data: publicUrlData } = supabase.storage
      .from('GestureSnap')
      .getPublicUrl(filename);

    const supabasePublicUrl = publicUrlData ? publicUrlData.publicUrl : '';

    const downloadPath = `/download.html?id=${encodeURIComponent(filename)}`;
    const fullQrUrl = `${baseUrl.replace(/\/$/, '')}${downloadPath}`;

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
        supabasePublicUrl: supabasePublicUrl,
      }),
    };
  } catch (error) {
    console.error('Upload Netlify function top-level error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
