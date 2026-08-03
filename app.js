/* ============================================
   PWA Hizb Al-A'zham — Application Logic
   ============================================ */

// --- PDF.js Setup (Local for 100% Offline) ---
const PDFJS_PATH = './lib/pdf.min.mjs';
const PDFJS_WORKER_PATH = './lib/pdf.worker.min.mjs';

let pdfjsLib = null;

async function initPDFJS() {
    if (pdfjsLib) return pdfjsLib;
    
    try {
        const module = await import(PDFJS_PATH);
        pdfjsLib = module;
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_PATH;
        return pdfjsLib;
    } catch (e) {
        console.error('Failed to load local PDF.js:', e);
        return null;
    }
}

// --- Data ---
const SECTIONS = [
    { pdf: 'Sholawat 40.pdf', name: 'Sholawat 40', label: '—', day: null },
    { pdf: 'Jumat.pdf', name: 'Hizb Pertama — Hari Jumat', label: 'Ju', day: 5 },
    { pdf: 'Sabtu.pdf', name: 'Hizb Kedua — Hari Sabtu', label: 'Sa', day: 6 },
    { pdf: 'Ahad.pdf', name: 'Hizb Ketiga — Hari Ahad', label: 'Ah', day: 0 },
    { pdf: 'Senin.pdf', name: 'Hizb Keempat — Hari Senin', label: 'Se', day: 1 },
    { pdf: 'Selasa.pdf', name: 'Hizb Kelima — Hari Selasa', label: 'Se', day: 2 },
    { pdf: 'Rabu.pdf', name: 'Hizb Keenam — Hari Rabu', label: 'Ra', day: 3 },
    { pdf: 'Kamis.pdf', name: 'Hizb Ketujuh — Hari Kamis', label: 'Ka', day: 4 },
];

// --- State ---
let currentPdf = null;
let currentPdfName = '';
let currentPage = 1;
let totalPages = 0;
let isRendering = false;
let pageIndicatorTimeout = null;

// --- DOM Elements ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const hamburgerBtn = $('#hamburger-btn');
const backBtn = $('#back-btn');
const readerTitle = $('#reader-title');
const sidebarOverlay = $('#sidebar-overlay');
const sidebar = $('#sidebar');
const sidebarClose = $('#sidebar-close');
const tocList = $('#toc-list');
const mainContent = $('#main-content');
const bottomNav = $('#bottom-nav');

const viewHome = $('#view-home');
const viewSections = $('#view-sections');
const viewReader = $('#view-reader');

const resumeCard = $('#resume-card');
const resumeDetail = $('#resume-detail');

const readerLoading = $('#reader-loading');
const pdfContainer = $('#pdf-container');
const pageIndicator = $('#page-indicator');
const pageInfo = $('#page-info');

const installPrompt = $('#install-prompt');

// --- Sidebar ---
function openSidebar() {
    sidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

hamburgerBtn.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
        closeSidebar();
    }
});

// --- Navigation ---
function switchView(viewName) {
    // Update views
    $$('.view').forEach(v => v.classList.remove('active'));
    
    // Update nav items
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    
    if (viewName === 'home') {
        viewHome.classList.add('active');
        $('#nav-home').classList.add('active');
        document.body.classList.remove('reader-mode');
    } else if (viewName === 'sections') {
        viewSections.classList.add('active');
        $('#nav-sections').classList.add('active');
        document.body.classList.remove('reader-mode');
    } else if (viewName === 'reader') {
        viewReader.classList.add('active');
        $('#nav-reader').classList.add('active');
        
        // Show empty state if no PDF loaded
        if (!currentPdf && pdfContainer.children.length === 0) {
            showEmptyReader();
        }
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Bottom nav clicks
$$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'reader' && currentPdf) {
            document.body.classList.add('reader-mode');
        } else {
            document.body.classList.remove('reader-mode');
        }
        switchView(view);
    });
});

// Back button
backBtn.addEventListener('click', () => {
    document.body.classList.remove('reader-mode');
    switchView('home');
});

// --- Show empty reader state ---
function showEmptyReader() {
    pdfContainer.innerHTML = `
        <div class="reader-empty">
            <div class="reader-empty-icon">📖</div>
            <p class="reader-empty-text">Belum ada bacaan dipilih</p>
            <p class="reader-empty-hint">Pilih bagian dari Beranda atau Daftar Isi</p>
        </div>
    `;
}

