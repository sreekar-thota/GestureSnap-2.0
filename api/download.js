import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const { id, url, download } = req.query || {};
  const targetUrl = url || (id && (id.startsWith('http://') || id.startsWith('https://')) ? id : null);

  try {
    let imageBuffer = null;

    // 1. Fetch directly from exact public Vercel Blob URL if provided
    if (targetUrl) {
      try {
        const blobRes = await fetch(targetUrl);
        if (blobRes.ok) {
          const arrayBuffer = await blobRes.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        }
      } catch (fetchErr) {
        console.warn('Fetching from direct Vercel Blob URL failed:', fetchErr.message);
      }
    }

    // 2. Fallback to local /tmp or uploads directory by filename
    if (!imageBuffer && id) {
      const safeFilename = path.basename(id).replace(/[^a-zA-Z0-9_.-]/g, '');
      if (safeFilename) {
        const tmpPath = path.join('/tmp', safeFilename);
        const uploadsPath = path.join(process.cwd(), 'uploads', safeFilename);

        if (fs.existsSync(tmpPath)) {
          imageBuffer = fs.readFileSync(tmpPath);
        } else if (fs.existsSync(uploadsPath)) {
          imageBuffer = fs.readFileSync(uploadsPath);
        }
      }
    }

    if (!imageBuffer) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (download === '1' || download === 'true') {
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Disposition', `attachment; filename="GestureSnap-PhotoStrip-${dateStr}.png"`);
    }

    return res.status(200).send(imageBuffer);
  } catch (error) {
    console.error('Download handler error:', error);
    return res.status(500).send('Internal Server Error');
  }
}
