# TruthPill – Technical Design Document

## 1. Overview

TruthPill is a medicine-package inspection platform designed to compare information visible on medicine packaging with available registration information in the NAFDAC Greenbook.

The system combines image validation, preliminary OCR, AI-based image analysis and registry lookup to produce an inspection report.

TruthPill is an evidence-support tool. It does not independently authenticate medicines or determine whether a medicine is safe or effective.

## 2. Objectives

The system is designed to:

- Accept photographs of medicine packaging.
- Extract visible medicine and package information.
- Identify a medicine registry record using its NAFDAC registration number where possible.
- Compare visible information with available registry data.
- Highlight possible printed-text concerns and packaging anomalies.
- Present comparison results and supporting evidence in an understandable report.

## 3. System Architecture

TruthPill has four main parts:

1. **Frontend:** Next.js and React interface for image selection, preliminary checks and report display.
2. **Image and OCR processing:** Browser-side image checks, compression and preliminary text extraction.
3. **Backend inspection API:** Image validation, AI image analysis, focused text review, registry lookup and scoring.
4. **Database and external services:** Supabase PostgreSQL for registry data and Groq for vision-model inference.

### High-level flow

```text
User
 |
 v
Next.js Frontend
 |
 +--> Image selection and file checks
 |
 +--> Tesseract.js preliminary OCR
 |
 +--> Image compression
 |
 v
POST /api
 |
 +--> Server-side image validation
 |
 +--> Groq vision analysis
 |
 +--> Focused image-based text review
 |
 +--> NAFDAC Greenbook lookup (Supabase)
 |
 +--> Comparison and TruthScore calculation
 |
 v
Inspection response
 |
 v
Inspection report in the frontend
```

## 4. Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Application framework | Next.js | Application routing and API handling |
| UI | React | Interactive interface |
| Styling | Tailwind CSS | Page and component styling |
| OCR | Tesseract.js | Preliminary extraction of visible text |
| AI inference | Groq API | Access to the configured vision model |
| Vision model | Qwen vision model | Package image analysis |
| Database | Supabase PostgreSQL | Medicine registry storage and lookup |
| Icons | Lucide React | Interface icons |

The configured model name and API settings are managed through environment variables and the backend implementation.

## 5. Frontend Design

The main frontend entry point is `app/page.js`. It manages application state and coordinates image upload, preliminary OCR, inspection requests and report display.

The inspection UI is divided into reusable components under `app/components/inspection/`.

| Component | Responsibility |
|---|---|
| `UploadSection.js` | Camera capture, gallery upload, image preview, preliminary-check status and inspection action |
| `ScanGuidelines.js` | Instructions for taking or selecting a package image |
| `InspectionReport.js` | Arranges the sections of the inspection report |
| `ScoreSummary.js` | Displays TruthScore, comparison coverage and score breakdown |
| `EvidenceLog.js` | Displays evidence entries marked as verified |
| `RegistryComparison.js` | Displays observed package details alongside registry details |
| `FindingsToReview.js` | Displays possible printed-text concerns for human review |
| `PackagingAnomalies.js` | Displays visual packaging observations classified as anomalies |

The components receive data and callbacks through props. Application state and inspection workflow remain in `page.js`.

## 6. Image Upload and Preliminary OCR

When a user selects an image, the frontend:

1. Checks that the file is JPEG, PNG or WebP.
2. Checks that the file is not empty and does not exceed 10 MB.
3. Creates a local preview URL.
4. Uses Tesseract.js to extract preliminary text.
5. Checks the extracted text for medicine-related cues.
6. Compresses the image to a maximum dimension of approximately 1200 pixels.
7. Sends the compressed image and OCR text to the backend when the user starts inspection.

The preliminary OCR check is intended to reject images that do not appear to contain sufficient medicine-related text. It is not the final medicine identification or authenticity assessment.

## 7. Backend Inspection Workflow

The backend endpoint is implemented in `app/api/route.js`.

The main processing stages are:

### 7.1 Request handling

The API receives the Base64-encoded image and preliminary OCR text from the frontend.

### 7.2 Image validation

The backend uses `lib/image-validation.js` to validate the image data, supported image format and size before processing.

### 7.3 Main vision analysis

The image is sent to the configured Groq vision model. The model is prompted to identify medicine packaging and extract visible fields, which may include:

- Medicine name
- NAFDAC registration number
- Manufacturer
- Active ingredients
- Batch number
- Expiry date
- Visible package text
- Packaging observations
- Visual anomalies

The model's output is parsed and normalised by the backend.

### 7.4 Focused printed-text review

A further image-based review examines visible printed text for possible spelling or text discrepancies.

OCR differences may be used as review leads, but a concern should be based on inspection of the image itself. A machine-generated suggestion is not proof that the package contains an error.

Findings are presented for human confirmation.

### 7.5 Registry lookup

The backend uses `lib/greenbook.js` to search the Supabase medicine registry.

An exact NAFDAC registration number match is the primary identification method. If an exact registration number is unavailable, a name-based result should be treated as a candidate rather than a confirmed identity.

### 7.6 Comparison and response

The backend compares extracted information with available registry fields, creates evidence entries, calculates the TruthScore and returns the inspection result to the frontend.

## 8. NAFDAC Greenbook Integration

