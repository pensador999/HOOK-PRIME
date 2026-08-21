(function () {
  if (!window.HUB) window.HUB = {};
  if (window.HUB.ImagePreview) return; // Already initialized

  // --- Constants & Styling ---
  const COLORS = {
    bg: '#0f172a',
    card: '#1e293b',
    accent: '#7F00FF', // Tiffany
    text: '#f8fafc',
    textMuted: '#94a3b8',
    overlay: 'rgba(15, 23, 42, 0.85)',
    priority: {
      1: '#7C3AED', // FRENTE green
      2: '#3b82f6', // COSTAS blue
      3: '#f97316', // PERSPEC orange
      4: '#64748b', // DETALHE gray
      5: '#8b5cf6'  // OTHER purple
    }
  };

  const CSS = `
    /* Image Preview Modal Styles */
    #hub-image-preview-modal {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: ${COLORS.overlay};
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      font-family: system-ui, -apple-system, sans-serif;
      color: ${COLORS.text};
    }
    #hub-image-preview-modal.hub-ip-show {
      opacity: 1;
      visibility: visible;
    }

    .hub-ip-container {
      background: ${COLORS.card};
      width: 90%;
      max-width: 1200px;
      height: 90%;
      max-height: 900px;
      border-radius: 16px;
      border: 1px solid rgba(127, 0, 255, 0.2);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.95);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #hub-image-preview-modal.hub-ip-show .hub-ip-container {
      transform: scale(1);
    }

    /* Header */
    .hub-ip-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(4px);
    }
    .hub-ip-header-info h2 {
      margin: 0 0 4px 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: ${COLORS.accent};
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .hub-ip-header-meta {
      margin: 0;
      font-size: 0.9rem;
      color: ${COLORS.textMuted};
    }
    .hub-ip-close {
      background: none;
      border: none;
      color: ${COLORS.textMuted};
      font-size: 1.75rem;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: color 0.2s ease, transform 0.2s ease;
    }
    .hub-ip-close:hover {
      color: #ef4444;
      transform: scale(1.1);
    }

    /* Navigation */
    .hub-ip-nav-btn {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .hub-ip-nav-btn:hover:not(:disabled) {
      background: ${COLORS.accent};
      border-color: ${COLORS.accent};
    }
    .hub-ip-nav-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .hub-ip-header-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .hub-ip-nav-group {
      display: flex;
      gap: 8px;
    }

    /* Content Area */
    .hub-ip-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
    /* Custom Scrollbar for content */
    .hub-ip-content::-webkit-scrollbar { width: 8px; }
    .hub-ip-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
    .hub-ip-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
    .hub-ip-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

    /* Grid */
    .hub-ip-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
    }
    
    /* Thumbnail Card */
    .hub-ip-card {
      background: rgba(15, 23, 42, 0.4);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      overflow: hidden;
      transition: all 0.3s ease;
      position: relative;
    }
    .hub-ip-card:hover {
      transform: translateY(-4px);
      border-color: rgba(127, 0, 255, 0.4);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .hub-ip-img-wrap {
      width: 100%;
      aspect-ratio: 1;
      background: #000;
      position: relative;
      cursor: zoom-in;
      overflow: hidden;
    }
    .hub-ip-img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: transform 0.3s ease;
    }
    .hub-ip-card:hover .hub-ip-img-wrap img {
      transform: scale(1.05);
    }
    
    /* Badges Overlay */
    .hub-ip-badges-top {
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
    }
    .hub-ip-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      color: white;
    }
    .hub-ip-badge-priority { border-left: 3px solid transparent; }
    .hub-ip-badge-gender { background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.1); }
    
    /* Card Info */
    .hub-ip-card-info {
      padding: 12px;
    }
    .hub-ip-filename {
      font-size: 0.85rem;
      font-weight: 500;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .hub-ip-filesize {
      font-size: 0.75rem;
      color: ${COLORS.textMuted};
    }

    /* Lightbox */
    #hub-ip-lightbox {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      cursor: zoom-out;
    }
    #hub-ip-lightbox.hub-ip-show {
      opacity: 1;
      visibility: visible;
    }
    #hub-ip-lightbox img {
      max-width: 95%;
      max-height: 95%;
      object-fit: contain;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    /* Empty State */
    .hub-ip-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${COLORS.textMuted};
    }
    .hub-ip-empty svg {
      width: 64px; height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
  `;

  // --- State ---
  let modalEl = null;
  let currentCodes = [];
  let currentIndex = 0;
  
  // --- Initialization ---
  function init() {
    if (document.getElementById('hub-image-preview-modal')) return;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Create DOM
    modalEl = document.createElement('div');
    modalEl.id = 'hub-image-preview-modal';
    modalEl.innerHTML = `
      <div class="hub-ip-container">
        <div class="hub-ip-header">
          <div class="hub-ip-header-info">
            <h2 id="hub-ip-title">Code Name</h2>
            <p class="hub-ip-header-meta" id="hub-ip-meta">Estampa | Source | 0 images</p>
          </div>
          <div class="hub-ip-header-controls">
            <div class="hub-ip-nav-group">
              <button class="hub-ip-nav-btn" id="hub-ip-prev" title="Previous (Left Arrow)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button class="hub-ip-nav-btn" id="hub-ip-next" title="Next (Right Arrow)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
            <button class="hub-ip-close" id="hub-ip-close" title="Close (ESC)">&times;</button>
          </div>
        </div>
        
        <div class="hub-ip-content" id="hub-ip-content">
          <!-- Grid goes here -->
        </div>
        
        <div id="hub-ip-lightbox">
          <img src="" id="hub-ip-lb-img" alt="Zoomed image" />
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    // Event Listeners
    document.getElementById('hub-ip-close').addEventListener('click', hide);
    document.getElementById('hub-ip-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('hub-ip-next').addEventListener('click', () => navigate(1));
    
    // Lightbox
    const lightbox = document.getElementById('hub-ip-lightbox');
    lightbox.addEventListener('click', () => {
      lightbox.classList.remove('hub-ip-show');
    });

    // Close on overlay click
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) hide();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!modalEl.classList.contains('hub-ip-show')) return;
      if (document.getElementById('hub-ip-lightbox').classList.contains('hub-ip-show')) {
        if (e.key === 'Escape') {
          document.getElementById('hub-ip-lightbox').classList.remove('hub-ip-show');
          e.stopPropagation();
        }
        return;
      }
      
      if (e.key === 'Escape') hide();
      else if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === 'ArrowRight') navigate(1);
    });
  }

  // --- Render ---
  function getPriorityName(p) {
    const map = { 1: 'FRENTE', 2: 'COSTAS', 3: 'PERSPEC', 4: 'DETALHE' };
    return map[p] || 'OUTRO';
  }

  function getPriorityColor(p) {
    return COLORS.priority[p] || COLORS.priority[5];
  }

  function getGenderIcon(g) {
    if (!g) return '';
    const upper = g.toUpperCase();
    if (upper.includes('MASC')) return '♂ MASC';
    if (upper.includes('FEM')) return '♀ FEM';
    if (upper.includes('INF')) return '👶 INF';
    return g;
  }

  function renderCurrent() {
    const data = currentCodes[currentIndex];
    if (!data) return;

    // Update Header
    document.getElementById('hub-ip-title').textContent = data.code || 'Unknown Code';
    const numImgs = data.images ? data.images.length : 0;
    const metaParts = [];
    if (data.estampa) metaParts.push(data.estampa);
    if (data.source) metaParts.push(data.source);
    metaParts.push(`${numImgs} image${numImgs !== 1 ? 's' : ''}`);
    document.getElementById('hub-ip-meta').textContent = metaParts.join(' • ');

    // Update Navigation Buttons
    document.getElementById('hub-ip-prev').disabled = currentIndex <= 0;
    document.getElementById('hub-ip-next').disabled = currentIndex >= currentCodes.length - 1;

    // Update Content
    const content = document.getElementById('hub-ip-content');
    
    if (numImgs === 0) {
      content.innerHTML = `
        <div class="hub-ip-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          <p>No images found for this code.</p>
        </div>
      `;
      return;
    }

    let gridHtml = '<div class="hub-ip-grid">';
    
    data.images.forEach((img, idx) => {
      const prioName = img.priority ? getPriorityName(img.priority) : '';
      const prioColor = img.priority ? getPriorityColor(img.priority) : '';
      const genderText = getGenderIcon(img.gender);
      const sizeStr = img.sizeKB ? `${img.sizeKB.toLocaleString()} KB` : '';
      
      gridHtml += `
        <div class="hub-ip-card">
          <div class="hub-ip-img-wrap" data-url="${img.url}" onclick="window.HUB.ImagePreview._openLightbox('${img.url}')">
            <img src="${img.url}" loading="lazy" alt="${img.name || 'Preview'}" />
            <div class="hub-ip-badges-top">
              ${prioName ? `<span class="hub-ip-badge hub-ip-badge-priority" style="border-left-color: ${prioColor}">${prioName}</span>` : '<span></span>'}
              ${genderText ? `<span class="hub-ip-badge hub-ip-badge-gender">${genderText}</span>` : ''}
            </div>
          </div>
          <div class="hub-ip-card-info">
            <div class="hub-ip-filename" title="${img.name}">${img.name || 'Unknown'}</div>
            <div class="hub-ip-filesize">${sizeStr}</div>
          </div>
        </div>
      `;
    });
    
    gridHtml += '</div>';
    content.innerHTML = gridHtml;
  }

  function navigate(dir) {
    const newIdx = currentIndex + dir;
    if (newIdx >= 0 && newIdx < currentCodes.length) {
      currentIndex = newIdx;
      renderCurrent();
    }
  }

  function hide() {
    if (modalEl) {
      modalEl.classList.remove('hub-ip-show');
      document.body.style.overflow = ''; // Restore scrolling
    }
  }

  // --- Public API ---
  window.HUB.ImagePreview = {
    show: function(data) {
      this.showAll([data], 0);
    },
    
    showAll: function(codesArray, startIndex = 0) {
      if (!codesArray || codesArray.length === 0) return;
      
      init();
      currentCodes = codesArray;
      currentIndex = Math.max(0, Math.min(startIndex, codesArray.length - 1));
      
      renderCurrent();
      
      modalEl.classList.add('hub-ip-show');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    },
    
    hide: hide,

    // Internal method for inline onclick
    _openLightbox: function(url) {
      if (!url) return;
      const lb = document.getElementById('hub-ip-lightbox');
      const img = document.getElementById('hub-ip-lb-img');
      img.src = url;
      lb.classList.add('hub-ip-show');
    }
  };

  // Auto-init on load if desired, but we'll create on first call
})();
