#!/usr/bin/env python3
"""Generate a simple 1200x630 OG image (paper/ink palette)."""
import struct
import zlib
from pathlib import Path


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def main() -> None:
    w, h = 1200, 630
    paper = (0xE8, 0xDF, 0xCA)
    ink = (0x2E, 0x25, 0x1F)
    muted = (0x70, 0x66, 0x5B)
    rule = (0xE4, 0xDB, 0xC6)

    rows: list[bytes] = []
    for y in range(h):
        row = bytearray([0])  # filter: none
        for x in range(w):
            if x % 11 == 0 and 40 < y < h - 40:
                r, g, b = rule
            else:
                r, g, b = paper
            # left accent bar
            if 72 <= x <= 84 and 180 <= y <= 450:
                r, g, b = ink
            # bottom hairline
            if h - 80 <= y <= h - 79:
                r, g, b = muted
            # top-right mark block
            if 1040 <= x <= 1128 and 90 <= y <= 178:
                r, g, b = ink
            row += bytes((r, g, b))
        rows.append(bytes(row))

    raw = b"".join(rows)
    comp = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", comp)
        + png_chunk(b"IEND", b"")
    )
    out = Path(__file__).resolve().parents[1] / "public" / "og.png"
    out.write_bytes(png)
    print(f"wrote {out} ({len(png)} bytes)")


if __name__ == "__main__":
    main()
