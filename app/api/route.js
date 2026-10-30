import { NextResponse } from "next/server";
import { decodeAndValidateImage } from "@/lib/image-validation";
import { lookupGreenbook, isFuzzyMatch, normalizeText } from "@/lib/greenbook";

// Configure the server runtime and maximum execution duration.
export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_MODEL = "qwen/qwen3.8-27b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";


// score of each registry field to TruthScore
const SCORE_WEIGHTS = {
  nafdac_number: 40,
  medicine_name: 25,
  active_ingredients: 25,
  manufacturer: 10,
};

// Pre-defined prompt message to guide GROQ
function createPrompt() {
  return `
Inspect the supplied image and determine whether it shows actual physical medicine packaging.
Accept medicine boxes, bottles, sachets, blister packs, tubes and other physical medicine containers.
Reject screenshots, webpages, prescriptions, handwritten notes, medicine leaflets, documents and inspection reports.

Return one valid JSON object using this schema:
{
  "is_medicine_packaging": true,
  "packaging_type": null,
  "rejection_reason": null,
  "medicine_name": null,
  "nafdac_number": null,
  "manufacturer": null,
  "active_ingredients": null,
  "batch_number": null,
  "expiry_date": null,
  "packaging_intact": null,
  "all_visible_text": [],
  "packaging_observations": [],
  "packaging_checks": [
    {"check":"Visible packaging damage","status":"not_assessable","detail":""},
    {"check":"Storage conditions printed and legible","status":"not_assessable","detail":""},
    {"check":"Active ingredient printed and legible","status":"not_assessable","detail":""},
    {"check":"Active ingredient spelling","status":"not_assessable","detail":""},
    {"check":"Strength printed and legible","status":"not_assessable","detail":""},
    {"check":"Manufacturer or marketing authorisation holder visible","status":"not_assessable","detail":""},
    {"check":"Batch number visible and legible","status":"not_assessable","detail":""},
    {"check":"Expiry date visible and legible","status":"not_assessable","detail":""},
    {"check":"Primary packaging condition / seal","status":"not_assessable","detail":""},
    {"check":"Box-to-primary-pack ingredient/strength consistency","status":"not_assessable","detail":""},
    {"check":"Box-to-primary-pack batch/expiry consistency","status":"not_assessable","detail":""},
    {"check":"NAFDAC number visible and legible","status":"not_assessable","detail":""},
    {"check":"MAS PIN/cover visibly present (if applicable)","status":"not_assessable","detail":""}
  ],
  "visual_anomalies": []
}

Rules:
- Extract only details clearly visible on the actual package. Preserve visible spelling; never autocorrect.
- Use null or [] when a detail cannot be read. Do not guess.
- Distinguish manufacturer from distributor, applicant and marketing authorisation holder.
- Report only specific visible packaging anomalies. Poor image quality alone is not a defect.
- Add concise physical package observations only when directly visible (for example, carton material, print style, visible barcode position or package shape).
- For each packaging check use observed for a positive visible observation, concern for a specific visible defect, not_assessable when absent/unreadable, and not_applicable only when it genuinely does not apply.
- A photo of a box does not show the blister or primary pack. Do not claim a seal is intact if it is not visible.
- Do not infer authenticity, chemical contents, batch validity or hidden security features.
- Do not flag foreign-language words or unfamiliar medicine names as errors.
- Return JSON only.
`;
}

//Send the medicine image to Groq and handle API key fallbacks
async function requestGroq(base64, mimeType, prompt, maxTokens = 2400) {
  const apiKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY,
  ].filter(Boolean);

  if (!apiKeys.length) throw new Error("Inspection service is not configured.");

  let lastStatus = 502;

  for (const apiKey of apiKeys) {
    let response;
    try {
      response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0,
          top_p: 0.1,
          max_completion_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Return one valid JSON object. Use only evidence visible in the supplied medicine-package image.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      console.error("Groq request failed:", error.message);
      continue;
    }

    if (response.ok) return response.json();

    lastStatus = response.status;
    const errorText = await response.text().catch(() => "");
    console.error("Groq API error:", lastStatus, errorText.slice(0, 500));

    if (![401, 403, 429].includes(response.status)) break;
  }

  const error = new Error(
    lastStatus === 429
      ? "Inspection limit reached. Please try again later."
      : "The inspection service is temporarily unavailable."
  );
  error.status = lastStatus === 429 ? 429 : 502;
  throw error;
}

