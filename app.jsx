const { useState } = React;

// The DEMO copy runs entirely in the browser by default: no network,
// no backend needed. If you want to point it at the FastAPI backend
// from the NM repo (identical logic, useful for double-checking),
// switch the source dropdown to "Backend API" and set the URL.

const DEFAULT_API_BASE =
  (typeof window !== "undefined" && window.RESIDENCY_API_BASE) ||
  localStorage.getItem("residencyApiBase") ||
  "http://localhost:8000";

const CITIZENSHIPS = [
  { value: "indian", label: "Indian citizen" },
  { value: "oci", label: "OCI / PIO" },
  { value: "foreign", label: "Foreign" },
];

const PURPOSES = [
  { value: "employment", label: "Employment" },
  { value: "business", label: "Business" },
  { value: "visit", label: "Visit" },
  { value: "other", label: "Other" },
];

const TAX_STATUS_LABEL = {
  resident: "Resident",
  rnor: "RNOR",
  non_resident: "Non-Resident",
  requires_professional_review: "Requires professional review",
};

const FEMA_STATUS_LABEL = {
  person_resident_in_india: "Person Resident in India",
  person_resident_outside_india: "Person Resident outside India",
  requires_professional_review: "Requires professional review",
};

function statusBadgeClass(status) {
  if (status === "requires_professional_review") return "warn";
  if (
    status === "resident" ||
    status === "rnor" ||
    status === "person_resident_in_india"
  )
    return "ok";
  return "bad";
}

function fyLabel(year) {
  const nextYY = String(year + 1).slice(-2);
  return `${year}-${nextYY}`;
}

