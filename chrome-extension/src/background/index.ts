import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

interface JobData {
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  jobType?: string;
  experience?: string;
  workplaceType?: string;
  applicantCount?: string;
  companySize?: string;
  linkedinEmployees?: string;
  industry?: string;
  followers?: string;
  hiringInsights?: string;
  benefits?: string;
  skills?: string;
  companyDescription?: string;
  companyCommitments?: string;
  url: string;
  postedDate?: string;
  postedDateISO?: string;
  scrapedAt: string;
}

// Storage for scraped jobs
let scrapedJobs: JobData[] = [];

// Load existing jobs from storage on startup
chrome.storage.local
  .get(['linkedinJobs'])
  .then(result => {
    if (result.linkedinJobs && Array.isArray(result.linkedinJobs)) {
      scrapedJobs = result.linkedinJobs;
      console.log('[LinkedIn Job Saver] Loaded', scrapedJobs.length, 'jobs from storage');
    } else {
      console.log('[LinkedIn Job Saver] No existing jobs found in storage');
    }
  })
  .catch(error => {
    console.error('[LinkedIn Job Saver] Error loading jobs from storage:', error);
    scrapedJobs = []; // Ensure we have a valid array
  });

const handleSaveJobs = async (newJobs: JobData[]) => {
  // Validate input
  if (!Array.isArray(newJobs)) {
    console.error('[LinkedIn Job Saver] Invalid input: newJobs is not an array');
    return;
  }

  // Merge new jobs with existing ones, avoiding duplicates
  const jobsToAdd = newJobs.filter(
    newJob =>
      !scrapedJobs.some(
        existingJob =>
          existingJob.title === newJob.title &&
          existingJob.company === newJob.company &&
          existingJob.url === newJob.url,
      ),
  );

  scrapedJobs.push(...jobsToAdd);

  // Save to chrome storage
  await chrome.storage.local.set({ linkedinJobs: scrapedJobs });

  console.log('[LinkedIn Job Saver] Saved', jobsToAdd.length, 'new jobs. Total:', scrapedJobs.length);

  // Show notification with unique ID
  const notificationId = `save-jobs-${Date.now()}`;
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon-34.png'),
    title: 'LinkedIn Job Saver',
    message: `Saved ${jobsToAdd.length} new jobs! Total: ${scrapedJobs.length}`,
  });
};

const handleExportCSV = async () => {
  if (!Array.isArray(scrapedJobs) || scrapedJobs.length === 0) {
    console.log('[LinkedIn Job Saver] No jobs to export');
    const notificationId = `no-jobs-${Date.now()}`;
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon-34.png'),
      title: 'LinkedIn Job Saver',
      message: 'No jobs to export. Please scrape some jobs first.',
    });
    return;
  }

  const csvContent = convertJobsToCSV(scrapedJobs);

  // Convert string to base64 data URL instead of using URL.createObjectURL
  const base64Data = btoa(unescape(encodeURIComponent(csvContent)));
  const dataUrl = `data:text/csv;charset=utf-8;base64,${base64Data}`;

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `linkedin-jobs-${timestamp}.csv`;

  try {
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true,
    });

    console.log('[LinkedIn Job Saver] CSV export initiated:', filename);
  } catch (error) {
    console.error('[LinkedIn Job Saver] Error exporting CSV:', error);

    // Fallback: show notification with error
    const errorNotificationId = `export-error-${Date.now()}`;
    chrome.notifications.create(errorNotificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon-34.png'),
      title: 'LinkedIn Job Saver - Export Error',
      message: 'Failed to export CSV. Please try again.',
    });
  }
};

const handleClearJobs = async () => {
  scrapedJobs = [];
  await chrome.storage.local.remove(['linkedinJobs']);
  console.log('[LinkedIn Job Saver] All jobs cleared');
};

const convertJobsToCSV = (jobs: JobData[]): string => {
  if (jobs.length === 0) return 'No jobs to export';

  const headers = [
    'Title',
    'Company',
    'Location',
    'Description',
    'Salary',
    'Job Type',
    'Workplace Type',
    'Experience',
    'Applicant Count',
    'Company Size',
    'LinkedIn Employees',
    'Industry',
    'Followers',
    'Hiring Insights',
    'Skills',
    'Company Description',
    'Company Commitments',
    'URL',
    'Posted Date',
    'Posted Date ISO',
    'Scraped At',
  ];

  const csvRows = [
    headers.join(','),
    ...jobs.map(job =>
      [
        escapeCsvField(job.title),
        escapeCsvField(job.company),
        escapeCsvField(job.location),
        escapeCsvField(job.description),
        escapeCsvField(job.salary || ''),
        escapeCsvField(job.jobType || ''),
        escapeCsvField(job.workplaceType || ''),
        escapeCsvField(job.experience || ''),
        escapeCsvField(job.applicantCount || ''),
        escapeCsvField(job.companySize || ''),
        escapeCsvField(job.linkedinEmployees || ''),
        escapeCsvField(job.industry || ''),
        escapeCsvField(job.followers || ''),
        escapeCsvField(job.hiringInsights || ''),
        escapeCsvField(job.skills || ''),
        escapeCsvField(job.companyDescription || ''),
        escapeCsvField(job.companyCommitments || ''),
        escapeCsvField(job.url),
        escapeCsvField(job.postedDate || ''),
        escapeCsvField(job.postedDateISO || ''),
        escapeCsvField(job.scrapedAt),
      ].join(','),
    ),
  ];

  return csvRows.join('\n');
};

const escapeCsvField = (field: string): string => {
  if (!field || typeof field !== 'string') {
    return '';
  }

  // Remove extra whitespace and clean the field
  const cleanField = field.trim().replace(/\s+/g, ' ');

  // Escape double quotes and wrap in quotes if necessary
  if (cleanField.includes(',') || cleanField.includes('"') || cleanField.includes('\n') || cleanField.includes('\r')) {
    return `"${cleanField.replace(/"/g, '""')}"`;
  }
  return cleanField;
};

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LinkedIn Job Saver] Background received message:', message);

  switch (message.action) {
    case 'SAVE_JOBS':
      handleSaveJobs(message.jobs)
        .then(() => {
          sendResponse({ success: true, jobCount: scrapedJobs.length });
        })
        .catch(error => {
          console.error('[LinkedIn Job Saver] Error saving jobs:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response

    case 'GET_ALL_JOBS':
      console.log('[LinkedIn Job Saver] Sending all jobs to popup', scrapedJobs);
      sendResponse({ jobs: scrapedJobs });
      return false; // Synchronous response

    case 'EXPORT_CSV':
      handleExportCSV()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('[LinkedIn Job Saver] Error exporting CSV:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response

    case 'CLEAR_JOBS':
      handleClearJobs()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('[LinkedIn Job Saver] Error clearing jobs:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response

    default:
      sendResponse({ error: 'Unknown action' });
      return false;
  }
});

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log('[LinkedIn Job Saver] Background script initialized');
