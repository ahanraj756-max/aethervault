import io
from fastapi.testclient import TestClient
from backend.tests.test_folders import get_auth_headers

def test_ai_flow(client: TestClient):
    headers = get_auth_headers(client, "aiuser", "ai@test.com")
    
    # 1. Upload a text file containing clear keywords
    content = b"Python machine learning project. We discuss classification models, data mining, and neural networks."
    file_io = io.BytesIO(content)
    
    upload_resp = client.post(
        "/api/v1/files/upload",
        files={"files": ("machine_learning.txt", file_io, "text/plain")},
        headers=headers
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["data"]["uploaded"][0]["id"]
    
    # 2. Trigger summarization & keyword extraction
    sum_resp = client.post(
        f"/api/v1/ai/summarize/{file_id}",
        headers=headers
    )
    assert sum_resp.status_code == 200
    data = sum_resp.json()["data"]
    assert "summary" in data
    lowered_kws = [k.lower() for k in data["keywords"]]
    assert any(target in kw or kw in target for target in ["python", "machine", "learning", "project", "models", "neural", "classification"] for kw in lowered_kws)
    assert len(data["tags"]) > 0
    
    # 3. Test Smart Search
    search_resp = client.post(
        "/api/v1/ai/search",
        json={"query": "machine learning"},
        headers=headers
    )
    assert search_resp.status_code == 200
    search_results = search_resp.json()["data"]
    assert len(search_results) > 0
    assert search_results[0]["file"]["id"] == file_id
    assert search_results[0]["match_type"] in ["exact", "semantic", "suggested"]
    assert search_results[0]["relevance_score"] > 0
    
    # 4. Test Chat with indexed file Q&A
    chat_resp = client.post(
        "/api/v1/ai/chat",
        json={"query": "neural networks"},
        headers=headers
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()["data"]
    assert "answer" in chat_data
    assert "machine_learning.txt" in chat_data["answer"] or len(chat_data["sources"]) > 0
    
    # 5. Test Organization suggestions proposal
    prop_resp = client.get(
        "/api/v1/ai/organize/propose",
        headers=headers
    )
    assert prop_resp.status_code == 200
    proposals = prop_resp.json()["data"]
    assert len(proposals) > 0
    assert proposals[0]["file_id"] == file_id
    assert proposals[0]["suggested_folder_name"] == "Documents"
    
    # 6. Test Organization execute moves
    execute_resp = client.post(
        "/api/v1/ai/organize/execute",
        json={
            "actions": [{
                "file_id": file_id,
                "suggested_folder_name": "Documents",
                "suggested_folder_id": None
            }]
        },
        headers=headers
    )
    assert execute_resp.status_code == 200
    assert "moved" in execute_resp.json()["message"]
    
    # Ensure file has been moved to the Documents folder
    file_details = client.get(
        f"/api/v1/files/{file_id}",
        headers=headers
    )
    assert file_details.status_code == 200
    assert file_details.json()["data"]["folder_id"] is not None

    # Verify that files already in a folder or uploaded into a folder are NOT suggested for reorganization
    folder_resp = client.post(
        "/api/v1/folders",
        json={"name": "CustomProjectFolder"},
        headers=headers
    )
    assert folder_resp.status_code == 201
    custom_folder_id = folder_resp.json()["data"]["id"]

    # Upload a file into that folder (simulating folder upload)
    folder_file_content = b"Content inside an uploaded folder"
    folder_file_io = io.BytesIO(folder_file_content)
    client.post(
        "/api/v1/files/upload",
        files={"files": ("folder_subfile.txt", folder_file_io, "text/plain")},
        data={"folder_id": str(custom_folder_id)},
        headers=headers
    )

    # Calling propose should return NO proposals for files already inside folders
    prop_resp_after = client.get(
        "/api/v1/ai/organize/propose",
        headers=headers
    )
    assert prop_resp_after.status_code == 200
    assert len(prop_resp_after.json()["data"]) == 0
    
    # 7. Test Duplicate detection scans
    # Upload same file content to trigger hash match
    file_io_dup = io.BytesIO(content)
    client.post(
        "/api/v1/files/upload",
        files={"files": ("ml_copy.txt", file_io_dup, "text/plain")},
        headers=headers
    )
    
    dup_resp = client.get(
        "/api/v1/ai/duplicates",
        headers=headers
    )
    assert dup_resp.status_code == 200
    dup_groups = dup_resp.json()["data"]
    assert len(dup_groups) > 0
    assert dup_groups[0]["num_duplicates"] == 2
