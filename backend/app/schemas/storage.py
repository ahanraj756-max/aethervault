from pydantic import BaseModel
from typing import Dict

class StorageStats(BaseModel):
    total_quota: int # bytes
    used_storage: int # bytes
    available_storage: int # bytes
    usage_percentage: float # 0 to 100
    num_files: int
    num_folders: int
    storage_by_type: Dict[str, int] # mime/category -> bytes
