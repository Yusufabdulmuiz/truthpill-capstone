export default function FindingsToReview({ findings }) {
  if (!findings?.length) return null;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
      <div className="bg-amber-50 border-b border-amber-200 py-4 px-5">
        <h3 className="text-base font-bold text-amber-900">
          Findings to Review
        </h3>
        <p className="text-sm text-amber-800 mt-1">
          Possible printed-text concerns identified from the package image.
          Check each item against the original packaging.
        </p>
      </div>

      <div className="p-5 space-y-3">
        {findings.map((item, index) => (
          <article
            key={`${item.printed_text}-${index}`}
            className="rounded-lg border border-amber-200 bg-amber-50/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="font-semibold text-gray-900">
                “{item.printed_text}”
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                  item.severity === "high"
                    ? "bg-red-100 text-red-800"
                    : item.severity === "medium"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {item.severity || "Review"}
              </span>
            </div>

            <p className="text-sm leading-6 text-gray-700">{item.concern}</p>

            {item.suggested_reading && (
              <p className="text-sm text-gray-800 mt-2">
                <strong>Possible reading:</strong> {item.suggested_reading}
              </p>
            )}

            {item.location && (
              <p className="text-xs text-gray-500 mt-2">
                <strong>Location:</strong> {item.location}
              </p>
            )}
          </article>
        ))}
      </div>

      <p className="px-5 pb-5 text-xs leading-5 text-gray-600">
        These are model-assisted visual observations, not proof of
        counterfeiting. Confirm the printed text manually.
      </p>
    </section>
  );
}
