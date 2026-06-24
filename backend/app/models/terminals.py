from sqlalchemy import Column, Integer, String, Float, ForeignKey
from app.core.database import Base


class Terminal(Base):
    __tablename__ = "terminals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    terminal_type = Column(String(20), default="terminal")
