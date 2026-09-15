import struct
import zlib
from pathlib import Path


def make_png(path: Path, size: int, rgb: tuple[int, int, int]) -> None:
    width = height = size
    raw = bytearray()
    for _ in range(height):
        raw.append(0)
        raw.extend(bytes(rgb) * width)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    path.write_bytes(png)


out_dir = Path(__file__).resolve().parent.parent / "public"
make_png(out_dir / "pwa-192x192.png", 192, (27, 94, 32))
make_png(out_dir / "pwa-512x512.png", 512, (27, 94, 32))
print("icons written")
