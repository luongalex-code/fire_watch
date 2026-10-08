import binascii
import hashlib
import hmac


PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, expected_hex = password_hash.split("$", 3)
        iterations = int(iterations_text)
        salt = binascii.unhexlify(salt_hex.encode("ascii"))
        expected = binascii.unhexlify(expected_hex.encode("ascii"))
    except (ValueError, binascii.Error):
        return False

    if algorithm != PASSWORD_HASH_ALGORITHM:
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual, expected)
