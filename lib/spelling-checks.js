import nspell from "nspell";
import dictionary from "dictionary-en";

const spell = nspell(dictionary);

// Words commonly found on medicine packaging that may not
// be included in a general English dictionary.
const ALLOWED_WORDS = new Set([
  "paracetamol",
  "acetaminophen",
  "ibuprofen",
  "amoxicillin",
  "artemether",
  "lumefantrine",
  "metformin",
  "ciprofloxacin",
  "azithromycin",
  "omeprazole",
  "cetirizine",
  "chlorpheniramine",
  "dihydroartemisinin",
  "pyrimethamine",
  "sulfadoxine",
  "pharmaceutical",
  "pharmacopoeia",
  "suspension",
  "dispersible",
  "capsule",
  "capsules",
  "tablets",
  "injection",
  "injections",
  "dosage",
  "contraindications",
  "ingredients",
  "manufactured",
  "manufacturer",
  "registration",
  "prescription",
  "antibiotic",
  "antimalarial",
  "nafdac",
]);

export function checkSpelling(ocrText) {
  if (typeof ocrText !== "string" || !ocrText.trim()) {
    return [];
  }

  const words = ocrText.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
  const seen = new Set();
  const warnings = [];

  for (const original of words) {
    const word = original.toLowerCase();

    if (
      seen.has(word) ||
      ALLOWED_WORDS.has(word) ||
      original === original.toUpperCase()
    ) {
      continue;
    }

    seen.add(word);

    if (spell.correct(word)) continue;

    const suggestions = spell.suggest(word).slice(0, 3);

    warnings.push({
      word: original,
      suggestions,
      message: suggestions.length
        ? `Possible spelling issue: "${original}".`
        : `The word "${original}" could not be confirmed by the dictionary.`,
    });
  }

  return warnings.slice(0, 30);
}