import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.admin import AdminPointsGrantSchema
from app.services.admin_service import (
    approve_commission,
    grant_patient_points,
    list_pending_commissions,
    search_patients,
)
from app.services.auth_service import get_current_admin

router = APIRouter(prefix="/admin", tags=["Administrator"])


@router.get("/commissions/pending")
def get_pending_commissions_endpoint(
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return list_pending_commissions(db)


@router.post("/commissions/{commission_id}/approve")
def approve_commission_endpoint(
    commission_id: uuid.UUID,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return approve_commission(
            commission_id=commission_id,
            admin_user_id=uuid.UUID(current_admin["id"]),
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get("/patients/search")
def search_patients_endpoint(
    query: str = Query(..., min_length=2, max_length=100),
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return search_patients(query, db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/patients/{patient_id}/points")
def grant_patient_points_endpoint(
    patient_id: uuid.UUID,
    payload: AdminPointsGrantSchema,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        return grant_patient_points(
            patient_id=patient_id,
            points=payload.points,
            reason=payload.reason,
            admin_user_id=uuid.UUID(current_admin["id"]),
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if "not found" in str(exc).lower()
            else status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
