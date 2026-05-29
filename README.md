# BrightArk Dental Lab Order Form

Production-grade, mobile-friendly React order form for BrightArk's dental lab.

## Stack

- React 18+ / TypeScript
- Vite
- Tailwind CSS (BrightArk brand tokens)
- React Hook Form + Zod
- react-dropzone, react-datepicker, lucide-react

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Features

- Multi-section lab order form with progress indicator
- Interactive Universal Numbering tooth selector (single / bridge)
- File upload slots with drag-and-drop auto-assignment
- Form validation, local draft save, and mock submission (`console.log` payload)

## Backend integration

See `src/App.tsx` — replace the commented `fetch` call with your BrightArk API endpoint.
