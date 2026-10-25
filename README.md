# TruthPill

TruthPill is a medicine-package inspection platform that helps users compare visible medicine details against registration information in the NAFDAC Greenbook.

The goal is to make medicine information easier to inspect and help users identify inconsistencies that may require further investigation.

**Note:** TruthPill provides supporting evidence. It does not guarantee that a medicine is genuine.

## Features

- Upload medicine-package images for inspection.
- Extract visible medicine details using a vision model.
- Compare NAFDAC registration numbers against Greenbook records.
- Compare medicine names and manufacturer details.
- Display registration information where available.
- Identify possible packaging anomalies.
- Generate a TruthScore and an evidence report.
- Validate image files before sending them for inspection.

## Technology Stack

- Next.js
- React
- Tailwind CSS
- Supabase and PostgreSQL
- Groq API
- Qwen vision model

## How It Works

1. A user uploads a medicine-package image.
2. The application validates the image format and size.
3. The backend sends the image to the Groq vision API.
4. The model extracts visible information and classifies the image.
5. The backend searches the `greenbook_medicines` table using the extracted NAFDAC number.
6. Available medicine details are compared with the registry record.
7. TruthPill generates a score and supporting evidence.
8. The frontend displays the inspection report.

## Project Structure

```text
truthpill/
├── app/
│   ├── api/
│   │   └── route.js
│   ├── page.js
│   ├── layout.js
│   └── globals.css
├── lib/
│   └── supabase.js
├── public/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- Node.js
- npm
- A Supabase project
- A Groq API key

## Installation

Clone the repository:

```bash
git clone https://github.com/Yusufabdulmuiz/truthpill-capstone
cd truthpill
npm install
```

Create a `.env.local` file in the project root.

Configure the following environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_server_side_secret
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_configured_vision_model
```

If the application uses additional Groq API keys, configure them as required by the backend.

Never commit `.env.local` or expose server-side secrets in client-side code.

## Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To build the application for production:

```bash
npm run build
npm run start
```

## Database

TruthPill uses Supabase PostgreSQL.

The medicine registry table is:

`greenbook_medicines`

The table includes fields such as:

- `id`
- `product_name`
- `nafdac_number`
- `nafdac_number_normalized`
- `active_ingredients`
- `strengths`
- `dosage_form`
- `routes`
- `manufacturer`
- `registration_status`
- `registration_date`
- `registration_expiry_date`
- `composition`

The inspection API uses the normalized NAFDAC number to search for a matching record.

Batch numbers and medicine-package expiry dates are extracted from the image when visible. They are not verified against Greenbook unless an appropriate source is available.

Registration expiry and package expiry are different fields.

## API Endpoint

### `POST /api`

The inspection endpoint accepts a Base64-encoded image.

Example request:

```json
{
  "image": "BASE64_ENCODED_IMAGE"
}
```

A successful response includes:

- `truthScore`
- `overallStatus`
- `inspectionConfidence`
- `scoreBreakdown`
- `evidenceList`
- `extracted`
- `medicine`

The endpoint returns an error response when validation, image extraction, or registry lookup fails.

## Security

- Keep API keys and server-side secrets private.
- Validate uploaded files on the server.
- Configure appropriate Supabase permissions.
- Apply Row Level Security where applicable.
- Avoid logging API keys or sensitive information.

## Limitations

- Vision models may extract incorrect or incomplete information.
- A registry match does not prove that a physical medicine package is genuine.
- Packaging anomalies are observations, not definitive proof of falsification.
- Registry coverage and freshness depend on the available source data.
- Batch numbers and package expiry dates require separate verification when the registry does not contain them.

Consult a licensed pharmacist or the appropriate regulatory authority if a medicine is suspected to be falsified.

## Deployment

Deploy the application to a compatible Next.js hosting platform.

Configure the required environment variables in the hosting dashboard and test the inspection flow after deployment.

## Project Links

- Live application: https://truthpill-capstone.vercel.app/
- GitHub repository: https://github.com/Yusufabdulmuiz/truthpill-capstone

## Disclaimer

TruthPill is an informational inspection tool. Its scores and findings do not guarantee the authenticity, safety, or quality of a medicine.