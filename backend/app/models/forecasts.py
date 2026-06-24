from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from app.core.database import Base


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    forecast_hour = Column(DateTime(timezone=True), nullable=False)
    predicted_demand = Column(Integer, default=0)
    confidence = Column(Float, nullable=True)
