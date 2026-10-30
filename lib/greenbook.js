
import { supabase } from "@/lib/supabase";

const REGISTRY_SELECT =
  "id, product_name, nafdac_number, nafdac_number_normalized, active_ingredients, manufacturer";

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeNafdac(value) {
  return String(value || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\bNAFDAC\b/g, "")
    .replace(
      /^\s*(?:(?:REG(?:ISTRATION)?\s*)?(?:NO|NUMBER|#)\s*[:.-]?\s*)/i,
      ""
    )
    .replace(/[^A-Z0-9]/g, "");
}

function getNafdacCandidates(value) {
  const original = String(value || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\bNAFDAC\b/g, "")
    .replace(
      /^\s*(?:(?:REG(?:ISTRATION)?\s*)?(?:NO|NUMBER|#)\s*[:.-]?\s*)/i,
      ""
    )
    .trim();

  return [
    original,
    original.replace(/\s+/g, ""),
    original.replace(/[\s/]+/g, "-"),
    original.replace(/[-\s/]+/g, ""),
    normalizeNafdac(value),
  ].filter((item, index, values) => item && values.indexOf(item) === index);
}

export function isFuzzyMatch(first, second) {
  const a = normalizeText(first).replace(/\s/g, "");
  const b = normalizeText(second).replace(/\s/g, "");

  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;

  let previous = Array.from(
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

    previous = current;
  }

  const similarity =
    1 - previous[b.length] / Math.max(a.length, b.length);

  return similarity >= 0.8;
}

function uniqueRows(rows) {
  return [
    ...new Map((rows || []).map((row) => [String(row.id), row])).values(),
  ];
}

function exactNafdacMatches(rows, normalizedNumber) {
  return (rows || []).filter(
    (row) =>
      normalizeNafdac(row.nafdac_number) === normalizedNumber ||
      normalizeNafdac(row.nafdac_number_normalized) === normalizedNumber
  );
}

export async function lookupGreenbook(extracted) {
  const rawNafdac = extracted.nafdac_number;
  const normalizedNafdac = normalizeNafdac(rawNafdac);

  if (rawNafdac && normalizedNafdac) {
    const candidates = getNafdacCandidates(rawNafdac);

    const rawResult = await supabase
      .from("greenbook_medicines")
      .select(REGISTRY_SELECT)
      .in("nafdac_number", candidates)
      .limit(20);

    if (rawResult.error) {
      throw new Error(rawResult.error.message);
    }

    let matches = exactNafdacMatches(
      rawResult.data,
      normalizedNafdac
    );

    if (!matches.length) {
      const normalizedResult = await supabase
        .from("greenbook_medicines")
        .select(REGISTRY_SELECT)
        .in("nafdac_number_normalized", candidates)
        .limit(20);

      if (normalizedResult.error) {
        throw new Error(normalizedResult.error.message);
      }

      matches = exactNafdacMatches(
        normalizedResult.data,
        normalizedNafdac
      );
    }

    const uniqueMatches = uniqueRows(matches);

    if (uniqueMatches.length === 1) {
      return {
        record: uniqueMatches[0],
        matchType: "exact_nafdac",
      };
    }

    if (uniqueMatches.length > 1) {
      return { record: null, matchType: "ambiguous" };
    }

    return { record: null, matchType: "none" };
  }

  if (!extracted.medicine_name) {
    return { record: null, matchType: "none" };
  }

  const searchTerms = normalizeText(extracted.medicine_name)
    .split(" ")
    .filter((term) => term.length > 1)
    .slice(0, 8);

  if (!searchTerms.length) {
    return { record: null, matchType: "none" };
  }

  const nameResult = await supabase
    .from("greenbook_medicines")
    .select(REGISTRY_SELECT)
    .textSearch("product_name", searchTerms.join(" & "), {
      config: "simple",
    })
    .limit(20);

  if (nameResult.error) {
    throw new Error(nameResult.error.message);
  }

  const extractedName = normalizeText(extracted.medicine_name);

  const matches = (nameResult.data || []).filter(
    (row) => normalizeText(row.product_name) === extractedName
  );

  const uniqueMatches = uniqueRows(matches);

  if (uniqueMatches.length === 1) {
    return {
      record: uniqueMatches[0],
      matchType: "name_candidate",
    };
  }

  return {
    record: null,
    matchType: uniqueMatches.length > 1 ? "ambiguous" : "none",
  };
}
