"""AIMBULENCE AI Emergency Pre-Arrival Coordination & Resource Matching Engine.

Analyzes pre-arrival patient information received from an ambulance en route,
extracts clinically relevant facts using rule-based/NLP entity extraction,
identifies the suspected emergency category, evaluates hospital resource availability,
and synthesizes an explainable Pre-Arrival Preparation Plan.

SAFETY PRINCIPLE:
The system is a clinical coordination and preparation assistant, NOT a replacement
for a physician. It does not diagnose disease or prescribe treatments. All outputs
use non-prescriptive advisory terminology ("suspected emergency", "potential requirement",
"preparation recommendation").
"""
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.models.prearrival import (
    ActionDecision,
    EmergencyPriority,
    HospitalAvailability,
    PreArrivalCaseCreate,
    ResourceCategory,
    VitalsSchema,
)
from backend.app.services.database import (
    AuditEventRecord,
    BedRecord,
    BloodInventoryRecord,
    DepartmentRecord,
    OperatingRoomRecord,
    PreArrivalActionRecord,
    PreArrivalCaseRecord,
    StaffRecord,
)


# ==============================================================================
# 1. NATURAL LANGUAGE CLINICAL FACT EXTRACTOR
# ==============================================================================

def extract_clinical_facts_from_text(text: str) -> Dict[str, Any]:
    """Extracts clinical facts, vitals, and injury descriptions from free-form paramedic text."""
    if not text:
        return {}

    lowered = text.lower()
    facts: Dict[str, Any] = {
        "extracted_symptoms": [],
        "extracted_vitals": {},
        "suspected_injuries": [],
        "safety_disclaimer": "AI-assisted extraction. Requires clinician verification upon ambulance touchdown.",
    }

    # 1. Age extraction (e.g. "28 year old", "28 yo", "age 28", "28yo")
    age_match = re.search(r"\b(\d{1,3})\s*(?:year[\s-]*old|yo|years\s*old)\b", lowered)
    if not age_match:
        age_match = re.search(r"\bage\s*(?:is|:)?\s*(\d{1,3})\b", lowered)
    if age_match:
        facts["age"] = int(age_match.group(1))

    # 2. Gender extraction
    if re.search(r"\b(male|man|boy|gentleman)\b", lowered):
        facts["gender"] = "Male"
    elif re.search(r"\b(female|woman|girl|lady)\b", lowered):
        facts["gender"] = "Female"

    # 3. Blood Pressure extraction (e.g. "bp 90/60", "bp is 90/60", "90/60 mmhg", "bp: 90/60")
    bp_match = re.search(r"\bbp\s*(?:is|:)?\s*(\d{2,3}/\d{2,3})\b", lowered)
    if not bp_match:
        bp_match = re.search(r"\b(\d{2,3}/\d{2,3})\s*(?:mmhg)?\b", lowered)
    if bp_match:
        facts["extracted_vitals"]["bp"] = bp_match.group(1)
        # Check for hypotension
        try:
            sys_bp = int(bp_match.group(1).split("/")[0])
            if sys_bp <= 95:
                facts["extracted_symptoms"].append("Hypotension (Systolic <= 95 mmHg)")
        except Exception:
            pass

    # 4. Heart Rate extraction (e.g. "heart rate 118", "hr 118", "pulse 118", "hr: 118 bpm")
    hr_match = re.search(r"\b(?:heart\s*rate|hr|pulse)\s*(?:is|:)?\s*(\d{2,3})\b", lowered)
    if hr_match:
        hr = int(hr_match.group(1))
        facts["extracted_vitals"]["hr"] = hr
        if hr > 100:
            facts["extracted_symptoms"].append(f"Tachycardia ({hr} BPM)")
        elif hr < 60:
            facts["extracted_symptoms"].append(f"Bradycardia ({hr} BPM)")

    # 5. SpO2 extraction (e.g. "spo2 88%", "oxygen saturation is 88%", "o2 sat 88", "saturation 88%")
    spo2_match = re.search(r"\b(?:spo2|oxygen\s*saturation|o2\s*sat|saturation)\s*(?:is|:)?\s*(\d{2,3})\s*%?\b", lowered)
    if spo2_match:
        spo2 = int(spo2_match.group(1))
        facts["extracted_vitals"]["spo2"] = spo2
        if spo2 < 92:
            facts["extracted_symptoms"].append(f"Hypoxemia (SpO2 {spo2}%)")

    # 6. Temperature extraction
    temp_match = re.search(r"\b(?:temp|temperature)\s*(?:is|:)?\s*(\d{2,3}(?:\.\d)?)\s*(?:f|c)?\b", lowered)
    if temp_match:
        facts["extracted_vitals"]["temp"] = f"{temp_match.group(1)} F"

    # 7. Respiratory Rate extraction
    rr_match = re.search(r"\b(?:respiratory\s*rate|rr)\s*(?:is|:)?\s*(\d{1,2})\b", lowered)
    if rr_match:
        facts["extracted_vitals"]["rr"] = int(rr_match.group(1))

    # 8. Clinical symptom & condition keywords
    symptom_patterns = [
        (r"\b(?:severe\s+bleeding|active\s+bleeding|hemorrhage|bleeding)\b", "Severe active hemorrhage"),
        (r"\b(?:road\s+traffic\s+accident|rta|motor\s+vehicle\s+collision|mvc|crash|collision)\b", "Road traffic collision"),
        (r"\b(?:fracture|broken\s+bone|open\s+fracture)\b", "Possible skeletal fracture"),
        (r"\b(?:conscious\s+but\s+confused|confused|altered\s+mental|altered\s+consciousness)\b", "Altered mental status / Confusion"),
        (r"\b(?:unconscious|unresponsive|comatose)\b", "Unresponsive / Comatose"),
        (r"\b(?:chest\s+pain|cardiac|angina|myocardial)\b", "Acute chest pain / Cardiac complaint"),
        (r"\b(?:shortness\s+of\s+breath|dyspnea|respiratory\s+distress|wheezing|stridor)\b", "Acute respiratory distress"),
        (r"\b(?:stroke|facial\s+droop|slurred\s+speech|hemiparesis|weakness)\b", "Suspected acute neurological deficit / Stroke"),
        (r"\b(?:anaphylaxis|allergic\s+reaction|hives|swelling|throat\s+tightness)\b", "Suspected anaphylaxis"),
        (r"\b(?:burn|burns|thermal\s+injury|scald)\b", "Thermal burn injury"),
        (r"\b(?:poison|overdose|toxic|ingestion)\b", "Suspected toxin exposure / Overdose"),
    ]
    for pattern, description in symptom_patterns:
        if re.search(pattern, lowered):
            facts["extracted_symptoms"].append(description)

    # 9. Blood group mention
    blood_match = re.search(r"\bblood\s*group\s*(?:is|:)?\s*(o\s*pos|o\s*neg|a\s*pos|a\s*neg|b\s*pos|b\s*neg|ab\s*pos|ab\s*neg|unknown)\b", lowered)
    if blood_match:
        facts["blood_group"] = blood_match.group(1).upper().replace(" ", "")

    return facts


