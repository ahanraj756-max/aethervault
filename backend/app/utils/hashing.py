import hashlib

def calculate_sha256(file_path_or_bytes) -> str:
    """Calculate SHA-256 hash of a file or raw bytes."""
    if isinstance(file_path_or_bytes, bytes):
        return hashlib.sha256(file_path_or_bytes).hexdigest()
    
    # Read chunk-by-chunk for local file paths
    sha256_hash = hashlib.sha256()
    with open(file_path_or_bytes, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()
