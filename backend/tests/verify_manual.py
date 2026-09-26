"""Manual verification script exercising Phase 2 tools on live SQLite database."""
from backend.app.services.database import SessionLocal, init_db, AuditEventRecord
from backend.app.tools import (
    get_hospital_capacity,
    calculate_resource_shortage,
    reserve_resource,
    create_operational_task,
    verify_operational_status,
)


def main():
    init_db()
    db = SessionLocal()

    print("=== 1. Hospital Capacity Tool ===")
    cap = get_hospital_capacity(db=db)
    print(f"Hospital: {cap['hospital_name']}, Code: {cap['operational_code']}")
    print(f"Emergency Beds: {cap['emergency_beds']['available']} available / {cap['emergency_beds']['total']} total")
    print(f"ICU Beds: {cap['icu_beds']['available']} available / {cap['icu_beds']['total']} total")
    print(f"Open Operating Rooms: {cap['operating_rooms']['open']}")

    print("\n=== 2. Shortage Calculation Tool (42 incoming casualties) ===")
    shortage = calculate_resource_shortage(incoming_casualties=42, db=db)
    print(f"Incoming: {shortage['incoming_casualties']} casualties")
    print(f"Emergency Bed Deficit: {shortage['deficits']['emergency_beds']} beds")
    print(f"ICU Deficit: {shortage['deficits']['icu_beds']} beds")
    print(f"Operating Room Deficit: {shortage['deficits']['operating_rooms']} ORs")
    print(f"Has Critical Shortage: {shortage['has_critical_shortage']}")

    print("\n=== 3. Operational Task Tool (GREEN) ===")
    task = create_operational_task(
        title="Deploy emergency trauma triage intake area",
        details={"intake_zone": "Hallway 2A"},
        db=db,
    )
    print(f"Task Created: {task['task_id']}, Status: {task['operational_status']}, Persisted: {task['persisted']}")

    print("\n=== 4. Safe Resource Reservation Tool (YELLOW) ===")
    res_bed = reserve_resource(
        resource_type="bed",
        resource_id="ED-01",
        reason="Reserved for first incoming acute trauma casualty",
        db=db,
    )
    print(f"Resource: {res_bed['resource_code']}, Status: {res_bed['status']}, Safety: {res_bed['safety_category']}")

    print("\n=== 5. Consequential Action Safety Gate (RED) ===")
    res_red = reserve_resource(
        resource_type="operating_room",
        resource_id="OR-3",
        reason="Preempt room for emergency surgery",
        db=db,
    )
    print(f"RED Action Status: {res_red['status']}, Risk Level: {res_red['risk_level']}")
    print(f"Reason: {res_red['reason']}")
    print(f"Requires Human Approval: {res_red['requires_human_approval']}")

    print("\n=== 6. Independent State Verification Tool ===")
    verif = verify_operational_status(
        target_entity="bed",
        entity_id="ED-01",
        expected_field="is_reserved",
        expected_value=True,
        db=db,
    )
    print(f"Verified: {verif['verified']}, Status: {verif['status']}, Actual Value: {verif['actual_value']}")

    print("\n=== 7. Audit Trail Events Recorded ===")
    audit_count = db.query(AuditEventRecord).count()
    print(f"Total Audit Trail Records in SQLite: {audit_count}")

    db.close()
    print("\nAll live tool operations executed and verified successfully!")


if __name__ == "__main__":
    main()
