from fastapi.testclient import TestClient

def test_register_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "testuser",
            "email": "testuser@aethervault.com",
            "password": "Password123",
            "confirm_password": "Password123"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["username"] == "testuser"
    assert data["data"]["email"] == "testuser@aethervault.com"

def test_register_duplicate_username(client: TestClient):
    # Attempt to register with the same username
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "testuser",
            "email": "another@aethervault.com",
            "password": "Password123",
            "confirm_password": "Password123"
        }
    )
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert "Username" in response.json()["message"]

def test_register_password_mismatch(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "mismatchuser",
            "email": "mismatch@aethervault.com",
            "password": "Password123",
            "confirm_password": "WrongPassword"
        }
    )
    assert response.status_code == 400
    assert response.json()["success"] is False

def test_login_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": "testuser",
            "password": "Password123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data["data"]
    assert data["data"]["token"]["token_type"] == "bearer"
    assert "access_token" in data["data"]["token"]

def test_login_invalid_password(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": "testuser",
            "password": "WrongPassword"
        }
    )
    assert response.status_code == 401
    assert response.json()["success"] is False

def test_get_me_success(client: TestClient):
    # 1. Login to get token
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "testuser", "password": "Password123"}
    )
    token = login_resp.json()["data"]["token"]["access_token"]
    
    # 2. Call /me with token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["username"] == "testuser"

def test_get_me_unauthorized(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["success"] is False
