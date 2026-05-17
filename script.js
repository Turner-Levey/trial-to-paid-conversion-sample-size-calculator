const DEFAULTS = {
  mode: "ab",
  baselineRate: 12,
  targetRate: 16,
  marginError: 3,
  confidence: 0.95,
  power: 0.8,
  variantShare: 50,
  trialsWeek: 240,
  trialLag: 14,
  enrolled: 0,
  minimumWeeks: 2
};

const zConfidence = {
  0.9: 1.6449,
  0.95: 1.96,
  0.99: 2.5758
};

const zPower = {
  0.8: 0.8416,
  0.85: 1.0364,
  0.9: 1.2816,
  0.95: 1.6449
};

const els = {
  form: document.querySelector("#calculator-form"),
  mode: document.querySelector("#mode"),
  baselineRate: document.querySelector("#baseline-rate"),
  baselineOutput: document.querySelector("#baseline-output"),
  targetRate: document.querySelector("#target-rate"),
  targetOutput: document.querySelector("#target-output"),
  marginError: document.querySelector("#margin-error"),
  marginOutput: document.querySelector("#margin-output"),
  confidence: document.querySelector("#confidence"),
  power: document.querySelector("#power"),
  variantShare: document.querySelector("#variant-share"),
  shareOutput: document.querySelector("#share-output"),
  trialsWeek: document.querySelector("#trials-week"),
  trialLag: document.querySelector("#trial-lag"),
  enrolled: document.querySelector("#enrolled"),
  minimumWeeks: document.querySelector("#minimum-weeks"),
  totalTrials: document.querySelector("#total-trials"),
  trialLabel: document.querySelector("#trial-label"),
  baselineTrials: document.querySelector("#baseline-trials"),
  baselineLabel: document.querySelector("#baseline-label"),
  variantTrials: document.querySelector("#variant-trials"),
  variantLabel: document.querySelector("#variant-label"),
  calendarRead: document.querySelector("#calendar-read"),
  calendarLabel: document.querySelector("#calendar-label"),
  statusPill: document.querySelector("#status-pill"),
  noteList: document.querySelector("#note-list"),
  notes: document.querySelector("#notes"),
  report: document.querySelector("#report"),
  reset: document.querySelector("#reset"),
  copyReport: document.querySelector("#copy-report"),
  downloadReport: document.querySelector("#download-report"),
  downloadCsv: document.querySelector("#download-csv")
};

function numberValue(input, fallback = 0) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function values() {
  const baselineRate = Math.min(95, Math.max(0.1, numberValue(els.baselineRate, DEFAULTS.baselineRate)));
  const targetRate = Math.min(99, Math.max(0.1, numberValue(els.targetRate, DEFAULTS.targetRate)));
  return {
    mode: els.mode.value,
    baselineRate,
    targetRate,
    marginError: Math.max(0.1, numberValue(els.marginError, DEFAULTS.marginError)),
    confidence: Number.parseFloat(els.confidence.value),
    power: Number.parseFloat(els.power.value),
    variantShare: Math.min(90, Math.max(10, numberValue(els.variantShare, DEFAULTS.variantShare))),
    trialsWeek: Math.max(1, numberValue(els.trialsWeek, DEFAULTS.trialsWeek)),
    trialLag: Math.max(0, numberValue(els.trialLag, DEFAULTS.trialLag)),
    enrolled: Math.max(0, numberValue(els.enrolled, DEFAULTS.enrolled)),
    minimumWeeks: Math.max(0, numberValue(els.minimumWeeks, DEFAULTS.minimumWeeks))
  };
}

function roundUp(value) {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil(value));
}

