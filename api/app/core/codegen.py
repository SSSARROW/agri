import hashlib
import secrets

# Unambiguous alphabet — no 0/O, 1/I/L — so a code stays readable aloud over
# a phone and typo-resistant when copied by hand (B-12).
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_batch_code(secret: str, random_length: int = 5, checksum_length: int = 2) -> str:
    """Random body + an HMAC-derived checksum suffix.

    The random part alone would be guessable-by-brute-force in principle;
    the checksum is derived from a server secret, so an attacker can't
    fabricate a code that merely *looks* plausible — enumerating batch
    codes means guessing both parts together, not just the random one.
    """
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(random_length))
    digest = hashlib.sha256(f"{secret}:{body}".encode()).digest()
    checksum = "".join(CODE_ALPHABET[b % len(CODE_ALPHABET)] for b in digest[:checksum_length])
    return body + checksum
