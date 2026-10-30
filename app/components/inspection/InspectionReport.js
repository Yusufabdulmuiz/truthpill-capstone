import ScoreSummary from "./ScoreSummary";
import EvidenceLog from "./EvidenceLog";
import RegistryComparison from "./RegistryComparison";
import FindingsToReview from "./FindingsToReview";
import PackagingAnomalies from "./PackagingAnomalies";

export default function InspectionReport({ report, onReset }) {
  return (
    <div className="space-y-6">
      <ScoreSummary report={report} />

      <section className="bg-green-50 p-4 rounded-xl border border-green-200 text-green-900 text-sm leading-6">
        <strong>Note:</strong> TruthScore measures agreement with available
        registry records. It is not proof that an individual medicine pack is
        genuine. Visual findings require human review.
      </section>

      <EvidenceLog evidence={report.evidenceList} />

      <RegistryComparison report={report} />

      <FindingsToReview
        findings={report.extracted?.label_text_warnings}
      />

      <PackagingAnomalies
        anomalies={report.extracted?.visual_anomalies}
      />

      <div className="flex justify-center pt-2 pb-6">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-green-700 px-6 py-3 text-sm font-semibold text-green-800 hover:bg-green-50 transition-colors"
        >
          Inspect Another Package
        </button>
      </div>
    </div>
  );
}
