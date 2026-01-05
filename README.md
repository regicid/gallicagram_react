# Gallicagram React

Gallicagram is a web application for visualizing linguistic trends in various historical corpora, including Gallica (BnF), Le Monde, and others. It allows users to plot word occurrences over time, view associated articles, and analyze co-occurrences.

## Architecture Overview

This project is a Single Page Application (SPA) built with **React**. It uses a functional component architecture with Hooks for state management.

### Tech Stack

- **Framework**: React (Create React App)
- **UI Component Library**: Material UI (@mui/material)
- **Visualization**: 
  - [Plotly.js](https://plotly.com/javascript/) (via `react-plotly.js`) for time series and bar charts.
  - [D3.js](https://d3js.org/) (d3-cloud) for word clouds.
- **Internationalization**: `react-i18next` for English/French support.
- **Data Fetching**: Native `fetch` with `PapaParse` for CSV handling.

## Key Components

The application is structured around a main controller component (`App.js`) that manages the global state and coordinates child components.

- **`src/App.js`**: The core component. It handles:
  - Global state (queries, plot data, UI settings).
  - API orchestration (fetching data from different endpoints based on the selected corpus).
  - Data processing (formatting raw API responses for Plotly).
  - Routing logic for different search modes (document, cooccurrence, article, etc.).

- **`src/FormComponent.js`**: The query interface.
  - dynamic form generation based on selected corpus.
  - Loads corpus configuration from `public/corpus.tsv`.
  - Handles basic validation and user inputs (CLI-style or guided).

- **`src/TabsComponent.js`**: Manages multiple active queries/tabs, allowing users to compare different searches.

- **`src/SumsComponent.js`**: Displays a bar chart ranking the total occurrences of queried terms.

- **`src/ContextDisplay.js`**: A complex component that fetches and renders contextual information (snippets, article previews, or full text) when a user clicks on a data point.

## Data & Configuration

### Corpus Configuration
The application is data-driven. The available corpora and their properties are defined in **`public/corpus.tsv`**. 
This file acts as a central registry, defining:
- **Available Modes**: Which search modes (ngram, document, joker, nearby) are valid for each corpus.
- **API Codes**: Identifiers used to construct API requests.
- **Metadata**: Date ranges, volume, and specific context filters.

### API Integration
The app interacts with multiple backends:
1. **Gallica SRU API**: For collecting metadata and occurrence counts from BnF.
2. **ENS Paris-Saclay API**: Custom endpoints (`/guni/`) for specific corpora like *Le Monde*.
3. **Proxy**: A configured proxy (`src/setupProxy.js`) handles CORS and routing to external APIs.

## Installation & Development

This project uses standard Node.js tooling.

### Prerequisites
- Node.js (v14+ recommended)
- npm

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```
   Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

3. **Build for production:**
   ```bash
   npm run build
   ```
   Builds the app to the `build` folder.

## Translation

Translations are stored in `public/locales/{en|fr}/translation.json`. The app detects the user's location (via IP) to set the default language to French or English.
