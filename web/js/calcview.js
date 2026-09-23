/* STDHub web — calculator view (keypad + history). Classic script. */
'use strict';

const CalcView = {
  expr: '',
  hist: [],
  sci: false,
  el: null,
  ui: {},

  title: function () { return I18n.t('app.calculator'); },

  mount: function (el) {
    this.el = el;
    el.innerHTML =
      '<div class="calc-wrap">' +
      '<div class="calc-preview" data-preview></div>' +
      '<div class="calc-display" data-display role="textbox" aria-label="expression">0</div>' +
      '<div class="calc-grid" data-grid></div>' +
      '<div><button class="btn btn-ghost btn-sm" data-sci>ƒx Scientific</button></div>' +
      '<div class="calc-hist" data-hist></div>' +
      '</div>';
    this.ui = {
      display: el.querySelector('[data-display]'),
      preview: el.querySelector('[data-preview]'),
      grid: el.querySelector('[data-grid]'),
      hist: el.querySelector('[data-hist]'),
      sci: el.querySelector('[data-sci]'),
    };
    this.ui.sci.addEventListener('click', () => {
      this.sci = !this.sci;
      this.renderKeys();
    });
    this.renderKeys();
    this.render();
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.commit(); }
      else if (e.key === 'Backspace') { this.expr = this.expr.slice(0, -1); this.render(); }
      else if (/^[0-9+\-*/%^().!]$/.test(e.key)) { this.expr += e.key; this.render(); }
    });
    el.tabIndex = 0;
  },

  keys: function () {
    const base = ['C', '⌫', '%', '/',
      '7', '8', '9', '*',
      '4', '5', '6', '-',
      '1', '2', '3', '+',
      '0', '.', '(', ')'];
    if (this.sci) {
      return ['sin(', 'cos(', 'tan(', '^',
        'sqrt(', 'log(', 'ln(', '!',
        'pi', 'e', '(', ')'].concat(base);
    }
    return base;
  },

  renderKeys: function () {
    const g = this.ui.grid;
    g.innerHTML = '';
    this.keys().forEach((k) => {
      const b = document.createElement('button');
      b.textContent = k;
      if ('/*-+^%'.includes(k)) b.className = 'op';
      b.addEventListener('click', () => this.press(k));
      g.appendChild(b);
    });
    const eq = document.createElement('button');
    eq.textContent = '=';
    eq.className = 'eq';
    eq.setAttribute('aria-label', '=');
    eq.addEventListener('click', () => this.commit());
    g.appendChild(eq);
  },

  press: function (k) {
    if (k === 'C') this.expr = '';
    else if (k === '⌫') this.expr = this.expr.slice(0, -1);
    else if (k === '%') this.expr += '/100';
    else this.expr += k;
    this.render();
  },

  preview: function () {
    if (!this.expr.trim()) return '';
    try {
      return Calc.formatResult(Calc.evaluate(this.expr));
    } catch (e) {
      return '';
    }
  },

  render: function () {
    if (!this.el) return;
    this.ui.display.textContent = this.expr || '0';
    this.ui.preview.textContent = this.preview();
    const h = this.ui.hist;
    h.innerHTML = '';
    this.hist.slice(-6).reverse().forEach((row) => {
      const d = document.createElement('div');
      d.className = 'calc-hist-row';
      const a = document.createElement('span');
      a.textContent = row[0];
      const b = document.createElement('strong');
      b.textContent = '= ' + row[1];
      d.append(a, b);
      h.appendChild(d);
    });
  },

  commit: function () {
    const out = this.preview();
    if (out === '') return;
    this.hist.push([this.expr, out]);
    this.expr = out;
    this.render();
  },

  onLang: function () { if (this.el) this.render(); },
};

window.CalcView = CalcView;