// --- PDF Download with retry ---
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;

// Cache downloaded PDFs in memory to avoid re-downloading
const pdfDataCache = new Map();

async function fetchPDFData(pdfFile) {
    // Return cached data if available
    if (pdfDataCache.has(pdfFile)) {
        return pdfDataCache.get(pdfFile);
    }

    const response = await fetch(pdfFile);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Read entire file as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('File kosong atau tidak valid');
    }

    // Cache for future use
    pdfDataCache.set(pdfFile, arrayBuffer.slice(0));
    return arrayBuffer;
}

function updateLoadingText(text) {
    const loadingP = readerLoading.querySelector('p');
    if (loadingP) loadingP.textContent = text;
}

// --- PDF Rendering ---
async function openPDF(pdfFile, pdfName, targetPage = 1) {
    if (isRendering) return;
    isRendering = true;
    
    // Update UI
    currentPdfName = pdfName;
    readerTitle.textContent = pdfName;
    document.body.classList.add('reader-mode');
    
    // Switch to reader view
    switchView('reader');
    document.body.classList.add('reader-mode');
    
    // Show loading
    pdfContainer.innerHTML = '';
    readerLoading.classList.remove('hidden');
    pageIndicator.classList.add('hidden');
    updateLoadingText('Mengunduh file...');
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Init PDF.js
            const pdfjs = await initPDFJS();
            if (!pdfjs) throw new Error('PDF.js tidak tersedia');
            
            // Step 1: Download full PDF as ArrayBuffer
            if (attempt > 1) {
                updateLoadingText(`Mencoba lagi (${attempt}/${MAX_RETRIES})...`);
                // Clear cache on retry in case partial data was cached
                pdfDataCache.delete(pdfFile);
            }
            
            const pdfData = await fetchPDFData(pdfFile);
            
            // Step 2: Pass ArrayBuffer to PDF.js (no network request needed)
            updateLoadingText('Memproses halaman...');
            const loadingTask = pdfjs.getDocument({ data: pdfData.slice(0) });
            const pdf = await loadingTask.promise;
            currentPdf = pdf;
            totalPages = pdf.numPages;
            
            // Hide loading
            readerLoading.classList.add('hidden');
            
            // Render all pages
            for (let i = 1; i <= totalPages; i++) {
                updateLoadingText(`Merender halaman ${i}/${totalPages}...`);
                await renderPage(pdf, i);
            }
            
            // Show page indicator
            currentPage = targetPage;
            updatePageIndicator();
            
            // Scroll to target page
            if (targetPage > 1) {
                scrollToPage(targetPage);
            }
            
            // Save reading position
            saveReadingPosition(pdfFile, pdfName, targetPage);
            
            // Setup scroll tracking
            setupScrollTracking();
            
            // Success — exit retry loop
            isRendering = false;
            return;
            
        } catch (err) {
            console.warn(`PDF load attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
            lastError = err;
            
            if (attempt < MAX_RETRIES) {
                // Wait before retrying
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
            }
        }
    }
    
    // All retries failed
    console.error('All PDF load attempts failed:', lastError);
    readerLoading.classList.add('hidden');
    pdfContainer.innerHTML = `
        <div class="reader-empty">
            <div class="reader-empty-icon">⚠️</div>
            <p class="reader-empty-text">Gagal memuat PDF</p>
            <p class="reader-empty-hint">${lastError.message}</p>
            <button class="retry-btn" onclick="retryOpenPDF('${pdfFile}', '${pdfName.replace(/'/g, "\\'")}', ${targetPage})">
                Coba Lagi
            </button>
        </div>
    `;
    isRendering = false;
}

// Global retry function (called from inline onclick)
window.retryOpenPDF = function(pdfFile, pdfName, targetPage) {
    pdfDataCache.delete(pdfFile); // clear any bad cache
    openPDF(pdfFile, pdfName, targetPage);
};

async function renderPage(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    
    // Calculate scale to fit width
    const containerWidth = Math.min(window.innerWidth, 480);
    const viewport = page.getViewport({ scale: 1 });
    const scale = (containerWidth / viewport.width) * window.devicePixelRatio;
    const scaledViewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page';
    canvas.dataset.page = pageNum;
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    canvas.style.width = `${scaledViewport.width / window.devicePixelRatio}px`;
    canvas.style.height = `${scaledViewport.height / window.devicePixelRatio}px`;
    
    const context = canvas.getContext('2d');
    
    // Render
    await page.render({
        canvasContext: context,
        viewport: scaledViewport,
    }).promise;
    
    pdfContainer.appendChild(canvas);
}

function scrollToPage(pageNum) {
    const canvas = pdfContainer.querySelector(`canvas[data-page="${pageNum}"]`);
    if (canvas) {
        const headerHeight = 60;
        const top = canvas.offsetTop - headerHeight - 8;
        window.scrollTo({ top, behavior: 'smooth' });
    }
}

// --- Scroll Tracking ---
function setupScrollTracking() {
    let ticking = false;
    
    const onScroll = () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                detectCurrentPage();
                ticking = false;
            });
            ticking = true;
        }
    };
    
    // Remove old listener if exists
    window.removeEventListener('scroll', window._pdfScrollHandler);
    window._pdfScrollHandler = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
}

function detectCurrentPage() {
    const pages = pdfContainer.querySelectorAll('canvas');
    const headerHeight = 60;
    const scrollTop = window.scrollY + headerHeight + 100;
    
    let detectedPage = 1;
    
    for (const canvas of pages) {
        if (canvas.offsetTop <= scrollTop) {
            detectedPage = parseInt(canvas.dataset.page);
        }
    }
    
    if (detectedPage !== currentPage) {
        currentPage = detectedPage;
        updatePageIndicator();
        
        // Save position
        const section = SECTIONS.find(s => s.pdf === getLastPdfFile());
        if (section) {
            saveReadingPosition(section.pdf, section.name, currentPage);
        }
    }
}

function updatePageIndicator() {
    if (totalPages > 0) {
        pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
        pageIndicator.classList.remove('hidden');
        
        // Auto-hide after 3 seconds
        clearTimeout(pageIndicatorTimeout);
        pageIndicatorTimeout = setTimeout(() => {
            pageIndicator.classList.add('hidden');
        }, 3000);
    }
}

// --- Reading Position (localStorage) ---
function saveReadingPosition(pdfFile, pdfName, page) {
    const data = {
        pdf: pdfFile,
        name: pdfName,
        page: page,
        timestamp: Date.now(),
    };
    localStorage.setItem('hizb_last_read', JSON.stringify(data));
    updateResumeCard();
}

function getLastPdfFile() {
    try {
        const data = JSON.parse(localStorage.getItem('hizb_last_read'));
        return data ? data.pdf : null;
    } catch {
        return null;
    }
}

function updateResumeCard() {
    try {
        const data = JSON.parse(localStorage.getItem('hizb_last_read'));
        if (data && data.pdf && data.name) {
            resumeDetail.textContent = `Halaman ${data.page} — ${data.name}`;
            resumeCard.classList.remove('hidden');
        }
    } catch {
        resumeCard.classList.add('hidden');
    }
}

// Resume card click
resumeCard.addEventListener('click', () => {
    try {
        const data = JSON.parse(localStorage.getItem('hizb_last_read'));
        if (data) {
            openPDF(data.pdf, data.name, data.page);
        }
    } catch {
        // ignore
    }
});

// --- Card & TOC Click Handlers ---


// TOC items in sidebar
$$('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
        const pdfFile = item.dataset.pdf;
        const pdfName = item.dataset.name;
        closeSidebar();
        // Small delay to let sidebar close animation complete
        setTimeout(() => {
            openPDF(pdfFile, pdfName);
        }, 150);
    });
});

// Section items
$$('.section-item').forEach(item => {
    item.addEventListener('click', () => {
        const pdfFile = item.dataset.pdf;
        const pdfName = item.dataset.name;
        openPDF(pdfFile, pdfName);
    });
});

// --- PWA Install ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installPrompt.style.display = 'flex';
});

installPrompt.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('Install outcome:', outcome);
        deferredPrompt = null;
    }
});

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// --- Init ---
function init() {
    // Show resume card if available
    updateResumeCard();
    
    // Show empty reader
    showEmptyReader();
    
    // Pre-init PDF.js
    initPDFJS();
    
    console.log('Hizb Al-A\'zham PWA initialized');
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
