import type { HospitalCapacity, Incident, ResourceStatus } from "@/types/domain";

/**
 * Deterministic operational deficit and bottleneck analysis.
 *
 * GOVERNANCE:
 * - NO LLM or probabilistic reasoning.
 * - NO invented deficit numbers or arbitrary "AI recommendations".
 * - Deterministic arithmetic strictly computed from real backend values.
 * - Every metric explicitly labels source values as BACKEND and computed values as DERIVED.
 */

export type DeficitSeverity = "CRITICAL" | "WARNING" | "NOMINAL";

export interface MetricSource {
  readonly label: string;
  readonly value: string | number;
  readonly source: "BACKEND";
}

export interface MetricDerived {
  readonly label: string;
  readonly value: string | number;
  readonly source: "DERIVED";
}

export interface OperationalDeficitItem {
  readonly id: string;
  readonly title: string;
  readonly severity: DeficitSeverity;
  readonly backendSources: readonly MetricSource[];
  readonly derivedMetric: MetricDerived;
  readonly formula: string;
  readonly note: string;
}

/**
 * Computes deterministic bottlenecks and deficits from verified backend models.
 */
export function computeOperationalDeficits(
  hospital?: HospitalCapacity,
  resources?: ResourceStatus,
  incident?: Incident,
): readonly OperationalDeficitItem[] {
  const items: OperationalDeficitItem[] = [];

  // 1. Emergency Department Bed Surge Deficit
  if (hospital) {
    if (incident) {
      const deficit = Math.max(0, incident.casualtyCount - hospital.emergencyBedsAvailable);
      const isDeficit = deficit > 0;
      items.push({
        id: "ed-surge-deficit",
        title: "Emergency Department Bed Surge Deficit",
        severity: isDeficit ? "CRITICAL" : "NOMINAL",
        backendSources: [
          { label: "Incoming Casualties", value: incident.casualtyCount, source: "BACKEND" },
          { label: "Available ED Beds", value: hospital.emergencyBedsAvailable, source: "BACKEND" },
          { label: "Total ED Capacity", value: hospital.emergencyBedsTotal, source: "BACKEND" },
        ],
        derivedMetric: {
          label: "Immediate Bed Shortfall",
          value: isDeficit ? `-${deficit} beds` : "0 (Adequate)",
          source: "DERIVED",
        },
        formula: "max(0, incoming_casualties - available_ed_beds)",
        note: isDeficit
          ? `Casualty intake exceeds available ED capacity by ${deficit} beds. Emergency surge mobilization required.`
          : "Available ED capacity satisfies immediate casualty arrivals.",
      });
    } else {
      const occupied = hospital.emergencyBedsTotal - hospital.emergencyBedsAvailable;
      const pct = hospital.emergencyBedsTotal > 0
        ? Math.round((occupied / hospital.emergencyBedsTotal) * 100)
        : 0;
      items.push({
        id: "ed-baseline-occupancy",
        title: "Emergency Department Baseline Occupancy",
        severity: pct >= 90 ? "CRITICAL" : pct >= 75 ? "WARNING" : "NOMINAL",
        backendSources: [
          { label: "Available ED Beds", value: hospital.emergencyBedsAvailable, source: "BACKEND" },
          { label: "Total ED Beds", value: hospital.emergencyBedsTotal, source: "BACKEND" },
        ],
        derivedMetric: {
          label: "ED Occupancy Rate",
          value: `${pct}% (${occupied}/${hospital.emergencyBedsTotal} occupied)`,
          source: "DERIVED",
        },
        formula: "((total_ed_beds - available_ed_beds) / total_ed_beds) * 100",
        note: `Current ED bed occupancy is at ${pct}%.`,
      });
    }

    // 2. ICU Critical Care Buffer
    const icuOccupied = hospital.icuBedsTotal - hospital.icuBedsAvailable;
    const icuPct = hospital.icuBedsTotal > 0
      ? Math.round((icuOccupied / hospital.icuBedsTotal) * 100)
      : 0;
    const icuSeverity: DeficitSeverity =
      hospital.icuBedsAvailable <= 2 ? "CRITICAL" : hospital.icuBedsAvailable <= 4 ? "WARNING" : "NOMINAL";

    items.push({
      id: "icu-surge-buffer",
      title: "ICU Critical Care Surge Buffer",
      severity: icuSeverity,
      backendSources: [
        { label: "Available ICU Beds", value: hospital.icuBedsAvailable, source: "BACKEND" },
        { label: "Total ICU Beds", value: hospital.icuBedsTotal, source: "BACKEND" },
      ],
      derivedMetric: {
        label: "ICU Occupancy Rate",
        value: `${icuPct}% (${icuOccupied}/${hospital.icuBedsTotal} occupied)`,
        source: "DERIVED",
      },
      formula: "((total_icu_beds - available_icu_beds) / total_icu_beds) * 100",
      note: `${hospital.icuBedsAvailable} ICU bed(s) available for critical post-operative admissions.`,
    });

    // 3. Operating Theatres (OR) Readiness & Clearance Need
    const inUseOrs = hospital.operatingRoomsTotal - hospital.operatingRoomsAvailable;
    const orSeverity: DeficitSeverity =
      hospital.operatingRoomsAvailable < 2 ? "CRITICAL" : hospital.operatingRoomsAvailable < 3 ? "WARNING" : "NOMINAL";

    items.push({
      id: "or-theater-readiness",
      title: "Operating Theatres (OR) Trauma Readiness",
      severity: orSeverity,
      backendSources: [
        { label: "Staffed & Open ORs", value: hospital.operatingRoomsAvailable, source: "BACKEND" },
        { label: "Total ORs", value: hospital.operatingRoomsTotal, source: "BACKEND" },
      ],
      derivedMetric: {
        label: "Theatres Pending Clearance",
        value: `${inUseOrs} occupied / elective`,
        source: "DERIVED",
      },
      formula: "total_operating_rooms - open_operating_rooms",
      note: `${hospital.operatingRoomsAvailable} OR(s) immediately clear for trauma reception. ${inUseOrs} OR(s) in non-urgent or elective status.`,
    });
  }

  // 4. Critical Blood Bank Reserves (O-Negative)
  if (resources && resources.bloodInventory.length > 0) {
    const oNeg = resources.bloodInventory.find((b) => b.bloodType === "O_NEG");
    if (oNeg) {
      const margin = oNeg.unitsAvailable - oNeg.minimumThreshold;
      const bloodSeverity: DeficitSeverity =
        margin < 0 ? "CRITICAL" : margin <= 5 ? "WARNING" : "NOMINAL";

      items.push({
        id: "blood-oneg-reserves",
        title: "O-Negative Universal Donor Blood Reserves",
        severity: bloodSeverity,
        backendSources: [
          { label: "O-Neg Units On Hand", value: oNeg.unitsAvailable, source: "BACKEND" },
          { label: "Minimum Safety Threshold", value: oNeg.minimumThreshold, source: "BACKEND" },
        ],
        derivedMetric: {
          label: "Threshold Safety Margin",
          value: margin >= 0 ? `+${margin} units buffer` : `${margin} units DEFICIT`,
          source: "DERIVED",
        },
        formula: "units_available - minimum_threshold",
        note: margin >= 0
          ? `Reserves exceed minimum baseline by ${margin} units.`
          : `Critical shortage: O-Neg reserves are below minimum safety threshold by ${Math.abs(margin)} units.`,
      });
    }
  }

  // 5. Trauma Specialist Staffing Load
  if (resources && resources.staff.length > 0) {
    const traumaSurgeons = resources.staff.filter(
      (m) => m.role === "TRAUMA_SURGEON" && m.isOnDuty,
    );
    const surgeonsCount = traumaSurgeons.length;

    if (incident && incident.casualtyCount > 0) {
      const ratio = Math.round(incident.casualtyCount / Math.max(1, surgeonsCount));
      const staffSeverity: DeficitSeverity =
        surgeonsCount === 0 ? "CRITICAL" : ratio > 12 ? "CRITICAL" : ratio > 6 ? "WARNING" : "NOMINAL";

      items.push({
        id: "trauma-staffing-load",
        title: "Trauma Surgical Coverage Load",
        severity: staffSeverity,
        backendSources: [
          { label: "Trauma Surgeons On Duty", value: surgeonsCount, source: "BACKEND" },
          { label: "Incoming Casualties", value: incident.casualtyCount, source: "BACKEND" },
        ],
        derivedMetric: {
          label: "Casualty-to-Surgeon Ratio",
          value: `${ratio}:1 ratio`,
          source: "DERIVED",
        },
        formula: "incoming_casualties / active_trauma_surgeons",
        note: `${surgeonsCount} trauma surgeon(s) on duty for ${incident.casualtyCount} anticipated casualties.`,
      });
    }
  }

  return items;
}