function abSampleSize(input) {
  const p1 = input.baselineRate / 100;
  const p2 = input.targetRate / 100;
  const delta = Math.abs(p2 - p1);
  if (delta < 0.001) return null;

  const zAlpha = zConfidence[input.confidence] || zConfidence[0.95];
  const zBeta = zPower[input.power] || zPower[0.8];
  const treatmentShare = input.variantShare / 100;
  const controlShare = 1 - treatmentShare;
  const ratio = treatmentShare / controlShare;
  const weightedP = (p1 + ratio * p2) / (1 + ratio);
  const alphaTerm = zAlpha * Math.sqrt(weightedP * (1 - weightedP) * (1 + (1 / ratio)));
  const betaTerm = zBeta * Math.sqrt((p1 * (1 - p1)) + ((p2 * (1 - p2)) / ratio));
  const controlNeeded = Math.pow(alphaTerm + betaTerm, 2) / Math.pow(delta, 2);
  const variantNeeded = controlNeeded * ratio;
  const baselineTrials = roundUp(controlNeeded);
  const variantTrials = roundUp(variantNeeded);
  const totalTrials = baselineTrials + variantTrials;
  const expectedBaselineConversions = baselineTrials * p1;
  const expectedVariantConversions = variantTrials * p2;
  return {
    design: "A/B lift test",
    baselineTrials,
    variantTrials,
    totalTrials,
    expectedBaselineConversions,
    expectedVariantConversions,
    expectedConversions: expectedBaselineConversions + expectedVariantConversions,
    liftPoints: input.targetRate - input.baselineRate,
    relativeLift: ((p2 - p1) / p1) * 100
  };
}

function estimateSampleSize(input) {
  const p = input.baselineRate / 100;
  const e = input.marginError / 100;
  const z = zConfidence[input.confidence] || zConfidence[0.95];
  const totalTrials = roundUp((Math.pow(z, 2) * p * (1 - p)) / Math.pow(e, 2));
  return {
    design: "Single-rate estimate",
    baselineTrials: totalTrials,
    variantTrials: 0,
    totalTrials,
    expectedBaselineConversions: totalTrials * p,
    expectedVariantConversions: 0,
    expectedConversions: totalTrials * p,
    liftPoints: 0,
    relativeLift: 0
  };
}

function calculate(input) {
  const sample = input.mode === "estimate" ? estimateSampleSize(input) : abSampleSize(input);
  if (!sample) return null;

  const remainingTrials = Math.max(0, sample.totalTrials - input.enrolled);
  const enrollmentWeeks = remainingTrials / input.trialsWeek;
  const calendarWeeks = Math.max(enrollmentWeeks, input.minimumWeeks) + (input.trialLag / 7);
  return {
    ...sample,
    remainingTrials: roundUp(remainingTrials),
    enrollmentWeeks,
    calendarWeeks
  };
}

function integer(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "n/a";
}

