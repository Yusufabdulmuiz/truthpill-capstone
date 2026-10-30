export default function EvidenceLog({ evidence }) {
  const verifiedEvidence = evidence?.filter(
    (item) => item.status === "verified"
  );

  if (!verifiedEvidence?.length) return null;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 py-4 px-5">
        <h3 className="text-base font-bold text-gray-900">Evidence Log</h3>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {verifiedEvidence.map((item, index) => (
          <div
            key={`${item.field || item.message}-${index}`}
            className="p-4 rounded-lg border border-gray-200"
          >
            <p className="text-sm font-medium leading-6 text-gray-800">
              {item.message}
            </p>
            <p className="text-xs font-semibold uppercase text-gray-500 mt-3">
              {item.source} · {item.status}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
