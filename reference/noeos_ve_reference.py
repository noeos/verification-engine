#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Independent stdlib-only verifier for Noeos Verification Engine protocol vectors."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

KIND = {"content": 1, "record": 2, "link": 3, "evidence": 4}
TYPE = {"bytes": 1, "utf8": 2, "uint64": 3, "none": 4}
HEX = re.compile(r"^(?:[0-9a-f]{2})*$")


class ProtocolError(ValueError):
    pass


def frame(frame_input: object) -> bytes:
    if not isinstance(frame_input, dict):
        raise ProtocolError("FRAME_KIND_UNKNOWN")
    kind_name = frame_input.get("kind")
    if kind_name not in KIND:
        raise ProtocolError("FRAME_KIND_UNKNOWN")
    fields = frame_input.get("fields")
    if not isinstance(fields, list) or len(fields) > 65535:
        raise ProtocolError("FRAME_LENGTH_INVALID")
    output = bytearray(b"NOEOSVE1")
    output.extend(bytes((KIND[kind_name], 0, 1, len(fields) >> 8, len(fields) & 0xFF)))
    previous = 0
    for item in fields:
        if not isinstance(item, dict):
            raise ProtocolError("FRAME_FIELD_TYPE_INVALID")
        tag = item.get("tag")
        if not isinstance(tag, int) or isinstance(tag, bool) or not 1 <= tag <= 65535:
            raise ProtocolError("FRAME_LENGTH_INVALID")
        if tag <= previous:
            raise ProtocolError("FRAME_FIELD_DUPLICATE" if tag == previous else "FRAME_FIELD_ORDER_INVALID")
        previous = tag
        field_type = item.get("type")
        if field_type not in TYPE:
            raise ProtocolError("FRAME_FIELD_TYPE_INVALID")
        value = field_value(field_type, item)
        output.extend(tag.to_bytes(2, "big"))
        output.append(TYPE[field_type])
        output.extend(len(value).to_bytes(8, "big"))
        output.extend(value)
    return bytes(output)


def field_value(field_type: str, item: dict[str, object]) -> bytes:
    value = item.get("value")
    if field_type == "none":
        if "value" in item:
            raise ProtocolError("FRAME_FIELD_TYPE_INVALID")
        return b""
    if field_type == "bytes":
        if not isinstance(value, str) or not HEX.fullmatch(value):
            raise ProtocolError("DIGEST_ENCODING_INVALID")
        repeat = item.get("repeat", 1)
        if not isinstance(repeat, int) or isinstance(repeat, bool) or not 1 <= repeat <= 1_000_000:
            raise ProtocolError("FRAME_LENGTH_INVALID")
        return bytes.fromhex(value) * repeat
    if field_type == "utf8":
        if not isinstance(value, str) or any(0xD800 <= ord(char) <= 0xDFFF for char in value):
            raise ProtocolError("UTF8_INVALID")
        return value.encode("utf-8", "strict")
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 9007199254740991:
        raise ProtocolError("FRAME_LENGTH_INVALID")
    return value.to_bytes(8, "big")


def verify(root: Path) -> int:
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("$schema") != "urn:noeos:verification-engine:vector-set:1":
        raise ValueError("invalid vector manifest")
    total = 0
    for listed in manifest["files"]:
        relative = listed["path"]
        if not isinstance(relative, str) or ".." in relative or relative.startswith("/"):
            raise ValueError("unsafe vector path")
        payload = (root / relative).read_bytes()
        if hashlib.sha256(payload).hexdigest() != listed["sha256"]:
            raise ValueError(f"vector digest mismatch: {relative}")
        document = json.loads(payload.decode("utf-8"))
        cases = document.get("cases")
        if not isinstance(cases, list) or len(cases) != listed["caseCount"]:
            raise ValueError(f"vector count mismatch: {relative}")
        for case in cases:
            verify_case(case)
            total += 1
    print(f"Independent Python reference validated {total} vectors.")
    return 0


def verify_case(case: object) -> None:
    if not isinstance(case, dict) or not isinstance(case.get("id"), str):
        raise ValueError("invalid vector case")
    kind = case.get("kind")
    if kind == "hashing":
        input_hex = case.get("inputHex")
        algorithm = case.get("algorithm")
        if not isinstance(input_hex, str) or not HEX.fullmatch(input_hex) or algorithm not in {"sha-256", "sha-384", "sha-512"}:
            raise ValueError(f"invalid hashing vector: {case['id']}")
        actual = hashlib.new(algorithm.replace("-", ""), bytes.fromhex(input_hex)).hexdigest()
        if actual != case.get("expectedDigest"):
            raise ValueError(f"digest mismatch: {case['id']}")
        return
    if kind == "framing":
        encoded = frame(case.get("frame"))
        if encoded.hex() != case.get("expectedFrameHex"):
            raise ValueError(f"frame mismatch: {case['id']}")
        algorithm = case.get("algorithm")
        if algorithm not in {"sha-256", "sha-384", "sha-512"}:
            raise ValueError(f"invalid algorithm: {case['id']}")
        actual = hashlib.new(algorithm.replace("-", ""), encoded).hexdigest()
        if actual != case.get("expectedDigest"):
            raise ValueError(f"digest mismatch: {case['id']}")
        return
    if kind == "evidence":
        evidence = case.get("evidence")
        algorithm = case.get("algorithm")
        if not isinstance(evidence, dict) or algorithm not in {"sha-256", "sha-384", "sha-512"}:
            raise ValueError(f"invalid evidence vector: {case['id']}")
        canonical = json.dumps(evidence, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
        if canonical.hex() != case.get("expectedJcsHex"):
            raise ValueError(f"evidence JCS mismatch: {case['id']}")
        encoded = frame({
            "kind": "evidence",
            "fields": [
                {"tag": 1, "type": "utf8", "value": algorithm},
                {"tag": 2, "type": "utf8", "value": evidence.get("$schema")},
                {"tag": 3, "type": "bytes", "value": canonical.hex()},
            ],
        })
        if encoded.hex() != case.get("expectedFrameHex"):
            raise ValueError(f"evidence frame mismatch: {case['id']}")
        actual = hashlib.new(algorithm.replace("-", ""), encoded).hexdigest()
        if actual != case.get("expectedDigest"):
            raise ValueError(f"evidence digest mismatch: {case['id']}")
        return
    if kind == "invalid":
        try:
            frame(case.get("frame"))
        except ProtocolError as error:
            if str(error) == case.get("expectedCode"):
                return
            raise ValueError(f"unexpected code: {case['id']}: {error}") from error
        raise ValueError(f"invalid vector succeeded: {case['id']}")
    raise ValueError(f"unsupported vector kind: {case['id']}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "--check":
        raise SystemExit("usage: noeos_ve_reference.py --check <vectors-directory>")
    raise SystemExit(verify(Path(sys.argv[2]).resolve()))
