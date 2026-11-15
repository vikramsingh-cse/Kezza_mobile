from pydantic import BaseModel, Field


class AdminPointsGrantSchema(BaseModel):
    points: int = Field(..., gt=0, le=1_000_000)
    reason: str = Field(..., min_length=3, max_length=220)
