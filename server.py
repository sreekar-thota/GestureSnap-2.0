import http.server
import socketserver
import os
import json
import urllib.parse
import socket
import time

PORT = 8080
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

LOCAL_IP = get_local_ip()
print(f"[GestureSnap Server] Local IP: http://{LOCAL_IP}:{PORT}")

class GestureSnapHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/upload':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                
                # Check if JSON payload with base64 or raw binary data
                file_data = None
                filename = f"strip_{int(time.time() * 1000)}.png"
                
                try:
                    data = json.loads(body.decode('utf-8'))
                    if 'image' in data:
                        import base64
                        img_str = data['image'].split(',')[1] if ',' in data['image'] else data['image']
                        file_data = base64.b64decode(img_str)
                except Exception:
                    file_data = body

                if file_data:
                    filepath = os.path.join(UPLOAD_DIR, filename)
                    with open(filepath, 'wb') as f:
                        f.write(file_data)
                    
                    # Return public local IP download URL for mobile QR code scanning
                    download_path = f"/download.html?id={filename}"
                    full_qr_url = f"http://{LOCAL_IP}:{PORT}{download_path}"
                    
                    response_data = {
                        "success": True,
                        "id": filename,
                        "downloadUrl": download_path,
                        "fullQrUrl": full_qr_url
                    }
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(response_data).encode('utf-8'))
                    return
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Endpoint to force direct image download with clean filename
        if parsed.path == '/api/download':
            query = urllib.parse.parse_qs(parsed.query)
            file_id = query.get('id', [''])[0]
            # Sanitize filename
            safe_filename = os.path.basename(file_id)
            filepath = os.path.join(UPLOAD_DIR, safe_filename)
            
            if os.path.exists(filepath) and os.path.isfile(filepath):
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                date_str = time.strftime('%Y-%m-%d')
                self.send_header('Content-Disposition', f'attachment; filename="GestureSnap-PhotoStrip-{date_str}.png"')
                with open(filepath, 'rb') as f:
                    content = f.read()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'File not found')
                return
                
        # Serve static files as default
        super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), GestureSnapHandler) as httpd:
        print(f"GestureSnap Server running at http://localhost:{PORT}")
        httpd.serve_forever()
