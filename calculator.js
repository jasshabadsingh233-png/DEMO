// Indian residency calculator — pure-JS port of the FastAPI backend
// from jasshabadsingh233-png/NM. Same rule names, same audit format,
// same thresholds. Everything runs in the browser; no network calls.
//
// This file is intentionally the source of truth for numeric
// thresholds *in the browser*. When the backend's constants.py
// changes, mirror the change here.

// ===========================================================================
// Constants — every threshold cited to its section
// ===========================================================================

// Section 6(1)(a): "182 days or more". Inclusive.
const STAY_DAYS_MAIN = 182;

// Section 6(1)(c): 60+ days in FY AND 365+ days across preceding 4 FYs.
const STAY_DAYS_ADDITIONAL = 60;
const PRECEDING_FOUR_YEARS_DAYS = 365;

// Explanation 1(a): Indian citizen leaving for employment / Indian
// ship crew — 60 → 182 in Section 6(1)(c).
const RELAXED_STAY_DAYS_LEAVING_FOR_EMPLOYMENT = 182;

// Explanation 1(b): Indian citizen / PIO visiting — 60 → 182.
const RELAXED_STAY_DAYS_VISIT = 182;

// Proviso to Explanation 1(b) — high-income visitor: 60 → 120.
const VISIT_HIGH_INCOME_STAY_DAYS = 120;

// ₹15 lakh threshold shared by Section 6(1A), the Expl. 1(b) proviso,
// and Sections 6(6)(c)/(d).
const HIGH_INCOME_THRESHOLD_INR = 1_500_000;

// Section 6(6)(a): non-resident in 9 of 10 preceding FYs.
const RNOR_NON_RESIDENT_YEARS_REQUIRED = 9;
const RNOR_NON_RESIDENT_LOOKBACK_YEARS = 10;

// Section 6(6)(b): ≤ 729 days in preceding 7 FYs.
const RNOR_STAY_DAYS_MAX = 729;
const RNOR_STAY_LOOKBACK_YEARS = 7;

// FEMA 2(v)(i): "more than 182" — strict inequality (contrast 6(1)(a)).
const FEMA_PRECEDING_FY_STAY_DAYS = 182;

const FY_START_MONTH = 4; // April
const FY_START_DAY = 1;
const FY_END_MONTH = 3; // March
const FY_END_DAY = 31;

// ===========================================================================
// Date helpers — dates are stored as "YYYY-MM-DD" strings; we compare
// them as ISO strings (safe because of zero-padding) and do arithmetic
// via Date objects only where necessary.
// ===========================================================================

