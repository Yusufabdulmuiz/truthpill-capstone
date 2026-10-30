# TruthPill

TruthPill is a medicine-package inspection platform that compares visible medicine details against registration information in the **NAFDAC Greenbook**.

It uses image analysis and registry data to highlight information that matches, differs or requires further review.

> **Important:** TruthPill provides supporting information. It does not independently authenticate a medicine or guarantee that a medicine is genuine, safe or effective.

## Features

- Upload a medicine-package image using a camera or image gallery.
- Check images and extract preliminary text using OCR.
- Extract visible medicine details using an AI vision model.
- Compare NAFDAC registration numbers against Greenbook records.
- Compare medicine names, manufacturers and active ingredients when available.
- Highlight possible printed-text concerns for human review.
- Identify possible packaging anomalies.
- Generate a TruthScore, comparison coverage and evidence report.
- Validate image formats and file sizes before inspection.

## Technology Stack

- **Next.js** – application framework and API routes
- **React** – user interface
- **Tailwind CSS** – styling
- **Supabase / PostgreSQL** – medicine registry data
- **Groq API** – AI inference
- **Qwen vision model** – image analysis
- **Tesseract.js** – preliminary OCR
- **Lucide React** – interface icons

## How It Works

1. The user uploads or captures an image of a medicine package.
2. The frontend checks the file type and size.
3. Tesseract.js performs a preliminary OCR check for medicine-related text.
4. The image is compressed and sent to the inspection API with the OCR text.
5. The backend validates the image and sends it to the vision model.
6. The model extracts visible package information and visual observations.
7. The backend searches the `greenbook_medicines` table, primarily using the extracted NAFDAC number.
8. Available package details are compared with the registry record.
9. A focused image review checks possible printed-text concerns.
10. TruthPill returns the inspection results, evidence and TruthScore for display.

## Project Structure

```text
truthpill/
├── app/
│   ├── api/
│   │   └── route.js
│   ├── components/
│   │   └── inspection/
│   │       ├── UploadSection.js
│   │       ├── ScanGuidelines.js
│   │       ├── InspectionReport.js
│   │       ├── ScoreSummary.js
│   │       ├── EvidenceLog.js
│   │       ├── RegistryComparison.js
│   │       ├── FindingsToReview.js
│   │       └── PackagingAnomalies.js
│   ├── page.js
│   ├── layout.js
│   └── globals.css
├── lib/
│   ├── greenbook.js
│   ├── image-validation.js
│   ├── spelling-checks.js
│   └── supabase.js
├── public/
├── docs/
│   └── TECHNICAL_DESIGN_DOCUMENT.md
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- Node.js
- npm
- A Supabase project containing the medicine registry data
- A Groq API key and access to the configured vision model

## Installation

```bash
git clone https://github.com/Yusufabdulmuiz/truthpill-capstone.git
cd truthpill-capstone
npm install
```

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_configured_vision_model
```

If the backend uses additional Groq keys for fallback requests, add the corresponding variables using the names expected by `app/api/route.js`.

Never commit `.env.local` or expose server-side secrets in client-side code.

## Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Build and run the production version:

```bash
npm run build
npm run start
```

## Database

TruthPill uses Supabase PostgreSQL. The medicine registry table is named:

```text
greenbook_medicines
```

The registry integration currently uses fields including:

- `id`
- `product_name`
- `nafdac_number`
- `nafdac_number_normalized`
- `active_ingredients`
- `manufacturer`

The wider dataset may also contain fields such as strength, dosage form, route, composition and registration dates. The fields actually queried by the application are determined by `lib/greenbook.js` and the current database schema.

An exact NAFDAC registration number match is the primary product identification method. Other fields are assessed separately.

Batch numbers and package expiry dates may be extracted when visible, but are not independently verified against Greenbook unless a separate verification source is available. Package expiry date and registration expiry date are different data points.

## API

### `POST /api`

The frontend sends a JSON request containing the image as Base64 data and the preliminary OCR text:

```json
{
  "image": "BASE64_ENCODED_IMAGE",
  "ocrText": "TEXT_EXTRACTED_FROM_THE_IMAGE"
}
```

A successful response includes inspection information such as:

- `success`
- `truthScore`
- `overallStatus`
- `comparisonCoverage`
- `scoreBreakdown`
- `evidenceList`
- `extracted`
- `medicine`
- `matchType`

The exact response structure is defined by `app/api/route.js`.

## TruthScore

TruthScore represents agreement between visible package details and available registry information for the comparisons that could be assessed.

It is not:

- A probability that a medicine is genuine.
- A laboratory authenticity result.
- Proof that a medicine is safe or effective.
- Independent verification of batch numbers or package expiry dates.

Comparison coverage indicates how much of the applicable registry comparison could be assessed. Information that is not visible or cannot be assessed should not be treated as a confirmed match.

## Security

- Keep API keys and server-side credentials private.
- Validate uploaded images on the server.
- Keep the Supabase service role key out of client-side code.
- Configure appropriate Supabase access controls and Row Level Security where applicable.
- Do not log credentials or unnecessary sensitive information.

## Limitations

- OCR and vision models may produce incorrect or incomplete results.
- Blurry, damaged, obstructed or partially visible packaging can limit inspection.
- A registry match does not prove that an individual package is genuine.
- A medicine-name match alone does not establish an exact registry identity.
- Printed-text concerns and packaging anomalies require human confirmation.
- Registry coverage and freshness depend on the available source data.
- Batch numbers and package expiry dates require separate verification when the registry does not contain them.

If a medicine is suspected to be falsified, consult a licensed pharmacist or the appropriate regulatory authority.

## Project Links

- **Live application:** https://truthpill-capstone.vercel.app/
- **GitHub repository:** https://github.com/Yusufabdulmuiz/truthpill-capstone
- **Technical Design Document:** [docs/TECHNICAL_DESIGN_DOCUMENT.md](docs/TECHNICAL_DESIGN_DOCUMENT.md)

## Disclaimer

TruthPill is an informational medicine-package inspection tool. Its scores, registry comparisons and visual findings provide supporting information for further investigation. They do not guarantee the authenticity, safety, quality or effectiveness of any medicine and do not replace laboratory testing, professional pharmaceutical assessment or regulatory verification.