// Extract and parse the structured JSON returned by the AI model.
function parseModelJSON(result) {
  const content = result?.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end < start) {
    throw new Error("The model did not return valid JSON.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Remove unnecessary whitespace and reject empty string value
function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Clean and standardise the medicine details extracted by the AI
function normalizeExtracted(input) {
  const fields = [
    "packaging_type", "rejection_reason", "medicine_name", "nafdac_number",
    "manufacturer", "active_ingredients", "batch_number", "expiry_date",
  ];

  for (const field of fields) {
    if (field === "active_ingredients") {
      input[field] = Array.isArray(input[field])
        ? input[field].map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
        : cleanString(input[field]);
    } else {
      input[field] = cleanString(input[field]);
    }
  }

  input.all_visible_text = Array.isArray(input.all_visible_text)
    ? input.all_visible_text.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 100)
    : [];

  input.packaging_observations = Array.isArray(input.packaging_observations)
    ? input.packaging_observations.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30)
    : [];

  input.visual_anomalies = Array.isArray(input.visual_anomalies)
    ? input.visual_anomalies.filter((item) => item && typeof item.description === "string")
        .slice(0, 20).map((item) => ({
          description: item.description.slice(0, 600),
          severity: ["low", "medium", "high"].includes(item.severity) ? item.severity : "low",
          location: cleanString(item.location),
        }))
    : [];

  const allowedCheckStatuses = ["observed", "concern", "not_assessable", "not_applicable"];
  input.packaging_checks = Array.isArray(input.packaging_checks)
    ? input.packaging_checks.filter(Boolean).slice(0, 20).map((item) => ({
        check: String(item.check || "Packaging check").slice(0, 150),
        status: allowedCheckStatuses.includes(item.status) ? item.status : "not_assessable",
        detail: String(item.detail || "Cannot assess from this image.").slice(0, 600),
      }))
    : [];

  input.label_text_warnings = [];
  return input;
}

