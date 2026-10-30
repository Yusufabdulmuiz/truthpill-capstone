export default function ScanGuidelines() {
  return (
    <section className="mb-8 bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-lg font-bold tracking-tight text-gray-950 mb-4">
        Before You Begin
      </h2>

      <ul className="space-y-4 text-base leading-7 text-gray-700">
        <li className="flex gap-2">
          <span className="font-semibold text-green-700">1.</span>
          <span>
            Use the actual medicine package. Photograph the box, bottle, sachet
            or blister, not a screenshot or product information page.
          </span>
        </li>

        <li className="flex gap-2">
          <span className="font-semibold text-green-700">2.</span>
          <span>
            Ensure the medicine name, NAFDAC number and other printed details
            are clear and readable.
          </span>
        </li>

        <li className="flex gap-2">
          <span className="font-semibold text-green-700">3.</span>
          <span>
            Only details visible in your image can be checked. Information that
            cannot be seen is not assumed.
          </span>
        </li>
      </ul>
    </section>
  );
}
