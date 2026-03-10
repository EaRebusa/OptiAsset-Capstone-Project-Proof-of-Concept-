from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Spec(Base):
    """The 'Brain' - Manufacturer ground truth reference."""
    __tablename__ = "specs_library"

    id = Column(Integer, primary_key=True, index=True)
    device_type = Column(String, index=True)
    model_name = Column(String, unique=True, index=True)
    temp_norm = Column(Float)
    usage_norm = Column(Float)
    warranty_months = Column(Integer)

class Asset(Base):
    """The 'Living Inventory' - Persistent asset storage."""
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String, unique=True, index=True)
    # Removed ForeignKey to allow unknown models
    model_name = Column(String, nullable=True)
    device_type = Column(String, nullable=True) # Added device_type
    is_generic = Column(Boolean, default=False) # Added is_generic for badge

    # Auto-Aging Logic: Store baseline, calc delta in logic layer
    initial_age = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Telemetry (Last Sync)
    current_temp = Column(Float)
    current_usage = Column(Float)
    maint_score = Column(Integer)
    repairs = Column(Integer)

    # ML Outputs
    health_score = Column(String, default="Unscored")
    cluster_id = Column(Integer, nullable=True)

    # Human-in-the-loop (Manager Overrides)
    override_score = Column(String, nullable=True)
    override_reason = Column(String, nullable=True)

    last_updated = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Explicit relationship definition since ForeignKey was removed
    spec = relationship("Spec", primaryjoin="Asset.model_name == Spec.model_name", foreign_keys=[model_name], uselist=False, viewonly=True)