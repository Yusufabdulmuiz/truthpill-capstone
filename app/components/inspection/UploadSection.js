
import { Camera, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function UploadSection({
  previewUrl,
  cameraInputRef,
  galleryInputRef,
  isPrechecking,
  isAnalyzing,
  precheckPassed,
  error,
  onImageUpload,
  onReset,
  onAnalyze,
}) {
  return (
    <section className="mb-6 sm:mb-8 shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
      <div className="p-4 sm:p-6">
        {!previewUrl ? (
          <div className="text-center border-2 border-dashed border-gray-300 rounded-xl p-5 sm:p-10 bg-gray-50">
            <div className="flex justify-center text-gray-400 mb-4">
              <Camera size={34} strokeWidth={1.7} />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:text-lg font-semibold">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="text-green-700 hover:text-green-900 hover:underline"
              >
                Take a Photo
              </button>

              <span className="text-gray-500">or</span>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="text-green-700 hover:text-green-900 hover:underline"
              >
                Upload an Image
              </button>
            </div>

            <p className="text-sm sm:text-base leading-6 sm:leading-7 text-gray-600 mt-3 max-w-sm mx-auto">
              Capture or select a clear image of your medicine package.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={previewUrl}
                alt="Selected medicine package"
                className="w-full h-64 sm:h-72 object-contain bg-gray-100 rounded-lg border border-gray-200"
              />

              <button
                type="button"
                onClick={onReset}
                disabled={isPrechecking || isAnalyzing}
                aria-label="Remove image"
                title="Remove image"
                className="absolute top-2 right-2 flex items-center justify-center h-9 w-9 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-sm disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm sm:text-base font-semibold text-gray-900">
              Uploaded package
            </p>

            <div
              className={`rounded-lg border p-3 sm:p-4 ${
                isPrechecking
                  ? "bg-blue-50 border-blue-200"
                  : precheckPassed
                    ? "bg-green-50 border-green-200"
                    : error
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {isPrechecking ? (
                  <Loader2
                    size={20}
                    className="mt-0.5 shrink-0 animate-spin text-blue-700"
                  />
                ) : precheckPassed ? (
                  <CheckCircle2
                    size={20}
                    className="mt-0.5 shrink-0 text-green-700"
                  />
                ) : (
                  <AlertCircle
                    size={20}
                    className="mt-0.5 shrink-0 text-gray-600"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-base font-semibold text-gray-950 break-words">
                    {isPrechecking
                      ? "Checking image and reading visible text..."
                      : precheckPassed
                        ? "Image check passed"
                        : error
                          ? "Preliminary check unsuccessful"
                          : "Waiting for preliminary check"}
                  </p>

                  {(!precheckPassed || isPrechecking || error) && (
                    <p className="text-sm sm:text-base leading-6 sm:leading-7 text-gray-700 mt-1 break-words">
                      {isPrechecking
                        ? "Please wait while the image is checked and visible text is read."
                        : error ||
                          "The image will be checked before inspection can begin."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onAnalyze}
              disabled={!precheckPassed || isPrechecking || isAnalyzing}
              className="w-full py-3 sm:py-4 text-sm sm:text-lg rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold transition-colors disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? "Running inspection..." : "Inspect Package"}
            </button>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onImageUpload}
          className="hidden"
        />

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onImageUpload}
          className="hidden"
        />
      </div>
    </section>
  );
}
