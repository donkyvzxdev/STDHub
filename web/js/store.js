/* STDHub web — settings + theme, persisted in localStorage. */
'use strict';

const Store = {
  KEY: 'stdhub.web.settings',
  data: null,
  defaults: function () {
    return {
      theme: 'dark',
      lang: 'pt',
      aiPreset: 'openai',
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-4o-mini',
      aiKey: '',
      braveKey: '',
    };
  },
  load: function () {
    try {
      const raw = window.localStorage.getItem(this.KEY);
      this.data = Object.assign(this.defaults(), raw ? JSON.parse(raw) : {});
    } catch (e) {
      this.data = this.defaults();
    }
    return this.data;
  },
  save: function () {
    try {
      window.localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) { /* private mode — session only */ }
  },
  get: function (k) { return this.data[k]; },
  set: function (k, v) { this.data[k] = v; this.save(); },
  applyTheme: function () {
    document.documentElement.setAttribute('data-theme', this.data.theme === 'light' ? 'light' : 'dark');
  },
  clear: function () {
    try {
      Object.keys(window.localStorage)
        .filter(function (k) { return k.indexOf('stdhub.web.') === 0; })
        .forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
    this.data = this.defaults();
    this.applyTheme();
  },
};

window.Store = Store;