function isoDate(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toUTC(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(a, b) {
  // Inclusive count b - a in days.
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

function addDays(iso, n) {
  const ms = toUTC(iso) + n * 86400000;
  const dt = new Date(ms);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function fyBounds(fyStartYear) {
  return {
    start: isoDate(fyStartYear, FY_START_MONTH, FY_START_DAY),
    end: isoDate(fyStartYear + 1, FY_END_MONTH, FY_END_DAY),
  };
}

// ===========================================================================
// Day counter
// ===========================================================================

function outsideDaysInWindow(trip, start, end) {
  // Trip endpoints both count as days in India, so outside portion is
  // (departure, arrival) = [departure+1, arrival-1] inclusive.
  const outStart = addDays(trip.date_of_departure_from_india, 1);
  const outEnd = addDays(trip.date_of_arrival_in_india, -1);
  if (outEnd < outStart) return 0;
  const lo = outStart > start ? outStart : start;
  const hi = outEnd < end ? outEnd : end;
  if (hi < lo) return 0;
  return daysBetween(lo, hi) + 1;
}

function daysInFy(trips, fyStartYear) {
  const { start, end } = fyBounds(fyStartYear);
  const totalDays = daysBetween(start, end) + 1;
  let outside = 0;
  for (const t of trips) outside += outsideDaysInWindow(t, start, end);
  return totalDays - outside;
}

function daysInPrecedingFys(trips, fyStartYear, nYears) {
  let sum = 0;
  for (let i = 0; i < nYears; i++) {
    sum += daysInFy(trips, fyStartYear - i - 1);
  }
  return sum;
}

// ===========================================================================
// Rule result and status constants
// ===========================================================================

function rr(section, passed, detail, thresholds_used = {}) {
  return { section, passed, detail, thresholds_used };
}

const TaxStatus = {
  RESIDENT: "resident",
  RNOR: "rnor",
  NON_RESIDENT: "non_resident",
  UNDETERMINED: "requires_professional_review",
};

const FemaStatus = {
  RESIDENT: "person_resident_in_india",
  NON_RESIDENT: "person_resident_outside_india",
  UNDETERMINED: "requires_professional_review",
};

// ===========================================================================
// Section 6(1) rule checks
// ===========================================================================

function check_6_1_a(daysInFy) {
  return rr(
    "6(1)(a)",
    daysInFy >= STAY_DAYS_MAIN,
    `Days in India in financial year: ${daysInFy}. Section 6(1)(a) is satisfied if days_in_fy >= ${STAY_DAYS_MAIN}.`,
    { days_required: STAY_DAYS_MAIN },
  );
}

function check_6_1_c_base(daysInFy, daysInPrev4) {
  const passed =
    daysInFy >= STAY_DAYS_ADDITIONAL &&
    daysInPrev4 >= PRECEDING_FOUR_YEARS_DAYS;
  return rr(
    "6(1)(c)",
    passed,
    `Days in FY: ${daysInFy} (need >= ${STAY_DAYS_ADDITIONAL}); days in preceding 4 FYs: ${daysInPrev4} (need >= ${PRECEDING_FOUR_YEARS_DAYS}).`,
    {
      days_required: STAY_DAYS_ADDITIONAL,
      preceding_days_required: PRECEDING_FOUR_YEARS_DAYS,
    },
  );
}

function check_6_1_c_relaxed_leaving_for_employment(
  daysInFy,
  daysInPrev4,
  citizenship,
  leftForEmployment,
) {
  const applicable = citizenship === "indian" && leftForEmployment;
  if (!applicable) {
    const base = check_6_1_c_base(daysInFy, daysInPrev4);
    return rr(
      "6(1)(c) r/w Explanation 1(a)",
      base.passed,
      `Explanation 1(a) not applicable (citizenship=${citizenship}, left_for_employment=${leftForEmployment}); base Section 6(1)(c) test applies. ${base.detail}`,
      base.thresholds_used,
    );
  }
  const daysReq = RELAXED_STAY_DAYS_LEAVING_FOR_EMPLOYMENT;
  const passed =
    daysInFy >= daysReq && daysInPrev4 >= PRECEDING_FOUR_YEARS_DAYS;
  return rr(
    "6(1)(c) r/w Explanation 1(a)",
    passed,
    `Indian citizen who left India for employment abroad or as crew of an Indian ship; the 60-day limb of Section 6(1)(c) is replaced by ${daysReq} days. Days in FY: ${daysInFy}; days in preceding 4 FYs: ${daysInPrev4}.`,
    {
      days_required: daysReq,
      preceding_days_required: PRECEDING_FOUR_YEARS_DAYS,
    },
  );
}

function check_6_1_c_relaxed_visit(
  daysInFy,
  daysInPrev4,
  citizenship,
  cameOnVisit,
  indianIncomeInr,
) {
  const applicable =
    (citizenship === "indian" || citizenship === "oci") && cameOnVisit;
  if (!applicable) {
    const base = check_6_1_c_base(daysInFy, daysInPrev4);
    return rr(
      "6(1)(c) r/w Explanation 1(b)",
      base.passed,
      `Explanation 1(b) not applicable (citizenship=${citizenship}, came_on_visit=${cameOnVisit}); base Section 6(1)(c) test applies. ${base.detail}`,
      base.thresholds_used,
    );
  }
  const highIncome = indianIncomeInr > HIGH_INCOME_THRESHOLD_INR;
  const daysReq = highIncome
    ? VISIT_HIGH_INCOME_STAY_DAYS
    : RELAXED_STAY_DAYS_VISIT;
  const rationale = highIncome
    ? `Indian citizen / PIO visiting India with total income other than foreign sources (${indianIncomeInr}) exceeding ${HIGH_INCOME_THRESHOLD_INR}; proviso to Explanation 1(b) sets the days-in-FY threshold to ${daysReq}.`
    : `Indian citizen / PIO visiting India with total income other than foreign sources (${indianIncomeInr}) not exceeding ${HIGH_INCOME_THRESHOLD_INR}; Explanation 1(b) sets the days-in-FY threshold to ${daysReq}.`;
  const passed =
    daysInFy >= daysReq && daysInPrev4 >= PRECEDING_FOUR_YEARS_DAYS;
  return rr(
    "6(1)(c) r/w Explanation 1(b)",
    passed,
    `${rationale} Days in FY: ${daysInFy}; days in preceding 4 FYs: ${daysInPrev4}.`,
    {
      days_required: daysReq,
      preceding_days_required: PRECEDING_FOUR_YEARS_DAYS,
      income_threshold: HIGH_INCOME_THRESHOLD_INR,
    },
  );
}

// ===========================================================================
// Section 6(1A) and 6(6)
// ===========================================================================

function check_6_1a_deemed_resident(
  citizenship,
  indianIncomeInr,
  liableToTaxElsewhere,
  alreadyResidentUnder61,
) {
  const thresholds = { income_threshold: HIGH_INCOME_THRESHOLD_INR };
  if (citizenship !== "indian") {
    return rr(
      "6(1A)",
      false,
      `Section 6(1A) is limited to Indian citizens; citizenship is ${citizenship}.`,
      thresholds,
    );
  }
  if (alreadyResidentUnder61) {
    return rr(
      "6(1A)",
      false,
      "Section 6(1A) does not apply because the person is already resident under Section 6(1).",
      thresholds,
    );
  }
  if (indianIncomeInr <= HIGH_INCOME_THRESHOLD_INR) {
    return rr(
      "6(1A)",
      false,
      `Total income other than foreign source income (${indianIncomeInr}) does not exceed ${HIGH_INCOME_THRESHOLD_INR}.`,
      thresholds,
    );
  }
  if (liableToTaxElsewhere === null || liableToTaxElsewhere === undefined) {
    return rr(
      "6(1A)",
      false,
      "Liability to tax in another country is unknown. Section 6(1A) turns on this fact; requires professional review.",
      thresholds,
    );
  }
  if (liableToTaxElsewhere) {
    return rr(
      "6(1A)",
      false,
      "Person is liable to tax in another country by reason of domicile, residence, or similar criterion; Section 6(1A) does not apply.",
      thresholds,
    );
  }
  return rr(
    "6(1A)",
    true,
    `Indian citizen with total income other than foreign source income (${indianIncomeInr}) exceeding ${HIGH_INCOME_THRESHOLD_INR}, not liable to tax in any other country by reason of domicile / residence.`,
    thresholds,
  );
}

function check_6_6_a_nine_of_ten(nrFlagsPrev10) {
  const nrCount = nrFlagsPrev10.filter((x) => x).length;
  const passed = nrCount >= RNOR_NON_RESIDENT_YEARS_REQUIRED;
  return rr(
    "6(6)(a)",
    passed,
    `Non-resident in ${nrCount} of the ${nrFlagsPrev10.length} preceding financial years supplied (Section 6(6)(a) requires ${RNOR_NON_RESIDENT_YEARS_REQUIRED} of ${RNOR_NON_RESIDENT_LOOKBACK_YEARS}).`,
    {
      years_required: RNOR_NON_RESIDENT_YEARS_REQUIRED,
      lookback_years: RNOR_NON_RESIDENT_LOOKBACK_YEARS,
    },
  );
}

function check_6_6_b_seven_year_stay(daysInPrev7) {
  return rr(
    "6(6)(b)",
    daysInPrev7 <= RNOR_STAY_DAYS_MAX,
    `Days in India in the preceding 7 financial years: ${daysInPrev7}. Section 6(6)(b) is satisfied if days_in_prev_7 <= ${RNOR_STAY_DAYS_MAX}.`,
    { days_max: RNOR_STAY_DAYS_MAX },
  );
}

function check_6_6_c_high_income_visitor(
  citizenship,
  cameOnVisit,
  daysInFy,
  indianIncomeInr,
) {
  const applicable =
    (citizenship === "indian" || citizenship === "oci") &&
    cameOnVisit &&
    indianIncomeInr > HIGH_INCOME_THRESHOLD_INR;
  const thresholds = {
    lower: VISIT_HIGH_INCOME_STAY_DAYS,
    upper_exclusive: STAY_DAYS_MAIN,
    income_threshold: HIGH_INCOME_THRESHOLD_INR,
  };
  if (!applicable) {
    return rr(
      "6(6)(c)",
      false,
      `Section 6(6)(c) not applicable (citizenship=${citizenship}, came_on_visit=${cameOnVisit}, income=${indianIncomeInr}).`,
      thresholds,
    );
  }
  const passed =
    daysInFy >= VISIT_HIGH_INCOME_STAY_DAYS && daysInFy < STAY_DAYS_MAIN;
  return rr(
    "6(6)(c)",
    passed,
    `High-income Indian citizen / PIO visitor; days in FY: ${daysInFy}. Section 6(6)(c) window is [${VISIT_HIGH_INCOME_STAY_DAYS}, ${STAY_DAYS_MAIN}).`,
    thresholds,
  );
}

function check_6_6_d_deemed_resident_is_rnor(deemedUnder61a) {
  return rr(
    "6(6)(d)",
    !!deemedUnder61a,
    deemedUnder61a
      ? "Deemed resident under Section 6(1A) is RNOR by Section 6(6)(d)."
      : "Not deemed resident under Section 6(1A); Section 6(6)(d) does not apply.",
    {},
  );
}

// ===========================================================================
// FEMA
// ===========================================================================

const A_EXCLUDING_PURPOSES = ["employment", "business", "other"];
const B_EXCLUDING_PURPOSES = ["visit"];

function check_2_v_i_preceding_year_days(daysInPrecedingFy) {
  return rr(
    "FEMA 2(v)(i)",
    daysInPrecedingFy > FEMA_PRECEDING_FY_STAY_DAYS,
    `Days in India in the preceding financial year: ${daysInPrecedingFy}. FEMA 2(v)(i) is satisfied if days_in_preceding_fy > ${FEMA_PRECEDING_FY_STAY_DAYS} (strict inequality; contrast Income-tax Section 6(1)(a) which reads '182 days or more').`,
    { days_required_strictly_greater_than: FEMA_PRECEDING_FY_STAY_DAYS },
  );
}

function check_2_v_i_A_gone_out_exclusion(currentlyOutside, purpose) {
  if (!currentlyOutside) {
    return rr(
      "FEMA 2(v)(i)(A)",
      false,
      "Not currently outside India; (A) is not applicable.",
    );
  }
  if (A_EXCLUDING_PURPOSES.includes(purpose)) {
    return rr(
      "FEMA 2(v)(i)(A)",
      true,
      `Person is outside India for ${purpose}; excluded from residency by Section 2(v)(i)(A).`,
    );
  }
  return rr(
    "FEMA 2(v)(i)(A)",
    false,
    `Person is outside India but the stated purpose (${purpose ?? "unspecified"}) is not within Section 2(v)(i)(A) (employment / business / uncertain-period stay).`,
  );
}

function check_2_v_i_B_come_to_stay_exclusion(currentlyIn, purpose) {
  if (!currentlyIn) {
    return rr(
      "FEMA 2(v)(i)(B)",
      false,
      "Not currently in India; (B) is not applicable.",
    );
  }
  if (B_EXCLUDING_PURPOSES.includes(purpose)) {
    return rr(
      "FEMA 2(v)(i)(B)",
      true,
      `Person is in India for ${purpose}; excluded from residency by Section 2(v)(i)(B) as the purpose is not employment, business, or an uncertain-period stay.`,
    );
  }
  return rr(
    "FEMA 2(v)(i)(B)",
    false,
    `Person is in India for ${purpose ?? "unspecified"}; this purpose falls within employment / business / uncertain-period stay, so Section 2(v)(i)(B) does not exclude them.`,
  );
}

// ===========================================================================
// Compose per-FY tax status
// ===========================================================================

function determineTaxStatus({
  daysInFy,
  daysInPrev4,
  daysInPrev7,
  nrFlagsPrev10,
  citizenship,
  leftForEmployment,
  cameOnVisit,
  indianIncomeInr,
  liableToTaxElsewhere,
}) {
  const audit = [];

  const rA = check_6_1_a(daysInFy);
  audit.push(rA);
  let residentUnder61 = rA.passed;
  let residentSection = rA.passed ? "6(1)(a)" : "";

  if (!residentUnder61) {
    let rC;
    if (citizenship === "indian" && leftForEmployment) {
      rC = check_6_1_c_relaxed_leaving_for_employment(
        daysInFy,
        daysInPrev4,
        citizenship,
        leftForEmployment,
      );
    } else if (
      (citizenship === "indian" || citizenship === "oci") &&
      cameOnVisit
    ) {
      rC = check_6_1_c_relaxed_visit(
        daysInFy,
        daysInPrev4,
        citizenship,
        cameOnVisit,
        indianIncomeInr,
      );
    } else {
      rC = check_6_1_c_base(daysInFy, daysInPrev4);
    }
    audit.push(rC);
    if (rC.passed) {
      residentUnder61 = true;
      residentSection = rC.section;
    }
  }

  if (residentUnder61) {
    const r6c = check_6_6_c_high_income_visitor(
      citizenship,
      cameOnVisit,
      daysInFy,
      indianIncomeInr,
    );
    audit.push(r6c);
    if (r6c.passed) {
      return {
        status: TaxStatus.RNOR,
        section: `${residentSection} r/w 6(6)(c)`,
        audit,
      };
    }
    const r6a = check_6_6_a_nine_of_ten(nrFlagsPrev10);
    audit.push(r6a);
    const r6b = check_6_6_b_seven_year_stay(daysInPrev7);
    audit.push(r6b);
    if (r6a.passed || r6b.passed) {
      const via = r6a.passed ? "6(6)(a)" : "6(6)(b)";
      return {
        status: TaxStatus.RNOR,
        section: `${residentSection} r/w ${via}`,
        audit,
      };
    }
    return { status: TaxStatus.RESIDENT, section: residentSection, audit };
  }

  const rDeemed = check_6_1a_deemed_resident(
    citizenship,
    indianIncomeInr,
    liableToTaxElsewhere,
    false,
  );
  audit.push(rDeemed);
  if (rDeemed.passed) {
    audit.push(check_6_6_d_deemed_resident_is_rnor(true));
    return {
      status: TaxStatus.RNOR,
      section: "6(1A) r/w 6(6)(d)",
      audit,
    };
  }
  if (
    citizenship === "indian" &&
    indianIncomeInr > HIGH_INCOME_THRESHOLD_INR &&
    (liableToTaxElsewhere === null || liableToTaxElsewhere === undefined)
  ) {
    return { status: TaxStatus.UNDETERMINED, section: "6(1A)", audit };
  }
  return { status: TaxStatus.NON_RESIDENT, section: "6(1)", audit };
}

function determineFemaStatus({
  daysInPrecedingFy,
  currentlyOutside,
  purposeOfGoingOut,
  currentlyIn,
  purposeOfStayInIndia,
}) {
  const audit = [];
  const rMain = check_2_v_i_preceding_year_days(daysInPrecedingFy);
  audit.push(rMain);
  const rA = check_2_v_i_A_gone_out_exclusion(
    currentlyOutside,
    purposeOfGoingOut,
  );
  audit.push(rA);
  const rB = check_2_v_i_B_come_to_stay_exclusion(
    currentlyIn,
    purposeOfStayInIndia,
  );
  audit.push(rB);

  if (rMain.passed) {
    if (rA.passed)
      return {
        status: FemaStatus.NON_RESIDENT,
        section: "FEMA 2(v)(i)(A)",
        audit,
      };
    if (rB.passed)
      return {
        status: FemaStatus.NON_RESIDENT,
        section: "FEMA 2(v)(i)(B)",
        audit,
      };
    return { status: FemaStatus.RESIDENT, section: "FEMA 2(v)(i)", audit };
  }
  if (
    currentlyIn &&
    (purposeOfStayInIndia === "employment" ||
      purposeOfStayInIndia === "business")
  ) {
    audit.push(
      rr(
        "FEMA 2(v)(i) — practice divergence",
        false,
        `Preceding-FY day count is not met, but the person is currently in India for ${purposeOfStayInIndia}. The Act's text does not add residents on intent alone; RBI practice often treats such a person as resident from arrival. Requires professional review.`,
      ),
    );
    return {
      status: FemaStatus.UNDETERMINED,
      section: "FEMA 2(v)(i)",
      audit,
    };
  }
  return { status: FemaStatus.NON_RESIDENT, section: "FEMA 2(v)(i)", audit };
}

// ===========================================================================
// Trip → facts inference
// ===========================================================================

function leftForEmploymentThisFy(trips, fyStartYear) {
  const { start, end } = fyBounds(fyStartYear);
  for (const t of trips) {
    if (
      t.purpose === "employment" &&
      t.date_of_departure_from_india >= start &&
      t.date_of_departure_from_india <= end &&
      t.date_of_arrival_in_india > end
    ) {
      return true;
    }
  }
  return false;
}

function cameOnVisitThisFy(trips, fyStartYear, citizenship) {
  if (citizenship !== "indian" && citizenship !== "oci") return false;
  const { start, end } = fyBounds(fyStartYear);
  for (const t of trips) {
    const outStart = addDays(t.date_of_departure_from_india, 1);
    const outEnd = addDays(t.date_of_arrival_in_india, -1);
    if (outEnd < outStart) continue;
    if (outEnd < start || outStart > end) continue;
    if (t.purpose === "visit") return true;
  }
  return false;
}

function locationOn(trips, onDate) {
  const sorted = [...trips].sort((a, b) =>
    a.date_of_departure_from_india < b.date_of_departure_from_india ? -1 : 1,
  );
  let currentTrip = null;
  let lastCompleted = null;
  for (const t of sorted) {
    if (
      t.date_of_departure_from_india < onDate &&
      onDate <= t.date_of_arrival_in_india
    ) {
      if (onDate === t.date_of_arrival_in_india) {
        lastCompleted = t;
      } else {
        currentTrip = t;
        break;
      }
    } else if (t.date_of_arrival_in_india < onDate) {
      lastCompleted = t;
    }
  }
  if (currentTrip) return { inIndia: false, purpose: currentTrip.purpose };
  return { inIndia: true, purpose: lastCompleted?.purpose ?? null };
}

// Cheap resident-vs-non-resident classifier used to build the
// preceding-10-year NR flag list. Uses [] for its own NR flags to avoid
// recursion, and skips RNOR sub-status (which does not affect the
// RESIDENT vs NON_RESIDENT split).
function statusOnly(trips, incomesByYear, citizenship, fyStartYear) {
  const dfy = daysInFy(trips, fyStartYear);
  const dPrev4 = daysInPrecedingFys(trips, fyStartYear, 4);
  const dPrev7 = daysInPrecedingFys(trips, fyStartYear, 7);
  const leftForEmp =
    citizenship === "indian" && leftForEmploymentThisFy(trips, fyStartYear);
  const cameVisit = cameOnVisitThisFy(trips, fyStartYear, citizenship);
  const inc = incomesByYear[fyStartYear];
  const indianIncome = inc?.indian_source_income_inr ?? 0;
  const liability = inc?.liable_to_tax_elsewhere ?? null;
  const { status } = determineTaxStatus({
    daysInFy: dfy,
    daysInPrev4: dPrev4,
    daysInPrev7: dPrev7,
    nrFlagsPrev10: [],
    citizenship,
    leftForEmployment: leftForEmp,
    cameOnVisit: cameVisit,
    indianIncomeInr: indianIncome,
    liableToTaxElsewhere: liability,
  });
  return status;
}

function nrFlagsPrevN(trips, incomesByYear, citizenship, fyStartYear, n) {
  const flags = [];
  for (let i = 0; i < n; i++) {
    const priorFy = fyStartYear - i - 1;
    const s = statusOnly(trips, incomesByYear, citizenship, priorFy);
    flags.push(s === TaxStatus.NON_RESIDENT);
  }
  return flags;
}

function projectRnorWindow(trips, incomesByYear, citizenship, currentFy) {
  const remaining = [currentFy];
  for (let i = 1; i <= RNOR_NON_RESIDENT_LOOKBACK_YEARS; i++) {
    const fy = currentFy + i;
    const s = statusOnly(trips, incomesByYear, citizenship, fy);
    if (s !== TaxStatus.RESIDENT && s !== TaxStatus.RNOR) break;
    const flags = nrFlagsPrevN(
      trips,
      incomesByYear,
      citizenship,
      fy,
      RNOR_NON_RESIDENT_LOOKBACK_YEARS,
    );
    const nrOf10 = flags.filter((x) => x).length;
    const dPrev7 = daysInPrecedingFys(trips, fy, RNOR_STAY_LOOKBACK_YEARS);
    const isRnor =
      nrOf10 >= RNOR_NON_RESIDENT_YEARS_REQUIRED ||
      dPrev7 <= RNOR_STAY_DAYS_MAX;
    if (!isRnor) break;
    remaining.push(fy);
  }
  return {
    years: remaining,
    closeDate: fyBounds(remaining[remaining.length - 1]).end,
  };
}

function statusesDisagree(tax, fema) {
  if (tax === TaxStatus.UNDETERMINED || fema === FemaStatus.UNDETERMINED) {
    return true;
  }
  const taxRes = tax === TaxStatus.RESIDENT || tax === TaxStatus.RNOR;
  const femaRes = fema === FemaStatus.RESIDENT;
  return taxRes !== femaRes;
}

// ===========================================================================
// Public entry point
// ===========================================================================

function calculate({
  trips,
  incomes,
  citizenship,
  fyStartYears,
  asOf,
  leftForEmploymentOverride,
  currentStayPurposeOverride,
}) {
  const incomesByYear = {};
  for (const y of incomes) incomesByYear[y.fy_start_year] = y;
  const overrideMap = leftForEmploymentOverride ?? {};

  const results = [];
  const sortedYears = [...fyStartYears].sort((a, b) => a - b);
  for (const fy of sortedYears) {
    const fyAsOf = asOf ?? fyBounds(fy).end;
    const dfy = daysInFy(trips, fy);
    const dPrev4 = daysInPrecedingFys(trips, fy, 4);
    const dPrev7 = daysInPrecedingFys(trips, fy, 7);
    const nrFlags = nrFlagsPrevN(
      trips,
      incomesByYear,
      citizenship,
      fy,
      RNOR_NON_RESIDENT_LOOKBACK_YEARS,
    );
    const inc = incomesByYear[fy];
    const indianIncome = inc?.indian_source_income_inr ?? 0;
    const liability = inc?.liable_to_tax_elsewhere ?? null;

    let leftForEmp;
    if (overrideMap[fy] !== undefined) {
      leftForEmp = citizenship === "indian" && overrideMap[fy];
    } else {
      leftForEmp =
        citizenship === "indian" && leftForEmploymentThisFy(trips, fy);
    }
    const cameVisit = cameOnVisitThisFy(trips, fy, citizenship);

    const {
      status: taxStatus,
      section: taxSection,
      audit: taxAudit,
    } = determineTaxStatus({
      daysInFy: dfy,
      daysInPrev4: dPrev4,
      daysInPrev7: dPrev7,
      nrFlagsPrev10: nrFlags,
      citizenship,
      leftForEmployment: leftForEmp,
      cameOnVisit: cameVisit,
      indianIncomeInr: indianIncome,
      liableToTaxElsewhere: liability,
    });

    const dPrecedingFy = daysInFy(trips, fy - 1);
    const loc = locationOn(trips, fyAsOf);
    const currentPurpose = currentStayPurposeOverride ?? loc.purpose;
    const {
      status: femaStatus,
      section: femaSection,
      audit: femaAudit,
    } = determineFemaStatus({
      daysInPrecedingFy: dPrecedingFy,
      currentlyOutside: !loc.inIndia,
      purposeOfGoingOut: loc.inIndia ? null : currentPurpose,
      currentlyIn: loc.inIndia,
      purposeOfStayInIndia: loc.inIndia ? currentPurpose : null,
    });

    let rnorYears = [];
    let rnorClose = null;
    if (taxStatus === TaxStatus.RNOR) {
      const proj = projectRnorWindow(trips, incomesByYear, citizenship, fy);
      rnorYears = proj.years;
      rnorClose = proj.closeDate;
    }

    const nextYY = String(fy + 1).slice(-2);
    results.push({
      fy_start_year: fy,
      fy_label: `${fy}-${nextYY}`,
      days_in_india: dfy,
      tax_status: taxStatus,
      tax_section: taxSection,
      fema_status: femaStatus,
      fema_section: femaSection,
      statuses_disagree: statusesDisagree(taxStatus, femaStatus),
      rnor_window_close_date: rnorClose,
      rnor_years_remaining: rnorYears,
      audit_trail: [...taxAudit, ...femaAudit],
    });
  }
  return results;
}

// Expose the public surface on window for the Babel-standalone runtime
// used by app.jsx (no bundler / no import/export in the browser here).
window.ResidencyCalc = {
  calculate,
  daysInFy,
  daysInPrecedingFys,
  TaxStatus,
  FemaStatus,
  check_6_1_a,
  check_6_1_c_base,
  check_6_1_c_relaxed_leaving_for_employment,
  check_6_1_c_relaxed_visit,
  check_6_1a_deemed_resident,
  check_6_6_a_nine_of_ten,
  check_6_6_b_seven_year_stay,
  check_6_6_c_high_income_visitor,
  check_6_6_d_deemed_resident_is_rnor,
  check_2_v_i_preceding_year_days,
  check_2_v_i_A_gone_out_exclusion,
  check_2_v_i_B_come_to_stay_exclusion,
};