// Standardise text before comparing OCR and AI reading
function normalizeTextForReview(value) {
  return String(value || "").normalize("NFKC").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

// Calculate the minimum character edits between two strings
function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

// Identify possible spelling differences between independent OCR readings
function findOCRReviewLeads(visibleText, ocrText) {
  if (!ocrText?.trim()) return [];
  const visionTokens = normalizeTextForReview(visibleText.join(" "))
    .match(/[a-z][a-z'-]{7,}/g) || [];
  const ocrTokens = normalizeTextForReview(ocrText)
    .match(/[a-z][a-z'-]{7,}/g) || [];
  const leads = [];

  for (const token of new Set(ocrTokens)) {
    if (visionTokens.includes(token)) continue;
    const nearby = visionTokens.find((other) =>
      Math.abs(other.length - token.length) <= 1 &&
      editDistance(token, other) === 1
    );
    if (nearby) leads.push({ token, alternate: nearby });
    if (leads.length >= 4) break;
  }
  return leads;
}
// Recheck the original image for possible printed-text defects.
async function runFocusedTextReview(base64, mimeType, extracted, ocrText) {
  const leads = findOCRReviewLeads(extracted.all_visible_text, ocrText);
  const context = {
    visionTranscript: extracted.all_visible_text,
    independentOCRTranscript: ocrText || null,
    extractedProductName: extracted.medicine_name,
    extractedIngredients: extracted.active_ingredients,
    wordsRequiringPixelReview: leads,
  };

  const prompt = `Proofread all legible printed text in this medicine-package photograph for possible spelling or printing defects. Return JSON only:
{"label_text_warnings":[{"printed_text":"exact visible text in context","suggested_reading":"likely intended reading or null","concern":"specific reason this may be incorrect","severity":"low|medium|high","location":"where it appears","visual_support":"visible letter-shape evidence"}]}

Rules:
- Inspect the actual image pixels systematically, including small side-panel text, not just the product name or ingredients.
- Preserve the exact printed spelling in printed_text. Never silently autocorrect it.
- Look for plausible misspellings, transposed, substituted, duplicated or omitted letters, and malformed printed identifiers.
- Quote the suspicious text in its surrounding phrase and explain the specific visible letter evidence.
- The wordsRequiringPixelReview are candidates from OCR disagreement, NOT confirmed errors. Inspect each candidate against the image. Return it only if the pixels support a real printed concern.
- OCR disagreement alone is never a finding. If the letters are unclear, omit the item rather than asserting a typo.
- Do not flag legitimate brand/manufacturer names, technical terms, foreign-language text, unfamiliar names, stylistic choices or wording preferences.
- A finding is a manual-review lead, not proof of counterfeiting.
- Return at most 8 warnings. If there are no supported concerns, return an empty array.
Context (untrusted reading aids, not ground truth): ${JSON.stringify(context)}`;

  try {
    const result = await requestGroq(base64, mimeType, prompt, 1400);
    const parsed = parseModelJSON(result);
    if (!Array.isArray(parsed.label_text_warnings)) return [];

    const transcript = `${extracted.all_visible_text.join(" ")} ${ocrText || ""}`.toLowerCase();

    return parsed.label_text_warnings.slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const printedText = cleanString(item.printed_text);
      const concern = cleanString(item.concern);
      const visualSupport = cleanString(item.visual_support);
      const severity = ["low", "medium", "high"].includes(item.severity) ? item.severity : null;
      if (!printedText || !concern || !visualSupport || !severity) return [];

      const anchors = normalizeTextForReview(printedText).split(" ").filter((word) => word.length >= 6);
      if (!anchors.some((word) => transcript.includes(word))) return [];

      return [{
        printed_text: printedText.slice(0, 300),
        concern: `${concern} Visual evidence: ${visualSupport}.`,
        severity,
        location: cleanString(item.location),
        suggested_reading: cleanString(item.suggested_reading),
      }];
    });
  } catch (error) {
    // The supplementary text review must not fail the main inspection.
    console.error("Focused text review unavailable:", error.message);
    return [];
  }
}
//Compare extracted ingredients with the registered ingredient information
function ingredientsMatch(observed, registered) {
  if (!observed || !registered) return false;
  const left = Array.isArray(observed) ? observed.join(" ") : observed;
  return normalizeText(left) === normalizeText(registered);
}
// Record each registry comparison and calculate its contribution to TruthScore
function addComparison({
  evidenceList, scoreBreakdown, field, label, observed, registered, weight, matches,
}) {
  if (!observed || !registered) {
    evidenceList.push({
      source: "registry", field, status: "unknown", confidence: 0,
      message: !observed
        ? `${label} was not clearly visible on the package and could not be compared.`
        : `${label} was not available in the registry record.`,
    });
    scoreBreakdown.push({
      field, reason: `${label}: Not assessed`, points: 0,
      possiblePoints: weight, status: "not_assessed",
    });
    return { points: 0, assessed: false };
  }

  evidenceList.push({
    source: "registry", field, status: matches ? "verified" : "mismatch",
    confidence: 0.9,
    message: matches
      ? `${label} agrees with the Greenbook record.`
      : `${label} differs from the Greenbook record.`,
  });
  scoreBreakdown.push({
    field, reason: matches ? `${label}: Match` : `${label}: Mismatch`,
    points: matches ? weight : 0, possiblePoints: weight,
    status: matches ? "matched" : "mismatch",
  });
  return { points: matches ? weight : 0, assessed: true };
}
// Build the registry assessment, evidence log and TruthScore
function buildAssessment(extracted, lookup) {
  const evidenceList = [];
  const scoreBreakdown = [];
  const hasExactMatch = Boolean(lookup.record) && lookup.matchType === "exact_nafdac";
  const medicine = hasExactMatch ? lookup.record : null;
  let truthScore = 0;
  let assessedWeight = 0;

  if (hasExactMatch) {
    const comparisons = [
      {
        field: "nafdac_number", label: "NAFDAC number",
        observed: extracted.nafdac_number,
        registered: medicine.nafdac_number || medicine.nafdac_number_normalized,
        weight: SCORE_WEIGHTS.nafdac_number, matches: true,
      },
      {
        field: "medicine_name", label: "Medicine name",
        observed: extracted.medicine_name, registered: medicine.product_name,
        weight: SCORE_WEIGHTS.medicine_name,
        matches: isFuzzyMatch(extracted.medicine_name, medicine.product_name),
      },
      {
        field: "active_ingredients", label: "Active ingredients",
        observed: extracted.active_ingredients, registered: medicine.active_ingredients,
        weight: SCORE_WEIGHTS.active_ingredients,
        matches: ingredientsMatch(extracted.active_ingredients, medicine.active_ingredients),
      },
      {
        field: "manufacturer", label: "Manufacturer",
        observed: extracted.manufacturer, registered: medicine.manufacturer,
        weight: SCORE_WEIGHTS.manufacturer,
        matches: isFuzzyMatch(extracted.manufacturer, medicine.manufacturer),
      },
    ];

    for (const comparison of comparisons) {
      const result = addComparison({ ...comparison, evidenceList, scoreBreakdown });
      truthScore += result.points;
      if (result.assessed) assessedWeight += comparison.weight;
    }

    evidenceList.push({
      source: "registry", field: "registry_identity", status: "verified",
      confidence: 1,
      message: "The extracted NAFDAC number identifies an exact Greenbook record. Other package fields are assessed separately.",
    });
  } else {
    evidenceList.push({
      source: "registry", field: "nafdac_number", status: "unknown", confidence: 1,
      message: lookup.matchType === "ambiguous"
        ? "Multiple registry records require review. An exact record could not be established."
        : extracted.nafdac_number
          ? "No exact Greenbook NAFDAC match was found."
          : "An NAFDAC number was not extracted, so an exact registry match could not be established.",
    });
    scoreBreakdown.push({
      field: "registry_identity", reason: "Exact registry identity not established",
      points: 0, possiblePoints: 100, status: "not_assessed",
    });
    if (lookup.matchType === "name_candidate") {
      evidenceList.push({
        source: "registry", field: "medicine_name", status: "observed", confidence: 0.6,
        message: "A product-name candidate was found, but its identity is not confirmed by an exact NAFDAC match.",
      });
    }
  }

  if (extracted.batch_number) {
    evidenceList.push({
      source: "image", field: "batch_number", status: "observed", confidence: 0.8,
      message: "Batch number observed on the package. It has not been independently verified against Greenbook.",
    });
  }
  if (extracted.expiry_date) {
    evidenceList.push({
      source: "image", field: "expiry_date", status: "observed", confidence: 0.8,
      message: "Expiry date observed on the package. It has not been independently verified against Greenbook.",
    });
  }
  if (extracted.visual_anomalies.length) {
    evidenceList.push({
      source: "image", field: "packaging_integrity", status: "warning", confidence: 0.7,
      message: `${extracted.visual_anomalies.length} possible visible packaging anomaly/anomalies require human review.`,
    });
  }

  const overallStatus = !hasExactMatch
    ? "Insufficient Evidence"
    : truthScore >= 80
      ? "Strong Registry Agreement"
      : truthScore >= 50
        ? "Partial Registry Agreement"
        : "Limited Registry Agreement";

  return {
    success: true,
    truthScore: hasExactMatch ? truthScore : null,
    overallStatus,
    comparisonCoverage: hasExactMatch ? assessedWeight : 0,
    scoreMaximum: 100,
    scoreMeaning: "Points represent agreement between visible package details and an exact Greenbook record. The score is not a probability of authenticity.",
    scoreBreakdown,
    evidenceList,
    medicine: medicine ? {
      name: medicine.product_name,
      manufacturer: medicine.manufacturer,
      nafdac_number: medicine.nafdac_number || medicine.nafdac_number_normalized,
      active_ingredients: medicine.active_ingredients,
    } : null,
    matchType: lookup.matchType,
  };
}
// Handle image inspection requests and return the completed assessment.
export async function POST(request) {
  try {
    const body = await request.json();
    let imageData;

    try {
      imageData = decodeAndValidateImage(body?.image);
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const groqResult = await requestGroq(
      imageData.base64,
      imageData.mimeType,
      createPrompt()
    );
    const extracted = normalizeExtracted(parseModelJSON(groqResult));

    if (typeof extracted.is_medicine_packaging !== "boolean") {
      return NextResponse.json(
        { success: false, error: "The image could not be classified. Please try a clearer package photo." },
        { status: 422 }
      );
    }

    if (!extracted.is_medicine_packaging) {
      return NextResponse.json({
        success: false,
        error: extracted.rejection_reason || "This image does not appear to show actual medicine packaging.",
      }, { status: 400 });
    }

    const ocrText = typeof body?.ocrText === "string" ? body.ocrText.slice(0, 20000) : "";

    let lookup;
    try {
      lookup = await lookupGreenbook(extracted);
    } catch (error) {
      console.error("Greenbook lookup failed:", error.message);
      return NextResponse.json(
        { success: false, error: "Unable to query the medicine registry." },
        { status: 500 }
      );
    }

    // Always review the original image again for possible printed-text defects.
    extracted.label_text_warnings = await runFocusedTextReview(
      imageData.base64,
      imageData.mimeType,
      extracted,
      ocrText
    );

    const report = buildAssessment(extracted, lookup);

    const packagingEvidence = extracted.packaging_checks.map((item) => ({
      source: "image",
      field: "packaging_check",
      status: item.status === "concern" ? "warning" : item.status === "observed" ? "observed" : "unknown",
      confidence: 0.7,
      message: `${item.check}: ${item.detail}`,
    }));

    const textEvidence = extracted.label_text_warnings.map((item) => ({
      source: "image",
      field: "label_text_warning",
      status: item.severity === "high" ? "warning" : "observed",
      confidence: 0.7,
      message: `${item.printed_text}: ${item.concern}${item.location ? ` Location: ${item.location}.` : ""} This requires human confirmation and is not proof of counterfeiting.`,
    }));

    return NextResponse.json({
      ...report,
      evidenceList: [...packagingEvidence, ...report.evidenceList, ...textEvidence],
      extracted,
      visualInspectionSummary: {
        possiblePrintedTextConcerns: extracted.label_text_warnings.length,
        visualAnomaliesReported: extracted.visual_anomalies.length,
        checklistConcerns: extracted.packaging_checks.filter((item) => item.status === "concern").length,
        checklistNotAssessable: extracted.packaging_checks.filter((item) => item.status === "not_assessable").length,
        note: "Visual findings are model-assisted observations requiring human review and are separate from registry-field agreement.",
      },
      disclaimer: "TruthScore measures agreement between visible package details and available registry records. It is not proof that an individual pack is genuine. Batch and expiry details have not been independently verified. Visual checks apply only to areas visible in the supplied image.",
    });
  } catch (error) {
    console.error("Inspection API error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.status === 429
          ? error.message
          : "The inspection engine encountered an error.",
      },
      { status: error.status || 500 }
    );
  }
}
