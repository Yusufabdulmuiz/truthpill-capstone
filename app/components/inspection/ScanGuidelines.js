
export default function ScanGuidelines() {
  return (
    <section className="mb-6 sm:mb-8 bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <h2 className="text-base sm:text-lg font-bold tracking-tight text-gray-950 mb-3 sm:mb-4">
        Before You Begin
      </h2>

      <ul className="space-y-3 sm:space-y-4 text-sm sm:text-base leading-6 sm:leading-7 text-gray-700">
        <li className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 font-semibold text-green-700">1.</span>
          <span className="min-w-0">
            Use the actual medicine package. Photograph the box, bottle, sachet
            or blister, not a screenshot or product information page.
          </span>
        </li>

        <li className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 font-semibold text-green-700">2.</span>
          <span className="min-w-0">
            Ensure the medicine name, NAFDAC number and other printed details
            are clear and readable.
          </span>
        </li>

        <li className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 font-semibold text-green-700">3.</span>
          <span className="min-w-0">
            Only details visible in your image can be checked. Information that
            cannot be seen is not assumed.
          </span>
        </li>
      </ul>
    </section>
  );
}
