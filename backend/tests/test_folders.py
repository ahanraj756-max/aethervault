from fastapi.testclient import TestClient

def get_auth_headers(client: TestClient, username: str = "folderuser", email: str = "folder@test.com") -> dict:
    # Register and login helper
    client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "Password123",
            "confirm_password": "Password123"
        }
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": "Password123"}
    )
    token = login_resp.json()["data"]["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_folder_crud(client: TestClient):
    headers = get_auth_headers(client)
    
    # 1. Create a root folder
    response = client.post(
        "/api/v1/folders",
        json={"name": "Documents", "parent_id": None},
        headers=headers
    )
    assert response.status_code == 201
    doc_folder = response.json()["data"]
    doc_id = doc_folder["id"]
    assert doc_folder["name"] == "Documents"
    
    # 2. Create subfolder inside Documents
    response = client.post(
        "/api/v1/folders",
        json={"name": "College", "parent_id": doc_id},
        headers=headers
    )
    assert response.status_code == 201
    coll_folder = response.json()["data"]
    coll_id = coll_folder["id"]
    assert coll_folder["parent_id"] == doc_id
    
    # 3. Prevent duplicate folder name in same parent
    response = client.post(
        "/api/v1/folders",
        json={"name": "College", "parent_id": doc_id},
        headers=headers
    )
    assert response.status_code == 400
    assert response.json()["success"] is False
    
    # 4. Rename folder
    response = client.put(
        f"/api/v1/folders/{coll_id}",
        json={"name": "University"},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "University"
    
    # 5. Prevent circular reference moving Documents folder inside University (its own child)
    # University is currently inside Documents, so moving Documents inside University causes a cycle.
    response = client.put(
        f"/api/v1/folders/{doc_id}/move",
        data={"parent_id": coll_id},
        headers=headers
    )
    assert response.status_code == 403
    assert "circular" in response.json()["message"].lower() or "itself" in response.json()["message"].lower()

    # 6. List folder contents
    response = client.get(f"/api/v1/folders?parent_id={doc_id}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()["data"]["folders"]) == 1
    assert response.json()["data"]["folders"][0]["id"] == coll_id
    
    # 7. Delete folder
    response = client.delete(f"/api/v1/folders/{doc_id}", headers=headers)
    assert response.status_code == 200
    
    # Ensure deleted
    response = client.get(f"/api/v1/folders/{doc_id}", headers=headers)
    assert response.status_code == 404

def test_folder_download_zip(client: TestClient):
    import io
    import zipfile
    
    headers = get_auth_headers(client, username="zipuser", email="zip@test.com")
    
    # 1. Create root folder "MyProject"
    resp = client.post(
        "/api/v1/folders",
        json={"name": "MyProject", "parent_id": None},
        headers=headers
    )
    assert resp.status_code == 201
    proj_id = resp.json()["data"]["id"]
    
    # 2. Upload file into "MyProject"
    file_content = b"print('Hello world!')"
    resp = client.post(
        "/api/v1/files/upload",
        files=[("files", ("main.py", io.BytesIO(file_content), "text/x-python"))],
        data={"folder_id": proj_id},
        headers=headers
    )
    assert resp.status_code == 200
    
    # 3. Create subfolder "docs" inside "MyProject"
    resp = client.post(
        "/api/v1/folders",
        json={"name": "docs", "parent_id": proj_id},
        headers=headers
    )
    assert resp.status_code == 201
    docs_id = resp.json()["data"]["id"]
    
    # 4. Upload file into "docs"
    doc_content = b"# Documentation"
    resp = client.post(
        "/api/v1/files/upload",
        files=[("files", ("README.md", io.BytesIO(doc_content), "text/markdown"))],
        data={"folder_id": docs_id},
        headers=headers
    )
    assert resp.status_code == 200
    
    # 5. Create empty subfolder "empty_dir" inside "MyProject"
    resp = client.post(
        "/api/v1/folders",
        json={"name": "empty_dir", "parent_id": proj_id},
        headers=headers
    )
    assert resp.status_code == 201
    
    # 6. Download the whole folder as ZIP
    dl_resp = client.get(f"/api/v1/folders/{proj_id}/download", headers=headers)
    assert dl_resp.status_code == 200
    assert "application/zip" in dl_resp.headers.get("content-type", "")
    
    # 7. Verify ZIP contents
    zip_bytes = io.BytesIO(dl_resp.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        namelist = zf.namelist()
        # Should contain MyProject/main.py, MyProject/docs/README.md, MyProject/empty_dir/
        assert "MyProject/main.py" in namelist
        assert "MyProject/docs/README.md" in namelist
        assert "MyProject/empty_dir/" in namelist
        assert zf.read("MyProject/main.py") == file_content
        assert zf.read("MyProject/docs/README.md") == doc_content

