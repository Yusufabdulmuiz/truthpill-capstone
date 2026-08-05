"use client"

import React, { useState, useRef } from "react"
import { Camera, Loader2, Search, X, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ArrowRightLeft, Info } from "lucide-react"

// --- Helper Functions ---
const normalizeText = (text) => {
  if (!text) return ""
  return text.toLowerCase().replace(/\d+\s*mg/g, "").replace(/\d+\s*ml/g, "").replace(/\d+\s*g/g, "").replace(/[^a-z0-9]/g, "")
}

const normalizeBatch = (text) => {
  if (!text) return ""
  return text.toUpperCase().replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/[^A-Z0-9]/g, "")
}

const formatExpiryMonth = (dateString) => {
  if (!dateString) return ""
  const match = dateString.match(/^(\d{4})[-/]?(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : dateString.slice(0, 7)
}

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

// --- Main React Component ---
export default function AnalyzePage() {
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        const maxSize = 850 
        let { width, height } = img
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize }
        }
        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.7)) 
      }
      const reader = new FileReader()
      reader.onload = (e) => { img.src = e.target?.result }
      reader.readAsDataURL(file)
    })
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        const compressed = await compressImage(file)
        setUploadedImage(compressed)
        setReport(null)
        setError(null)
      } catch (err) {
        setError("Failed to process image.")
      }
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
      const base64Data = uploadedImage.split(",")[1]
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data }),
      })

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned a non-JSON response (Status ${response.status}). Ensure the API route is configured correctly.`)
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

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-700 bg-green-50 border-green-200"
    if (score >= 50) return "text-yellow-700 bg-yellow-50 border-yellow-200"
    return "text-red-700 bg-red-50 border-red-200"
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Basic Header Placeholder */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 shadow-sm">
        <div className="container mx-auto font-bold text-xl text-green-700 tracking-tight">TruthPill</div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TruthPill Inspection</h1>
          <p className="text-gray-600">Scan medicine packaging to cross-reference authenticity against national registries.</p>
        </div>

        {/* Upload Section */}
        <div className="mb-8 shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
          <div className="p-6">
            {!uploadedImage ? (
              <div className="text-center border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-green-600 transition-colors">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600 font-medium flex items-center justify-center gap-2">
                    <button onClick={() => cameraInputRef.current?.click()} className="text-green-700 hover:text-green-800 hover:underline">Take Photo</button>
                    <span>or</span>
                    <button onClick={() => galleryInputRef.current?.click()} className="text-green-700 hover:text-green-800 hover:underline">Upload Image</button>
                  </p>
                  <p className="text-xs text-gray-400">Ensure NAFDAC number and text are clearly visible</p>
                </div>
                {/* Hidden File Inputs */}
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <img src={uploadedImage} alt="Scanned Product" className="w-full h-64 object-contain bg-black/5 rounded-lg border border-gray-200 shadow-sm" />
                  <button onClick={clearImage} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <button 
                  onClick={analyzeImage} 
                  disabled={isAnalyzing} 
                  className="w-full py-4 text-lg rounded-xl shadow-md bg-green-700 hover:bg-green-800 text-white font-semibold flex justify-center items-center disabled:opacity-70 transition-colors"
                >
                  {isAnalyzing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Running Evidence Engine...</> : <><Search className="mr-2 h-5 w-5" /> Generate Inspection Report</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}