# REST API Documentation - AetherVault (v1)

All endpoints are versioned and prefixed with `/api/v1`.

---

## Response Standard Envelopes

### Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Invalid password entered",
  "error_code": "AUTH_ERROR"
}
```

---

## Endpoint Definitions

### 1. Authentication (`/api/v1/auth`)

- **`POST /register`**
  - Payload: `{ "username": "...", "email": "...", "password": "...", "confirm_password": "..." }`
  - Returns: Success envelope with registered `UserResponse`.
- **`POST /login`**
  - Payload: `{ "username_or_email": "...", "password": "..." }`
  - Returns: JWT access token and user credentials.
- **`GET /me`**
  - Headers: `Authorization: Bearer <token>`
  - Returns: Profile details of current user.

### 2. File Explorer (`/api/v1/files`)

- **`GET /?folder_id=X&favorite=Y`**
  - Returns: List of files matching folder/favorite scopes.
- **`POST /upload`**
  - Form Data: `files` (multi-upload list), `folder_id` (optional destination parent).
  - Returns: Lists of uploaded file records and list of failures.
- **`GET /{id}/download`**
  - Returns: Stream binary file download.
- **`PUT /{id}/rename`**
  - Payload: `{ "name": "new_name.ext" }`
  - Returns: Updated file record.
- **`PUT /{id}/move`**
  - Payload: `{ "folder_id": destination_id }`
  - Returns: Updated file record.
- **`POST /{id}/copy`**
  - Returns: Duplicate copy file record.
- **`DELETE /{id}`**
  - Returns: Success deletion confirmation.

### 3. Folder Navigation (`/api/v1/folders`)

- **`GET /?parent_id=X`**
  - Returns: Nested contents lists containing folders and files.
- **`POST /`**
  - Payload: `{ "name": "...", "parent_id": X_or_null }`
  - Returns: Created folder details.
- **`PUT /{id}`**
  - Payload: `{ "name": "new_name" }`
  - Returns: Updated folder details.
- **`DELETE /{id}`**
  - Returns: Success cascading deletion confirmation.

### 4. AI Subsystem (`/api/v1/ai`)

- **`POST /search`**
  - Payload: `{ "query": "..." }`
  - Returns: Sorted list of files matched with score and match type (exact, semantic, suggested).
- **`POST /summarize/{file_id}`**
  - Returns: AI-extracted summaries, tag list, and keywords list.
- **`POST /chat`**
  - Payload: `{ "query": "..." }`
  - Returns: Answer text with sources files metadata.
- **`GET /organize/propose`**
  - Returns: Classification proposals list.
- **`POST /organize/execute`**
  - Payload: `{ "actions": [{ "file_id": 1, "suggested_folder_name": "Images", "suggested_folder_id": null }] }`
  - Returns: Success execution confirmation.
- **`GET /duplicates`**
  - Returns: Hash clusters listing duplicate occurrences.
