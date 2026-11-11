(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const grid = $('cardsGrid');
  const fieldFilter = $('fieldFilter');
  const searchInput = $('searchInput');
  const dialog = $('detailsDialog');
  let workshops = [];
  let selected = new Set();

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
    return '<div class="artwork" style="--art-mid:' + colors[1] + ';--art-dark:' + colors[2] + '" aria-label="המחשה גרפית לעולם החלל">' +
      '<span class="art-orbit"></span><span class="art-planet"></span><span class="art-spark" aria-hidden="true">✦</span><span class="art-hint">המחשה גרפית</span></div>';
  }
  function photoHTML(w, lazy) {
    return w.photo
      ? '<img src="' + escapeHTML(w.photo) + '" alt="תמונת המחשה של התוצר: ' + escapeHTML(w.title) + '"' + (lazy ? ' loading="lazy"' : '') + '>'
      : artworkHTML(w);
  }
  function handleBrokenPhotos(root) {
    root.querySelectorAll('img[src*="/summer/image/"]').forEach((img) => {
      img.addEventListener('error', () => {
        const w = workshops.find((item) => item.id === Number(img.dataset.workshopId));
        if (w) {
          img.insertAdjacentHTML('afterend', artworkHTML(w));
          img.remove();
        }
      }, { once: true });
    });
  }
  function shownWorkshops() {
    const term = searchInput.value.trim().toLocaleLowerCase('he');
    const field = fieldFilter.value;
    return workshops.filter((w) =>
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
    $('resultCount').textContent = 'מוצגות ' + shown.length + ' מתוך ' + workshops.length;
    $('selectedCount').textContent = selectionLabel(selected.size);
    $('selectedCountTop').textContent = selectionLabel(selected.size);
    $('printButton').disabled = selected.size === 0;
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
        '<div class="dialog-actions"><button id="toggleDialogSelection" type="button" class="button ' + (isSelected ? 'button-secondary' : 'button-primary') + '">' + (isSelected ? 'הסרה מהקטלוג' : 'הוספה לקטלוג') + '</button></div>' +
      '</div>';
    $('toggleDialogSelection').addEventListener('click', () => {
      if (selected.has(w.id)) selected.delete(w.id);
      else selected.add(w.id);
      dialog.close();
      render();
    });
    dialog.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => {
        img.insertAdjacentHTML('afterend', artworkHTML(w));
        img.remove();
      }, { once: true });
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
        const item = img.closest('.print-item');
        const index = item ? Number(item.querySelector('.print-item-topline').textContent.match(/\d+/)?.[0]) : NaN;
        const w = workshops.find((v) => v.id === index);
        if (w) {
          img.insertAdjacentHTML('afterend', artworkHTML(w));
          img.remove();
        }
      }, { once:true });
    });
  }
  async function start() {
    try {
      const response = await fetch('./data.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('הקובץ לא נטען (' + response.status + ')');
      const data = await response.json();
      if (!Array.isArray(data.workshops)) throw new Error('מבנה נתונים לא תקין');
      workshops = data.workshops;
      selected = new Set(workshops.map((w) => w.id));
      $('workshopTotal').textContent = String(workshops.length);
      [...new Set(workshops.map((w) => w.field))].sort((a,b)=>a.localeCompare(b,'he'))
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
  $('printButton').addEventListener('click', () => {
    if (!selected.size) return;
    buildPrint();
    window.print();
  });
  window.addEventListener('beforeprint', () => { if (workshops.length) buildPrint(); });
  $('closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  start();
})();