function App() {
  const [source, setSource] = useState(
    localStorage.getItem("residencySource") || "local",
  );
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [citizenship, setCitizenship] = useState("indian");
  const [trips, setTrips] = useState([
    {
      date_of_departure_from_india: "2024-08-01",
      date_of_arrival_in_india: "2025-02-15",
      purpose: "employment",
    },
  ]);
  const [incomes, setIncomes] = useState([
    {
      fy_start_year: 2024,
      indian_source_income_inr: 500000,
      liable_to_tax_elsewhere: null,
    },
  ]);
  const [fyRange, setFyRange] = useState({ start: 2024, end: 2024 });
  const [currentStayPurpose, setCurrentStayPurpose] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function updateTrip(i, patch) {
    setTrips((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }
  function addTrip() {
    setTrips((prev) => [
      ...prev,
      {
        date_of_departure_from_india: "",
        date_of_arrival_in_india: "",
        purpose: "visit",
      },
    ]);
  }
  function removeTrip(i) {
    setTrips((prev) => prev.filter((_, j) => j !== i));
  }

  function updateIncome(i, patch) {
    setIncomes((prev) =>
      prev.map((y, j) => (j === i ? { ...y, ...patch } : y)),
    );
  }
  function addIncome() {
    setIncomes((prev) => [
      ...prev,
      {
        fy_start_year: (prev[prev.length - 1]?.fy_start_year ?? 2024) + 1,
        indian_source_income_inr: 0,
        liable_to_tax_elsewhere: null,
      },
    ]);
  }
  function removeIncome(i) {
    setIncomes((prev) => prev.filter((_, j) => j !== i));
  }

  function buildInput() {
    const fyStartYears = [];
    for (let y = fyRange.start; y <= fyRange.end; y++) fyStartYears.push(y);
    const normalisedIncomes = incomes.map((y) => ({
      fy_start_year: y.fy_start_year,
      indian_source_income_inr: y.indian_source_income_inr,
      liable_to_tax_elsewhere:
        y.liable_to_tax_elsewhere === "yes"
          ? true
          : y.liable_to_tax_elsewhere === "no"
            ? false
            : null,
    }));
    return {
      citizenship,
      trips,
      incomes: normalisedIncomes,
      fy_start_years: fyStartYears,
      current_stay_purpose_override: currentStayPurpose || null,
    };
  }

  async function calculate() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      localStorage.setItem("residencySource", source);
      const input = buildInput();
      if (source === "local") {
        const rows = window.ResidencyCalc.calculate({
          trips: input.trips,
          incomes: input.incomes,
          citizenship: input.citizenship,
          fyStartYears: input.fy_start_years,
          currentStayPurposeOverride: input.current_stay_purpose_override,
        });
        setResults({ calculation_id: "in-browser", results: rows });
      } else {
        localStorage.setItem("residencyApiBase", apiBase);
        const payload = { ...input };
        if (!payload.current_stay_purpose_override) {
          delete payload.current_stay_purpose_override;
        } else {
          payload.current_stay_purpose_override =
            input.current_stay_purpose_override;
        }
        const res = await fetch(`${apiBase}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        setResults(await res.json());
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>India Residency Calculator</h1>
      <p className="muted">
        Income-tax Act 1961 Sections 6(1), 6(1A), 6(6) and FEMA 1999 Section
        2(v). Statutory facts and citations only — not tax advice.
      </p>

      <div className="card">
        <h3>Source</h3>
        <div className="row">
          <div>
            <label>Where to compute</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="local">In this browser (offline)</option>
              <option value="api">Backend API</option>
            </select>
          </div>
          {source === "api" && (
            <div style={{ gridColumn: "span 3" }}>
              <label>API base URL</label>
              <input
                type="url"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="http://localhost:8000"
              />
            </div>
          )}
        </div>
        <p className="muted">
          {source === "local"
            ? "All logic runs locally via calculator.js — the JS mirror of the FastAPI backend. Nothing leaves this page."
            : "Requests go to the FastAPI backend at the URL above."}
        </p>
      </div>

      <div className="card">
        <h3>Person</h3>
        <div className="row">
          <div>
            <label>Citizenship</label>
            <select
              value={citizenship}
              onChange={(e) => setCitizenship(e.target.value)}
            >
              {CITIZENSHIPS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Report from FY (start year)</label>
            <input
              type="number"
              value={fyRange.start}
              onChange={(e) =>
                setFyRange((r) => ({ ...r, start: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <label>Report to FY (start year)</label>
            <input
              type="number"
              value={fyRange.end}
              onChange={(e) =>
                setFyRange((r) => ({ ...r, end: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <label>
              Purpose of current stay (override)
              <span className="muted"> — blank = infer from trips</span>
            </label>
            <select
              value={currentStayPurpose}
              onChange={(e) => setCurrentStayPurpose(e.target.value)}
            >
              <option value="">(infer)</option>
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Trips out of India</h3>
        <p className="muted">
          Departure and arrival days both count as days in India.
        </p>
        {trips.map((t, i) => (
          <div className="row trip" key={i}>
            <div>
              <label>Departure from India</label>
              <input
                type="date"
                value={t.date_of_departure_from_india}
                onChange={(e) =>
                  updateTrip(i, { date_of_departure_from_india: e.target.value })
                }
              />
            </div>
            <div>
              <label>Arrival back in India</label>
              <input
                type="date"
                value={t.date_of_arrival_in_india}
                onChange={(e) =>
                  updateTrip(i, { date_of_arrival_in_india: e.target.value })
                }
              />
            </div>
            <div>
              <label>Purpose</label>
              <select
                value={t.purpose}
                onChange={(e) => updateTrip(i, { purpose: e.target.value })}
              >
                {PURPOSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: "end" }}>
              <button
                className="secondary"
                type="button"
                onClick={() => removeTrip(i)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button className="secondary" type="button" onClick={addTrip}>
          + Add trip
        </button>
      </div>

      <div className="card">
        <h3>Annual Indian-source income</h3>
        <p className="muted">
          "Total income other than income from foreign sources" per Explanation
          2 to Section 6(1). Liable-to-tax-elsewhere is used only by Section
          6(1A).
        </p>
        {incomes.map((y, i) => (
          <div className="row income" key={i}>
            <div>
              <label>FY (start year, e.g. 2024 = 2024-25)</label>
              <input
                type="number"
                value={y.fy_start_year}
                onChange={(e) =>
                  updateIncome(i, { fy_start_year: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label>Indian-source income (INR)</label>
              <input
                type="number"
                value={y.indian_source_income_inr}
                onChange={(e) =>
                  updateIncome(i, {
                    indian_source_income_inr: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label>Liable to tax in another country?</label>
              <select
                value={y.liable_to_tax_elsewhere ?? ""}
                onChange={(e) =>
                  updateIncome(i, { liable_to_tax_elsewhere: e.target.value })
                }
              >
                <option value="">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div style={{ alignSelf: "end" }}>
              <button
                className="secondary"
                type="button"
                onClick={() => removeIncome(i)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button className="secondary" type="button" onClick={addIncome}>
          + Add year
        </button>
      </div>

      <button onClick={calculate} disabled={loading}>
        {loading ? "Calculating…" : "Calculate"}
      </button>

      {error && (
        <div className="card error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {results && <Results data={results} />}
    </div>
  );
}

function Results({ data }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>
        Results{" "}
        <span className="muted" style={{ fontWeight: "normal" }}>
          (calculation #{data.calculation_id})
        </span>
      </h3>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>FY</th>
              <th>Days in India</th>
              <th>Tax status</th>
              <th>Tax section</th>
              <th>FEMA status</th>
              <th>FEMA section</th>
              <th>Disagree</th>
              <th>RNOR window closes</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.fy_start_year}>
                <td>{r.fy_label}</td>
                <td>{r.days_in_india}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(r.tax_status)}`}>
                    {TAX_STATUS_LABEL[r.tax_status]}
                  </span>
                </td>
                <td className="muted">{r.tax_section}</td>
                <td>
                  <span className={`badge ${statusBadgeClass(r.fema_status)}`}>
                    {FEMA_STATUS_LABEL[r.fema_status]}
                  </span>
                </td>
                <td className="muted">{r.fema_section}</td>
                <td>
                  {r.statuses_disagree ? (
                    <span className="badge warn">Yes</span>
                  ) : (
                    <span className="muted">No</span>
                  )}
                </td>
                <td>
                  {r.rnor_window_close_date ? (
                    <span>
                      {r.rnor_window_close_date}
                      <div className="muted">
                        {r.rnor_years_remaining
                          .map((y) => fyLabel(y))
                          .join(", ")}
                      </div>
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.results.map((r) => (
        <details key={r.fy_start_year}>
          <summary>Audit trail — {r.fy_label}</summary>
          <ol className="audit">
            {r.audit_trail.map((x, i) => (
              <li key={i}>
                <strong>
                  {x.passed ? "✓" : "·"} {x.section}
                </strong>{" "}
                — {x.detail}
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
