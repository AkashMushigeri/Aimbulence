"""Database configuration, SQLAlchemy ORM models, and synthetic seed initializer."""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hospital_operations.db")

# SQLite thread configuration
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ==============================================================================
# ORM ENTITIES (Strictly Synthetic Operational Data - No Patient Clinical Data)
# ==============================================================================

class HospitalRecord(Base):
    __tablename__ = "hospitals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    operational_code = Column(String(20), nullable=False, default="NORMAL")
    last_updated = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    departments = relationship("DepartmentRecord", back_populates="hospital", cascade="all, delete-orphan")


class DepartmentRecord(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hospital_id = Column(String(36), ForeignKey("hospitals.id"), nullable=False)
    name = Column(String(100), nullable=False)
    department_type = Column(String(30), nullable=False)
    total_beds = Column(Integer, nullable=False, default=0)
    available_beds = Column(Integer, nullable=False, default=0)
    occupied_beds = Column(Integer, nullable=False, default=0)
    staff_on_duty = Column(Integer, nullable=False, default=0)
    status_note = Column(String(255), nullable=True)

    hospital = relationship("HospitalRecord", back_populates="departments")


class BedRecord(Base):
    __tablename__ = "beds"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bed_code = Column(String(20), nullable=False, unique=True)
    bed_type = Column(String(20), nullable=False)  # EMERGENCY, ICU, SURGICAL, GENERAL
    department = Column(String(50), nullable=False)
    is_occupied = Column(Boolean, nullable=False, default=False)
    is_reserved = Column(Boolean, nullable=False, default=False)


class OperatingRoomRecord(Base):
    __tablename__ = "operating_rooms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    room_number = Column(String(10), nullable=False, unique=True)
    status = Column(String(30), nullable=False, default="OPEN")  # OPEN, IN_USE, RESERVED_FOR_TRAUMA
    scheduled_procedure = Column(String(255), nullable=True)
    is_emergency_cleared = Column(Boolean, nullable=False, default=False)


class StaffRecord(Base):
    __tablename__ = "staff"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    role = Column(String(30), nullable=False)  # DOCTOR, TRAUMA_SURGEON, NURSE, PARAMEDIC
    department = Column(String(50), nullable=False)
    is_on_duty = Column(Boolean, nullable=False, default=True)
    is_assigned = Column(Boolean, nullable=False, default=False)


class AmbulanceRecord(Base):
    __tablename__ = "ambulances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_code = Column(String(20), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default="AVAILABLE")
    crew_assigned = Column(Boolean, nullable=False, default=True)


class BloodInventoryRecord(Base):
    __tablename__ = "blood_inventory"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    blood_type = Column(String(10), nullable=False, unique=True)
    units_available = Column(Integer, nullable=False, default=0)
    minimum_threshold = Column(Integer, nullable=False, default=5)


class OperationalTaskRecord(Base):
    __tablename__ = "operational_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(36), nullable=True)
    title = Column(String(200), nullable=False)
    tier = Column(String(10), nullable=False, default="GREEN")
    status = Column(String(20), nullable=False, default="PENDING")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class IncidentRecord(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=lambda: f"INC-{uuid.uuid4().hex[:8].upper()}")
    title = Column(String(120), nullable=False)
    incident_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    casualty_count = Column(Integer, nullable=False)
    location = Column(String(200), nullable=False)
    eta_minutes = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="REPORTED")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class AuditEventRecord(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(36), nullable=True)
    event_type = Column(String(50), nullable=False)
    action_name = Column(String(100), nullable=True)
    tier = Column(String(10), nullable=True)
    details_json = Column(Text, nullable=False, default="{}")
    performed_by = Column(String(50), nullable=False, default="SYSTEM")
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class RunbookExecutionRecord(Base):
    __tablename__ = "runbook_executions"

    id = Column(String(36), primary_key=True, default=lambda: f"RBX-{uuid.uuid4().hex[:8].upper()}")
    runbook_id = Column(String(50), nullable=False, default="MCI-01")
    incident_id = Column(String(36), nullable=False)
    state = Column(String(30), nullable=False, default="PENDING")
    current_step_id = Column(String(50), nullable=True)
    checkpoint_id = Column(String(50), nullable=True)
    parameters_json = Column(Text, nullable=False, default="{}")
    context_json = Column(Text, nullable=False, default="{}")
    summary_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


