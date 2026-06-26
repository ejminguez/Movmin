from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_type = Column(String(30), nullable=False)
    severity = Column(String(20), default="moderate")
    title = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    affected_route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    estimated_delay_min = Column(Integer, default=0)
    status = Column(String(20), default="active")
    source = Column(String(20), default="simulation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
