from http.server import BaseHTTPRequestHandler
import io
import json
import cgi
import msoffcrypto


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self._error(400, "Expected multipart/form-data")
                return

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": content_type,
                },
            )

            password_field = form.getvalue("password")
            if not password_field:
                self._error(400, "Missing password")
                return

            file_field = form["file"]
            if not hasattr(file_field, "file"):
                self._error(400, "Missing file")
                return

            file_bytes = file_field.file.read()
            if not file_bytes:
                self._error(400, "Empty file")
                return

            # Check if already encrypted
            input_stream = io.BytesIO(file_bytes)
            try:
                office_file = msoffcrypto.OfficeFile(input_stream)
            except Exception:
                self._error(
                    400,
                    "This file does not appear to be a valid Word document.",
                )
                return

            if office_file.is_encrypted():
                self._error(400, "This document is already password-protected.")
                return

            # Encrypt
            output_stream = io.BytesIO()
            try:
                office_file.load_key(password=password_field)
                office_file.encrypt(password_field, output_stream)
            except Exception as e:
                self._error(500, f"Encryption failed: {str(e)}")
                return

            encrypted_bytes = output_stream.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(encrypted_bytes)))
            self.end_headers()
            self.wfile.write(encrypted_bytes)

        except Exception as e:
            self._error(500, f"Unexpected error: {str(e)}")

    def _error(self, code, message):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode())
