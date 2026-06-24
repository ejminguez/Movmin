from sqlalchemy import Column, Integer, String, Float, Text
from app.core.database import Base


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=False)
    distance_km = Column(Float, nullable=True)
