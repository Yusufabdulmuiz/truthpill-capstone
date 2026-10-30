"use client";

import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

import UploadSection from "./components/inspection/UploadSection";
import ScanGuidelines from "./components/inspection/ScanGuidelines";
import InspectionReport from "./components/inspection/InspectionReport";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function hasMedicineCues(text) {
  const value = text.toLowerCase();

  const cueGroups = [
    /\bnafdac\b|\breg(?:istration)?\s*(?:no|number)\b/i,
    /\btablets?\b|\bcapsules?\b|\bsyrup\b|\bsuspension\b|\binjection\b|\bblister\b/i,
    /\b\d+\s?(?:mg|mcg|g|ml|iu)\b/i,
    /\bbatch\b|\bexpiry\b|\bexp(?:iry)?\s*date\b|\bmfg\b|\bmanufactured\b/i,
    /\bdosage\b|\bingredients\b|\bactive ingredient\b|\bpharmaceutical\b/i,
  ];

  return cueGroups.filter((pattern) => pattern.test(value)).length >= 2;
}

// Resize and compress the image before OCR processing

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const image = new Image();

    reader.onerror = () =>
      reject(new Error("The selected file could not be read."));

    image.onerror = () =>
      reject(new Error("This is not a readable image."));

    image.onload = () => {
      try {
        const maxDimension = 1200;
        let { width, height } = image;

        if (!width || !height) {
          reject(new Error("The image appears to be invalid."));
          return;
        }

        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Your browser could not process this image."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const compressedImage = canvas.toDataURL("image/jpeg", 0.75);

        if (!compressedImage.startsWith("data:image/jpeg;base64,")) {
          reject(new Error("The image could not be converted to JPEG."));
          return;
        }

        resolve(compressedImage);
      } catch {
        reject(new Error("Failed to process this image."));
      }
    };

    reader.onload = () => {
      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// Extract preliminary text from the processed image

async function extractPreliminaryText(imageDataUrl) {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(imageDataUrl);
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

export default function AnalyzePage() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrText, setOcrText] = useState("");

  const [isPrechecking, setIsPrechecking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [precheckPassed, setPrecheckPassed] = useState(false);

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const precheckRunRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const resetInspection = () => {
    precheckRunRef.current += 1;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreviewUrl(null);
    setUploadedImage(null);
    setOcrText("");
    setReport(null);
    setError("");
    setPrecheckPassed(false);
    setIsPrechecking(false);
    setIsAnalyzing(false);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const currentRun = ++precheckRunRef.current;

    setUploadedImage(null);
    setOcrText("");
    setReport(null);
    setError("");
    setPrecheckPassed(false);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Upload a JPG, PNG or WebP image.");
      return;
    }

    if (!file.size || file.size > MAX_IMAGE_SIZE) {
      setError("The image must be smaller than 10 MB.");
      return;
    }

    // To keep the original image for the user's preview
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const imageUrl = URL.createObjectURL(file);
    previewUrlRef.current = imageUrl;
    setPreviewUrl(imageUrl);

    setIsPrechecking(true);

    try {
      // Convert the image to JPEG before sending it to OCR.
      const compressed = await compressImage(file);

      if (currentRun !== precheckRunRef.current) return;

      const text = await extractPreliminaryText(compressed);

      if (currentRun !== precheckRunRef.current) return;

      if (!text.trim()) {
        throw new Error(
          "We could not read enough text from this image. Try a clearer photo with the package text visible."
        );
      }

      if (!hasMedicineCues(text)) {
        throw new Error(
          "We could not identify enough medicine-related text. Please upload a clear photo of the medicine package, showing details such as its dosage, NAFDAC number or packaging information."
        );
      }

      setUploadedImage(compressed);
      setOcrText(text);
      setPrecheckPassed(true);
    } catch (err) {
      if (currentRun !== precheckRunRef.current) return;

      setUploadedImage(null);
      setPrecheckPassed(false);
      setError(err.message || "The image could not be validated.");
    } finally {
      if (currentRun === precheckRunRef.current) {
        setIsPrechecking(false);
      }
    }
  };

  const analyzeImage = async () => {
    if (!uploadedImage || !precheckPassed || isAnalyzing || isPrechecking) {
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setReport(null);

    try {
      const base64Data = uploadedImage.split(",")[1];
// To send the image and preliminary OCR text to the backend
      const response = await fetch("/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Data,
          ocrText,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Inspection failed.");
      }
// Update the page with the inspection report returned by the backend
      setReport(data);
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-4 sm:px-6 shadow-sm">
        <div className="container mx-auto">
          <img
            src="/truthpill-logo.png"
            alt="TruthPill Logo"
            className="h-10 w-auto"
          />
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 sm:py-8 max-w-4xl text-[15px] leading-relaxed text-gray-800">
        <div className="text-center mb-7 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-gray-950 mb-3">
            Medicine Package Inspection
          </h1>

          <p className="text-sm sm:text-lg leading-6 sm:leading-8 text-gray-700 max-w-2xl mx-auto">
            Check visible medicine package details against official NAFDAC
            registry records.
          </p>
        </div>

        <UploadSection
          previewUrl={previewUrl}
          cameraInputRef={cameraInputRef}
          galleryInputRef={galleryInputRef}
          isPrechecking={isPrechecking}
          isAnalyzing={isAnalyzing}
          precheckPassed={precheckPassed}
          error={error}
          onImageUpload={handleImageUpload}
          onReset={resetInspection}
          onAnalyze={analyzeImage}
        />

        <ScanGuidelines />

        {error && !previewUrl && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <h3 className="font-semibold">Upload Notice</h3>
            <p className="text-sm mt-1 leading-6">{error}</p>
          </div>
        )}

        {report && (
          <InspectionReport report={report} onReset={resetInspection} />
        )}
      </main>
    </div>
  );
}
