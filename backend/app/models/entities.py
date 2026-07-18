from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(100), unique=True)
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="farmer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plots: Mapped[list["Plot"]] = relationship(back_populates="owner")


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
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    crop_id: Mapped[UUID] = mapped_column(ForeignKey("crops.id", ondelete="RESTRICT"))
    area_hectares: Mapped[float] = mapped_column(Float)
    location_lat: Mapped[float] = mapped_column(Float)
    location_lng: Mapped[float] = mapped_column(Float)
    seeding_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="growing")
    health: Mapped[str] = mapped_column(String(100), default="Khỏe mạnh")
    moisture: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[User] = relationship(back_populates="plots")
    crop: Mapped[Crop] = relationship(back_populates="plots")
    disease_logs: Mapped[list["DiseaseLog"]] = relationship(back_populates="plot")
    yield_forecasts: Mapped[list["YieldForecast"]] = relationship(back_populates="plot")


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

    plot: Mapped[Plot] = relationship(back_populates="yield_forecasts")


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