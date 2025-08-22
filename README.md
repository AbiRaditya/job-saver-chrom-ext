# LinkedIn Job Scraper Chrome Extension

A Chrome extension built with React, TypeScript, and Vite that allows you to automatically scrape and save LinkedIn job listings to a CSV file.

## Features

- 🚀 **One-click job scraping** on LinkedIn job pages
- 💾 **Save jobs to CSV** with all relevant details
- 🔄 **Real-time job counter** showing how many jobs you've saved
- 🎯 **Smart duplicate detection** to avoid saving the same job twice
- 📱 **Easy-to-use popup interface** for managing saved jobs
- 🧹 **Clear saved jobs** functionality
- 📥 **Export to CSV** with proper formatting
- 🌓 **Dark/Light theme support**

## Installation

### Development Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd job-saver-chrom-ext
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build the extension:**
   ```bash
   pnpm build
   ```

4. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `dist` folder from your project directory

### Production Installation

1. Download the latest release from the releases page
2. Extract the ZIP file
3. Follow steps 4 from the development installation above

## How to Use

### 1. Navigate to LinkedIn Jobs
- Go to [LinkedIn Jobs](https://www.linkedin.com/jobs/)
- Search for jobs you're interested in

### 2. Start Scraping
- Click the extension icon in your Chrome toolbar
- Click "🚀 Start Job Scraping" in the popup
- You'll see a blue "💾 Save Jobs" button appear on the LinkedIn page

### 3. Collect Jobs
- Click the "💾 Save Jobs" button on LinkedIn to start collecting job listings
- The button will show how many jobs have been collected
- Browse through job listings and job detail pages - the extension will automatically collect job data
- Click "🛑 Stop" when you're done collecting

### 4. Export Your Data
- Return to the extension popup
- Click "📥 Export to CSV" to download your jobs as a CSV file
- The file will be named `linkedin-jobs-YYYY-MM-DD.csv`

### 5. Manage Your Data
- Use "🔄 Refresh Count" to update the job counter
- Use "🗑️ Clear All Jobs" to remove all saved jobs

## CSV Export Format

The exported CSV file includes the following columns:
- **Title**: Job title
- **Company**: Company name
- **Location**: Job location
- **Description**: Job description (when available)
- **Salary**: Salary information (when available)
- **Job Type**: Employment type (when available)
- **Experience**: Experience requirements (when available)
- **URL**: Direct link to the job posting
- **Posted Date**: When the job was posted (when available)
- **Scraped At**: When you saved the job

## Technical Details

### Architecture
- **Manifest V3** Chrome extension
- **React 19** for UI components
- **TypeScript** for type safety
- **Vite** for fast building
- **Tailwind CSS** for styling
- **Turbo** for monorepo management

### Components
- **Content Script**: Runs on LinkedIn pages to scrape job data
- **Background Script**: Handles data processing and CSV generation
- **Popup**: User interface for managing the extension
- **Storage**: Chrome storage API for persisting job data

### Permissions Required
- `storage`: To save job data locally
- `scripting`: To inject content scripts into LinkedIn pages
- `tabs`: To interact with browser tabs
- `notifications`: To show status notifications
- `downloads`: To download CSV files
- `host_permissions`: To access LinkedIn.com

## Development

### Building
```bash
pnpm build
```

### Development Mode
```bash
pnpm dev
```

### File Structure
```
├── chrome-extension/          # Extension configuration
│   ├── manifest.ts           # Extension manifest
│   └── src/background/       # Background script
├── pages/
│   ├── content/             # Content scripts
│   │   └── src/matches/linkedin/  # LinkedIn-specific content script
│   └── popup/               # Extension popup UI
└── packages/                # Shared packages and utilities
```

### Key Files
- `pages/content/src/linkedin-scraper.ts` - Main job scraping logic
- `chrome-extension/src/background/index.ts` - Background script for data processing
- `pages/popup/src/Popup.tsx` - Extension popup interface
- `chrome-extension/manifest.ts` - Extension configuration

## Troubleshooting

### Extension Not Working
1. Make sure you're on a LinkedIn jobs page (`linkedin.com/jobs/`)
2. Check that the extension is enabled in `chrome://extensions/`
3. Try refreshing the LinkedIn page and reloading the extension

### No Jobs Being Saved
1. Ensure you clicked "Start Job Scraping" in the popup first
2. Look for the blue "💾 Save Jobs" button on the LinkedIn page
3. Make sure you're on job search results or job detail pages

### CSV Export Issues
1. Check that you have jobs saved (counter > 0)
2. Ensure Chrome has permission to download files
3. Check your Downloads folder for the CSV file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Disclaimer

This extension is for educational and personal use only. Please respect LinkedIn's Terms of Service and use responsibly. The extension only collects publicly available job information that you can already see on LinkedIn.