function decimal(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function percent(value, digits = 1) {
  return `${Number(value).toFixed(digits)}%`;
}

function status(input, result) {
  if (!result) return ["Need lift", "risk"];
  if (result.calendarWeeks > 16) return ["Long read", "risk"];
  if (result.calendarWeeks > 8 || result.expectedConversions < 30) return ["Use caution", "watch"];
  return ["Readable plan", "good"];
}

function buildNotes(input, result) {
  if (!result) {
    return [[
      "Target lift needed",
      "Set a target conversion rate that differs from the baseline before sizing the test."
    ]];
  }

  const notes = [];
  if (input.mode === "ab") {
    notes.push([
      "Detectable lift",
      `The plan sizes for ${percent(input.baselineRate)} to ${percent(input.targetRate)} trial-to-paid conversion, a ${decimal(result.liftPoints)} point absolute lift.`
    ]);
  } else {
    notes.push([
      "Estimate width",
      `The plan estimates a ${percent(input.baselineRate)} conversion rate within about ±${decimal(input.marginError)} percentage points at ${percent(input.confidence * 100, 0)} confidence.`
    ]);
  }

  notes.push([
    "Calendar read",
    `At ${integer(input.trialsWeek)} qualified trials per week, the readout is about ${decimal(result.calendarWeeks)} weeks including a ${integer(input.trialLag)} day trial-to-paid lag.`
  ]);

  if (result.expectedConversions < 30) {
    notes.push([
      "Low conversion count",
      `Expected paid conversions are only ${decimal(result.expectedConversions)}. Treat this as a planning estimate and avoid over-reading small swings.`
    ]);
  }

  if (input.enrolled > 0) {
    notes.push([
      "Existing enrollment",
      `${integer(input.enrolled)} already enrolled trials reduce the remaining enrollment need to ${integer(result.remainingTrials)} trials.`
    ]);
  }

  if (input.mode === "ab" && input.variantShare !== 50) {
    notes.push([
      "Uneven split",
      `The ${integer(input.variantShare)}% variant split changes arm sizes; a 50/50 split is usually more efficient for pure lift detection.`
    ]);
  }

  return notes;
}

function reportText(input, result) {
  const noteText = els.notes.value.trim() || "None";
  const statusText = status(input, result)[0];
  const lines = [
    "# Trial-to-Paid Conversion Sample Size Note",
    "",
    `Status: ${statusText}`,
    `Mode: ${input.mode === "ab" ? "A/B lift test" : "Single-rate estimate"}`,
    `Baseline trial-to-paid rate: ${percent(input.baselineRate)}`,
    `Target trial-to-paid rate: ${input.mode === "ab" ? percent(input.targetRate) : "n/a"}`,
    `Confidence: ${percent(input.confidence * 100, 0)}`,
    `Power: ${input.mode === "ab" ? percent(input.power * 100, 0) : "n/a"}`,
    `Qualified trials per week: ${integer(input.trialsWeek)}`,
    `Trial-to-paid lag: ${integer(input.trialLag)} days`,
    `Already enrolled trials: ${integer(input.enrolled)}`,
    "",
    "## Result"
  ];

  if (result) {
    lines.push(
      `- Total required trials: ${integer(result.totalTrials)}`,
      `- Baseline arm trials: ${integer(result.baselineTrials)}`,
      `- Variant arm trials: ${integer(result.variantTrials)}`,
      `- Remaining trials: ${integer(result.remainingTrials)}`,
      `- Expected paid conversions: ${decimal(result.expectedConversions)}`,
      `- Enrollment weeks: ${decimal(result.enrollmentWeeks)}`,
      `- Calendar readout: ${decimal(result.calendarWeeks)} weeks`
    );
  } else {
    lines.push("- Set a target conversion rate different from the baseline.");
  }

  lines.push("", "## Notes", ...buildNotes(input, result).map((note) => `- ${note[0]}: ${note[1]}`), "", "## Context", noteText, "", "Statistical planning worksheet only. Not legal, financial, tax, accounting, investment, or growth advice.");
  return lines.join("\n");
}

function csvText(input, result) {
  const rows = [
    ["metric", "value"],
    ["mode", input.mode],
    ["baseline_rate_percent", input.baselineRate],
    ["target_rate_percent", input.mode === "ab" ? input.targetRate : ""],
    ["margin_error_points", input.mode === "estimate" ? input.marginError : ""],
    ["confidence", input.confidence],
    ["power", input.mode === "ab" ? input.power : ""],
    ["variant_share_percent", input.mode === "ab" ? input.variantShare : ""],
    ["qualified_trials_per_week", input.trialsWeek],
    ["trial_to_paid_lag_days", input.trialLag],
    ["already_enrolled_trials", input.enrolled],
    ["minimum_runtime_weeks", input.minimumWeeks],
    ["total_required_trials", result ? result.totalTrials : ""],
    ["baseline_arm_trials", result ? result.baselineTrials : ""],
    ["variant_arm_trials", result ? result.variantTrials : ""],
    ["remaining_trials", result ? result.remainingTrials : ""],
    ["expected_paid_conversions", result ? result.expectedConversions.toFixed(1) : ""],
    ["enrollment_weeks", result ? result.enrollmentWeeks.toFixed(1) : ""],
    ["calendar_readout_weeks", result ? result.calendarWeeks.toFixed(1) : ""]
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function setModeVisibility(input) {
  const isEstimate = input.mode === "estimate";
  document.querySelectorAll(".ab-only").forEach((node) => {
    node.style.display = isEstimate ? "none" : "";
  });
  document.querySelectorAll(".estimate-only").forEach((node) => {
    node.style.display = isEstimate ? "" : "none";
  });
}

function render() {
  const input = values();
  setModeVisibility(input);
  const result = calculate(input);
  const [statusText, statusClass] = status(input, result);

  els.baselineOutput.textContent = percent(input.baselineRate);
  els.targetOutput.textContent = percent(input.targetRate);
  els.marginOutput.textContent = `±${decimal(input.marginError)}pp`;
  els.shareOutput.textContent = percent(input.variantShare, 0);

  els.statusPill.textContent = statusText;
  els.statusPill.className = statusClass;

  if (result) {
    els.totalTrials.textContent = integer(result.totalTrials);
    els.trialLabel.textContent = `${integer(result.remainingTrials)} remaining after enrolled trials`;
    els.baselineTrials.textContent = integer(result.baselineTrials);
    els.baselineLabel.textContent = input.mode === "ab" ? `${decimal(result.expectedBaselineConversions)} expected paid` : "Single cohort";
    els.variantTrials.textContent = input.mode === "ab" ? integer(result.variantTrials) : "n/a";
    els.variantLabel.textContent = input.mode === "ab" ? `${decimal(result.expectedVariantConversions)} expected paid` : "Not used in estimate mode";
    els.calendarRead.textContent = `${decimal(result.calendarWeeks)} wk`;
    els.calendarLabel.textContent = `${decimal(result.enrollmentWeeks)} wk enrollment plus lag`;
  } else {
    els.totalTrials.textContent = "n/a";
    els.trialLabel.textContent = "Target and baseline match";
    els.baselineTrials.textContent = "n/a";
    els.baselineLabel.textContent = "Qualified trials";
    els.variantTrials.textContent = "n/a";
    els.variantLabel.textContent = "Qualified trials";
    els.calendarRead.textContent = "n/a";
    els.calendarLabel.textContent = "Enrollment plus trial lag";
  }

  els.noteList.textContent = "";
  for (const note of buildNotes(input, result)) {
    const item = document.createElement("div");
    item.className = "note";
    const title = document.createElement("strong");
    title.textContent = note[0];
    const body = document.createElement("p");
    body.textContent = note[1];
    item.append(title, body);
    els.noteList.append(item);
  }

  els.report.value = reportText(input, result);
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reset() {
  els.mode.value = DEFAULTS.mode;
  els.baselineRate.value = DEFAULTS.baselineRate;
  els.targetRate.value = DEFAULTS.targetRate;
  els.marginError.value = DEFAULTS.marginError;
  els.confidence.value = String(DEFAULTS.confidence);
  els.power.value = String(DEFAULTS.power);
  els.variantShare.value = DEFAULTS.variantShare;
  els.trialsWeek.value = DEFAULTS.trialsWeek;
  els.trialLag.value = DEFAULTS.trialLag;
  els.enrolled.value = DEFAULTS.enrolled;
  els.minimumWeeks.value = DEFAULTS.minimumWeeks;
  els.notes.value = "";
  render();
}

document.querySelectorAll("input, select, textarea").forEach((input) => {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
});

els.reset.addEventListener("click", reset);
els.copyReport.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.report.value);
  els.copyReport.textContent = "Copied";
  window.setTimeout(() => {
    els.copyReport.textContent = "Copy Markdown";
  }, 1200);
});
els.downloadReport.addEventListener("click", () => {
  const input = values();
  download("trial-to-paid-sample-size-note.md", reportText(input, calculate(input)), "text/markdown");
});
els.downloadCsv.addEventListener("click", () => {
  const input = values();
  download("trial-to-paid-sample-size.csv", csvText(input, calculate(input)), "text/csv");
});

render();
