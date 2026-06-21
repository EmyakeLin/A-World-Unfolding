import http.server
import socketserver
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class UTF8Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def guess_type(self, path):
        base = super().guess_type(path)
        if base.startswith('text/'):
            return base + '; charset=utf-8'
        return base

with socketserver.TCPServer(("", PORT), UTF8Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
