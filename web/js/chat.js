/* STDHub web — Tutor chat view. Classic script. */
'use strict';

const ChatView = {
  msgs: [],
  busy: false,
  el: null,
  ui: {},

  title: function () { return I18n.t('app.tutor'); },

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
    this.ui.input.placeholder = I18n.t('app.askPlaceholder');
    this.ui.input.setAttribute('aria-label', I18n.t('app.askPlaceholder'));
    this.ui.send.textContent = I18n.t('app.send');
    this.ui.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.ask(this.ui.input.value.trim());
    });
    this.render();
  },

  onLang: function () {
    if (!this.el) return;
    this.ui.input.placeholder = I18n.t('app.askPlaceholder');
    this.ui.send.textContent = I18n.t('app.send');
  },

  push: function (role, text) {
    this.msgs.push({ role: role, text: text });
    this.render();
  },

  render: function () {
    if (!this.el) return;
    const log = this.ui.log;
    log.innerHTML = '';
    this.msgs.forEach((m) => {
      const d = document.createElement('div');
      d.className = 'chat-msg ' + m.role;
      d.textContent = m.text;
      log.appendChild(d);
    });
    log.scrollTop = log.scrollHeight;
  },

  ask: async function (text) {
    if (!text || this.busy) return;
    this.ui.input.value = '';
    this.push('user', text);
    const needsKey = Store.get('aiPreset') !== 'pollinations' && !Store.get('aiKey');
    if (needsKey) {
      this.push('sys', I18n.t('app.needKey'));
      return;
    }
    this.busy = true;
    this.push('ai', I18n.t('app.thinking'));
    try {
      const out = await AI.chat([
        { role: 'system', content: AI.tutorSystem() },
        { role: 'user', content: text },
      ]);
      this.msgs[this.msgs.length - 1] = { role: 'ai', text: out };
    } catch (e) {
      this.msgs[this.msgs.length - 1] = {
        role: 'sys',
        text: e.message === 'offline' ? I18n.t('app.offline') : String(e.message || e),
      };
    }
    this.busy = false;
    this.render();
  },
};

window.ChatView = ChatView;
