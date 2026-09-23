/* STDHub web — Research: Brave web search + AI summary. Needs key + net. */
'use strict';

const SearchView = {
  busy: false,
  el: null,
  ui: {},

  title: function () { return I18n.t('app.research'); },

  mount: function (el) {
    this.el = el;
    el.innerHTML =
      '<div class="chat-wrap"><div class="chat-log" data-log></div>' +
      '<form class="chat-form" data-form><input data-input /><button class="btn btn-primary" data-send></button></form></div>';
    this.ui = {
      log: el.querySelector('[data-log]'),
      form: el.querySelector('[data-form]'),
      input: el.querySelector('[data-input]'),
      send: el.querySelector('[data-send]'),
    };
    this.ui.input.placeholder = I18n.t('app.searchPlaceholder');
    this.ui.input.setAttribute('aria-label', I18n.t('app.searchPlaceholder'));
    this.ui.send.textContent = I18n.t('app.search');
    this.ui.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.search(this.ui.input.value.trim());
    });
  },

  onLang: function () {
    if (!this.el) return;
    this.ui.input.placeholder = I18n.t('app.searchPlaceholder');
    this.ui.send.textContent = I18n.t('app.search');
  },

  say: function (cls, text, isHtml) {
    const d = document.createElement('div');
    d.className = cls;
    if (isHtml) d.innerHTML = text;
    else d.textContent = text;
    this.ui.log.appendChild(d);
    this.ui.log.scrollTop = this.ui.log.scrollHeight;
    return d;
  },

  esc: function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  search: async function (q) {
    if (!q || this.busy) return;
    const key = Store.get('braveKey');
    if (!key) {
      this.say('chat-msg sys', I18n.t('app.needKey'));
      return;
    }
    this.busy = true;
    let results = [];
    try {
      const res = await fetch(
        'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) + '&count=5',
        { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      results = (data.web && data.web.results) || [];
    } catch (e) {
      this.say('chat-msg sys', e.message === 'Failed to fetch' || e.name === 'TypeError'
        ? I18n.t('app.offline')
        : String(e.message || e));
      this.busy = false;
      return;
    }
    if (!results.length) {
      this.say('chat-msg sys', '0 results');
      this.busy = false;
      return;
    }
    results.forEach((r) => {
      this.say('search-hit', '<a href="' + this.esc(r.url) + '" target="_blank" rel="noreferrer">' +
        this.esc(r.title || r.url) + '</a><p>' + this.esc(r.description || '') + '</p>', true);
    });
    const summaryBox = this.say('search-summary', I18n.t('app.summarizing'));
    try {
      const context = results.map((r, i) => '[' + (i + 1) + '] ' + r.title + ' — ' + (r.description || '')).join('\n');
      const out = await AI.chat([
        { role: 'system', content: 'Summarize these web results briefly in the student language, citing [1], [2]...' },
        { role: 'user', content: q + '\n\n' + context },
      ]);
      summaryBox.textContent = out;
    } catch (e) {
      summaryBox.textContent = e.message === 'offline' ? I18n.t('app.offline') : String(e.message || e);
    }
    this.busy = false;
    this.ui.log.scrollTop = this.ui.log.scrollHeight;
  },
};

window.SearchView = SearchView;
