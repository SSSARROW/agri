import os
import hmac
import hashlib
from db.supabase import supabase

SAFE_ALPHABET = "234679ACDEFGHJKMNPQRTUVWXYZ"

CHAR_MAP = {
    '0': '2',
    'O': 'P',
    '1': '3',
    'I': 'J',
    'L': 'M',
    'S': 'T',
    '5': '6',
    'B': 'C',
    '8': '9',
}

def to_safe_char(ch: str) -> str:
    u = ch.upper()
    if u in SAFE_ALPHABET:
        return u
    if u in CHAR_MAP:
        return CHAR_MAP[u]
    return SAFE_ALPHABET[0]

def get_crop_prefix(crop: str) -> str:
    clean = "".join(to_safe_char(ch) for ch in crop if ch.isalnum())
    if not clean:
        clean = "CRP"
    prefix = clean[:3].rjust(3, SAFE_ALPHABET[0])
    return prefix

def encode_seq(seq: int) -> str:
    if seq <= 0:
        seq = 1
    base = len(SAFE_ALPHABET)
    res = []
    n = seq
    while n > 0:
        res.append(SAFE_ALPHABET[n % base])
        n //= base
    s = "".join(reversed(res))
    return s.rjust(4, SAFE_ALPHABET[0])

def decode_seq(s: str) -> int:
    base = len(SAFE_ALPHABET)
    n = 0
    for char in s:
        if char not in SAFE_ALPHABET:
            raise ValueError(f"Invalid character '{char}'")
        n = n * base + SAFE_ALPHABET.index(char)
    return n

def compute_sig_suffix(crop_prefix: str, seq: int) -> str:
    secret = os.getenv("BATCH_CODE_SECRET", "dev-secret-change-in-prod")
    sig = hmac.new(
        secret.encode(),
        f"{crop_prefix}:{seq}".encode(),
        hashlib.sha256
    ).hexdigest().upper()
    first_two = sig[:2]
    return "".join(to_safe_char(c) for c in first_two)

def validate_batch_code(code: str) -> bool:
    if not code or not isinstance(code, str):
        return False
    parts = code.split("-")
    if len(parts) != 3:
        return False

    crop_prefix, encoded_seq, sig_suffix = parts
    if len(crop_prefix) != 3 or len(encoded_seq) != 4 or len(sig_suffix) != 2:
        return False

    for ch in crop_prefix + encoded_seq + sig_suffix:
        if ch not in SAFE_ALPHABET:
            return False

    try:
        seq = decode_seq(encoded_seq)
    except Exception:
        return False

    expected_sig = compute_sig_suffix(crop_prefix, seq)
    return hmac.compare_digest(sig_suffix, expected_sig)

def generate_batch_code(crop: str) -> str:
    crop_prefix = get_crop_prefix(crop)
    res = supabase.table("batch").select("id", count="exact").execute()
    count = res.count if res.count is not None else len(res.data or [])
    seq = count + 1

    while True:
        encoded_seq = encode_seq(seq)
        sig_suffix = compute_sig_suffix(crop_prefix, seq)
        code = f"{crop_prefix}-{encoded_seq}-{sig_suffix}"

        check_res = supabase.table("batch").select("id").eq("code", code).execute()
        if not check_res.data:
            return code
        seq += 1
