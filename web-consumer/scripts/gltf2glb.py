#!/usr/bin/env python3
"""Repack a .gltf with an embedded base64 buffer into a binary .glb.

Strips the data-URI buffer (33% base64 inflation) into the GLB BIN chunk.
Usage: python3 scripts/gltf2glb.py input.gltf output.glb
"""

import base64
import json
import struct
import sys


def main() -> None:
    src, dst = sys.argv[1], sys.argv[2]
    gltf = json.load(open(src))

    buf = gltf["buffers"][0]
    uri = buf.pop("uri")
    assert uri.startswith("data:"), "expected an embedded data-URI buffer"
    binary = base64.b64decode(uri.split(",", 1)[1])
    binary += b"\x00" * (-len(binary) % 4)
    buf["byteLength"] = len(binary)

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * (-len(json_bytes) % 4)

    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))  # magic "glTF", v2
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))  # JSON chunk
        f.write(json_bytes)
        f.write(struct.pack("<II", len(binary), 0x004E4942))  # BIN chunk
        f.write(binary)
    print(f"wrote {dst} ({total} bytes)")


if __name__ == "__main__":
    main()
