# Security Safeguards Review - AetherVault

Security is at the core of AetherVault's self-hosted, local-first vision.

---

## 1. Directory Path Traversal Prevention
Self-hosted storage systems are highly vulnerable to path traversal attempts, where clients pass strings like `../../etc/passwd` or `..\..\Windows\System32` to hijack system control.

AetherVault completely neutralizes this vector:
- **UUID Physical Abstraction:** When files are uploaded, their physical filename is mapped to a server-generated UUID (e.g. `c73a81a8-12ab-4712-a7cf-00192bc931f2.dat`).
- **Separation of Metadata and Storage:** Folder paths are completely virtual and exist solely in the SQLite database schema. No physical subfolders (which could be exploited via dot-dot traversal names) are created for file storage.
- **Local Sandbox Check:** If relative filenames are checked by any utility, the `validate_safe_path` function resolves absolute paths and enforces that the target folder lies strictly within the parent user directory.

---

## 2. Resource Isolation Checks
AetherVault enforces authorization boundaries at the API level. Every file operations endpoint executes ownership checks:
- **File Retrieval:**
  ```python
  file = db.query(File).filter(File.id == file_id).first()
  if file.user_id != current_user.id:
      raise ForbiddenException("You do not have access to this resource")
  ```
- **Folder Navigations:** Any query scoping to a `folder_id` verifies that `folder.user_id == current_user.id` before fetching subcontents.
- **Cycle Prevention:** Folder updates traverse up the parent nodes to block circular associations which could cause memory leaks or infinite query loops.

---

## 3. Cryptographic Storage & Session Rules
- **Password Protection:** Passwords undergo modern key derivation using `bcrypt` salting. Plain-text passwords never touch logs, data records, or terminal buffers.
- **Bearer Session JWT Tokens:** User authentication issues signed HS256 JWT tokens. Token expirations are locked to a 3-hour window.
- **Input Filtering:** Pydantic schemas sanitize string formats, enforcing email structures and stripping trailing whitespace/dangerous chars.
