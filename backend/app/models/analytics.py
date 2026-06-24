from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Analytic(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    avg_travel_time_min = Column(Float, nullable=True)
    avg_delay_min = Column(Float, nullable=True)
    on_time_performance = Column(Float, nullable=True)
    utilization = Column(Float, nullable=True)
    active_bus_count = Column(Integer, default=0)
