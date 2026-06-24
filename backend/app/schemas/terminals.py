from pydantic import BaseModel, ConfigDict
from typing import Optional


class TerminalBase(BaseModel):
    name: str
    lat: float
    lng: float
    route_id: Optional[int] = None
    terminal_type: str = "terminal"


class TerminalCreate(TerminalBase):
    pass


class TerminalResponse(TerminalBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
