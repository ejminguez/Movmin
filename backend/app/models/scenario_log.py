from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base

class ScenarioLog(Base):
    __tablename__ = "scenario_logs"

    id = Column(Integer, primary_key=True, index=True)
    scenario_type = Column(String(50), nullable=False)
    parameters = Column(JSON, nullable=True)
    impact_summary = Column(JSON, nullable=True)
    insight_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
