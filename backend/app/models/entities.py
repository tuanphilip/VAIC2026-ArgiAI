from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(100), unique=True)
    citizen_id: Mapped[str | None] = mapped_column(String(12), unique=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(20))
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="farmer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plots: Mapped[list["Plot"]] = relationship(back_populates="owner")
    harvest_plans: Mapped[list["HarvestPlan"]] = relationship(
        back_populates="owner", foreign_keys=lambda: [HarvestPlan.owner_id]
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Tư vấn nông nghiệp")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    session_id: Mapped[UUID] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    intent: Mapped[str | None] = mapped_column(String(50))
    confidence: Mapped[float | None] = mapped_column(Float)
    citations: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Crop(Base):
    __tablename__ = "crops"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String(100))
    variety: Mapped[str] = mapped_column(String(100))
    growth_duration_days: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plots: Mapped[list["Plot"]] = relationship(back_populates="crop")


class Plot(Base):
    __tablename__ = "plots"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    crop_id: Mapped[UUID] = mapped_column(ForeignKey("crops.id", ondelete="RESTRICT"))
    area_hectares: Mapped[float] = mapped_column(Float)
    location_lat: Mapped[float] = mapped_column(Float)
    location_lng: Mapped[float] = mapped_column(Float)
    seeding_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="growing")
    health: Mapped[str] = mapped_column(String(100), default="Khỏe mạnh")
    moisture: Mapped[int | None] = mapped_column(Integer)
    boundary: Mapped[list[list[float]] | None] = mapped_column(JSONB(none_as_null=True))
    livestock: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    crop_types: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    owner_phone: Mapped[str | None] = mapped_column(String(20))
    owner_name: Mapped[str | None] = mapped_column(String(150))
    region: Mapped[str | None] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[User | None] = relationship(back_populates="plots")
    crop: Mapped[Crop] = relationship(back_populates="plots")
    disease_logs: Mapped[list["DiseaseLog"]] = relationship(back_populates="plot")
    yield_forecasts: Mapped[list["YieldForecast"]] = relationship(back_populates="plot")
    harvest_plans: Mapped[list["HarvestPlan"]] = relationship(back_populates="plot")


class DiseaseLog(Base):
    __tablename__ = "disease_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    plot_id: Mapped[UUID | None] = mapped_column(ForeignKey("plots.id", ondelete="SET NULL"))
    reporter_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    image_url: Mapped[str] = mapped_column(String(500))
    detected_disease: Mapped[str] = mapped_column(String(150))
    confidence: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(30), default="Trung bình")
    treatment_measures: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    official_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    plot: Mapped[Plot | None] = relationship(back_populates="disease_logs")
    treatment_plans: Mapped[list["TreatmentPlan"]] = relationship(back_populates="disease_log")


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    disease_log_id: Mapped[UUID] = mapped_column(ForeignKey("disease_logs.id", ondelete="CASCADE"), index=True)
    plot_label: Mapped[str] = mapped_column(String(200))
    treatment_agent: Mapped[str] = mapped_column(String(200))
    interval_days: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="planned", server_default="planned")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    disease_log: Mapped[DiseaseLog] = relationship(back_populates="treatment_plans")


class YieldForecast(Base):
    __tablename__ = "yield_forecasts"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    plot_id: Mapped[UUID] = mapped_column(ForeignKey("plots.id", ondelete="CASCADE"))
    forecasted_yield_tons: Mapped[float] = mapped_column(Float)
    confidence_score: Mapped[float] = mapped_column(Float)
    optimal_harvest_start: Mapped[date] = mapped_column(Date)
    optimal_harvest_end: Mapped[date] = mapped_column(Date)
    weather_advisory: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    forecast_method: Mapped[str] = mapped_column(String(40), default="heuristic_v1", server_default="heuristic_v1")
    model_version: Mapped[str] = mapped_column(String(80), default="heuristic-v1", server_default="heuristic-v1")
    status: Mapped[str] = mapped_column(String(30), default="review_required", server_default="review_required")
    forecasted_yield_min_tons: Mapped[float | None] = mapped_column(Float)
    forecasted_yield_max_tons: Mapped[float | None] = mapped_column(Float)
    input_snapshot: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    weather_source: Mapped[str | None] = mapped_column(String(150))
    weather_snapshot: Mapped[dict | None] = mapped_column(JSONB)
    explanation: Mapped[str | None] = mapped_column(Text)
    needs_human_review: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    plot: Mapped[Plot] = relationship(back_populates="yield_forecasts")