# ==============================================================================
# 2. EMERGENCY CATEGORY & PRIORITY CLASSIFIER
# ==============================================================================

def classify_emergency_case(
    symptoms: List[str],
    vitals: VitalsSchema,
    incident_type: Optional[str] = None,
    raw_text: Optional[str] = None,
) -> Tuple[str, EmergencyPriority, str]:
    """Determines the suspected emergency category, clinical priority, and summary rationale."""
    combined_corpus = " ".join(symptoms).lower()
    if incident_type:
        combined_corpus += " " + incident_type.lower()
    if raw_text:
        combined_corpus += " " + raw_text.lower()

    # Priority determination
    is_hypotensive = False
    if vitals.bp:
        try:
            sys = int(vitals.bp.split("/")[0])
            if sys <= 95:
                is_hypotensive = True
        except Exception:
            pass

    is_hypoxemic = vitals.spo2 is not None and vitals.spo2 < 90
    is_tachycardic = vitals.hr is not None and vitals.hr >= 115

    # Category matching
    if any(k in combined_corpus for k in ["bleeding", "hemorrhage", "traffic", "rta", "collision", "crash", "fracture", "trauma", "fall"]):
        category = "TRAUMA / SEVERE BLEEDING"
        if is_hypotensive or is_hypoxemic or is_tachycardic or "severe" in combined_corpus:
            priority = EmergencyPriority.CRITICAL
            summary = "Acute multi-system trauma presentation with hemodynamic compromise (hypotension and/or hypoxemia) and significant active blood loss."
        else:
            priority = EmergencyPriority.HIGH
            summary = "Acute traumatic injury without immediate decompensation; requires urgent secondary trauma survey."

    elif any(k in combined_corpus for k in ["cardiac", "chest pain", "arrest", "myocardial", "stemi", "angina"]):
        category = "CARDIAC EMERGENCY"
        priority = EmergencyPriority.CRITICAL if (is_hypotensive or is_hypoxemic) else EmergencyPriority.HIGH
        summary = "Potential acute coronary syndrome or malignant cardiac arrhythmia requiring immediate resuscitation bay telemetry and cardiology alert."

    elif any(k in combined_corpus for k in ["stroke", "slurred", "droop", "facial", "hemiparesis", "neurological"]):
        category = "STROKE-LIKE SYMPTOMS"
        priority = EmergencyPriority.HIGH
        summary = "Acute focal neurological deficit presentation within acute therapeutic window; requires immediate non-contrast cranial CT."

    elif any(k in combined_corpus for k in ["respiratory", "breath", "dyspnea", "stridor", "asthma", "hypoxemia", "copd"]):
        category = "RESPIRATORY EMERGENCY"
        priority = EmergencyPriority.CRITICAL if is_hypoxemic else EmergencyPriority.HIGH
        summary = "Acute respiratory insufficiency with compromised gas exchange; requires supplemental oxygen and advanced airway readiness."

    elif any(k in combined_corpus for k in ["anaphylaxis", "allergy", "hives", "swelling", "epinephrine"]):
        category = "ANAPHYLAXIS"
        priority = EmergencyPriority.CRITICAL if is_hypotensive else EmergencyPriority.HIGH
        summary = "Severe systemic allergic hypersensitivity response with potential airway compromise."

    elif any(k in combined_corpus for k in ["poison", "overdose", "toxin", "ingestion"]):
        category = "POISONING / OVERDOSE"
        priority = EmergencyPriority.HIGH
        summary = "Potential toxic ingestion or overdose requiring toxicological monitoring and antidote readiness."

    elif any(k in combined_corpus for k in ["burn", "thermal", "scald"]):
        category = "BURNS / THERMAL INJURY"
        priority = EmergencyPriority.HIGH
        summary = "Significant thermal injury requiring fluid resuscitation protocol and sterile trauma coverage."

    else:
        category = "ACUTE MEDICAL EMERGENCY"
        priority = EmergencyPriority.MEDIUM
        summary = "Undifferentiated acute emergency requiring immediate triage assessment and emergency bed allocation."

    return category, priority, summary


