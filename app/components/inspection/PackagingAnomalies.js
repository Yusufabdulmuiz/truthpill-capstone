export default function PackagingAnomalies({ anomalies }) {
  if (!anomalies?.length) return null;

  return (
    <section className="border border-red-200 bg-white rounded-xl overflow-hidden">
      <div className="py-4 px-5 border-b border-red-200 bg-red-50">
        <h3 className="text-base font-bold text-red-900">
          Packaging Anomalies
        </h3>
      </div>

      <ul className="p-5 text-sm text-red-900 list-disc pl-9 space-y-2">
        {anomalies.map((item, index) => (
          <li key={index} className="leading-6">
            <strong>{item.severity || "Observation"}:</strong>{" "}
            {item.description}
            {item.location ? ` Location: ${item.location}.` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
