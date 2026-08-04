from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os


class CorsHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "https://partner.steamgames.com")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--port", type=int, default=18765)
    args = parser.parse_args()
    os.chdir(args.directory.resolve())
    ThreadingHTTPServer(("127.0.0.1", args.port), CorsHandler).serve_forever()


if __name__ == "__main__":
    main()
