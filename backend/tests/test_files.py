import io
from fastapi.testclient import TestClient
from backend.tests.test_folders import get_auth_headers

def test_file_operations(client: TestClient):
    headers_owner = get_auth_headers(client, "fileuser", "file@test.com")
    headers_stranger = get_auth_headers(client, "strangeruser", "stranger@test.com")
    
    # 1. Create a folder for files
    folder_resp = client.post(
        "/api/v1/folders",
        json={"name": "Notes", "parent_id": None},
        headers=headers_owner
    )
    folder_id = folder_resp.json()["data"]["id"]
    
    # 2. Upload file
    file_content = b"AetherVault local text indexing test contents."
    file_io = io.BytesIO(file_content)
    
    upload_resp = client.post(
        "/api/v1/files/upload",
        files={"files": ("index_notes.txt", file_io, "text/plain")},
        data={"folder_id": folder_id},
        headers=headers_owner
    )
    assert upload_resp.status_code == 200
    uploaded_files = upload_resp.json()["data"]["uploaded"]
    assert len(uploaded_files) == 1
    file_id = uploaded_files[0]["id"]
    assert uploaded_files[0]["original_filename"] == "index_notes.txt"
    assert uploaded_files[0]["file_size"] == len(file_content)
    
    # 3. Download file
    download_resp = client.get(
        f"/api/v1/files/{file_id}/download",
        headers=headers_owner
    )
    assert download_resp.status_code == 200
    assert download_resp.content == file_content
    
    # 4. Duplicate upload (auto collision rename)
    file_io_dup = io.BytesIO(b"Same file name contents")
    upload_dup_resp = client.post(
        "/api/v1/files/upload",
        files={"files": ("index_notes.txt", file_io_dup, "text/plain")},
        data={"folder_id": folder_id},
        headers=headers_owner
    )
    assert upload_dup_resp.status_code == 200
    dup_file = upload_dup_resp.json()["data"]["uploaded"][0]
    assert dup_file["original_filename"] == "index_notes (1).txt"
    
    # 5. Copy file
    copy_resp = client.post(
        f"/api/v1/files/{file_id}/copy",
        headers=headers_owner
    )
    assert copy_resp.status_code == 200
    copied_file = copy_resp.json()["data"]
    assert copied_file["original_filename"] == "index_notes - Copy.txt"
    
    # 6. Toggle Favorite
    fav_resp = client.post(
        f"/api/v1/files/{file_id}/favorite",
        headers=headers_owner
    )
    assert fav_resp.status_code == 200
    assert fav_resp.json()["data"]["is_favorite"] is True
    
    # 7. Cross-user isolation security check
    # Stranger attempts to download owner's file
    stranger_download = client.get(
        f"/api/v1/files/{file_id}/download",
        headers=headers_stranger
    )
    assert stranger_download.status_code == 403 # Forbidden
    
    # Stranger attempts to rename owner's file
    stranger_rename = client.put(
        f"/api/v1/files/{file_id}/rename",
        json={"name": "hacked.txt"},
        headers=headers_stranger
    )
    assert stranger_rename.status_code == 403
    
    # 8. Delete file
    delete_resp = client.delete(
        f"/api/v1/files/{file_id}",
        headers=headers_owner
    )
    assert delete_resp.status_code == 200
    
    # Verify missing after deletion
    get_resp = client.get(
        f"/api/v1/files/{file_id}",
        headers=headers_owner
    )
    assert get_resp.status_code == 404
