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

class LinkedInJobScraper {
  private jobs: JobData[] = [];
  private isScrapingActive = false;
  private scrapingButton: HTMLButtonElement | null = null;
  private observer: MutationObserver | null = null;

  // LinkedIn constants
  private static readonly JOBS_PER_PAGE = 25; // LinkedIn's fixed constant - cannot be changed
  private static readonly MAX_LOW_YIELD_PAGES = 3; // Stop if we hit consecutive pages with very few new jobs

  init() {
    console.log('[LinkedIn Job Saver] Initializing scraper');
    this.setupMessageListener();
    this.addScrapingButton();
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (message.action === 'START_SCRAPING') {
          this.startScraping();
          sendResponse({ success: true });
        } else if (message.action === 'STOP_SCRAPING') {
          this.stopScraping();
          sendResponse({ success: true });
        } else if (message.action === 'GET_SCRAPED_JOBS') {
          sendResponse({ jobs: this.jobs });
        } else {
          sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('[LinkedIn Job Saver] Error in message handler:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
      return true; // Keep message channel open for async response
    });
  }

  private addScrapingButton() {
    // Add a floating button to the page for easy access
    const button = document.createElement('button');
    button.innerHTML = '💾 Save Jobs';
    button.id = 'linkedin-job-scraper-button'; // Add unique ID
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      background: #0073b1;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    button.addEventListener('click', () => {
      if (this.isScrapingActive) {
        this.stopScraping();
      } else {
        this.startScraping();
      }
    });

    // // Add a test scroll button
    // const testScrollButton = document.createElement('button');
    // testScrollButton.innerHTML = '🔄 Test Scroll';
    // testScrollButton.id = 'linkedin-test-scroll-button';
    // testScrollButton.style.cssText = `
    //   position: fixed;
    //   top: 70px;
    //   right: 20px;
    //   z-index: 9999;
    //   background: #ff6600;
    //   color: white;
    //   border: none;
    //   padding: 10px 15px;
    //   border-radius: 5px;
    //   cursor: pointer;
    //   font-size: 14px;
    //   box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    // `;

    // testScrollButton.addEventListener('click', () => {
    //   this.testScrollFunction();
    // });

    // Remove existing buttons if any
    const existingButton = document.getElementById('linkedin-job-scraper-button');
    if (existingButton) {
      existingButton.remove();
    }
    const existingTestButton = document.getElementById('linkedin-test-scroll-button');
    if (existingTestButton) {
      existingTestButton.remove();
    }

    document.body.appendChild(button);
    // document.body.appendChild(testScrollButton);
    this.scrapingButton = button;
  }

  private async startScraping() {
    console.log('[LinkedIn Job Saver] Starting detailed job scraping');
    this.isScrapingActive = true;
    this.updateButtonText();

    // Clear any existing jobs from this session
    this.jobs = [];

    try {
      // Check if we're on a job search results page
      if (this.isJobSearchPage()) {
        await this.scrapeAllPages();
      } else if (this.isJobDetailPage()) {
        await this.scrapeJobDetail();
      } else {
        console.log('[LinkedIn Job Saver] Not on a recognized LinkedIn jobs page');
        this.showNotification('Please navigate to LinkedIn job search results page');
        return;
      }

      // Set up observer for dynamic loading
      this.observePageChanges();
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error during scraping:', error);
      this.showNotification('Error occurred during scraping. Check console for details.');
    }

    console.log(`[LinkedIn Job Saver] Scraping session completed. Found ${this.jobs.length} jobs.`);
  }

  private stopScraping() {
    console.log('[LinkedIn Job Saver] Stopping job scraping');
    this.isScrapingActive = false;
    this.updateButtonText();

    // Disconnect observer to prevent memory leaks
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Send jobs to background script for processing
    if (this.jobs.length > 0) {
      this.showNotification(`Saving ${this.jobs.length} jobs to storage...`);
      chrome.runtime.sendMessage(
        {
          action: 'SAVE_JOBS',
          jobs: this.jobs,
        },
        response => {
          if (response?.success) {
            console.log('[LinkedIn Job Saver] Jobs saved successfully. Clearing local array.');
            this.showNotification(
              `✅ Successfully saved ${this.jobs.length} jobs! Total: ${response.jobCount} jobs in storage.`,
            );
            // Clear local jobs array after successful save
            this.jobs = [];
            this.updateButtonText();
          } else {
            console.error('[LinkedIn Job Saver] Failed to save jobs:', response?.error);
            this.showNotification('❌ Failed to save jobs. Please try again.');
          }
        },
      );
    } else {
      this.showNotification('No new jobs found to save.');
    }
  }

  private updateButtonText() {
    if (this.scrapingButton) {
      if (this.isScrapingActive) {
        this.scrapingButton.innerHTML = `🛑 Stop Detailed Scraping (${this.jobs.length} jobs found)`;
        this.scrapingButton.style.background = '#d73502';
      } else {
        this.scrapingButton.innerHTML = '💾 Start Detailed Job Scraping';
        this.scrapingButton.style.background = '#0073b1';
      }
    }
  }

  private isJobSearchPage(): boolean {
    return (
      window.location.pathname.includes('/jobs/search') ||
      document.querySelector('.jobs-search-results') !== null ||
      document.querySelector('ul[class*="nCeEmjyITZIWOfWganYaBNgtRamiLriko"]') !== null
    );
  }

  private isJobDetailPage(): boolean {
    return window.location.pathname.includes('/jobs/view/') || document.querySelector('.job-details') !== null;
  }

  private scrapeJobListings() {
    // Updated selectors for the new LinkedIn interface
    const jobCards = document.querySelectorAll(
      'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
    );

    console.log(`[LinkedIn Job Saver] Found ${jobCards.length} job cards`);
    console.log(jobCards, 'jobCards');

    jobCards.forEach(card => {
      const jobData = this.extractJobDataFromCard(card as HTMLElement);
      console.log(jobData, 'jobData');

      if (jobData && !this.isDuplicateJob(jobData)) {
        this.jobs.push(jobData);
        console.log('[LinkedIn Job Saver] Scraped job:', jobData.title);
      }
    });

    this.updateButtonText();
  }

  private async scrapeJobListingsDetailed() {
    console.log('[LinkedIn Job Saver] Starting detailed job scraping...');

    // First, trigger lazy loading by scrolling to load all jobs
    await this.triggerLazyLoadingOfAllJobs();

    const jobCards = document.querySelectorAll(
      'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
    );

    console.log(`[LinkedIn Job Saver] Found ${jobCards.length} job cards for detailed scraping`);

    if (jobCards.length === 0) {
      this.showNotification('No job cards found. Please ensure you are on a LinkedIn job search page.');
      return;
    }

    let newJobsFound = 0;
    let duplicatesSkipped = 0;

    // Process jobs sequentially to avoid overwhelming LinkedIn's servers
    for (let i = 0; i < jobCards.length; i++) {
      if (!this.isScrapingActive) {
        console.log('[LinkedIn Job Saver] Scraping stopped by user');
        break;
      }

      const jobCard = jobCards[i] as HTMLElement;
      const wasNewJob = await this.processJobCardDetailed(jobCard, i + 1, jobCards.length);

      if (wasNewJob === true) {
        newJobsFound++;
      } else if (wasNewJob === false) {
        duplicatesSkipped++;
      }

      // Add delay between processing jobs to be respectful to LinkedIn's servers
      await this.delay(2000);
    }

    console.log(
      `[LinkedIn Job Saver] Detailed scraping completed. Total jobs: ${this.jobs.length}, New this page: ${newJobsFound}, Duplicates: ${duplicatesSkipped}`,
    );

    // If we found very few new jobs (less than 20% of the page), this might indicate we're seeing repeats
    if (jobCards.length > 0 && newJobsFound < jobCards.length * 0.2) {
      console.log(
        `[LinkedIn Job Saver] Warning: Only ${newJobsFound} new jobs found out of ${jobCards.length} on this page. Possible duplicate page or end of unique results.`,
      );
    }

    this.updateButtonText();
  }

  private async scrapeAllPages() {
    console.log('[LinkedIn Job Saver] Starting multi-page scraping...');

    // Get total page count and result count
    const paginationInfo = this.getPaginationInfo();
    console.log('[LinkedIn Job Saver] Pagination info:', paginationInfo);

    this.showNotification(
      `Found ${paginationInfo.totalResults} results across ${paginationInfo.totalPages} pages (${paginationInfo.calculatedPages} calculated from ${LinkedInJobScraper.JOBS_PER_PAGE} jobs/page). Starting scraping...`,
    );

    let currentPage = paginationInfo.currentPage;
    let consecutiveLowYieldPages = 0; // Track pages with very few new jobs

    // Scrape all pages
    while (currentPage <= paginationInfo.totalPages && this.isScrapingActive) {
      console.log(`[LinkedIn Job Saver] Scraping page ${currentPage} of ${paginationInfo.totalPages}`);

      // Update button to show page progress
      if (this.scrapingButton) {
        this.scrapingButton.innerHTML = `🔄 Page ${currentPage}/${paginationInfo.totalPages} (${this.jobs.length} jobs)`;
        this.scrapingButton.style.background = '#0066cc';
      }

      const jobsBeforePage = this.jobs.length;

      // Scrape current page
      await this.scrapeJobListingsDetailed();

      const newJobsThisPage = this.jobs.length - jobsBeforePage;
      const expectedJobsThisPage = Math.min(
        LinkedInJobScraper.JOBS_PER_PAGE,
        paginationInfo.totalResults - (currentPage - 1) * LinkedInJobScraper.JOBS_PER_PAGE,
      );

      console.log(
        `[LinkedIn Job Saver] Page ${currentPage}: Found ${newJobsThisPage} new jobs (expected up to ${expectedJobsThisPage} based on ${LinkedInJobScraper.JOBS_PER_PAGE}/page)`,
      );

      // Check if this page yielded very few new jobs
      if (newJobsThisPage < 5) {
        // Less than 5 new jobs indicates mostly duplicates
        consecutiveLowYieldPages++;
        console.log(
          `[LinkedIn Job Saver] Low yield page detected. Only ${newJobsThisPage} new jobs found. Consecutive low yield pages: ${consecutiveLowYieldPages}`,
        );

        if (consecutiveLowYieldPages >= LinkedInJobScraper.MAX_LOW_YIELD_PAGES) {
          console.log(
            `[LinkedIn Job Saver] Stopping pagination due to ${LinkedInJobScraper.MAX_LOW_YIELD_PAGES} consecutive low-yield pages. Likely reached end of unique results.`,
          );
          this.showNotification(
            `⚠️ Stopping early: Found mostly duplicate jobs on last ${LinkedInJobScraper.MAX_LOW_YIELD_PAGES} pages. Total: ${this.jobs.length} jobs`,
          );
          break;
        }
      } else {
        consecutiveLowYieldPages = 0; // Reset counter if we found good results
      }

      // If this is not the last page, navigate to next page
      if (currentPage < paginationInfo.totalPages && this.isScrapingActive) {
        const navigated = await this.navigateToNextPage();
        if (!navigated) {
          console.log('[LinkedIn Job Saver] Failed to navigate to next page, stopping pagination');
          break;
        }
        currentPage++;

        // Wait for page to load
        await this.delay(3000);

        // Trigger lazy loading for the new page
        await this.triggerLazyLoadingOfAllJobs();
      } else {
        break;
      }
    }

    console.log(`[LinkedIn Job Saver] Multi-page scraping completed. Total jobs scraped: ${this.jobs.length}`);
  }

  private getPaginationInfo(): {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    calculatedPages: number;
  } {
    // Get total results
    const resultsElement = document.querySelector(
      '.jobs-search-results-list__subtitle span, .jobs-search-results-list__text span',
    );
    const resultsText = resultsElement?.textContent?.trim() || '';
    const resultsMatch = resultsText.match(/(\d{1,3}(?:,\d{3})*)\s*results?/i);
    const totalResults = resultsMatch ? parseInt(resultsMatch[1].replace(/,/g, ''), 10) : 0;

    // Calculate total pages based on LinkedIn's 25 jobs per page constant
    const calculatedPages = totalResults > 0 ? Math.ceil(totalResults / LinkedInJobScraper.JOBS_PER_PAGE) : 1;

    // Get current page from URL start parameter (more reliable than UI)
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    const currentPageFromUrl = startParam
      ? Math.floor(parseInt(startParam, 10) / LinkedInJobScraper.JOBS_PER_PAGE) + 1
      : 1;

    // Get displayed total pages from pagination UI as fallback
    const pageStateElement = document.querySelector('.jobs-search-pagination__page-state');
    const pageStateText = pageStateElement?.textContent?.trim() || '';
    const pageMatch = pageStateText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);

    const currentPageFromUI = pageMatch ? parseInt(pageMatch[1], 10) : currentPageFromUrl;
    const displayedTotalPages = pageMatch ? parseInt(pageMatch[2], 10) : calculatedPages;

    // Use URL-based current page as it's more reliable
    const currentPage = currentPageFromUrl;

    // Use the more reliable calculation (LinkedIn sometimes caps displayed pages)
    const totalPages = Math.max(calculatedPages, displayedTotalPages);

    console.log(
      `[LinkedIn Job Saver] Pagination calculation: ${totalResults} results ÷ ${LinkedInJobScraper.JOBS_PER_PAGE} jobs/page = ${calculatedPages} calculated pages, UI shows ${displayedTotalPages} pages, using ${totalPages} total pages`,
    );
    console.log(
      `[LinkedIn Job Saver] Current page: URL start=${startParam} → page ${currentPageFromUrl}, UI shows page ${currentPageFromUI}, using page ${currentPage}`,
    );

    return { currentPage, totalPages, totalResults, calculatedPages };
  }

  private async navigateToNextPage(): Promise<boolean> {
    try {
      const { currentPage, totalPages } = this.getPaginationInfo();

      if (currentPage >= totalPages) {
        console.log(`[LinkedIn Job Saver] Already on last page (${currentPage}/${totalPages})`);
        return false;
      }

      const nextPage = currentPage + 1;
      const nextStartParam = (nextPage - 1) * LinkedInJobScraper.JOBS_PER_PAGE;

      // Update URL to navigate to next page
      const url = new URL(window.location.href);
      url.searchParams.set('start', nextStartParam.toString());

      console.log(
        `[LinkedIn Job Saver] Navigating from page ${currentPage} to page ${nextPage} (start=${nextStartParam})`,
      );

      // Navigate to the new URL
      window.location.href = url.toString();

      // Wait a bit for navigation to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error navigating to next page:', error);
      return false;
    }
  }

  private async waitForPageLoad(): Promise<void> {
    const maxWaitTime = 10000; // 10 seconds max wait
    const checkInterval = 500; // Check every 500ms
    let elapsed = 0;

    return new Promise(resolve => {
      const checkForPageLoad = () => {
        // Check if job cards are loaded and pagination is updated
        const jobCards = document.querySelectorAll(
          'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
        );
        const paginationLoaded = document.querySelector('.jobs-search-pagination__page-state');

        if (jobCards.length > 0 && paginationLoaded) {
          console.log('[LinkedIn Job Saver] Page loaded successfully');
          resolve();
          return;
        }

        elapsed += checkInterval;
        if (elapsed >= maxWaitTime) {
          console.log('[LinkedIn Job Saver] Timeout waiting for page load');
          resolve(); // Continue even if page doesn't fully load
          return;
        }

        setTimeout(checkForPageLoad, checkInterval);
      };

      checkForPageLoad();
    });
  }

  private async triggerLazyLoadingOfAllJobs(): Promise<void> {
    console.log('[LinkedIn Job Saver] Triggering lazy loading by scrolling to load all jobs...');

    // Find the specific job list container (the scrollable div containing job cards)
    // Look for the div inside .scaffold-layout__list that contains the job cards
    const scaffoldContainer = document.querySelector('.scaffold-layout__list') as HTMLElement;

    if (!scaffoldContainer) {
      console.log(
        '[LinkedIn Job Saver] Could not find scaffold container (.scaffold-layout__list), proceeding without lazy loading',
      );
      return;
    }

    // Find the scrollable div inside the scaffold container (not the header)
    let jobListContainer = scaffoldContainer.querySelector('div:not([class*="header"])') as HTMLElement;

    // If the generic selector doesn't work, try more specific selectors
    // if (!jobListContainer) {
    // Try to find by the specific class you mentioned
    jobListContainer = scaffoldContainer.querySelector(
      'div[class*="IwpeeIRcSlEXWwTclyiDQNxTjLCVZciIo"]',
    ) as HTMLElement;
    // }

    if (!jobListContainer) {
      // Fallback: find the div that contains job cards
      const divsInScaffold = scaffoldContainer.querySelectorAll('div');
      for (const div of Array.from(divsInScaffold)) {
        const hasJobCards = div.querySelector('li[data-occludable-job-id], li.scaffold-layout__list-item');
        if (hasJobCards && !div.className.includes('header')) {
          jobListContainer = div as HTMLElement;
          break;
        }
      }
    }

    if (!jobListContainer) {
      console.log(
        '[LinkedIn Job Saver] Could not find scrollable job list container inside .scaffold-layout__list, proceeding without lazy loading',
      );
      return;
    }

    console.log('[LinkedIn Job Saver] Found scaffold container:', scaffoldContainer);
    console.log('[LinkedIn Job Saver] Found job list container:', jobListContainer);
    console.log('[LinkedIn Job Saver] Job list container classes:', jobListContainer.className);

    // First, scroll to the top to ensure we start from the beginning
    jobListContainer.scrollTop = 0;
    await this.delay(1000);

    let previousJobCount = 0;
    let currentJobCount = 0;
    let stableCount = 0;
    const maxScrollAttempts = 20; // Prevent infinite scrolling
    let scrollAttempts = 0;

    // Scroll down gradually to trigger lazy loading
    while (scrollAttempts < maxScrollAttempts && this.isScrapingActive) {
      // Count current jobs within this container
      const jobCards = jobListContainer.querySelectorAll(
        'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
      );
      currentJobCount = jobCards.length;

      console.log(`[LinkedIn Job Saver] Scroll attempt ${scrollAttempts + 1}: Found ${currentJobCount} jobs`);

      // Update progress
      if (this.scrapingButton) {
        this.scrapingButton.innerHTML = `🔄 Loading jobs... (${currentJobCount} found)`;
        this.scrapingButton.style.background = '#ff6600';
      }

      // Check if we've reached the pagination (bottom of the list)
      const pagination = document.querySelector('.jobs-search-pagination');
      if (pagination) {
        const paginationRect = pagination.getBoundingClientRect();
        const containerRect = jobListContainer.getBoundingClientRect();

        // If pagination is visible within the container, we've reached the bottom
        if (paginationRect.top < containerRect.bottom + 100) {
          console.log('[LinkedIn Job Saver] Reached pagination, stopping lazy loading');
          break;
        }
      }

      // Check if job count has stabilized (no new jobs loaded)
      if (currentJobCount === previousJobCount) {
        stableCount++;
        if (stableCount >= 3) {
          console.log('[LinkedIn Job Saver] Job count stabilized, assuming all jobs are loaded');
          break;
        }
      } else {
        stableCount = 0; // Reset stable count if new jobs were found
      }

      previousJobCount = currentJobCount;

      // Scroll down by a portion of the container height
      const scrollAmount = jobListContainer.clientHeight * 0.8;
      jobListContainer.scrollTop += scrollAmount;

      console.log(
        `[LinkedIn Job Saver] Scrolled to position: ${jobListContainer.scrollTop}/${jobListContainer.scrollHeight}`,
      );

      // Wait longer for content to load (3 seconds as requested)
      await this.delay(3000);
      scrollAttempts++;
    }

    // Scroll back to the top to start scraping from the beginning
    console.log('[LinkedIn Job Saver] Scrolling back to top to start scraping...');
    jobListContainer.scrollTop = 0;
    await this.delay(1500);

    const finalJobCount = jobListContainer.querySelectorAll(
      'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
    ).length;

    console.log(`[LinkedIn Job Saver] Lazy loading completed. Final job count: ${finalJobCount}`);
    this.showNotification(`Loaded ${finalJobCount} jobs. Starting detailed scraping...`);
  }

  private async processJobCardDetailed(jobCard: HTMLElement, index: number, total: number): Promise<boolean | null> {
    try {
      // Update button to show progress
      this.updateButtonWithProgress(index, total);

      // First get basic data from the card
      const basicJobData = this.extractJobDataFromCard(jobCard);
      if (!basicJobData) {
        console.log(`[LinkedIn Job Saver] Could not extract basic data from job card ${index}`);
        return null;
      }

      // Check if we already have this job
      if (this.isDuplicateJob(basicJobData)) {
        console.log(`[LinkedIn Job Saver] Job ${index} already exists, skipping`);
        return false;
      }

      // Click on the job card to load detailed information
      const detailedJobData = await this.clickAndExtractJobDetails(jobCard, basicJobData);

      if (detailedJobData) {
        this.jobs.push(detailedJobData);
        console.log(`[LinkedIn Job Saver] Successfully scraped job ${index}/${total}: ${detailedJobData.title}`);
        return true;
      }

      return null;
    } catch (error) {
      console.error(`[LinkedIn Job Saver] Error processing job card ${index}:`, error);
      return null;
    }
  }

  private async clickAndExtractJobDetails(jobCard: HTMLElement, basicData: JobData): Promise<JobData | null> {
    try {
      // Find the clickable link in the job card
      const jobLink = jobCard.querySelector('a[href*="/jobs/view/"], .job-card-container__link') as HTMLAnchorElement;
      if (!jobLink) {
        console.log('[LinkedIn Job Saver] No clickable link found in job card');
        return basicData; // Return basic data if we can't click
      }

      // Scroll the job card into view
      jobCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.delay(500);

      // Click the job card to load details
      jobLink.click();
      console.log('[LinkedIn Job Saver] Clicked job card, waiting for details to load...');

      // Wait for job details to load
      await this.waitForJobDetails();

      // Extract detailed information
      const detailedData = this.extractDetailedJobInfo(basicData);

      return detailedData;
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error clicking job card:', error);
      return basicData; // Return basic data as fallback
    }
  }

  private async waitForJobDetails(): Promise<void> {
    const maxWaitTime = 8000; // 8 seconds max wait
    const checkInterval = 300; // Check every 300ms
    let elapsed = 0;

    return new Promise(resolve => {
      const checkForDetails = () => {
        // Check for job details panel indicators
        const detailsPanel =
          document.querySelector('.jobs-search__job-details') ||
          document.querySelector('.job-details') ||
          document.querySelector('[data-job-id]') ||
          document.querySelector('.jobs-details') ||
          document.querySelector('.job-view-layout') ||
          document.querySelector('.jobs-description') ||
          document.querySelector('.jobs-description-content');

        if (detailsPanel) {
          console.log('[LinkedIn Job Saver] Job details loaded');
          resolve();
          return;
        }

        elapsed += checkInterval;
        if (elapsed >= maxWaitTime) {
          console.log('[LinkedIn Job Saver] Timeout waiting for job details');
          resolve(); // Continue even if details don't load
          return;
        }

        setTimeout(checkForDetails, checkInterval);
      };

      checkForDetails();
    });
  }

  private extractDetailedJobInfo(basicData: JobData): JobData {
    try {
      // Look for the main job details container
      const detailsContainer = document.querySelector(
        '.jobs-search__job-details--container, .job-view-layout.jobs-details, .jobs-details',
      );

      if (!detailsContainer) {
        console.log('[LinkedIn Job Saver] Job details container not found, using basic data');
        return basicData;
      }

      // Extract enhanced job information
      const enhancedData: JobData = { ...basicData };

      // Extract job title from detailed view
      const titleElement = detailsContainer.querySelector('.job-details-jobs-unified-top-card__job-title h1 a, h1 a');
      if (titleElement && titleElement.textContent?.trim()) {
        enhancedData.title = this.cleanText(titleElement.textContent);
      }

      // Extract company name from detailed view
      const companyElement = detailsContainer.querySelector('.job-details-jobs-unified-top-card__company-name a');
      if (companyElement && companyElement.textContent?.trim()) {
        enhancedData.company = this.cleanText(companyElement.textContent);
      }

      // Extract location and posted date from the tertiary description
      const tertiaryDesc = detailsContainer.querySelector(
        '.job-details-jobs-unified-top-card__tertiary-description-container',
      );
      if (tertiaryDesc) {
        const spans = tertiaryDesc.querySelectorAll('.tvm__text');
        spans.forEach(span => {
          const text = span.textContent?.trim();
          if (text) {
            // Location detection (contains "Territory", "State", "City", or common location patterns)
            if (
              text.includes('Territory') ||
              text.includes('State') ||
              text.includes('City') ||
              (text.includes(',') && !text.includes('ago') && !text.includes('applicant'))
            ) {
              enhancedData.location = this.cleanText(text);
            }
            // Posted date detection
            if (text.includes('ago')) {
              enhancedData.postedDate = this.cleanText(text);
              enhancedData.postedDateISO = this.convertRelativeDateToISO(text);
            }
            // Applicant count
            if (text.includes('applicant')) {
              enhancedData.applicantCount = this.cleanText(text);
            }
          }
        });
      }

      // Extract workplace type and job type from preferences section
      const preferencesSection = detailsContainer.querySelector('.job-details-fit-level-preferences');
      if (preferencesSection) {
        const buttons = preferencesSection.querySelectorAll('button .tvm__text strong');
        buttons.forEach(button => {
          const text = button.textContent?.trim();
          if (text) {
            if (text.includes('On-site') || text.includes('Remote') || text.includes('Hybrid')) {
              enhancedData.workplaceType = this.cleanText(text);
            }
            if (
              text.includes('Full-time') ||
              text.includes('Part-time') ||
              text.includes('Contract') ||
              text.includes('Internship')
            ) {
              enhancedData.jobType = this.cleanText(text);
            }
          }
        });
      }

      // Extract detailed job description
      const descriptionElement = detailsContainer.querySelector(
        '.jobs-box__html-content#job-details, .jobs-description-content__text',
      );
      if (descriptionElement && descriptionElement.textContent?.trim()) {
        const description = this.cleanText(descriptionElement.textContent);

        // Extract skills if mentioned in description
        const skillsKeywords = ['Skills:', 'Technologies:', 'Requirements:', 'Technical Skills:'];
        for (const keyword of skillsKeywords) {
          if (description.includes(keyword)) {
            const skillsIndex = description.indexOf(keyword);
            const skillsSection = description.substring(skillsIndex, skillsIndex + 500); // Take next 500 chars
            const lines = skillsSection.split('\n').slice(0, 3); // Take first few lines
            enhancedData.skills = this.cleanText(lines.join(' '));
            break;
          }
        }

        enhancedData.description = description;
      }

      // Extract company information from "About the company" section
      const companySection = detailsContainer.querySelector('.jobs-company, .job-details-about-company');
      if (companySection) {
        // Extract company name from the entity lockup
        const companyNameElement = companySection.querySelector('.artdeco-entity-lockup__title a');
        if (companyNameElement && companyNameElement.textContent?.trim()) {
          enhancedData.company = this.cleanText(companyNameElement.textContent);
        }

        // Extract company followers from entity lockup subtitle
        const followersElement = companySection.querySelector('.artdeco-entity-lockup__subtitle');
        if (followersElement && followersElement.textContent?.includes('followers')) {
          enhancedData.followers = this.cleanText(followersElement.textContent);
        }

        // Extract company info (industry, size, LinkedIn members)
        const companyInfoElement = companySection.querySelector('.t-14.mt5');
        if (companyInfoElement && companyInfoElement.textContent?.trim()) {
          const infoText = companyInfoElement.textContent.trim();

          // Extract industry (text before first inline information span)
          const industryMatch = infoText.split(/\s+(?=\d+-\d+\s+employees|\d+\s+employees)/)[0];
          if (industryMatch && industryMatch.trim()) {
            enhancedData.industry = this.cleanText(industryMatch);
          }

          // Extract company size (employees count)
          const employeeSpan = companySection.querySelector('.jobs-company__inline-information');
          if (employeeSpan && employeeSpan.textContent?.includes('employees')) {
            enhancedData.companySize = this.cleanText(employeeSpan.textContent);
          }

          // Extract LinkedIn member count
          const linkedinMembersSpans = companySection.querySelectorAll('.jobs-company__inline-information');
          if (linkedinMembersSpans.length > 1) {
            const linkedinMembersText = linkedinMembersSpans[1].textContent?.trim();
            if (linkedinMembersText && linkedinMembersText.includes('LinkedIn')) {
              enhancedData.linkedinEmployees = this.cleanText(linkedinMembersText);
            }
          }
        }

        // Extract company description from the description container
        const descriptionElement = companySection.querySelector(
          '.jobs-company__company-description .text-body-small-open',
        );
        if (descriptionElement) {
          // Look for the inner div that contains the actual description text
          const descriptionDiv = descriptionElement.querySelector('div[dir="ltr"]');
          if (descriptionDiv && descriptionDiv.textContent?.trim()) {
            enhancedData.companyDescription = this.cleanText(descriptionDiv.textContent);
          } else if (descriptionElement.textContent?.trim()) {
            enhancedData.companyDescription = this.cleanText(descriptionElement.textContent);
          }
        }

        // Fallback: try alternative selectors for company description
        if (!enhancedData.companyDescription) {
          const altDescriptionElement = companySection.querySelector(
            '.jobs-company__company-description, .text-body-small-open',
          );
          if (altDescriptionElement && altDescriptionElement.textContent?.trim()) {
            enhancedData.companyDescription = this.cleanText(altDescriptionElement.textContent);
          }
        }

        // Company commitments
        const commitmentsSection = companySection.querySelector('.job-details-company__commitments-container');
        if (commitmentsSection) {
          const commitments: string[] = [];
          const commitmentTypes = commitmentsSection.querySelectorAll('.job-details-company__commitments-type h4');
          const commitmentDescs = commitmentsSection.querySelectorAll('.job-details-company__commitments-description');

          commitmentTypes.forEach((type, index) => {
            const typeText = type.textContent?.trim();
            const descText = commitmentDescs[index]?.textContent?.trim();
            if (typeText) {
              if (descText) {
                commitments.push(`${typeText}: ${descText}`);
              } else {
                commitments.push(typeText);
              }
            }
          });

          if (commitments.length > 0) {
            enhancedData.companyCommitments = commitments.join('; ');
          }
        }
      }

      // Extract hiring insights from premium insights section
      const insightsSection = detailsContainer.querySelector(
        '.aiq-premium-insights-module-card__container--with-highchart-data',
      );
      if (insightsSection) {
        const insights: string[] = [];
        const statsElements = insightsSection.querySelectorAll(
          '.aiq-premium-insights-module-card__statistics-container',
        );

        statsElements.forEach(stat => {
          const percentage = stat.querySelector('.t-24.t-black.t-bold');
          const description = stat.querySelector('.t-12.t-black--light');

          if (percentage && description) {
            const percentText = percentage.textContent?.trim();
            const descText = description.textContent?.trim();
            if (percentText && descText) {
              insights.push(`${percentText} ${descText}`);
            }
          }
        });

        if (insights.length > 0) {
          enhancedData.hiringInsights = insights.join('; ');
        }
      }

      // Extract salary information (if available)
      const salarySection = detailsContainer.querySelector('#SALARY, .jobs-details__salary-main-rail-card');
      if (salarySection && salarySection.textContent?.trim()) {
        enhancedData.salary = this.cleanText(salarySection.textContent);
      }

      console.log('[LinkedIn Job Saver] Enhanced job data extracted successfully');
      return enhancedData;
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error extracting detailed job info:', error);
      return basicData; // Return basic data as fallback
    }
  }

  private updateButtonWithProgress(current: number, total: number) {
    if (this.scrapingButton) {
      this.scrapingButton.innerHTML = `🔄 Scraping ${current}/${total} (${this.jobs.length} saved)`;
      this.scrapingButton.style.background = '#0066cc';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async testScrollFunction(): Promise<void> {
    console.log('[LinkedIn Job Saver] Testing scroll function...');
    this.showNotification('🔄 Testing scroll function - check console for details');

    try {
      // Find the scaffold container first
      const scaffoldContainer = document.querySelector('.scaffold-layout__list') as HTMLElement;

      if (!scaffoldContainer) {
        console.log('[LinkedIn Job Saver] Could not find scaffold container (.scaffold-layout__list)');
        this.showNotification('❌ Could not find scaffold container (.scaffold-layout__list)');
        return;
      }

      // Find the scrollable div inside the scaffold container (not the header)
      let jobListContainer = scaffoldContainer.querySelector('div:not([class*="header"])') as HTMLElement;

      // If the generic selector doesn't work, try more specific selectors
      //   if (!jobListContainer) {
      // Try to find by the specific class you mentioned
      jobListContainer = scaffoldContainer.querySelector(
        'div[class*="IwpeeIRcSlEXWwTclyiDQNxTjLCVZciIo"]',
      ) as HTMLElement;
      //   }

      if (!jobListContainer) {
        // Fallback: find the div that contains job cards
        const divsInScaffold = scaffoldContainer.querySelectorAll('div');
        for (const div of Array.from(divsInScaffold)) {
          const hasJobCards = div.querySelector('li[data-occludable-job-id], li.scaffold-layout__list-item');
          if (hasJobCards && !div.className.includes('header')) {
            jobListContainer = div as HTMLElement;
            break;
          }
        }
      }

      if (!jobListContainer) {
        console.log('[LinkedIn Job Saver] Could not find scrollable job list container inside .scaffold-layout__list');
        this.showNotification('❌ Could not find scrollable job list container');
        return;
      }

      console.log('[LinkedIn Job Saver] Found scaffold container:', scaffoldContainer);
      console.log('[LinkedIn Job Saver] Found job list container:', jobListContainer);
      console.log('[LinkedIn Job Saver] Job list container classes:', jobListContainer.className);
      console.log('[LinkedIn Job Saver] Container scrollHeight:', jobListContainer.scrollHeight);
      console.log('[LinkedIn Job Saver] Container clientHeight:', jobListContainer.clientHeight);

      // Count initial jobs
      const initialJobCards = jobListContainer.querySelectorAll(
        'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
      );
      console.log(`[LinkedIn Job Saver] Initial job count: ${initialJobCards.length}`);
      this.showNotification(`Found ${initialJobCards.length} jobs initially. Starting scroll test...`);

      // Test scroll to bottom
      console.log('[LinkedIn Job Saver] Scrolling to bottom...');
      jobListContainer.scrollTop = jobListContainer.scrollHeight;
      await this.delay(2000);

      // Count jobs after scroll
      const afterScrollJobCards = jobListContainer.querySelectorAll(
        'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
      );
      console.log(`[LinkedIn Job Saver] Job count after scroll: ${afterScrollJobCards.length}`);

      // Check if pagination is visible
      const pagination = document.querySelector('.jobs-search-pagination');
      const paginationVisible = pagination ? 'visible' : 'not visible';
      console.log(`[LinkedIn Job Saver] Pagination element: ${paginationVisible}`);

      // Test the full lazy loading function
      console.log('[LinkedIn Job Saver] Testing full lazy loading function...');
      await this.triggerLazyLoadingOfAllJobs();

      // Final count
      const finalJobCards = jobListContainer.querySelectorAll(
        'li[data-occludable-job-id] .job-card-container, li.scaffold-layout__list-item .job-card-container',
      );
      console.log(`[LinkedIn Job Saver] Final job count after lazy loading: ${finalJobCards.length}`);

      this.showNotification(
        `✅ Scroll test completed! Initial: ${initialJobCards.length}, After scroll: ${afterScrollJobCards.length}, Final: ${finalJobCards.length}`,
      );
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error during scroll test:', error);
      this.showNotification('❌ Error during scroll test - check console for details');
    }
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\t+/g, ' ') // Replace tabs with spaces
      .substring(0, 2000); // Limit length to prevent overly long descriptions
  }

  private convertRelativeDateToISO(relativeDate: string): string | undefined {
    if (!relativeDate) return undefined;

    const now = new Date();
    const lowerDate = relativeDate.toLowerCase().trim();

    // Extract number and unit
    const match = lowerDate.match(/(\d+)\s*(hour|day|week|month|year)s?\s*ago/);
    if (!match) return undefined;

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    const targetDate = new Date(now);

    switch (unit) {
      case 'hour':
        targetDate.setHours(targetDate.getHours() - amount);
        break;
      case 'day':
        targetDate.setDate(targetDate.getDate() - amount);
        break;
      case 'week':
        targetDate.setDate(targetDate.getDate() - amount * 7);
        break;
      case 'month':
        targetDate.setMonth(targetDate.getMonth() - amount);
        break;
      case 'year':
        targetDate.setFullYear(targetDate.getFullYear() - amount);
        break;
      default:
        return undefined;
    }

    return targetDate.toISOString();
  }

  private showNotification(message: string) {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      background: #0073b1;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 5000);
  }

  private scrapeJobDetail() {
    const jobData = this.extractJobDataFromDetailPage();
    if (jobData && !this.isDuplicateJob(jobData)) {
      this.jobs.push(jobData);
      console.log('[LinkedIn Job Saver] Scraped job detail:', jobData.title);
      this.updateButtonText();
    }
  }

  private extractJobDataFromCard(card: HTMLElement): JobData | null {
    try {
      // Updated selectors based on the current LinkedIn structure
      const titleElement = card.querySelector(
        '.job-card-container__link[aria-label], .job-card-list__title--link, a[class*="job-card-container__link"]',
      );
      const companyElement = card.querySelector(
        '.artdeco-entity-lockup__subtitle span, .job-card-container__primary-description',
      );
      const locationElement = card.querySelector(
        '.job-card-container__metadata-wrapper li span, .artdeco-entity-lockup__caption li span',
      );
      const linkElement = card.querySelector('a[href*="/jobs/view/"]');
      const postedDateElement = card.querySelector('time[datetime]');
      const insightElement = card.querySelector('.job-card-container__job-insight-text');
      const dataJobId =
        card.getAttribute('data-job-id') ||
        card.closest('li[data-occludable-job-id]')?.getAttribute('data-occludable-job-id');

      // Extract title from aria-label or text content
      const title =
        titleElement?.getAttribute('aria-label')?.trim() ||
        titleElement?.textContent?.trim().replace(/\s+/g, ' ') ||
        '';

      const company = companyElement?.textContent?.trim() || '';
      const location = locationElement?.textContent?.trim() || '';
      const postedDate = postedDateElement?.getAttribute('datetime') || '';
      const insight = insightElement?.textContent?.trim() || '';

      // Construct URL from job ID or use existing link
      let url = '';
      if (linkElement) {
        url = (linkElement as HTMLAnchorElement).href;
      } else if (dataJobId) {
        url = `https://www.linkedin.com/jobs/view/${dataJobId}/`;
      } else {
        // Fallback: try to extract job ID from current URL or use current URL
        const currentUrlMatch = window.location.href.match(/\/jobs\/view\/(\d+)/);
        if (currentUrlMatch) {
          url = `https://www.linkedin.com/jobs/view/${currentUrlMatch[1]}/`;
        } else {
          url = window.location.href;
        }
      }

      // Validate URL
      if (!url || (!url.includes('linkedin.com') && !url.startsWith('https://'))) {
        console.warn('[LinkedIn Job Saver] Invalid URL constructed:', url);
        url = window.location.href; // Fallback to current page
      }

      // Clean up title (remove verification icons and extra spaces)
      const cleanTitle = title.replace(/with verification$/, '').trim();

      if (!cleanTitle || !company) {
        console.log('[LinkedIn Job Saver] Skipping job card - missing title or company:', {
          title: cleanTitle,
          company,
        });
        return null;
      }

      return {
        title: cleanTitle,
        company,
        location,
        description: insight, // Use job insight as initial description
        postedDate,
        postedDateISO: this.convertRelativeDateToISO(postedDate),
        url,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error extracting job data from card:', error);
      return null;
    }
  }

  private extractJobDataFromDetailPage(): JobData | null {
    try {
      const titleElement = document.querySelector(
        '.job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title h1',
      );
      const companyElement = document.querySelector(
        '.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a',
      );
      const locationElement = document.querySelector(
        '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet',
      );
      const descriptionElement = document.querySelector(
        '.job-details-jobs-unified-top-card__job-description, .jobs-description__content',
      );
      const salaryElement = document.querySelector('.job-details-jobs-unified-top-card__job-insight');

      const title = titleElement?.textContent?.trim() || '';
      const company = companyElement?.textContent?.trim() || '';
      const location = locationElement?.textContent?.trim() || '';
      const description = descriptionElement?.textContent?.trim() || '';
      const salary = salaryElement?.textContent?.trim() || '';

      if (!title || !company) return null;

      return {
        title,
        company,
        location,
        description,
        salary,
        url: window.location.href,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[LinkedIn Job Saver] Error extracting job data from detail page:', error);
      return null;
    }
  }

  private isDuplicateJob(newJob: JobData): boolean {
    return this.jobs.some(
      job => job.title === newJob.title && job.company === newJob.company && job.url === newJob.url,
    );
  }

  private observePageChanges() {
    if (!this.isScrapingActive) return;

    // Disconnect existing observer if any
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver(mutations => {
      if (!this.isScrapingActive) {
        this.observer?.disconnect();
        this.observer = null;
        return;
      }

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if new job cards were added
          const hasNewJobCards = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              return (
                element.querySelector('.job-card-container') !== null ||
                element.querySelector('li[data-occludable-job-id]') !== null ||
                element.matches('.job-card-container') ||
                element.matches('li[data-occludable-job-id]')
              );
            }
            return false;
          });

          if (hasNewJobCards) {
            console.log('[LinkedIn Job Saver] New job cards detected, scraping...');
            setTimeout(() => this.scrapeJobListings(), 1000); // Delay to ensure content is loaded
          }
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Stop observing after 30 seconds to prevent memory leaks
    setTimeout(() => {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }, 30000);
  }
}

export const linkedinJobScraper = new LinkedInJobScraper();
export type { JobData };
