(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const grid = $('cardsGrid');
  const fieldFilter = $('fieldFilter');
  const searchInput = $('searchInput');
  const dialog = $('detailsDialog');
  let workshops = [];
  let selected = new Set();
  let sharedView = false;

  const palette = [
    ['#087f8f','#447d9a','#142e52'],
    ['#9270c8','#6763a3','#1a2d59'],
    ['#cb7d5c','#a16368','#332944'],
    ['#159e86','#4d9a8d','#193a52'],
    ['#c48a3d','#b47456','#39304d']
  ];

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (s) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }
  function colorFor(field) {
    let hash = 0;
    for (const char of field) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  }
  function artworkHTML(w) {
    const colors = colorFor(w.field);
    const drawings = {
      16:'<path d="M86 18v31m125-31v31" stroke="#deefff" stroke-width="3"/><path d="m86 56 8 18 20 2-15 14 4 20-17-10-17 10 4-20-15-14 20-2z" fill="#ffd38f"/><rect x="178" y="56" width="65" height="55" rx="14" fill="#d7f6f4" stroke="#fff" stroke-width="3"/><circle cx="194" cy="79" r="5" fill="#345376"/><circle cx="226" cy="79" r="5" fill="#345376"/><path d="M194 98q16 12 32 0" fill="none" stroke="#345376" stroke-width="3"/><path d="M211 55V41m-8 0h16" stroke="#fff" stroke-width="3"/>',
      17:'<path d="M98 69h-62v46h62zm166 0h-62v46h62z" fill="#b4dff7" stroke="#eafaff" stroke-width="4"/><path d="M67 69v46m-31-23h62m136-23v46m-32-23h62" stroke="#4a82a8" stroke-width="3"/><rect x="105" y="58" width="90" height="70" rx="13" fill="#ffe3a8" stroke="#fff" stroke-width="4"/><rect x="128" y="72" width="45" height="42" rx="6" fill="#a4d9d5"/><path d="M150 58V34m0 0 14-11" stroke="#f8fbff" stroke-width="4"/><circle cx="169" cy="21" r="6" fill="#f9dfb9"/>',
      18:'<path d="M89 48Q141 144 220 55" fill="none" stroke="#e1faff" stroke-width="9" stroke-linecap="round"/><path d="M112 72l46 46 47-57" fill="none" stroke="#bde2eb" stroke-width="6"/><path d="M158 119v30m-33 0h68" stroke="#fff0d8" stroke-width="8" stroke-linecap="round"/><path d="M198 54q14-19 31-17m-24 29q29-32 54-24" stroke="#ffe1a8" stroke-width="4" fill="none" stroke-linecap="round"/>',
      19:'<path d="M142 29h16l15 56-13 28h-20l-13-28z" fill="#e1faff" stroke="#fff" stroke-width="4"/><rect x="139" y="60" width="23" height="25" rx="5" fill="#72bace"/><path d="M127 91 102 115l35-7m36-17 25 24-35-7" fill="#ffc58b"/><path d="m140 115 10 35 10-35" fill="#ffdb86"/><path d="m147 117 3 42 3-42" fill="#fff2b9"/><circle cx="217" cy="132" r="22" fill="#ddb891" opacity=".65"/>',
      20:'<path d="m135 39 15-13 15 13 10 48-25 29-25-29z" fill="#eec99b" stroke="#ffecd6" stroke-width="4"/><circle cx="150" cy="67" r="12" fill="#75b5c6" stroke="#fff3df" stroke-width="3"/><path d="m125 84-18 31 30-11m38-20 18 31-30-11m-23 15 10 32 10-32" fill="#dba56e" stroke="#ffe1b2" stroke-width="3"/><path d="M217 52h-41m21-17v35" stroke="#d6f3ff" stroke-width="4"/>',
      21:'<circle cx="150" cy="61" r="32" fill="#ebfbff" stroke="#fff" stroke-width="5"/><path d="M127 50q20-21 46 0v17q-25 10-46-2z" fill="#71b7c7"/><path d="M132 98h36l21 44-16 12h-46l-16-12z" fill="#e2edf4" stroke="#fff" stroke-width="5"/><path d="m112 107-19 26m95-26 19 26m-73 15-9 18m50-18 9 18" stroke="#fff" stroke-width="13" stroke-linecap="round"/><rect x="141" y="115" width="18" height="14" rx="3" fill="#e7b477"/>',
      22:'<path d="M150 28 161 83l76 37-2 14-76-17-4 25 24 15-1 9-28-8-28 8-1-9 24-15-4-25-76 17-2-14 76-37z" fill="#e2f6fc" stroke="#fff" stroke-width="4"/><path d="M150 45v99" stroke="#6aaabc" stroke-width="3"/><circle cx="150" cy="92" r="5" fill="#ffcf90"/>',
      23:'<path d="M150 28v16m-8-14h16" stroke="#ffe0ab" stroke-width="5"/><rect x="105" y="50" width="90" height="58" rx="16" fill="#d6f4f0" stroke="#fff" stroke-width="4"/><circle cx="127" cy="77" r="9" fill="#276088"/><circle cx="173" cy="77" r="9" fill="#276088"/><path d="M131 96h38" stroke="#276088" stroke-width="4" stroke-linecap="round"/><path d="M105 116h90l-15 29h-60z" fill="#f9cf91"/><path d="m106 118-25 13 14 11-20 11m120-35 25 13-14 11 20 11m-99-8-15 12 18 10m43-22 15 12-18 10" stroke="#e2f5ff" stroke-width="6" fill="none" stroke-linejoin="round"/>'
    };
    const illustration = drawings[w.id];
    if (!illustration) return '<div class="artwork" style="--art-mid:' + colors[1] + ';--art-dark:' + colors[2] + '" aria-label="המחשה גרפית לעולם החלל"><span class="art-orbit"></span><span class="art-planet"></span><span class="art-spark">✦</span><span class="art-hint">המחשה גרפית</span></div>';
    return '<div class="artwork" style="--art-mid:' + colors[1] + ';--art-dark:' + colors[2] + '" aria-label="המחשה גרפית של ' + escapeHTML(w.title) + '">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 180" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true"><circle cx="75" cy="32" r="3" fill="#fff5ce"/><circle cx="249" cy="143" r="2" fill="#def7fa"/><circle cx="250" cy="38" r="2" fill="#fff5ce"/><ellipse cx="150" cy="97" rx="126" ry="66" transform="rotate(-18 150 97)" stroke="#e6f7ff4d" fill="none"/>' + illustration + '</svg><span class="art-hint">המחשה גרפית</span></div>';
  }
  function photoHTML(w, lazy) {
    const firstImage = w.imageFiles && w.imageFiles[0];
    if (!firstImage && !w.photo) return artworkHTML(w);
    const source = firstImage ? './media/' + encodeURIComponent(firstImage) : w.photo;
    return '<img src="' + escapeHTML(source) + '" data-workshop-id="' + w.id +
      '" alt="תמונת התוצר: ' + escapeHTML(w.title) + '"' + (lazy ? ' loading="lazy"' : '') + '>';
  }
  function useFallback(img, w) {
    if (w.photo && img.dataset.fallbackStage !== 'original') {
      img.dataset.fallbackStage = 'original';
      img.src = w.photo;
      return;
    }
    img.insertAdjacentHTML('afterend', artworkHTML(w));
    img.remove();
  }
  function handleBrokenPhotos(root) {
    root.querySelectorAll('img[data-workshop-id]').forEach((img) => {
      img.addEventListener('error', () => {
        const w = workshops.find((item) => item.id === Number(img.dataset.workshopId));
        if (w) useFallback(img, w);
      });
    });
  }
  function shownWorkshops() {
    const term = searchInput.value.trim().toLocaleLowerCase('he');
    const field = fieldFilter.value;
    return workshops.filter((w) =>
      (!sharedView || selected.has(w.id)) &&
      (!field || w.field === field) &&
      (!term || [w.title, w.lesson, w.product, w.field].some((part) => part.toLocaleLowerCase('he').includes(term)))
    );
  }
  function selectionLabel(n) {
    return n === 1 ? 'סדנה אחת נבחרה' : n + ' סדנאות נבחרו';
  }
  function renderCard(w) {
    const isSelected = selected.has(w.id);
    const c = colorFor(w.field);
    const article = document.createElement('article');
    article.className = 'workshop-card' + (isSelected ? ' is-selected' : '');
    article.style.setProperty('--accent', c[0]);
    article.innerHTML =
      '<div class="card-photo">' +
        photoHTML(w, true) +
        '<span class="card-index">' + String(w.id).padStart(2,'0') + '</span>' +
        '<label class="card-choice"><input type="checkbox" aria-label="בחירת הסדנה ' + escapeHTML(w.title) + '"' + (isSelected ? ' checked' : '') + '> <span>לכלול בקטלוג</span></label>' +
      '</div>' +
      '<div class="card-body">' +
        '<span class="card-category">' + escapeHTML(w.field) + '</span>' +
        '<h3 class="card-title">' + escapeHTML(w.title) + '</h3>' +
        '<p class="card-lead">' + escapeHTML(w.lesson) + '</p>' +
        '<div class="card-product"><strong>התוצר שבונים</strong><span>' + escapeHTML(w.product) + '</span></div>' +
        '<div class="card-meta"><span>כיתות ג׳–ה׳</span><span>60 דקות</span></div>' +
        '<div class="card-footer"><button class="details-button" type="button" aria-label="פרטים מלאים על ' + escapeHTML(w.title) + '">לפרטי הסדנה המלאים ←</button><small>מדע · יצירה · התנסות</small></div>' +
      '</div>';
    article.querySelector('input').addEventListener('change', (event) => {
      if (event.target.checked) selected.add(w.id);
      else selected.delete(w.id);
      render();
    });
    article.querySelector('.details-button').addEventListener('click', () => openDetails(w));
    return article;
  }
  function render() {
    const shown = shownWorkshops();
    grid.replaceChildren(...shown.map(renderCard));
    $('emptyState').hidden = shown.length !== 0;
    $('resultCount').textContent = 'מוצגות ' + shown.length + ' מתוך ' + (sharedView ? selected.size : workshops.length);
    $('selectedCount').textContent = selectionLabel(selected.size);
    $('selectedCountTop').textContent = selectionLabel(selected.size);
    $('printButton').disabled = selected.size === 0;
    $('shareButton').disabled = selected.size === 0;
    $('selectVisible').disabled = shown.length === 0;
    handleBrokenPhotos(grid);
  }
  function resetFilters() {
    searchInput.value = '';
    fieldFilter.value = '';
    render();
  }
  function openDetails(w) {
    const isSelected = selected.has(w.id);
    const c = colorFor(w.field);
    $('dialogContent').innerHTML =
      '<div class="dialog-cover">' + photoHTML(w, false) + '</div>' +
      '<div class="dialog-body" style="--accent:' + c[0] + '">' +
        '<p class="card-category">' + escapeHTML(w.field) + '</p>' +
        '<h2 id="dialogTitle">' + escapeHTML(w.title) + '</h2>' +
        '<div class="dialog-meta"><span>כיתות ג׳–ה׳</span><span>משך הסדנה: 60 דקות</span><span>תוצר אישי</span></div>' +
        '<section class="dialog-block"><h3>מה לומדים בסדנה?</h3><p>' + escapeHTML(w.lesson) + '</p></section>' +
        '<section class="dialog-block"><h3>מה התלמידים יוצרים?</h3><p>' + escapeHTML(w.product) + '</p></section>' +
        (sharedView ? '' : '<div class="dialog-actions"><button id="toggleDialogSelection" type="button" class="button ' + (isSelected ? 'button-secondary' : 'button-primary') + '">' + (isSelected ? 'הסרה מהקטלוג' : 'הוספה לקטלוג') + '</button></div>') +
      '</div>';
    if (!sharedView) {
      $('toggleDialogSelection').addEventListener('click', () => {
        if (selected.has(w.id)) selected.delete(w.id);
        else selected.add(w.id);
        dialog.close();
        render();
      });
    }
    dialog.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => useFallback(img, w));
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function printItem(w) {
    return '<article class="print-item">' +
      '<div class="print-item-visual">' + photoHTML(w, false) + '</div>' +
      '<div class="print-item-body">' +
        '<div class="print-item-topline">סדנה ' + String(w.id).padStart(2, '0') + ' / ' + escapeHTML(w.field) + '</div>' +
        '<h2>' + escapeHTML(w.title) + '</h2>' +
        '<div class="print-brief"><span>כיתות ג׳–ה׳</span><span>60 דקות</span></div>' +
        '<h3>על השיעור</h3><p>' + escapeHTML(w.lesson) + '</p>' +
        '<h3>על התוצר</h3><p>' + escapeHTML(w.product) + '</p>' +
      '</div></article>';
  }
  function buildPrint() {
    const items = workshops.filter((w) => selected.has(w.id));
    const groups = [];
    for (let i = 0; i < items.length; i += 2) groups.push(items.slice(i, i + 2));
    const uniqueFields = new Set(items.map((w) => w.field)).size;
    const cover = '<section class="print-cover">' +
      '<div class="print-mark">תעשיידע | קטלוג סדנאות</div>' +
      '<h1>יוצאים לגלות.<br><em>חוזרים עם משהו שבנינו.</em></h1>' +
      '<p>סדנאות STEM בהשראת עולם החלל: למידה מדעית, חקר והתנסות יוצרת.</p>' +
      '<div class="print-summary">' + items.length + ' סדנאות נבחרות · ' + uniqueFields + ' תחומי תוכן · כיתות ג׳–ה׳ · 60 דקות לסדנה</div>' +
      '<div class="print-footer">תעשיידע — תעשייה למען חינוך מתקדם (ע״ר)</div>' +
      '</section>';
    const pages = groups.map((group, i) =>
      '<section class="print-page"><header class="print-page-head"><span>סדנאות חלל | תעשיידע</span><small>סדנאות לבחירה · כיתות ג׳–ה׳</small></header>' +
      '<div class="print-items">' + group.map(printItem).join('') + '</div>' +
      '<footer class="print-page-foot"><span>מדע · יצירה · התנסות</span><span>' + (i + 2) + ' / ' + (groups.length + 1) + '</span></footer></section>'
    ).join('');
    $('printRoot').innerHTML = cover + pages;
    $('printRoot').querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => {
        const w = workshops.find((v) => v.id === Number(img.dataset.workshopId));
        if (w) useFallback(img, w);
      });
    });
  }
  function selectedIDs() {
    return workshops.filter((w) => selected.has(w.id)).map((w) => w.id);
  }
  function shareURL() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    const ids = selectedIDs();
    const isAll = ids.length === workshops.length;
    // Compact, stable selection: at most 23 bits encoded as base36.
    const mask = ids.reduce((bits, id) => bits | (1 << (id - 1)), 0);
    url.searchParams.set('s', isAll ? 'all' : 'x' + mask.toString(36));
    return url.toString();
  }
  function defaultWhatsAppIntro(count) {
    const number = count === 1 ? 'סדנה אחת' : count + ' סדנאות';
    return 'שלום,\n\nמצורף קטלוג דיגיטלי של סדנאות החלל של תעשיידע, המיועדות לתלמידי כיתות ג׳–ה׳.\n\nבקטלוג מוצגות ' + number + ' שנבחרו עבורכם. הסדנאות משלבות למידה מדעית, התנסות חווייתית ויצירת תוצר אישי. בקישור תוכלו להכיר את התוכן הלימודי ואת התוצר בכל סדנה.\n\nנשמח לסייע בבחירת הסדנאות המתאימות.\nצוות תעשיידע';
  }
  function fullWhatsAppMessage() {
    const introduction = $('shareMessage').value.trim();
    const linkLine = 'לצפייה בקטלוג הדיגיטלי:\n' + $('shareLink').value;
    return introduction ? introduction + '\n\n' + linkLine : linkLine;
  }
  function refreshWhatsAppLink() {
    $('sendWhatsApp').href = 'https://wa.me/?text=' + encodeURIComponent(fullWhatsAppMessage());
  }
  function openShareDialog() {
    if (!selected.size || sharedView) return;
    const url = shareURL();
    $('shareLink').value = url;
    $('shareMessage').value = defaultWhatsAppIntro(selected.size);
    $('shareDescription').textContent = (selected.size === 1 ? 'נוצר קישור המציג סדנה אחת בלבד.' : 'נוצר קישור המציג ' + selected.size + ' סדנאות בלבד.') + ' אפשר לערוך את נוסח ההודעה לפני השליחה.';
    $('previewShareLink').href = url;
    $('shareFeedback').textContent = '';
    refreshWhatsAppLink();
    const shareDialog = $('shareDialog');
    if (typeof shareDialog.showModal === 'function') shareDialog.showModal();
    else shareDialog.setAttribute('open', '');
  }
  async function copyText(value, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('copy denied');
      }
      $('shareFeedback').textContent = successMessage;
    } catch (_) {
      $('shareFeedback').textContent = 'ההעתקה לא הצליחה. אפשר לסמן ולהעתיק את הטקסט ידנית.';
    }
  }
  function activateRecipientView() {
    const raw = new URLSearchParams(window.location.search).get('s');
    // Accept old comma-separated links as well as the compact new format.
    // Invalid links return to the editable, unfiltered catalog.
    if (!raw) return;
    const available = new Set(workshops.map((w) => w.id));
    let linkedIDs;
    if (raw === 'all') {
      linkedIDs = new Set(available);
    } else if (/^x[0-9a-z]{1,6}$/.test(raw)) {
      const mask = parseInt(raw.slice(1), 36);
      const validMask = workshops.reduce((bits, w) => bits | (1 << (w.id - 1)), 0);
      if (mask <= 0 || (mask & ~validMask) !== 0) return;
      linkedIDs = new Set(workshops.filter((w) => (mask & (1 << (w.id - 1))) !== 0).map((w) => w.id));
    } else if (/^\d{1,2}(,\d{1,2}){0,22}$/.test(raw)) {
      linkedIDs = new Set(raw.split(',').map(Number).filter((id) => available.has(id)));
    } else {
      return;
    }
    if (linkedIDs.size === 0) return;
    selected = linkedIDs;
    sharedView = true;
    document.body.classList.add('shared-view');
    $('sharedBanner').hidden = false;
    $('sharedBannerTitle').textContent = linkedIDs.size === 1 ? 'קטלוג דיגיטלי: סדנה אחת שנבחרה עבורכם' : 'קטלוג דיגיטלי: ' + linkedIDs.size + ' סדנאות שנבחרו עבורכם';
    $('catalogTitle').textContent = 'הסדנאות שנבחרו עבורכם';
    $('catalogDescription').textContent = 'עיינו בסדנאות ולחצו על כל כרטיס לקבלת פרטים מלאים על השיעור ועל התוצר.';
    document.title = 'קטלוג סדנאות חלל נבחרות | תעשיידע';
  }
  async function start() {
    try {
      const response = await fetch('./data.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('הקובץ לא נטען (' + response.status + ')');
      const data = await response.json();
      if (!Array.isArray(data.workshops)) throw new Error('מבנה נתונים לא תקין');
      workshops = data.workshops;
      selected = new Set(workshops.map((w) => w.id));
      activateRecipientView();
      $('workshopTotal').textContent = String(sharedView ? selected.size : workshops.length);
      $('workshopTotalLabel').textContent = sharedView ? 'סדנאות בקטלוג' : 'סדנאות לבחירה';
      [...new Set(workshops.filter((w) => !sharedView || selected.has(w.id)).map((w) => w.field))].sort((a,b)=>a.localeCompare(b,'he'))
        .forEach((field) => fieldFilter.add(new Option(field, field)));
      render();
    } catch (error) {
      $('resultCount').textContent = 'אירעה תקלה בטעינת הקטלוג';
      $('emptyState').hidden = false;
      $('emptyState').querySelector('strong').textContent = 'לא ניתן לטעון את נתוני הסדנאות.';
      $('emptyState').querySelector('p').textContent = 'נא לרענן את העמוד. ' + error.message;
      $('resetEmpty').hidden = true;
      console.error(error);
    }
  }
  searchInput.addEventListener('input', render);
  fieldFilter.addEventListener('change', render);
  $('resetFilters').addEventListener('click', resetFilters);
  $('resetEmpty').addEventListener('click', resetFilters);
  $('selectVisible').addEventListener('click', () => {
    shownWorkshops().forEach((w) => selected.add(w.id)); render();
  });
  $('clearSelection').addEventListener('click', () => { selected.clear(); render(); });
  function printSelection() {
    if (!selected.size) return;
    buildPrint();
    window.print();
  }
  $('printButton').addEventListener('click', printSelection);
  $('sharedPrintButton').addEventListener('click', printSelection);
  $('shareButton').addEventListener('click', openShareDialog);
  $('shareMessage').addEventListener('input', () => {
    $('shareFeedback').textContent = '';
    refreshWhatsAppLink();
  });
  $('copyShareLink').addEventListener('click', () => copyText($('shareLink').value, 'הקישור הדיגיטלי הועתק.'));
  $('copyShareText').addEventListener('click', () => copyText(fullWhatsAppMessage(), 'ההודעה עם הקישור הועתקה.'));
  $('closeShareDialog').addEventListener('click', () => $('shareDialog').close());
  $('shareDialog').addEventListener('click', (event) => {
    if (event.target === $('shareDialog')) $('shareDialog').close();
  });
  window.addEventListener('beforeprint', () => { if (workshops.length) buildPrint(); });
  $('closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  start();
})();