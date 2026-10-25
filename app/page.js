"use client"

import React, { useState, useRef } from "react"
import { Camera, Loader2, Search, X, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ArrowRightLeft, Info } from "lucide-react"

// --- Helpers Function ---

// Strip dosages (mg, ml) and special chars for clean comparison
const normalizeText = (text) => {
  if (!text) return ""
  return text.toLowerCase()
    .replace(/\d+\s*mg/g, "")
    .replace(/\d+\s*ml/g, "")
    .replace(/\d+\s*g/g, "")
    .replace(/[^a-z0-9]/g, "")
}

// Fix common OCR typos in batch numbers (e.g., 'O' vs '0')
const normalizeBatch = (text) => {
  if (!text) return ""
  return text.toUpperCase()
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/[^A-Z0-9]/g, "")
}

// Standardize dates to YYYY-MM
const formatExpiryMonth = (dateString) => {
  if (!dateString) return ""
  const match = dateString.match(/^(\d{4})[-/]?(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : dateString.slice(0, 7)
}

// Standard Levenshtein distance calculation
const getLevenshteinDistance = (a, b) => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

// Check if strings are at least 80% similar
const checkFuzzyMatch = (ext, db) => {
  if (!ext || !db) return null
  const s1 = normalizeText(ext)
  const s2 = normalizeText(db)
  
  if (s1.includes(s2) || s2.includes(s1) || (s1 === "mb" && s2.includes("maybaker"))) return true
  
  const distance = getLevenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)
  const similarity = maxLength === 0 ? 1 : (maxLength - distance) / maxLength
  
  return similarity >= 0.8
}
 
export default function AnalyzePage() {
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  // Validate and compress the selected image before allowing inspection.
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      const img = new Image()

      reader.onerror = () => reject(new Error("The selected file could not be read."))
      img.onerror = () => reject(new Error("This file is not a readable image. Please choose a JPG, PNG, or WebP image."))

      img.onload = () => {
        try {
          const maxSize = 1200
          let { width, height } = img

          if (!width || !height) {
            reject(new Error("The image appears to be invalid. Please choose another image."))
            return
          }

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height >= width && height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }

          const canvas = document.createElement("canvas")
          canvas.width = Math.round(width)
          canvas.height = Math.round(height)
          const context = canvas.getContext("2d")

          if (!context) {
            reject(new Error("Your browser could not process this image. Please try another image."))
            return
          }

          context.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL("image/jpeg", 0.75))
        } catch {
          reject(new Error("Failed to process this image. Please try another one."))
        }
      }

      reader.onload = () => {
        img.src = reader.result
      }
      reader.readAsDataURL(file)
    })
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset the input so selecting the same file again triggers onChange.
    event.target.value = ""
    setReport(null)
    setUploadedImage(null)
    setError(null)

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Unsupported file type. Please upload a JPG, PNG, or WebP image.")
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("This image is larger than 10 MB. Please choose a smaller image.")
      return
    }

    if (file.size === 0) {
      setError("The selected file is empty. Please choose another image.")
      return
    }

    try {
      const compressed = await compressImage(file)
      setUploadedImage(compressed)
    } catch (err) {
      setError(err.message || "Failed to process image.")
    }
  }

  const clearImage = () => {
    setUploadedImage(null)
    setReport(null)
    setError(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (galleryInputRef.current) galleryInputRef.current.value = ""
  }

  const analyzeImage = async () => {
    if (!uploadedImage) return
    setIsAnalyzing(true)
    setError(null)
    setReport(null)

    try {
      // Strip base64 prefix before sending
      const base64Data = uploadedImage.split(",")[1]
      
      const response = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data }),
      })

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned a non-JSON response (Status ${response.status}).`)
      }

      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Inspection failed.")
      
      setReport(data)
    } catch (err) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Dynamic styling based on final TruthScore
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-700 bg-green-50 border-green-200"
    if (score >= 50) return "text-yellow-700 bg-yellow-50 border-yellow-200"
    return "text-red-700 bg-red-50 border-red-200"
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 shadow-sm">
        <div className="container mx-auto">
          <img src="/truthpill-logo.png" alt="TruthPill Logo" className="h-10 w-auto" />
        </div>      
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TruthPill Inspection</h1>
          <p className="text-gray-600">Scan medicine packaging to cross-reference authenticity against national registries.</p>
        </div>

        {/* Upload & Preview Section */}
        <div className="mb-8 shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
          <div className="p-6">
            {!uploadedImage ? (
              <div className="text-center border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-green-600 transition-colors">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600 font-medium flex items-center justify-center gap-2">
                   
                    {/* Hidden inputs are triggered via these buttons */}
                    <button onClick={() => cameraInputRef.current?.click()} className="text-green-700 hover:text-green-800 hover:underline">Take Photo</button>
                    <span>or</span>
                    <button onClick={() => galleryInputRef.current?.click()} className="text-green-700 hover:text-green-800 hover:underline">Upload Image</button>
                  </p>
                  <p className="text-xs text-gray-400">Ensure NAFDAC number and text are clearly visible</p>
                </div>
                
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            ) 
            : (
              <div className="space-y-4">
                <div className="relative">
                  <img src={uploadedImage} alt="Scanned Product" className="w-full h-64 object-contain bg-black/5 rounded-lg border border-gray-200 shadow-sm" />
                  <button onClick={clearImage} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <button 
                  onClick={analyzeImage} 
                  disabled={isAnalyzing || !uploadedImage} 
                  className="w-full py-4 text-lg rounded-xl shadow-md bg-green-700 hover:bg-green-800 text-white font-semibold flex justify-center items-center disabled:opacity-70 transition-colors"
                >
                  {isAnalyzing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Running Evidence Engine...</> : <><Search className="mr-2 h-5 w-5" /> Generate Inspection Report</>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 w-full overflow-hidden">
            <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Inspection Failed</h3>
              <p className="text-sm mt-1 break-words whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* RESULTS SECTION */}
        {/* ========================================== */}
        {report && (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Score Card */}
            <div className={`bg-white rounded-xl shadow-sm border-2 ${report.truthScore >= 80 ? 'border-green-200' : report.truthScore >= 50 ? 'border-yellow-200' : 'border-red-200'}`}>
              <div className="p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="flex flex-col items-center">
                  <div className={`w-40 h-40 shrink-0 rounded-full border-8 flex items-center justify-center ${getScoreColor(report.truthScore)}`}>
                    <div className="text-center">
                      <span className="text-5xl font-bold block">{report.truthScore}</span>
                      <span className="text-xs uppercase font-bold tracking-wider opacity-70">TruthScore</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <div className="flex items-center gap-3 justify-center md:justify-start mb-1">
                      <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full uppercase tracking-wider">
                        {report.overallStatus}
                      </span>
                      <span className="text-xs text-gray-400">
                        Confidence: <strong className="text-gray-600">{report.inspectionConfidence}</strong>
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{report.overallStatus}</h2>
                    <p className="text-gray-500 mt-1">
                      {report.truthScore >= 80 
                        ? "This product matches official database records and shows high corroborating evidence."
                        : report.truthScore >= 50
                        ? "Partial evidence found. Some fields could not be verified against the official registry."
                        : "Low evidence match. Critical verification failures detected."}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Points Awarded</h4>
                    <ul className="space-y-2">
                      {report.scoreBreakdown.map((item, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.reason}</span>
                          <span className={`font-mono font-medium ${item.type === 'positive' ? 'text-green-600' : item.type === 'negative' ? 'text-red-600' : 'text-gray-500'}`}>
                            {item.type === 'positive' ? '+' : ''}{item.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer Alert */}
            <div className="flex items-start gap-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-blue-800 text-xs shadow-sm">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                <strong>Disclaimer:</strong> TruthScore reflects how much independent evidence agrees with the scanned package. It is an informational inspection tool and <strong>is not a guarantee that a medicine is genuine.</strong> Always consult a licensed pharmacist if you suspect a product is falsified.
              </p>
            </div>

            {/* Evidence Log Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 py-3 px-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600">Evidence Log</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.evidenceList?.map((item, i) => {
                  let icon = <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  let badgeColor = "bg-green-50 text-green-700 border-green-200"

                  if (item.status === "mismatch" || item.status === "warning") {
                    icon = <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    badgeColor = "bg-red-50 text-red-700 border-red-200"
                  } else if (item.status === "unknown") {
                    icon = <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                    badgeColor = "bg-gray-50 text-gray-600 border-gray-200"
                  } else if (item.status === "observed") {
                    icon = <Search className="h-4 w-4 text-blue-500 shrink-0" />
                    badgeColor = "bg-blue-50 text-blue-700 border-blue-200"
                  }

                  return (
                    <div key={i} className="flex items-start justify-between gap-2 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                      <div className="flex items-center gap-2">
                        {icon}
                        <span className="text-xs font-medium text-gray-800 leading-snug">{item.message}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border uppercase tracking-wider shrink-0 ${badgeColor}`}>
                        {item.source}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Comparison Table Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 py-3 px-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                  <ArrowRightLeft className="h-5 w-5 text-green-700" /> Image vs. Registry Data
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-100/75 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Field</th>
                      <th className="py-3 px-4 font-semibold">Observed in Image</th>
                      <th className="py-3 px-4 font-semibold">Official Registry</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Medicine Name */}
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Medicine Name</td>
                      <td className="py-3 px-4">{report.extracted.medicine_name || "Not visible"}</td>
                      <td className="py-3 px-4">{!report.medicine ? "N/A" : (report.medicine.name || <span className="text-gray-400 italic">Not compared</span>)}</td>
                      <td className="py-3 px-4">
                        {report.medicine && report.extracted.medicine_name ? (
                          checkFuzzyMatch(report.extracted.medicine_name, report.medicine.name) ? (
                            <span className="text-green-600 font-semibold flex items-center gap-1">✓ Match</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗ Mismatch</span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">Not evaluated</span>
                        )}
                      </td>
                    </tr>
                    {/* Manufacturer */}
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Manufacturer</td>
                      <td className="py-3 px-4">{report.extracted.manufacturer || "Not visible"}</td>
                      <td className="py-3 px-4">{!report.medicine ? "N/A" : (report.medicine.manufacturer || <span className="text-gray-400 italic">Not compared</span>)}</td>
                      <td className="py-3 px-4">
                        {report.medicine && report.extracted.manufacturer ? (
                          checkFuzzyMatch(report.extracted.manufacturer, report.medicine.manufacturer) ? (
                            <span className="text-green-600 font-semibold flex items-center gap-1">✓ Match</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗ Mismatch</span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">Not evaluated</span>
                        )}
                      </td>
                    </tr>
                    {/* NAFDAC */}
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">NAFDAC Number</td>
                      <td className="py-3 px-4 font-mono">{report.extracted.nafdac_number || "Not visible"}</td>
                      <td className="py-3 px-4 font-mono">{!report.medicine ? "N/A" : (report.medicine.nafdac_number || <span className="text-gray-400 italic">Not compared</span>)}</td>
                      <td className="py-3 px-4">
                        {report.medicine && report.extracted.nafdac_number ? (
                          report.extracted.nafdac_number.toUpperCase().trim() === report.medicine.nafdac_number.toUpperCase().trim() ? (
                            <span className="text-green-600 font-semibold">✓ Match</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗ Mismatch</span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">Not evaluated</span>
                        )}
                      </td>
                    </tr>
                    {/* Batch Number */}
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Batch Number</td>
                      <td className="py-3 px-4 font-mono">{report.extracted.batch_number || "Not visible"}</td>
                      <td className="py-3 px-4 font-mono">{!report.medicine ? "N/A" : (report.medicine.batch_number || <span className="text-gray-400 italic">Not compared</span>)}</td>
                      <td className="py-3 px-4">
                        {report.medicine && report.extracted.batch_number ? (
                           normalizeBatch(report.extracted.batch_number) === normalizeBatch(report.medicine.batch_number) ? (
                            <span className="text-green-600 font-semibold">✓ Match</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗ Mismatch</span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">Not evaluated</span>
                        )}
                      </td>
                    </tr>
                    {/* Expiry Date */}
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Expiry Date</td>
                      <td className="py-3 px-4 font-mono">{report.extracted.expiry_date || "Not visible"}</td>
                      <td className="py-3 px-4 font-mono">{!report.medicine ? "N/A" : (report.medicine.expiry_date || <span className="text-gray-400 italic">Not compared</span>)}</td>
                      <td className="py-3 px-4">
                        {report.medicine && report.extracted.expiry_date ? (
                          formatExpiryMonth(report.extracted.expiry_date) === formatExpiryMonth(report.medicine.expiry_date) ? (
                            <span className="text-green-600 font-semibold">✓ Match</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗ Mismatch</span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">Not evaluated</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Anomalies Warning */}
            {report.extracted.visual_anomalies && report.extracted.visual_anomalies.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-xl shadow-sm overflow-hidden mt-6">
                <div className="py-3 px-4 border-b border-red-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h3 className="text-sm font-semibold text-red-800">Packaging Anomalies Detected</h3>
                </div>
                <div className="p-4 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {report.extracted.visual_anomalies.map((anomaly, i) => (
                      <li key={i}>
                        <strong>{anomaly.type}:</strong> {anomaly.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}