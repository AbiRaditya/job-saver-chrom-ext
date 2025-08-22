import '@src/Popup.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect } from 'react';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'LinkedIn Job Saver',
  message: 'LinkedIn Job Saver is active!',
} as const;

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [jobCount, setJobCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load job count on popup open
  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'GET_ALL_JOBS' }, response => {
      console.log(response, 'response in popup');

      if (response?.jobs) {
        setJobCount(response.jobs.length);
      }
    });
  }, []);

  const startJobScraping = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (!tab.url?.includes('linkedin.com/jobs')) {
      chrome.notifications.create('not-linkedin-jobs', {
        ...notificationOptions,
        title: 'Not LinkedIn Jobs',
        message: 'Please navigate to LinkedIn.com/jobs to scrape jobs!',
      });
      return;
    }

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('invalid-page', {
        ...notificationOptions,
        title: 'Invalid Page',
        message: 'Cannot run scraper on this page!',
      });
      return;
    }

    setIsLoading(true);

    try {
      // The content script is already injected via manifest, just send start message
      chrome.tabs.sendMessage(tab.id!, { action: 'START_SCRAPING' }, response => {
        if (chrome.runtime.lastError) {
          // Content script not loaded, try injecting manually
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id! },
              files: ['/content/linkedin.iife.js'],
            })
            .then(() => {
              // Retry sending message after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id!, { action: 'START_SCRAPING' }, response => {
                  if (response?.success) {
                    chrome.notifications.create('scraping-started', {
                      ...notificationOptions,
                      title: 'Job Scraping Started',
                      message: 'Click the "💾 Save Jobs" button on LinkedIn to start collecting jobs!',
                    });
                  }
                  setIsLoading(false);
                });
              }, 500);
            })
            .catch(err => {
              console.error('Error injecting script:', err);
              chrome.notifications.create('inject-error', {
                ...notificationOptions,
                title: 'Injection Error',
                message: 'Failed to load content script. Please refresh the page and try again.',
              });
              setIsLoading(false);
            });
        } else if (response?.success) {
          chrome.notifications.create('scraping-started', {
            ...notificationOptions,
            title: 'Job Scraping Started',
            message: 'Click the "💾 Save Jobs" button on LinkedIn to start collecting jobs!',
          });
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.error('Error starting scraper:', err);
      setIsLoading(false);
    }
  };

  const exportJobs = () => {
    chrome.runtime.sendMessage({ action: 'EXPORT_CSV' }, response => {
      if (response?.success) {
        chrome.notifications.create(`export-success-${Date.now()}`, {
          ...notificationOptions,
          title: 'Export Started',
          message: 'Your jobs are being exported to CSV!',
        });
      } else {
        chrome.notifications.create(`export-error-${Date.now()}`, {
          ...notificationOptions,
          title: 'Export Failed',
          message: 'Failed to export CSV. Please try again.',
        });
      }
    });
  };

  const clearJobs = () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_JOBS' }, response => {
      if (response?.success) {
        setJobCount(0);
        chrome.notifications.create(`jobs-cleared-${Date.now()}`, {
          ...notificationOptions,
          title: 'Jobs Cleared',
          message: 'All saved jobs have been cleared!',
        });
      } else {
        chrome.notifications.create(`clear-error-${Date.now()}`, {
          ...notificationOptions,
          title: 'Clear Failed',
          message: 'Failed to clear jobs. Please try again.',
        });
      }
    });
  };

  const refreshJobCount = () => {
    chrome.runtime.sendMessage({ action: 'GET_ALL_JOBS' }, response => {
      if (response?.jobs) {
        setJobCount(response.jobs.length);
      }
    });
  };

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
        {/* <button onClick={goGithubSite}>
          <img src={chrome.runtime.getURL(logo)} className="App-logo" alt="logo" />
        </button> */}

        <div className="mb-4 text-center">
          <h2 className="mb-2 text-lg font-bold">LinkedIn Job Saver</h2>
          <p className="mb-4 text-sm">Saved Jobs: {jobCount}</p>
        </div>

        <div className="flex w-full max-w-xs flex-col space-y-2">
          <button
            className={cn(
              'rounded px-4 py-2 font-bold shadow hover:scale-105 disabled:opacity-50',
              isLight ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700',
            )}
            onClick={startJobScraping}
            disabled={isLoading}>
            {isLoading ? 'Injecting...' : '🚀 Start Job Scraping'}
          </button>

          <button
            className={cn(
              'rounded px-4 py-2 font-bold shadow hover:scale-105',
              isLight ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700',
            )}
            onClick={exportJobs}
            disabled={jobCount === 0}>
            📥 Export to CSV
          </button>

          <button
            className={cn(
              'rounded px-4 py-2 font-bold shadow hover:scale-105',
              isLight ? 'bg-gray-500 text-white hover:bg-gray-600' : 'bg-gray-600 text-white hover:bg-gray-700',
            )}
            onClick={refreshJobCount}>
            🔄 Refresh Count
          </button>

          <button
            className={cn(
              'rounded px-4 py-2 font-bold shadow hover:scale-105',
              isLight ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-600 text-white hover:bg-red-700',
            )}
            onClick={clearJobs}
            disabled={jobCount === 0}>
            🗑️ Clear All Jobs
          </button>
        </div>

        {/* <div className="mt-4">
          <ToggleButton>{t('toggleTheme')}</ToggleButton>
        </div> */}

        {/* <p className="mt-4 text-center text-xs opacity-75">
          Navigate to LinkedIn job search and click "Start Job Scraping"
        </p> */}
      </header>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
