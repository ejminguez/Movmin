from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Bus(Base):
    __tablename__ = "buses"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    name = Column(String(50), nullable=False)
    license_plate = Column(String(20), nullable=True)
    capacity = Column(Integer, nullable=False, default=50)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    speed = Column(Float, default=0)
    occupancy = Column(Integer, default=0)
    status = Column(String(20), default="active")
    last_updated = Column(DateTime(timezone=True), server_default=func.now())
