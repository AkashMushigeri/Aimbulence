"use client";

import { useState, useTransition } from "react";
import type { CaseCreatePayload, PreArrivalCase } from "@/types/domain/prearrival";
import {
  createPreArrivalCaseAction,
  markPreArrivalArrivedAction,
  seedPreArrivalDemoAction,
  updatePreArrivalLocationAction,
} from "@/app/actions";

interface AmbulanceIntakeProps {
  onCaseCreated?: (created: PreArrivalCase) => void;
  activeCase?: PreArrivalCase | null;
}

export function AmbulanceIntake({ onCaseCreated, activeCase: initialCase }: AmbulanceIntakeProps) {
  const [activeCase, setActiveCase] = useState<PreArrivalCase | null>(initialCase ?? null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [ambulanceId, setAmbulanceId] = useState("AMB-102");
  const [patientName, setPatientName] = useState("Alex Turner");
  const [patientAge, setPatientAge] = useState<number | "">(28);
  const [patientGender, setPatientGender] = useState("Male");
  const [rawDescription, setRawDescription] = useState(
    "28 year old male involved in a road traffic accident. Severe bleeding from left leg. BP 90/60. Heart rate 118. SpO2 88%. Patient is conscious but confused. Possible fracture. Blood group unknown.",
  );
  const [bp, setBp] = useState("90/60");
  const [hr, setHr] = useState<number | "">(118);
  const [spo2, setSpo2] = useState<number | "">(88);
  const [temp, setTemp] = useState("98.4 F");
  const [rr, setRr] = useState<number | "">(24);
  const [consciousness, setConsciousness] = useState("Conscious but confused");
  const [bloodGroup, setBloodGroup] = useState("Unknown");
  const [oxygenRequired, setOxygenRequired] = useState(true);
  const [painLevel, setPainLevel] = useState("Severe (8/10)");
  const [locationName, setLocationName] = useState("Tumakuru Road, Mile 8");
  const [distanceKm, setDistanceKm] = useState(8.4);
  const [etaMinutes, setEtaMinutes] = useState(14);

  const handleFillDemoScenario = () => {
    setAmbulanceId("AMB-102");
    setPatientName("Alex Turner");
    setPatientAge(28);
    setPatientGender("Male");
    setRawDescription(
      "28 year old male involved in a road traffic accident. Severe bleeding from left leg. BP 90/60. Heart rate 118. SpO2 88%. Patient is conscious but confused. Possible fracture. Blood group unknown.",
    );
    setBp("90/60");
    setHr(118);
    setSpo2(88);
    setTemp("98.4 F");
    setRr(24);
    setConsciousness("Conscious but confused");
    setBloodGroup("Unknown");
    setOxygenRequired(true);
    setPainLevel("Severe (8/10)");
    setLocationName("Tumakuru Road, Mile 8");
    setDistanceKm(8.4);
    setEtaMinutes(14);
    setFeedback("Loaded 28yo Male Road Traffic Accident Demo Scenario.");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const payload: CaseCreatePayload = {
      ambulance_id: ambulanceId,
      raw_description: rawDescription,
      patient_name: patientName || undefined,
      patient_age: typeof patientAge === "number" ? patientAge : undefined,
      patient_gender: patientGender,
      symptoms: ["Severe active hemorrhage", "Hypotension", "Possible fracture", "Altered mental status"],
      vitals: {
        bp: bp || undefined,
        hr: typeof hr === "number" ? hr : undefined,
        spo2: typeof spo2 === "number" ? spo2 : undefined,
        temp: temp || undefined,
        rr: typeof rr === "number" ? rr : undefined,
      },
      allergies: "None known (NKDA)",
      medical_conditions: "No chronic conditions",
      current_medications: "None",
      incident_type: "Road Traffic Accident (High-Speed Vehicle Collision)",
      consciousness,
      blood_group: bloodGroup,
      oxygen_required: oxygenRequired,
      pain_level: painLevel,
      current_location_name: locationName,
      destination_hospital: "Metro Central Trauma Hospital",
      distance_km: distanceKm,
      eta_minutes: etaMinutes,
    };

    startTransition(async () => {
      const res = await createPreArrivalCaseAction(payload);
      if (res.ok && res.case) {
        setActiveCase(res.case);
        setFeedback(res.message ?? "Case successfully transmitted to hospital.");
        onCaseCreated?.(res.case);
      } else {
        setFeedback(res.message ?? "Transmission failed.");
      }
    });
  };

  const handleSimulateEta = (newEta: number) => {
    if (!activeCase) return;
    const newDistance = Math.max(0, Number((distanceKm * (newEta / Math.max(1, activeCase.eta_minutes))).toFixed(1)));
    startTransition(async () => {
      const res = await updatePreArrivalLocationAction(activeCase.id, {
        eta_minutes: newEta,
        distance_km: newDistance,
        current_location_name: newEta <= 0 ? "Hospital Trauma Bay" : locationName,
      });
      if (res.ok && res.case) {
        setActiveCase(res.case);
        setDistanceKm(newDistance);
        setEtaMinutes(newEta);
      }
    });
  };

  const handleArrive = () => {
    if (!activeCase) return;
    startTransition(async () => {
      const res = await markPreArrivalArrivedAction(activeCase.id);
      if (res.ok && res.case) {
        setActiveCase(res.case);
        setEtaMinutes(0);
        setDistanceKm(0);
        setFeedback("Ambulance arrived at emergency trauma bay.");
      }
    });
  };

  const handleQuickSeed = () => {
    startTransition(async () => {
      const res = await seedPreArrivalDemoAction();
      if (res.ok && res.case) {
        setActiveCase(res.case);
        setFeedback("Flagship demo case seeded directly on server.");
        onCaseCreated?.(res.case);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Fill Controls */}
      <div className="rounded-xl border border-stone-200 bg-[#fffdfa] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-mono text-lg font-bold tracking-tight text-stone-900">
                AMBULANCE TELEMETRY & PATIENT PRE-CHECK
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600 sm:text-sm">
              Transmit en-route patient vitals and natural-language incident notes to hospital trauma teams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleFillDemoScenario}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 font-mono text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
            >
              <span>⚡</span> Load 28yo Collision Scenario
            </button>

            <button
              type="button"
              onClick={handleQuickSeed}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 font-mono text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
            >
              <span>🔄</span> 1-Click Server Seed
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2 font-mono text-xs font-medium text-sky-800">
            {feedback}
          </div>
        )}
      </div>

      {/* Active Transmission Card (if transmitted) */}
      {activeCase && (
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-200 pb-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-emerald-600 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-white">
                {activeCase.status}
              </span>
              <h3 className="font-mono text-base font-bold text-stone-900">
                Unit {activeCase.ambulance_id} — {activeCase.destination_hospital}
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Remaining</span>
                <p className="font-mono text-lg font-bold text-stone-900">
                  {activeCase.eta_minutes} min ({activeCase.distance_km} km)
                </p>
              </div>

              {activeCase.status !== "ARRIVED" ? (
                <button
                  type="button"
                  onClick={handleArrive}
                  disabled={isPending}
                  className="rounded-lg bg-emerald-700 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  Mark Arrived
                </button>
              ) : (
                <span className="rounded-lg bg-emerald-200 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
                  ARRIVED AT HOSPITAL
                </span>
              )}
            </div>
          </div>

          {/* Quick ETA Simulator Slider */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs font-bold text-stone-700">Simulate ETA:</span>
            {[14, 10, 5, 2, 0].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSimulateEta(m)}
                disabled={isPending}
                className={`rounded border px-2.5 py-1 font-mono text-xs font-semibold transition ${
                  activeCase.eta_minutes === m
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                {m === 0 ? "Touchdown (0m)" : `${m}m`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-[#fffdfa] p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Natural Language Description */}
          <div className="space-y-4">
            <div>
              <label htmlFor="rawDescription" className="block font-mono text-xs font-bold uppercase tracking-wider text-stone-700">
                1. Natural Language Clinical Incident Description
              </label>
              <p className="mt-1 text-xs text-stone-500">
                Paramedics can speak or type freely. AIMBULENCE AI will automatically extract vitals, symptoms, and priority.
              </p>
              <textarea
                id="rawDescription"
                rows={5}
                value={rawDescription}
                onChange={(e) => setRawDescription(e.target.value)}
                placeholder="Describe patient condition, mechanism of injury, acute bleeding, vitals, and consciousness..."
                className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-3 font-sans text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Ambulance ID</label>
                <input
                  type="text"
                  value={ambulanceId}
                  onChange={(e) => setAmbulanceId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Patient Name / Identifier</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Age</label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Gender</label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Current Location</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">ETA (Minutes)</label>
                <input
                  type="number"
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Structured Vitals */}
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-stone-700">
                2. Structured Clinical Vitals
              </label>
              <p className="mt-1 text-xs text-stone-500">
                Direct paramedic input. Values automatically trigger hospital preparation alarms if anomalous.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <span className="block font-mono text-xs text-stone-500">Blood Pressure (BP)</span>
                <input
                  type="text"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  placeholder="e.g. 90/60"
                  className="mt-1 w-full font-mono text-lg font-bold text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">Target &gt; 95 mmHg</span>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <span className="block font-mono text-xs text-stone-500">Heart Rate (HR)</span>
                <input
                  type="number"
                  value={hr}
                  onChange={(e) => setHr(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 118"
                  className="mt-1 w-full font-mono text-lg font-bold text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">BPM (Normal 60-100)</span>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <span className="block font-mono text-xs text-stone-500">SpO2 Oxygen Saturation</span>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 88"
                  className="mt-1 w-full font-mono text-lg font-bold text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">% (Normal &gt;= 95%)</span>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <span className="block font-mono text-xs text-stone-500">Respiratory Rate (RR)</span>
                <input
                  type="number"
                  value={rr}
                  onChange={(e) => setRr(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 24"
                  className="mt-1 w-full font-mono text-lg font-bold text-stone-900 focus:outline-none"
                />
                <span className="text-[10px] text-stone-400">Breaths / min</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Neurological State / GCS</label>
                <select
                  value={consciousness}
                  onChange={(e) => setConsciousness(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                >
                  <option value="Alert">Alert (GCS 15)</option>
                  <option value="Conscious but confused">Conscious but confused (GCS 12-14)</option>
                  <option value="Responds to voice">Responds to voice (GCS 9-11)</option>
                  <option value="Unresponsive">Unresponsive / Comatose (GCS &lt; 8)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs font-medium text-stone-600">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 font-mono text-sm text-stone-900"
                >
                  <option value="Unknown">Unknown (Stage O-Neg)</option>
                  <option value="O_NEG">O-Negative</option>
                  <option value="O_POS">O-Positive</option>
                  <option value="A_POS">A-Positive</option>
                  <option value="B_POS">B-Positive</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="oxygen"
                type="checkbox"
                checked={oxygenRequired}
                onChange={(e) => setOxygenRequired(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
              />
              <label htmlFor="oxygen" className="font-mono text-xs font-medium text-stone-800">
                Patient actively receiving supplemental oxygen via mask
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 border-t border-stone-200 pt-5">
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing Clinical Facts &amp; Generating Pre-Arrival Plan...
              </>
            ) : (
              <>
                <span>🚨</span> ANALYZE &amp; TRANSMIT PRE-ARRIVAL ALERT TO HOSPITAL
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-stone-400">
            AIMBULENCE Coordination Assistant — Clinical preparation recommendation engine.
          </p>
        </div>
      </form>
    </div>
  );
}
