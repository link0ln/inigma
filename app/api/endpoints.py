from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.models.secret import SecretCreate, SecretRead
from app.services import secret_service
from app.core.database import get_session

router = APIRouter()

@router.post("/", response_model=SecretRead, status_code=status.HTTP_201_CREATED)
def create_new_secret(
    *,
    session: Session = Depends(get_session),
    secret_in: SecretCreate
) -> SecretRead:
    """
    Create a new secret.
    """
    db_secret = secret_service.create_secret(db=session, secret_in=secret_in)
    # Convert the ORM model (SecretDb/Secret) to the Pydantic model for response (SecretRead)
    # SecretRead.model_validate(obj, *, strict=None, from_attributes=None, context=None)
    # For SQLModel, from_attributes=True is often helpful or model_validate can handle it.
    return SecretRead.model_validate(db_secret)

@router.get("/{unique_id}", response_model=SecretRead)
def read_secret(
    *,
    session: Session = Depends(get_session),
    unique_id: str
) -> SecretRead:
    """
    Retrieve a secret by its unique ID.
    Handles view count decrement and TTL internally.
    """
    db_secret_data = secret_service.get_secret_for_viewing(db=session, unique_id=unique_id)
    if db_secret_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found or expired")
    
    # db_secret_data is already a copy of the Secret model instance (SecretDb).
    # Convert it to SecretRead for the response.
    return SecretRead.model_validate(db_secret_data)