class HarvestPlan(Base):
    __tablename__ = "harvest_plans"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    plot_id: Mapped[UUID] = mapped_column(ForeignKey("plots.id", ondelete="CASCADE"), index=True)
    forecast_id: Mapped[UUID | None] = mapped_column(ForeignKey("yield_forecasts.id", ondelete="SET NULL"))
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="draft")
    planned_start_date: Mapped[date] = mapped_column(Date)
    planned_end_date: Mapped[date] = mapped_column(Date)
    expected_yield_tons: Mapped[float | None] = mapped_column(Float)
    actual_yield_tons: Mapped[float | None] = mapped_column(Float)
    labor_count: Mapped[int | None] = mapped_column(Integer)
    transport_notes: Mapped[str | None] = mapped_column(Text)
    storage_notes: Mapped[str | None] = mapped_column(Text)
    risk_notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plot: Mapped[Plot] = relationship(back_populates="harvest_plans")
    owner: Mapped[User] = relationship(back_populates="harvest_plans", foreign_keys=[owner_id])
    tasks: Mapped[list["HarvestPlanTask"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class HarvestPlanTask(Base):
    __tablename__ = "harvest_plan_tasks"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    harvest_plan_id: Mapped[UUID] = mapped_column(ForeignKey("harvest_plans.id", ondelete="CASCADE"), index=True)
    task_type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    planned_date: Mapped[date] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    assigned_to: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped[HarvestPlan] = relationship(back_populates="tasks")


class MarketPrice(Base):
    __tablename__ = "market_prices"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    crop_id: Mapped[UUID] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"))
    price_per_kg: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(150))
    recorded_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    crop_id: Mapped[UUID] = mapped_column(ForeignKey("crops.id", ondelete="CASCADE"))
    target_price: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FinanceTransaction(Base):
    __tablename__ = "finance_transactions"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(20))
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(100))
    transaction_date: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    contact: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_name: Mapped[str] = mapped_column(String(150))
    quantity: Mapped[float] = mapped_column(Float)
    supplier_id: Mapped[UUID | None] = mapped_column(ForeignKey("suppliers.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_name: Mapped[str] = mapped_column(String(150))
    quantity: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserSettings(Base):
    __tablename__ = "user_settings"
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SeasonalEvent(Base):
    __tablename__ = "seasonal_events"
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    calendar_key: Mapped[str] = mapped_column(String(40), default="work")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TraceabilityLabel(Base):
    __tablename__ = "traceability_labels"
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lot_name: Mapped[str] = mapped_column(String(200))
    harvest_date: Mapped[date] = mapped_column(Date)
    standard: Mapped[str] = mapped_column(String(80))
    farmer: Mapped[str] = mapped_column(String(150))
    qr_value: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ShipmentRecord(Base):
    __tablename__ = "shipment_records"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    shipment_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="scheduled")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(30))
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(30))
    location: Mapped[str | None] = mapped_column(String(120))
    reorder_level: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    inventory_item_id: Mapped[UUID] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    quantity_delta: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WeatherAlertSubscription(Base):
    __tablename__ = "weather_alert_subscriptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    phone_number: Mapped[str] = mapped_column(String(20))
    rain_threshold_mm: Mapped[float] = mapped_column(Float, default=50.0)
    wind_gust_threshold_kmh: Mapped[float] = mapped_column(Float, default=50.0)
    temperature_threshold_c: Mapped[float] = mapped_column(Float, default=38.0)
    soil_moisture_threshold_pct: Mapped[int] = mapped_column(Integer, default=40)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DisasterWarning(Base):
    __tablename__ = "disaster_warnings"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    type: Mapped[str] = mapped_column(String(50), index=True)  # flood / storm / drought / heatwave
    severity: Mapped[str] = mapped_column(String(20))  # low / medium / high / critical
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    affected_region: Mapped[str] = mapped_column(Text)  # JSON or GeoJSON geometry
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(100))
    raw_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON blob
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())