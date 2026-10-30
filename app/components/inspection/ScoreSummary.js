function getScoreColor(score) {
  if (score >= 80) return "text-green-800 bg-green-50 border-green-300";
  if (score >= 50) return "text-amber-800 bg-amber-50 border-amber-300";
  return "text-red-800 bg-red-50 border-red-300";
}

export default function ScoreSummary({ report }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-5">
        <p className="text-sm font-bold uppercase tracking-wider text-gray-600">
          Inspection Report
        </p>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">
          {report.overallStatus}
        </h2>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div
          className={`w-44 h-44 shrink-0 rounded-full border-[9px] flex items-center justify-center ${
            report.truthScore === null
              ? "text-gray-700 bg-gray-50 border-gray-300"
              : getScoreColor(report.truthScore)
          }`}
        >
          <div className="text-center">
            <span className="text-6xl font-extrabold block leading-none">
              {report.truthScore === null ? "—" : report.truthScore}
            </span>
            <span className="text-sm uppercase font-bold tracking-wider mt-2 block">
              TruthScore
            </span>
            <span className="text-xs mt-1 block">out of 100</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          <p className="text-sm leading-6 text-gray-700">
            {report.truthScore === null
              ? "An exact registry identity could not be established. This does not by itself prove that the product is counterfeit."
              : `The package details earned ${report.truthScore} out of 100 possible points from the registry comparisons that were assessed.`}
          </p>

          {report.comparisonCoverage !== undefined && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex justify-between items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">
                  Comparison coverage
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {report.comparisonCoverage}%
                </span>
              </div>

              <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, report.comparisonCoverage)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-800 mb-3">
              Score Breakdown
            </h4>

            <div className="space-y-2">
              {report.scoreBreakdown?.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between gap-4 text-sm"
                >
                  <span className="text-gray-700">{item.reason}</span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {item.points > 0 ? "+" : ""}
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
