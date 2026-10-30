function StatusLabel({ status }) {
  const styles = {
    verified: "bg-green-50 text-green-800 border-green-200",
    mismatch: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    unknown: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const labels = {
    verified: "Match",
    mismatch: "Mismatch",
    warning: "Warning",
    unknown: "Not evaluated",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        styles[status] || styles.unknown
      }`}
    >
      {labels[status] || status || "Not evaluated"}
    </span>
  );
}

function FieldRow({ label, observed, registry, status }) {
  const isVisible = Boolean(observed);

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3 font-semibold text-gray-900">{label}</td>
      <td className="px-4 py-3 text-gray-800">
        {isVisible ? observed : (
          <span className="text-gray-500">Not visible</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-800">
        {isVisible ? registry || "Not found in registry" : (
          <span className="text-gray-500">Not displayed</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isVisible ? status || <StatusLabel status="unknown" /> : (
          <StatusLabel status="unknown" />
        )}
      </td>
    </tr>
  );
}

export default function RegistryComparison({ report }) {
  const hasExactMatch = report.matchType === "exact_nafdac";

  const getFieldStatus = (field) => {
    const item = report.evidenceList?.find(
      (evidence) => evidence.field === field
    );
    return item ? <StatusLabel status={item.status} /> : null;
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 py-4 px-5">
        <h3 className="text-base font-bold text-gray-900">
          Image vs. Registry Data
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm text-gray-800">
          <thead className="bg-gray-100 text-xs uppercase text-gray-700">
            <tr>
              <th className="py-3 px-4">Field</th>
              <th className="py-3 px-4">Observed in Image</th>
              <th className="py-3 px-4">Official Registry</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>

          <tbody>
            <FieldRow
              label="Medicine Name"
              observed={report.extracted?.medicine_name}
              registry={hasExactMatch ? report.medicine?.name : null}
              status={getFieldStatus("medicine_name")}
            />
            <FieldRow
              label="Manufacturer"
              observed={report.extracted?.manufacturer}
              registry={hasExactMatch ? report.medicine?.manufacturer : null}
              status={getFieldStatus("manufacturer")}
            />
            <FieldRow
              label="NAFDAC Number"
              observed={report.extracted?.nafdac_number}
              registry={hasExactMatch ? report.medicine?.nafdac_number : null}
              status={getFieldStatus("nafdac_number")}
            />
            <FieldRow
              label="Active Ingredients"
              observed={report.extracted?.active_ingredients}
              registry={
                hasExactMatch ? report.medicine?.active_ingredients : null
              }
              status={getFieldStatus("active_ingredients")}
            />
            <FieldRow
              label="Batch Number"
              observed={report.extracted?.batch_number}
              registry={null}
              status={
                report.extracted?.batch_number ? (
                  <span className="font-semibold text-blue-700">
                    Observed only
                  </span>
                ) : null
              }
            />
            <FieldRow
              label="Expiry Date"
              observed={report.extracted?.expiry_date}
              registry={null}
              status={
                report.extracted?.expiry_date ? (
                  <span className="font-semibold text-blue-700">
                    Observed only
                  </span>
                ) : null
              }
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}