class RunbookStepExecutionRecord(Base):
    __tablename__ = "runbook_step_executions"

    id = Column(String(36), primary_key=True, default=lambda: f"RBS-{uuid.uuid4().hex[:8].upper()}")
    execution_id = Column(String(36), nullable=False, index=True)
    step_id = Column(String(50), nullable=False)
    step_number = Column(Integer, nullable=False)
    name = Column(String(120), nullable=False)
    safety_category = Column(String(10), nullable=False, default="GREEN")
    status = Column(String(30), nullable=False, default="PENDING")
    input_json = Column(Text, nullable=False, default="{}")
    output_json = Column(Text, nullable=False, default="{}")
    verification_json = Column(Text, nullable=False, default="{}")
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)



# ==============================================================================
# DATABASE LIFECYCLE & SEEDING
# ==============================================================================

def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(engine_instance=None):
    """Create all database tables and seed baseline synthetic data if empty."""
    active_engine = engine_instance or engine
    Base.metadata.create_all(bind=active_engine)
    
    SessionClass = sessionmaker(autocommit=False, autoflush=False, bind=active_engine)
    db = SessionClass()
    try:
        seed_baseline_if_empty(db)
    finally:
        db.close()


def seed_baseline_if_empty(db: Session):
    """Seed synthetic hospital capacity baseline if no hospital record exists."""
    existing = db.query(HospitalRecord).first()
    if existing:
        return  # Already seeded

    # 1. Hospital record
    hospital = HospitalRecord(
        id="hosp-metro-central",
        name="Metro Central Trauma Hospital",
        operational_code="NORMAL",
        last_updated=datetime.now(timezone.utc),
    )
    db.add(hospital)

    # 2. Departments
    dept_ed = DepartmentRecord(
        id="dept-ed",
        hospital_id=hospital.id,
        name="Emergency Department",
        department_type="EMERGENCY",
        total_beds=20,
        available_beds=12,
        occupied_beds=8,
        staff_on_duty=12,
        status_note="Normal ED intake flow",
    )
    dept_icu = DepartmentRecord(
        id="dept-icu",
        hospital_id=hospital.id,
        name="Intensive Care Unit",
        department_type="ICU",
        total_beds=10,
        available_beds=4,
        occupied_beds=6,
        staff_on_duty=6,
        status_note="Standard critical monitoring",
    )
    dept_surg = DepartmentRecord(
        id="dept-surg",
        hospital_id=hospital.id,
        name="Surgical Operations",
        department_type="SURGERY",
        total_beds=5,
        available_beds=2,
        occupied_beds=3,
        staff_on_duty=8,
        status_note="2 open ORs, 3 in scheduled non-urgent elective procedures",
    )
    dept_blood = DepartmentRecord(
        id="dept-blood",
        hospital_id=hospital.id,
        name="Blood Bank & Transfusion",
        department_type="BLOOD_BANK",
        total_beds=0,
        available_beds=0,
        occupied_beds=0,
        staff_on_duty=2,
        status_note="O-negative reserves adequate for baseline",
    )
    db.add_all([dept_ed, dept_icu, dept_surg, dept_blood])

    # 3. Individual Beds (Deterministic synthetic baseline: 12 ED available, 4 ICU available)
    for i in range(1, 21):
        is_occupied = i > 12  # 1 to 12 available, 13 to 20 occupied
        db.add(BedRecord(
            id=f"bed-ed-{i:02d}",
            bed_code=f"ED-{i:02d}",
            bed_type="EMERGENCY",
            department="Emergency Department",
            is_occupied=is_occupied,
            is_reserved=False,
        ))

    for i in range(1, 11):
        is_occupied = i > 4   # 1 to 4 available, 5 to 10 occupied
        db.add(BedRecord(
            id=f"bed-icu-{i:02d}",
            bed_code=f"ICU-{i:02d}",
            bed_type="ICU",
            department="Intensive Care Unit",
            is_occupied=is_occupied,
            is_reserved=False,
        ))

    # 4. Operating Rooms (2 Open, 3 in non-urgent elective use)
    db.add(OperatingRoomRecord(
        id="or-01",
        room_number="OR-1",
        status="OPEN",
        scheduled_procedure=None,
        is_emergency_cleared=True,
    ))
    db.add(OperatingRoomRecord(
        id="or-02",
        room_number="OR-2",
        status="OPEN",
        scheduled_procedure=None,
        is_emergency_cleared=True,
    ))
    db.add(OperatingRoomRecord(
        id="or-03",
        room_number="OR-3",
        status="IN_USE",
        scheduled_procedure="Elective Arthroscopic Knee Debridement",
        is_emergency_cleared=False,
    ))
    db.add(OperatingRoomRecord(
        id="or-04",
        room_number="OR-4",
        status="IN_USE",
        scheduled_procedure="Elective Inguinal Hernia Repair",
        is_emergency_cleared=False,
    ))
    db.add(OperatingRoomRecord(
        id="or-05",
        room_number="OR-5",
        status="IN_USE",
        scheduled_procedure="Elective Cholecystectomy",
        is_emergency_cleared=False,
    ))

    # 5. Staff (Deterministic baseline: 8 Doctors including 3 trauma surgeons, 16 Nurses)
    doctor_names = [
        ("Dr. Marcus Chen", "TRAUMA_SURGEON", "Emergency Department"),
        ("Dr. Sarah Vance", "TRAUMA_SURGEON", "Surgical Operations"),
        ("Dr. Elena Rostova", "TRAUMA_SURGEON", "Emergency Department"),
        ("Dr. James Thorne", "DOCTOR", "Emergency Department"),
        ("Dr. Priya Patel", "DOCTOR", "Emergency Department"),
        ("Dr. David Kim", "DOCTOR", "Intensive Care Unit"),
        ("Dr. Rachel Morris", "ANESTHESIOLOGIST", "Surgical Operations"),
        ("Dr. Tariq Al-Mansoor", "ANESTHESIOLOGIST", "Surgical Operations"),
    ]
    for idx, (name, role, dept) in enumerate(doctor_names, start=1):
        db.add(StaffRecord(
            id=f"staff-doc-{idx:02d}",
            name=name,
            role=role,
            department=dept,
            is_on_duty=True,
            is_assigned=False,
        ))

    for idx in range(1, 17):
        dept = "Emergency Department" if idx <= 10 else ("Intensive Care Unit" if idx <= 14 else "Surgical Operations")
        db.add(StaffRecord(
            id=f"staff-nurse-{idx:02d}",
            name=f"Nurse Specialist {idx:02d}",
            role="NURSE",
            department=dept,
            is_on_duty=True,
            is_assigned=False,
        ))

    # 6. Ambulances (5 available)
    for idx in range(1, 6):
        db.add(AmbulanceRecord(
            id=f"amb-{idx:02d}",
            vehicle_code=f"MEDIC-{idx:02d}",
            status="AVAILABLE",
            crew_assigned=True,
        ))

    # 7. Blood Inventory (Total: 30 units, including 18 O-neg)
    blood_distribution = [
        ("O_NEG", 18, 10),
        ("O_POS", 6, 5),
        ("A_POS", 4, 3),
        ("B_POS", 2, 2),
    ]
    for b_type, units, min_thresh in blood_distribution:
        db.add(BloodInventoryRecord(
            id=f"blood-{b_type.lower()}",
            blood_type=b_type,
            units_available=units,
            minimum_threshold=min_thresh,
        ))

    # 8. Initial Audit Event
    initial_audit = AuditEventRecord(
        id=str(uuid.uuid4()),
        event_type="SYSTEM_INITIALIZED",
        action_name="SEED_BASELINE_CAPACITY",
        tier="GREEN",
        details_json=json.dumps({
            "message": "Hospital operational synthetic capacity baseline initialized.",
            "emergency_beds": 12,
            "icu_beds": 4,
            "open_ors": 2,
            "doctors": 8,
            "nurses": 16,
            "ambulances": 5,
            "blood_units": 30,
        }),
        performed_by="SYSTEM",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(initial_audit)

    db.commit()
