import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const image = body?.image;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const filename = `strip_${Date.now()}.png`;
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    let blobUrl = null;

    // Try Vercel Blob if token is available
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import('@vercel/blob');
        const blob = await put(`uploads/${filename}`, buffer, {
          access: 'public',
          contentType: 'image/png',
        });
        blobUrl = blob.url; // Exact public URL from Vercel Blob
      } catch (blobErr) {
        console.warn('Vercel Blob upload failed or token missing, using local fallback:', blobErr.message);
      }
    }

    // Always attempt local filesystem fallback (/tmp for serverless, uploads/ for local dev)
    try {
      const tmpPath = path.join('/tmp', filename);
      fs.writeFileSync(tmpPath, buffer);
    } catch (e) {
      // Ignored if /tmp is not available
    }

    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      }
    } catch (e) {
      // Ignored in read-only serverless environments
    }

    // Determine host for QR URL dynamically using request headers
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:8080';

    // When blobUrl exists, encode the exact public Blob URL directly in the download URL
    let downloadPath = `/download.html?id=${filename}`;
    if (blobUrl) {
      downloadPath = `/download.html?url=${encodeURIComponent(blobUrl)}`;
    }
    const fullQrUrl = `${protocol}://${host}${downloadPath}`;

    return res.status(200).json({
      success: true,
      id: filename,
      blobUrl: blobUrl,
      downloadUrl: downloadPath,
      fullQrUrl: fullQrUrl
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
