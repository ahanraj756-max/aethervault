import io
import pytest
from fastapi.testclient import TestClient
from backend.tests.test_folders import get_auth_headers

def test_trash_file_and_restore(client: TestClient):
    headers = get_auth_headers(client, "trashuser1", "trash1@test.com")
    
    # 1. Upload a test file
    file_content = b"Content for trash testing"
    res = client.post(
        "/api/v1/files/upload",
        headers=headers,
        files={"files": ("trash_me.txt", io.BytesIO(file_content), "text/plain")}
    )
    assert res.status_code == 200
    file_data = res.json()["data"]["uploaded"][0]
    file_id = file_data["id"]
    
    # 2. Soft delete file (move to trash)
    res_del = client.delete(f"/api/v1/files/{file_id}", headers=headers)
    assert res_del.status_code == 200
    
    # 3. Verify it is excluded from normal file list
    res_list = client.get("/api/v1/folders", headers=headers)
    assert res_list.status_code == 200
    active_files = [f["id"] for f in res_list.json()["data"]["files"]]
    assert file_id not in active_files
    
    # 4. Verify it appears in the Recycle Bin
    res_trash = client.get("/api/v1/trash", headers=headers)
    assert res_trash.status_code == 200
    trashed_files = [f["id"] for f in res_trash.json()["data"]["files"]]
    assert file_id in trashed_files
    assert res_trash.json()["data"]["total_items"] >= 1
    
    # 5. Restore file from Recycle Bin
    res_restore = client.post(f"/api/v1/trash/files/{file_id}/restore", headers=headers)
    assert res_restore.status_code == 200
    assert res_restore.json()["success"] is True
    
    # 6. Verify it is back in active files and gone from Recycle Bin
    res_list2 = client.get("/api/v1/folders", headers=headers)
    active_files2 = [f["id"] for f in res_list2.json()["data"]["files"]]
    assert file_id in active_files2
    
    res_trash2 = client.get("/api/v1/trash", headers=headers)
    trashed_files2 = [f["id"] for f in res_trash2.json()["data"]["files"]]
    assert file_id not in trashed_files2

def test_trash_folder_and_permanent_delete(client: TestClient):
    headers = get_auth_headers(client, "trashuser2", "trash2@test.com")
    
    # 1. Create a folder
    res_folder = client.post(
        "/api/v1/folders",
        headers=headers,
        json={"name": "Folder To Trash"}
    )
    assert res_folder.status_code == 201
    folder_id = res_folder.json()["data"]["id"]
    
    # 2. Upload a file inside the folder
    file_content = b"Nested content inside folder"
    res_file = client.post(
        "/api/v1/files/upload",
        data={"folder_id": folder_id},
        headers=headers,
        files={"files": ("nested_doc.txt", io.BytesIO(file_content), "text/plain")}
    )
    assert res_file.status_code == 200
    nested_file_id = res_file.json()["data"]["uploaded"][0]["id"]
    
    # 3. Soft delete the folder
    res_del = client.delete(f"/api/v1/folders/{folder_id}", headers=headers)
    assert res_del.status_code == 200
    
    # 4. Check Recycle Bin contains both folder and nested file
    res_trash = client.get("/api/v1/trash", headers=headers)
    assert res_trash.status_code == 200
    trashed_folder_ids = [f["id"] for f in res_trash.json()["data"]["folders"]]
    trashed_file_ids = [f["id"] for f in res_trash.json()["data"]["files"]]
    assert folder_id in trashed_folder_ids
    assert nested_file_id in trashed_file_ids
    
    # 5. Permanently delete folder
    res_perm = client.delete(f"/api/v1/trash/folders/{folder_id}/permanent", headers=headers)
    assert res_perm.status_code == 200
    
    # 6. Verify removed from Recycle Bin
    res_trash2 = client.get("/api/v1/trash", headers=headers)
    trashed_folder_ids2 = [f["id"] for f in res_trash2.json()["data"]["folders"]]
    assert folder_id not in trashed_folder_ids2

def test_empty_recycle_bin(client: TestClient):
    headers = get_auth_headers(client, "trashuser3", "trash3@test.com")
    
    # 1. Upload and delete two files
    for i in range(2):
        res = client.post(
            "/api/v1/files/upload",
            headers=headers,
            files={"files": (f"empty_test_{i}.txt", io.BytesIO(b"data"), "text/plain")}
        )
        fid = res.json()["data"]["uploaded"][0]["id"]
        client.delete(f"/api/v1/files/{fid}", headers=headers)
        
    # Check trash has items
    res_trash = client.get("/api/v1/trash", headers=headers)
    assert res_trash.json()["data"]["total_items"] >= 2
    
    # Empty trash
    res_empty = client.delete("/api/v1/trash/empty", headers=headers)
    assert res_empty.status_code == 200
    assert res_empty.json()["success"] is True
    
    # Verify Recycle Bin is now empty
    res_trash_after = client.get("/api/v1/trash", headers=headers)
    assert res_trash_after.json()["data"]["total_items"] == 0
