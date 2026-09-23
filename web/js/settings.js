/* STDHub web — settings modal + AI connection test. Classic script. */
'use strict';

const SettingsView = {
  dlg: null,

  openModal: function () {
    if (!this.dlg) this.build();
    this.sync();
    this.dlg.showModal();
  },

  build: function () {
    const dlg = document.createElement('dialog');
    dlg.className = 'web-modal wide';
    dlg.innerHTML =
      '<form method="dialog" class="modal-stack" data-form>' +
      '<h3 data-title style="margin:0"></h3>' +
      '<label class="set-row"><span data-l-theme></span><div class="set-line">' +
      '<button type="button" class="btn btn-outline btn-sm" data-theme-dark></button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-theme-light></button></div></label>' +
      '<label class="set-row"><span data-l-lang></span><div class="set-line">' +
      '<button type="button" class="btn btn-outline btn-sm" data-lang-pt>Português</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-lang-en>English</button></div></label>' +
      '<div class="set-row"><span data-l-ai></span>' +
      '<label class="small muted" data-l-preset></label><select data-ai-preset>' +
      '<option value="pollinations"></option><option value="openai"></option></select>' +
      '<label class="small muted" data-l-base></label><input data-ai-base />' +
      '<label class="small muted" data-l-model></label><input data-ai-model />' +
      '<label class="small muted" data-l-key></label><input data-ai-key type="password" autocomplete="off" />' +
      '<div class="set-line"><button type="button" class="btn btn-outline btn-sm" data-ai-test></button>' +
      '<span class="small muted" data-ai-msg></span></div></div>' +
      '<label class="set-row"><span data-l-brave></span><input data-brave-key type="password" autocomplete="off" /></label>' +
      '<div class="set-line"><button type="button" class="btn btn-outline btn-sm" data-clear></button>' +
      '<span class="small muted" data-saved></span></div>' +
      '<div class="modal-actions"><button class="btn btn-primary btn-sm" value="ok" data-done>OK</button></div>' +
      '</form>';
    document.body.appendChild(dlg);
    this.dlg = dlg;
    const q = (s) => dlg.querySelector(s);
    q('[data-theme-dark]').addEventListener('click', () => { Store.set('theme', 'dark'); Store.applyTheme(); });
    q('[data-theme-light]').addEventListener('click', () => { Store.set('theme', 'light'); Store.applyTheme(); });
    q('[data-lang-pt]').addEventListener('click', () => this.setLang('pt'));
    q('[data-lang-en]').addEventListener('click', () => this.setLang('en'));
    q('[data-ai-preset]').addEventListener('change', (e) => {
      const v = e.target.value;
      Store.set('aiPreset', v);
      if (v === 'pollinations') {
        Store.set('aiBaseUrl', 'https://text.pollinations.ai/openai');
        Store.set('aiModel', 'openai');
        Store.set('aiKey', '');
      }
      this.sync();
    });
    ['aiBaseUrl', 'aiModel', 'aiKey', 'braveKey'].forEach((k) => {
      const map = { aiBaseUrl: '[data-ai-base]', aiModel: '[data-ai-model]', aiKey: '[data-ai-key]', braveKey: '[data-brave-key]' };
      q(map[k]).addEventListener('change', (e) => {
        Store.set(k, e.target.value);
        this.flashSaved();
      });
    });
    q('[data-ai-test]').addEventListener('click', () => this.testAi());
    q('[data-clear]').addEventListener('click', () => {
      Store.clear();
      I18n.setLang(Store.get('lang'));
      q('[data-saved]').textContent = I18n.t('app.cleared');
      this.sync();
      App.refreshTexts();
    });
  },

  setLang: function (lang) {
    Store.set('lang', lang);
    I18n.setLang(lang);
    this.sync();
    App.refreshTexts();
  },

  sync: function () {
    if (!this.dlg) return;
    const q = (s) => this.dlg.querySelector(s);
    q('[data-title]').textContent = I18n.t('app.settings');
    q('[data-l-theme]').textContent = I18n.t('app.theme');
    q('[data-theme-dark]').textContent = I18n.t('app.dark');
    q('[data-theme-light]').textContent = I18n.t('app.light');
    q('[data-l-lang]').textContent = I18n.t('app.language');
    q('[data-l-ai]').textContent = I18n.t('app.aiTitle');
    q('[data-l-preset]').textContent = I18n.t('app.aiPreset');
    q('[data-ai-preset] option[value="pollinations"]').textContent = I18n.t('app.pollinations');
    q('[data-ai-preset] option[value="openai"]').textContent = I18n.t('app.openai');
    q('[data-l-base]').textContent = I18n.t('app.aiBaseUrl');
    q('[data-l-model]').textContent = I18n.t('app.aiModel');
    q('[data-l-key]').textContent = I18n.t('app.aiKey');
    q('[data-ai-test]').textContent = I18n.t('app.aiTest');
    q('[data-l-brave]').textContent = I18n.t('app.braveKey');
    q('[data-clear]').textContent = I18n.t('app.clearData');
    q('[data-ai-preset]').value = Store.get('aiPreset');
    q('[data-ai-base]').value = Store.get('aiBaseUrl');
    q('[data-ai-model]').value = Store.get('aiModel');
    q('[data-ai-key]').value = Store.get('aiKey');
    q('[data-brave-key]').value = Store.get('braveKey');
    q('[data-ai-msg]').textContent = '';
    q('[data-saved]').textContent = '';
  },

  flashSaved: function () {
    if (!this.dlg) return;
    this.dlg.querySelector('[data-saved]').textContent = I18n.t('app.saved');
  },

  testAi: async function () {
    const q = (s) => this.dlg.querySelector(s);
    q('[data-ai-msg]').textContent = '...';
    try {
      const out = await AI.chat(
        [{ role: 'user', content: 'Reply with exactly: ok' }],
        { model: Store.get('aiModel'), baseUrl: Store.get('aiBaseUrl'), key: Store.get('aiKey') },
      );
      q('[data-ai-msg]').textContent = I18n.t('app.aiTestOk') + ' (' + out.slice(0, 40) + ')';
    } catch (e) {
      q('[data-ai-msg]').textContent = e.message === 'offline'
        ? I18n.t('app.offline')
        : I18n.t('app.aiTestFail', { message: String(e.message || e).slice(0, 120) });
    }
  },
};

window.SettingsView = SettingsView;
