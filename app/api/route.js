import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const normalizeText = (text) =>
  (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeNafdac = (text) =>
  (text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const isFuzzyMatch = (first, second) => {
  const a = normalizeText(first);
  const b = normalizeText(second);

  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return (
    (Math.max(a.length, b.length) - previous[b.length]) /
      Math.max(a.length, b.length) >=
    0.8
  );
};

const detectImageType = (buffer) => {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

export async function POST(request) {
  try {
    const body = await request.json();
    const image = body?.image;

    if (typeof image !== "string" || !image.trim()) {
      return NextResponse.json(
        { success: false, error: "Please upload an image." },
        { status: 400 }
      );
    }

    const base64 = image.startsWith("data:")
      ? image.split(",")[1]
      : image;

    if (
      !base64 ||
      base64.length > Math.ceil(MAX_IMAGE_SIZE * 4 / 3) + 8 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid or oversized image." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(base64, "base64");

    if (
      !buffer.length ||
      buffer.length > MAX_IMAGE_SIZE ||
      buffer.toString("base64").replace(/=+$/, "") !==
        base64.replace(/=+$/, "")
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid image data or file size." },
        { status: 400 }
      );
    }

    const mimeType = detectImageType(buffer);

    if (!mimeType) {
      return NextResponse.json(
        {
          success: false,
          error: "Upload a valid JPG, PNG, or WebP image.",
        },
        { status: 415 }
      );
    }

    // Preserve the existing Groq API key configuration.
    const apiKeys = [
      process.env.GROQ_API_KEY_1,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY,
    ].filter(Boolean);

    // Keep the model currently configured in your working project.
    const model = "qwen/qwen3.8-27b";

    if (!apiKeys.length) {
      console.error("Missing Groq API key configuration.");

      return NextResponse.json(
        {
          success: false,
          error: "Inspection service is not configured.",
        },
        { status: 500 }
      );
    }

    const prompt = `
Return one valid JSON object with this schema:
{
  "is_medicine_packaging": boolean,
  "packaging_type": string|null,
  "rejection_reason": string|null,
  "medicine_name": string|null,
  "nafdac_number": string|null,
  "manufacturer": string|null,
  "batch_number": string|null,
  "expiry_date": string|null,
  "packaging_intact": boolean,
  "visual_anomalies": [
    {
      "type": string,
      "severity": "low"|"medium"|"high",
      "description": string
    }
  ]
}

Extract only visible information.
Do not claim that a medicine is authentic.
Use null for unreadable fields.
Return JSON only.
`;

    let result = null;
    let lastStatus = 502;
    let lastError = "";

    for (const apiKey of apiKeys) {
      let response;

      try {
        response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              max_completion_tokens: 1000,
              messages: [
                {
                  role: "system",
                  content: "Return only one valid JSON object.",
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${base64}`,
                      },
                    },
                  ],
                },
              ],
            }),
          }
        );
      } catch (error) {
        console.error("Groq request failed:", error.message);
        lastError = error.message;
        continue;
      }

      if (response.ok) {
        result = await response.json();
        break;
      }

      lastStatus = response.status;
      lastError = await response.text().catch(() => "");

      if (![401, 429].includes(response.status)) break;
    }

    if (!result) {
      console.error("Groq API error:", lastStatus, lastError.slice(0, 500));

      return NextResponse.json(
        {
          success: false,
          error:
            lastStatus === 429
              ? "Inspection limit reached. Please try again later."
              : "The inspection service is temporarily unavailable.",
        },
        { status: lastStatus === 429 ? 429 : 502 }
      );
    }

    const content = result.choices?.[0]?.message?.content || "";
    const cleaned = content
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let extracted;

    try {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");

      if (start === -1 || end < start) {
        throw new Error("No JSON object found.");
      }

      extracted = JSON.parse(cleaned.slice(start, end + 1));

      if (typeof extracted.is_medicine_packaging !== "boolean") {
        throw new Error("Missing image classification.");
      }
    } catch (error) {
      console.error("Invalid model response:", error.message);

      return NextResponse.json(
        {
          success: false,
          error: "Could not interpret the image. Please try again.",
        },
        { status: 422 }
      );
    }

    if (!extracted.is_medicine_packaging) {
      return NextResponse.json(
        {
          success: false,
          error:
            extracted.rejection_reason ||
            "No medicine packaging was detected.",
        },
        { status: 400 }
      );
    }

    const evidenceList = [];
    const scoreBreakdown = [];
    let truthScore = 0;
    let medicine = null;

    if (extracted.nafdac_number) {
      const number = normalizeNafdac(extracted.nafdac_number);

      // Query only confirmed Greenbook columns.
      const { data, error } = await supabase
        .from("greenbook_medicines")
        .select(
          "id, product_name, nafdac_number, nafdac_number_normalized, active_ingredients, manufacturer"
        )
        .eq("nafdac_number_normalized", number)
        .limit(2);

      if (error) {
        console.error("Greenbook query failed:", error.message);

        return NextResponse.json(
          {
            success: false,
            error: "Unable to query the medicine registry.",
          },
          { status: 500 }
        );
      }

      if (data.length > 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Multiple Greenbook records matched this number.",
          },
          { status: 409 }
        );
      }

      medicine = data[0] || null;
    }

    if (medicine) {
      truthScore += 45;

      evidenceList.push({
        source: "registry",
        field: "nafdac_number",
        status: "verified",
        confidence: 1,
        message: "NAFDAC number matched a Greenbook record.",
      });

      scoreBreakdown.push({
        reason: "Greenbook record found",
        points: 45,
        type: "positive",
      });

      if (extracted.medicine_name) {
        const matches = isFuzzyMatch(
          extracted.medicine_name,
          medicine.product_name
        );

        if (matches) truthScore += 20;

        evidenceList.push({
          source: "registry",
          field: "medicine_name",
          status: matches ? "verified" : "mismatch",
          confidence: 0.85,
          message: matches
            ? "Medicine name matches the registry."
            : "Medicine name differs from the registry.",
        });

        scoreBreakdown.push({
          reason: matches ? "Medicine name matches" : "Medicine name mismatch",
          points: matches ? 20 : 0,
          type: matches ? "positive" : "negative",
        });
      }

      if (extracted.manufacturer && medicine.manufacturer) {
        const matches = isFuzzyMatch(
          extracted.manufacturer,
          medicine.manufacturer
        );

        if (matches) truthScore += 15;

        evidenceList.push({
          source: "registry",
          field: "manufacturer",
          status: matches ? "verified" : "mismatch",
          confidence: 0.85,
          message: matches
            ? "Manufacturer matches the registry."
            : "Manufacturer differs from the registry.",
        });

        scoreBreakdown.push({
          reason: matches
            ? "Manufacturer matches"
            : "Manufacturer mismatch",
          points: matches ? 15 : 0,
          type: matches ? "positive" : "negative",
        });
      }

      if (medicine.active_ingredients) {
        evidenceList.push({
          source: "registry",
          field: "active_ingredients",
          status: "observed",
          confidence: 1,
          message: `Registered active ingredients: ${medicine.active_ingredients}`,
        });
      }
    } else {
      evidenceList.push({
        source: "registry",
        field: "nafdac_number",
        status: "mismatch",
        confidence: 1,
        message: extracted.nafdac_number
          ? "No matching Greenbook record was found."
          : "NAFDAC number was not readable.",
      });

      scoreBreakdown.push({
        reason: "Registry record not matched",
        points: 0,
        type: "negative",
      });
    }

    if (extracted.batch_number) {
      evidenceList.push({
        source: "image",
        field: "batch_number",
        status: "observed",
        confidence: 0.8,
        message: "Batch number extracted from the image; not verified against Greenbook.",
      });
    }

    if (extracted.expiry_date) {
      evidenceList.push({
        source: "image",
        field: "expiry_date",
        status: "observed",
        confidence: 0.8,
        message: "Package expiry date extracted from the image; not verified against Greenbook.",
      });
    }

    if (extracted.visual_anomalies?.length) {
      const penalty = extracted.visual_anomalies.length * 15;
      truthScore -= penalty;

      evidenceList.push({
        source: "image",
        field: "packaging_integrity",
        status: "warning",
        confidence: 0.8,
        message: `${extracted.visual_anomalies.length} possible packaging anomaly/anomalies observed.`,
      });

      scoreBreakdown.push({
        reason: "Possible packaging anomalies",
        points: -penalty,
        type: "negative",
      });
    }

    truthScore = Math.max(0, Math.min(100, truthScore));

    const overallStatus =
      medicine && truthScore >= 80
        ? "High Evidence Match"
        : medicine && truthScore >= 50
          ? "Partial Evidence Match"
          : "Low Evidence Match";

    return NextResponse.json({
      success: true,
      truthScore,
      overallStatus,
      inspectionConfidence: medicine ? "Medium" : "Low",
      scoreBreakdown,
      evidenceList,
      extracted,
      medicine: medicine
        ? {
            name: medicine.product_name,
            manufacturer: medicine.manufacturer,
            nafdac_number: medicine.nafdac_number,
            batch_number: null,
            expiry_date: null,
            active_ingredients: medicine.active_ingredients,
          }
        : null,
    });
  } catch (error) {
    console.error("Inspection API error:", error.message);

    return NextResponse.json(
      {
        success: false,
        error: "The inspection engine encountered an error.",
      },
      { status: 500 }
    );
  }
}