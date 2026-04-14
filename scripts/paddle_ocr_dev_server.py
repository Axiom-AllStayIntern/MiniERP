#!/usr/bin/env python3
"""
Local PaddleOCR HTTP service for SmartFin AR image OCR (dev).

Install (CPU example; use Paddle docs for your OS/CUDA):
  pip install "paddlepaddle" paddleocr fastapi uvicorn python-multipart opencv-python-headless numpy

Run:
  python scripts/paddle_ocr_dev_server.py

Then in .dev.vars:
  PADDLE_OCR_URL=http://127.0.0.1:8765
  OCR_PADDLE_ONLY=true

Contract: POST /ocr  multipart field "file"  ->  JSON {"text": "..."}
"""

import argparse
import os
import sys
import traceback


def main() -> None:
    # Workarounds for some Windows + Paddle CPU runtime incompatibilities:
    # - PIR executor / oneDNN conversion errors
    # - oneDNN attribute conversion on certain ops
    os.environ.setdefault("FLAGS_enable_pir_api", "0")
    os.environ.setdefault("FLAGS_enable_pir_in_executor", "0")
    os.environ.setdefault("FLAGS_use_mkldnn", "0")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    try:
        import numpy as np
        from fastapi import FastAPI, File
        from fastapi.responses import JSONResponse
        import uvicorn
    except ImportError as e:
        print("Missing dependency:", e, file=sys.stderr)
        print("pip install paddlepaddle paddleocr fastapi uvicorn python-multipart opencv-python-headless numpy", file=sys.stderr)
        sys.exit(1)

    app = FastAPI(title="SmartFin PaddleOCR dev")
    _ocr = None

    def get_ocr():
        nonlocal _ocr
        if _ocr is None:
            from paddleocr import PaddleOCR

            # Cross-version init compatibility (2.x / 3.x).
            init_candidates = [
                {"use_textline_orientation": True, "lang": "ch"},
                {"use_angle_cls": True, "lang": "ch"},
                {"lang": "ch"},
            ]
            last_error = None
            for kwargs in init_candidates:
                try:
                    _ocr = PaddleOCR(**kwargs)
                    break
                except Exception as ex:  # noqa: BLE001
                    last_error = ex
            if _ocr is None:
                raise last_error if last_error is not None else RuntimeError("Failed to initialize PaddleOCR")
        return _ocr

    def run_ocr_engine(img):
        ocr = get_ocr()
        last_error = None
        # Compat for PaddleOCR 2.x / 3.x
        for fn in (
            lambda: ocr.ocr(img, cls=True),
            lambda: ocr.ocr(img),
            lambda: ocr.predict(img),
        ):
            try:
                return fn()
            except Exception as ex:  # noqa: BLE001
                last_error = ex
        raise last_error if last_error is not None else RuntimeError("Unknown OCR engine error")

    def extract_lines(result) -> list[str]:
        lines: list[str] = []
        if result is None:
            return lines

        # Classic format: [[ [box], [text, score] ], ...]
        try:
            blocks = result[0] if isinstance(result, list) and result else result
            if isinstance(blocks, list):
                for block in blocks:
                    if isinstance(block, (list, tuple)) and len(block) > 1 and block[1]:
                        second = block[1]
                        if isinstance(second, (list, tuple)) and second:
                            lines.append(str(second[0]))
                            continue
                    if isinstance(block, dict):
                        txt = block.get("text") or block.get("rec_text") or block.get("transcription")
                        if txt:
                            lines.append(str(txt))
        except Exception:
            pass

        # Newer result objects fallback
        if not lines and isinstance(result, list):
            for item in result:
                if isinstance(item, dict):
                    txt = item.get("text") or item.get("rec_text") or item.get("transcription")
                    if txt:
                        lines.append(str(txt))
        return lines

    @app.post("/ocr")
    async def ocr_endpoint(file=File(...)):
        try:
            import cv2

            raw = await file.read()
            if not raw:
                return JSONResponse({"error": "empty file"}, status_code=400)
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return JSONResponse({"error": "could not decode image"}, status_code=400)
            result = run_ocr_engine(img)
            lines = extract_lines(result)
            text = "\n".join(lines).strip()
            if not text:
                return JSONResponse({"text": "", "warning": "no text detected"}, status_code=200)
            return {"text": text}
        except Exception as ex:  # noqa: BLE001
            traceback.print_exc()
            return JSONResponse({"error": str(ex)}, status_code=500)

    @app.get("/health")
    async def health():
        return {"ok": True}

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