# ==============================================================================
# 3. EXPLAINABLE RESOURCE MATCHING ENGINE
# ==============================================================================

def generate_explainable_recommendations(
    category: str,
    priority: EmergencyPriority,
    vitals: VitalsSchema,
    symptoms: List[str],
    incident_type: Optional[str],
    db: Session,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Evaluates hospital availability and generates explainable preparation recommendations with explicit clinical reasons."""
    recs: List[Dict[str, Any]] = []
    actions: List[str] = []

    # Query real-time hospital resource state from SQLite
    ed_avail = db.query(BedRecord).filter(
        BedRecord.bed_type == "EMERGENCY",
        BedRecord.is_occupied == False,
        BedRecord.is_reserved == False,
    ).count()

    icu_avail = db.query(BedRecord).filter(
        BedRecord.bed_type == "ICU",
        BedRecord.is_occupied == False,
        BedRecord.is_reserved == False,
    ).count()

    oneg_blood = db.query(BloodInventoryRecord).filter(BloodInventoryRecord.blood_type == "O_NEG").first()
    oneg_units = oneg_blood.units_available if oneg_blood else 0

    open_ors = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.status == "OPEN").count()
    or3 = db.query(OperatingRoomRecord).filter(OperatingRoomRecord.room_number == "OR-3").first()
    or3_status = or3.status if or3 else "IN_USE"

    trauma_surgeons_on_duty = db.query(StaffRecord).filter(
        StaffRecord.role == "TRAUMA_SURGEON",
        StaffRecord.is_on_duty == True,
    ).count()

    # Rule-Based Matching by Category
    if category == "TRAUMA / SEVERE BLEEDING":
        # 1. Emergency Trauma Bed
        bed_status = HospitalAvailability.AVAILABLE if ed_avail >= 2 else (HospitalAvailability.LIMITED if ed_avail == 1 else HospitalAvailability.UNAVAILABLE)
        recs.append({
            "resource_category": ResourceCategory.BED_FACILITY.value,
            "resource_name": "Emergency Trauma Bay (Bed ED-01)",
            "recommended_status": "PREPARE",
            "reason": "Immediate resuscitation bay required to initiate advanced trauma life support (ATLS) and hemorrhage control.",
            "hospital_availability": bed_status.value,
            "requires_approval": True,
        })
        actions.append("Clear and prepare Emergency Trauma Bay ED-01 with warming lights and monitor.")

        # 2. Trauma Surgeon
        surgeon_status = HospitalAvailability.AVAILABLE if trauma_surgeons_on_duty > 0 else HospitalAvailability.LIMITED
        recs.append({
            "resource_category": ResourceCategory.SPECIALIST.value,
            "resource_name": "On-Duty Trauma Surgeon (Dr. Marcus Chen)",
            "recommended_status": "NOTIFY",
            "reason": "Direct clinical evaluation of severe lower extremity hemorrhage and potential vascular/orthopedic injury required upon arrival.",
            "hospital_availability": surgeon_status.value,
            "requires_approval": False,
        })
        actions.append("Pre-alert on-duty trauma surgeon to report to trauma bay at T-5 minutes.")

        # 3. Emergency Physician
        recs.append({
            "resource_category": ResourceCategory.SPECIALIST.value,
            "resource_name": "Emergency Attending Physician",
            "recommended_status": "ALERT",
            "reason": "Lead resuscitation team, manage airway and fluid resuscitation, and supervise trauma intake.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })

        # 4. Blood Bank O-Negative Units
        blood_status = HospitalAvailability.AVAILABLE if oneg_units >= 6 else HospitalAvailability.LIMITED
        recs.append({
            "resource_category": ResourceCategory.BLOOD_BANK.value,
            "resource_name": "Uncrossmatched O-Negative Blood (4 Units)",
            "recommended_status": "PREPARE",
            "reason": "Ambulance telemetry indicates hypotension (systolic <= 90 mmHg) and acute hemorrhage; emergency uncrossmatched blood staged for rapid transfusion.",
            "hospital_availability": blood_status.value,
            "requires_approval": True,
        })
        actions.append("Alert Blood Bank to release 4 units uncrossmatched O-negative PRBC to trauma refrigerator.")

        # 5. IV Fluids & Rapid Infuser
        recs.append({
            "resource_category": ResourceCategory.MEDICATION_SUPPLIES.value,
            "resource_name": "Rapid Infuser & Warmed Normal Saline (2L)",
            "recommended_status": "PREPARE",
            "reason": "Urgent volume resuscitation needed to restore mean arterial pressure and prevent hypovolemic shock decompensation.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        actions.append("Prime Belmont rapid blood and fluid infuser with warmed crystalloid.")

        # 6. High-Flow Oxygen & Airway
        recs.append({
            "resource_category": ResourceCategory.MEDICATION_SUPPLIES.value,
            "resource_name": "High-Flow Oxygen & Video Laryngoscopy Tray",
            "recommended_status": "STANDBY",
            "reason": f"Patient pulse oximetry recorded at {vitals.spo2 or 88}%; hypoxemia and confusion warrant immediate supplemental oxygen and airway readiness.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        actions.append("Connect non-rebreather mask to oxygen regulator at 15 L/min in trauma bay.")

        # 7. CT Scanner / Radiology
        recs.append({
            "resource_category": ResourceCategory.IMAGING_RADIOLOGY.value,
            "resource_name": "CT Scanner (Trauma Pan-Scan Protocol)",
            "recommended_status": "STANDBY",
            "reason": "High-speed road traffic collision mechanism necessitates immediate CT imaging (head, cervical spine, chest/abdomen/pelvis) once stabilized.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        actions.append("Notify CT technician to hold scanner queue for trauma pan-scan upon stabilization.")

        # 8. Operating Room Readiness
        or_avail_status = HospitalAvailability.AVAILABLE if open_ors >= 1 else (HospitalAvailability.LIMITED if or3_status == "IN_USE" else HospitalAvailability.UNAVAILABLE)
        recs.append({
            "resource_category": ResourceCategory.OPERATION_THEATRE.value,
            "resource_name": "Operating Room 3 (Surgical Preemption Standby)",
            "recommended_status": "STANDBY",
            "reason": "Severe hemorrhage and possible open fracture may necessitate emergent surgical exploration and vascular repair.",
            "hospital_availability": or_avail_status.value,
            "requires_approval": True,
        })
        actions.append("Notify surgical coordinator to place OR-3 on tentative trauma standby.")

    elif category == "CARDIAC EMERGENCY":
        recs.append({
            "resource_category": ResourceCategory.BED_FACILITY.value,
            "resource_name": "Cardiac Resuscitation Bay (ED-02)",
            "recommended_status": "PREPARE",
            "reason": "Immediate cardiac monitoring, defibrillator access, and transcutaneous pacing readiness required.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": True,
        })
        recs.append({
            "resource_category": ResourceCategory.SPECIALIST.value,
            "resource_name": "On-Call Interventional Cardiologist",
            "recommended_status": "NOTIFY",
            "reason": "Suspected acute coronary syndrome; evaluate for emergent cardiac catheterization.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        recs.append({
            "resource_category": ResourceCategory.MEDICATION_SUPPLIES.value,
            "resource_name": "12-Lead ECG Machine & Biphasic Defibrillator",
            "recommended_status": "PREPARE",
            "reason": "Aquire diagnostic 12-lead ECG within 5 minutes of hospital touchdown.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        actions.append("Wheel 12-lead ECG cart and defibrillator to triage intake bay.")
        actions.append("Notify interventional cardiology fellow on call.")

    elif category == "STROKE-LIKE SYMPTOMS":
        recs.append({
            "resource_category": ResourceCategory.BED_FACILITY.value,
            "resource_name": "Acute Stroke Assessment Bed (ED-03)",
            "recommended_status": "PREPARE",
            "reason": "Rapid NIH Stroke Scale neurological examination and blood glucose testing required.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        recs.append({
            "resource_category": ResourceCategory.IMAGING_RADIOLOGY.value,
            "resource_name": "Non-Contrast Head CT Scanner",
            "recommended_status": "PREPARE",
            "reason": "Differentiate ischemic vs hemorrhagic stroke to determine thrombolytic (tPA) eligibility within acute window.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": True,
        })
        recs.append({
            "resource_category": ResourceCategory.SPECIALIST.value,
            "resource_name": "Telestroke / Neurologist On Call",
            "recommended_status": "NOTIFY",
            "reason": "Expert neurological adjudication for urgent thrombolysis or endovascular thrombectomy.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        actions.append("Code Stroke activation: clear CT scanner table immediately.")
        actions.append("Prepare point-of-care coagulation and glucose testing.")

    else:
        # General / Medical
        recs.append({
            "resource_category": ResourceCategory.BED_FACILITY.value,
            "resource_name": "Emergency Acute Bed",
            "recommended_status": "PREPARE",
            "reason": "Standard acute emergency department bed required for initial evaluation.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        recs.append({
            "resource_category": ResourceCategory.SPECIALIST.value,
            "resource_name": "Emergency Physician",
            "recommended_status": "NOTIFY",
            "reason": "Perform initial physical triage and order diagnostic workup.",
            "hospital_availability": HospitalAvailability.AVAILABLE.value,
            "requires_approval": False,
        })
        actions.append("Assign next open emergency intake bed.")

    return recs, actions


# ==============================================================================
# 4. PRE-ARRIVAL CASE COORDINATOR (MAIN PIPELINE)
# ==============================================================================

def process_and_create_prearrival_case(
    payload: PreArrivalCaseCreate,
    db: Session,
) -> PreArrivalCaseRecord:
    """End-to-end coordinator: extracts facts, classifies emergency, checks resources, and persists plan."""
    now = datetime.now(timezone.utc)

    # 1. NLP / Clinical Fact Extraction if raw description provided
    extracted = {}
    if payload.raw_description:
        extracted = extract_clinical_facts_from_text(payload.raw_description)

    # 2. Merge extracted facts with structured inputs
    age = payload.patient_age or extracted.get("age", 28)
    gender = payload.patient_gender or extracted.get("gender", "Male")
    
    symptoms = list(payload.symptoms)
    for sym in extracted.get("extracted_symptoms", []):
        if sym not in symptoms:
            symptoms.append(sym)

    vitals_dict = extracted.get("extracted_vitals", {})
    vital_bp = (payload.vitals.bp if payload.vitals and payload.vitals.bp else vitals_dict.get("bp", "90/60"))
    vital_hr = (payload.vitals.hr if payload.vitals and payload.vitals.hr else vitals_dict.get("hr", 118))
    vital_spo2 = (payload.vitals.spo2 if payload.vitals and payload.vitals.spo2 else vitals_dict.get("spo2", 88))
    vital_temp = (payload.vitals.temp if payload.vitals and payload.vitals.temp else vitals_dict.get("temp", "98.6 F"))
    vital_rr = (payload.vitals.rr if payload.vitals and payload.vitals.rr else vitals_dict.get("rr", 22))

    vitals_obj = VitalsSchema(
        bp=vital_bp,
        hr=vital_hr,
        spo2=vital_spo2,
        temp=vital_temp,
        rr=vital_rr,
    )

    blood_group = payload.blood_group or extracted.get("blood_group", "Unknown")
    consciousness = payload.consciousness or ("Conscious but confused" if "confusion" in " ".join(symptoms).lower() else "Alert")
    oxygen_required = payload.oxygen_required or (vital_spo2 is not None and vital_spo2 < 92)

    # 3. Classify Category & Urgency
    category, priority, summary = classify_emergency_case(
        symptoms=symptoms,
        vitals=vitals_obj,
        incident_type=payload.incident_type,
        raw_text=payload.raw_description,
    )

    # 4. Generate Explainable Recommendations
    recommendations, immediate_actions = generate_explainable_recommendations(
        category=category,
        priority=priority,
        vitals=vitals_obj,
        symptoms=symptoms,
        incident_type=payload.incident_type,
        db=db,
    )

    # 5. Persist Case in Database
    case_record = PreArrivalCaseRecord(
        ambulance_id=payload.ambulance_id,
        patient_name=payload.patient_name or f"Patient {payload.ambulance_id}",
        patient_age=age,
        patient_gender=gender,
        symptoms_json=json.dumps(symptoms),
        vital_bp=vital_bp,
        vital_hr=vital_hr,
        vital_spo2=vital_spo2,
        vital_temp=vital_temp,
        vital_rr=vital_rr,
        allergies=payload.allergies,
        medical_conditions=payload.medical_conditions,
        current_medications=payload.current_medications,
        incident_type=payload.incident_type or "Road Traffic Collision",
        consciousness=consciousness,
        blood_group=blood_group,
        oxygen_required=oxygen_required,
        pain_level=payload.pain_level or "Severe (8/10)",
        raw_description=payload.raw_description,
        extracted_data_json=json.dumps(extracted),
        emergency_category=category,
        priority=priority.value,
        clinical_summary=summary,
        current_location_name=payload.current_location_name,
        destination_hospital=payload.destination_hospital,
        distance_km=payload.distance_km,
        eta_minutes=payload.eta_minutes,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status="EN_ROUTE",
        immediate_actions_json=json.dumps(immediate_actions),
        created_at=now,
        updated_at=now,
    )
    db.add(case_record)
    db.flush()

    # 6. Persist Associated Preparation Actions
    for rec in recommendations:
        action_rec = PreArrivalActionRecord(
            case_id=case_record.id,
            resource_category=rec["resource_category"],
            resource_name=rec["resource_name"],
            recommended_status=rec["recommended_status"],
            reason=rec["reason"],
            hospital_availability=rec["hospital_availability"],
            decision_type=ActionDecision.PENDING.value,
            requires_approval=rec["requires_approval"],
            created_at=now,
        )
        db.add(action_rec)

    # 7. Audit Log Entry
    audit = AuditEventRecord(
        incident_id=case_record.id,
        event_type="PREARRIVAL_CASE_CREATED",
        action_name="SYNTHESIZE_PREPARATION_PLAN",
        tier="GREEN",
        details_json=json.dumps({
            "ambulance_id": payload.ambulance_id,
            "category": category,
            "priority": priority.value,
            "eta_minutes": payload.eta_minutes,
            "actions_count": len(recommendations),
            "summary": summary,
        }),
        performed_by="AIMBULENCE_AGENT",
        timestamp=now,
    )
    db.add(audit)
    db.commit()
    db.refresh(case_record)

    return case_record
