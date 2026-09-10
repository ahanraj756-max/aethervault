from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from backend.app.database import Base

def get_utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class AIMetadata(Base):
    __tablename__ = "ai_metadata"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), unique=True, nullable=False)
    summary = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True) # JSON array or comma-separated string
    tags = Column(Text, nullable=True) # JSON array or comma-separated string
    indexed_content = Column(Text, nullable=True) # raw text extracted for search and chat
    processing_status = Column(String, default="pending", nullable=False) # pending, processing, completed, failed
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    file = relationship("File", back_populates="ai_metadata")