TruthPill stores or accesses medicine registration information through the Supabase table:

```text
greenbook_medicines
```

The application lookup uses fields including:

- `id`
- `product_name`
- `nafdac_number`
- `nafdac_number_normalized`
- `active_ingredients`
- `manufacturer`

The exact selected columns are defined in `lib/greenbook.js`.

### Matching principles

- An exact NAFDAC number match is the primary registry identity check.
- Medicine name, manufacturer and active ingredients are compared separately where the information is available.
- A name-only result is a candidate and must not be presented as an exact registry identity.
- A field that is not visible in the image must not be presented as though it was compared.
- A missing registry value is not automatically evidence of a counterfeit product.

### Batch and expiry information

Batch numbers and package expiry dates may be extracted from the image. They are observations unless independently checked against an appropriate source.

The package expiry date must not be confused with the registration expiry date stored in a regulatory dataset.

## 9. Evidence Model

The inspection report uses evidence entries to explain the basis of its findings.

An evidence entry may contain:

| Field | Description |
|---|---|
| `source` | Origin of the evidence, such as image, registry or system |
| `field` | Package or registry field being assessed |
| `status` | Assessment result |
| `confidence` | Model or system confidence where supplied |
| `message` | Human-readable explanation |

Statuses used by the inspection workflow include:

- `verified`
- `observed`
- `mismatch`
- `warning`
- `unknown`

These statuses have different meanings. For example, `observed` means information was seen on the package; it does not mean the information was independently verified.

## 10. TruthScore and Comparison Coverage

TruthScore represents agreement between the visible package information and available registry information for the fields assessed.

The score is based on the comparison weights implemented in the backend. The score breakdown is returned to the frontend so users can see how the result was calculated.

Comparison coverage indicates the proportion of applicable comparisons that could be assessed.

Important interpretation rules:

- TruthScore is not a probability of authenticity.
- It is not a laboratory result.
- It does not prove that an individual package is genuine.
- Fields that cannot be assessed should not be counted as confirmed matches.
- Batch and package expiry observations should not receive registry-verification credit without an appropriate source.

The authoritative scoring weights and calculation are defined in `app/api/route.js`. They should be updated in this document whenever the implementation changes.

## 11. API Specification

### `POST /api`

The frontend sends a JSON request.

Example:

```json
{
  "image": "BASE64_ENCODED_IMAGE",
  "ocrText": "PRELIMINARY_OCR_TEXT"
}
```

The `image` value contains the Base64 image data expected by the backend. The `ocrText` value contains text extracted by the frontend's preliminary OCR process.

A successful response may include:

- `success`
- `truthScore`
- `overallStatus`
- `comparisonCoverage`
- `scoreBreakdown`
- `evidenceList`
- `extracted`
- `medicine`
- `matchType`

The exact response schema is defined by the API implementation and should be kept in sync with the frontend.

## 12. Database and Configuration

### Supabase

Supabase PostgreSQL stores the medicine registry data used by the inspection workflow.

The table name is `greenbook_medicines`. Its actual schema should be maintained in line with the queries in `lib/greenbook.js`.

### Environment variables

The application requires configuration similar to:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_configured_vision_model
```

Additional Groq fallback-key variables may be required depending on the backend configuration.

Server-side secrets must remain on the server and must not be exposed through client-side code or committed to source control.

## 13. Security and Error Handling

The system should:

- Validate image data on the server.
- Restrict accepted image formats and file sizes.
- Keep Groq credentials and Supabase service-role credentials private.
- Apply suitable Supabase access controls and Row Level Security where applicable.
- Handle model failures, rate limits and malformed responses.
- Avoid treating an AI extraction result as verified registry data.
- Return useful error messages without exposing secrets.

A model rate-limit response, such as HTTP 429 from the Groq service, should be handled as an inference-service failure rather than as a successful inspection result.

## 14. Limitations

- OCR and vision models can misread or omit package information.
- Image quality and viewing angle affect extraction.
- A photograph of one side of a package cannot establish the condition of the entire package.
- Registry records may be incomplete or out of date.
- A registry match does not authenticate the physical medicine pack.
- Printed-text findings and visual anomalies require human review.
- Batch numbers and package expiry dates are not independently verified unless a suitable verification source is integrated.

TruthPill does not replace laboratory testing, professional pharmaceutical assessment or regulatory verification.

## 15. Deployment

The application is built with Next.js and can be deployed to a compatible hosting platform.

The deployment process includes:

1. Connecting the GitHub repository to the hosting provider.
2. Installing dependencies and building the Next.js application.
3. Configuring production environment variables.
4. Confirming Supabase connectivity.
5. Confirming Groq API access and model availability.
6. Testing image upload and the complete inspection workflow.

The live application is:

https://truthpill-capstone.vercel.app/

## 16. Future Technical Improvements

Potential improvements include:

- Automated tests for image validation, registry matching and scoring.
- More robust OCR and text-region comparison.
- Additional authoritative medicine data sources.
- Improved registry data update and provenance tracking.
- Better monitoring and handling of AI service rate limits.
- Audit trails for inspection results and evidence.
- More extensive validation with pharmacists and medicine-packaging experts.

These are potential improvements and should not be interpreted as features that are already implemented.
