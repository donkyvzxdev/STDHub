/* STDHub web — StudyMD parser + HTML renderer, ported from app/src/lib/stmd.ts
   and app/src/components/editor/StudyNotebook.tsx. Pure JS, no dependencies.
   All text is HTML-escaped; only http(s)/mailto links become <a>. */
'use strict';

function isStmdFile(name) {
  return name.toLowerCase().endsWith('.stmd');
}

function ensureStudyExtension(name) {
  const trimmed = name.trim().replace(/\.+$/, '');
  if (trimmed === '' || trimmed.startsWith('.')) {
    return trimmed === '' ? name : trimmed;
  }
  const dot = trimmed.lastIndexOf('.');
  if (dot > 0 && dot < trimmed.length - 1) return trimmed;
  return trimmed + '.stmd';
}

function drawingMarkdown(dataUrl, alt) {
  return '![' + (alt || 'desenho') + '](' + dataUrl + ')';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------- calc symbols ---------------- */

function normalizeCalcSymbols(expr) {
  let out = expr;
  out = out.replace(/√/g, 'sqrt');
  out = out.replace(/\braiz\s+quadrada\s+de\s+/gi, 'sqrt ');
  out = out.replace(/\braiz\s+quadrada\s+/gi, 'sqrt ');
  out = out.replace(/\braiz\s+de\s+/gi, 'sqrt ');
  out = out.replace(/\braiz\b/gi, 'sqrt');
  out = out.replace(/\bsqrt\b/gi, 'sqrt');
  out = out.replace(/sqrt\s+\(/g, 'sqrt(');
  out = out.replace(/sqrt(\d+(?:\.\d+)?)/g, 'sqrt($1)');
  out = out.replace(/sqrt\s+(\d+(?:\.\d+)?)/g, 'sqrt($1)');
  return out;
}

function evaluateStdCalc(rawExpr) {
  const expr = rawExpr.trim();
  if (expr === '') return { display: '', result: null };
  try {
    const result = Calc.formatResult(Calc.evaluate(normalizeCalcSymbols(expr)));
    return { display: expr + ' = ' + result, result: result };
  } catch (e) {
    return { display: expr + ' = ?', result: null };
  }
}

/* ---------------- inline markers ---------------- */

const STD_CLOSED_RE = /#std([A-Za-z]+)\s+([^\n]*?)\s*\/std\1/gi;
const STD_CALC_EQ_RE = /#stdcalc\s+([^\n]*?)\s*=\s*$/gi;

function overlaps(ranges, start, end) {
  return ranges.some(function (r) { return start < r[1] && end > r[0]; });
}

function findStdMarkersInLine(line, lineNo) {
  const out = [];
  const used = [];
  STD_CLOSED_RE.lastIndex = 0;
  let m;
  while ((m = STD_CLOSED_RE.exec(line))) {
    if (m.index > 0 && line[m.index - 1] === '\\') continue;
    const func = m[1].toLowerCase();
    if (func !== 'calc' && func !== 'marker') continue;
    let inner = m[2].trim();
    if (func === 'calc') inner = inner.replace(/\s*=\s*$/, '').trim();
    if (inner === '') continue;
    const start = m.index;
    const end = start + m[0].length;
    used.push([start, end]);
    if (func === 'calc') {
      const calc = evaluateStdCalc(inner);
      out.push({ func: func, inner: inner, start: start, end: end, line: lineNo, display: calc.display, tone: calc.result === null ? 'error' : 'calc' });
    } else {
      out.push({ func: func, inner: inner, start: start, end: end, line: lineNo, display: inner, tone: 'marker' });
    }
  }
  STD_CALC_EQ_RE.lastIndex = 0;
  while ((m = STD_CALC_EQ_RE.exec(line))) {
    if (m.index > 0 && line[m.index - 1] === '\\') continue;
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(used, start, end)) continue;
    const inner = m[1].replace(/\s*=\s*$/, '').trim();
    if (inner === '') continue;
    used.push([start, end]);
    const calc = evaluateStdCalc(inner);
    out.push({ func: 'calc', inner: inner, start: start, end: end, line: lineNo, display: calc.display, tone: calc.result === null ? 'error' : 'calc' });
  }
  return out;
}

function findStdMarkers(source) {
  const out = [];
  source.split('\n').forEach(function (line, i) {
    findStdMarkersInLine(line, i).forEach(function (mk) { out.push(mk); });
  });
  return out;
}

/* ---------------- inline tokens ---------------- */

const INLINE_RE = /(`[^`\n]+`)|(!\[[^\]\n]*\]\([^)\s\n]+\))|(\[[^\]\n]+\]\([^)\s\n]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(==[^=\n]+==)|(\+\+[^+\n]+\+\+)|(\$[^$\n]+\$)/g;

function splitMedia(full) {
  const closeBracket = full.indexOf('](');
  const inner = full.slice(full.startsWith('!') ? 2 : 1, closeBracket);
  const target = full.slice(closeBracket + 2, -1);
  if (full.startsWith('!')) return { alt: inner, src: target };
  return { text: inner, href: target };
}

function tokenizePlain(text) {
  const out = [];
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    last = m.index + m[0].length;
    const parts = m.slice(1);
    const code = parts[0], image = parts[1], link = parts[2];
    const strongStars = parts[3], strongUnder = parts[4];
    const emStar = parts[5], emUnder = parts[6];
    const strike = parts[7], mark = parts[8], underline = parts[9], math = parts[10];
    if (code) out.push({ kind: 'code', text: code.slice(1, -1) });
    else if (image) { const p = splitMedia(image); out.push({ kind: 'image', alt: p.alt, src: p.src }); }
    else if (link) { const p = splitMedia(link); out.push({ kind: 'link', text: p.text, href: p.href }); }
    else if (strongStars) out.push({ kind: 'strong', text: strongStars.slice(2, -2) });
    else if (strongUnder) out.push({ kind: 'strong', text: strongUnder.slice(2, -2) });
    else if (emStar) out.push({ kind: 'em', text: emStar.slice(1, -1) });
    else if (emUnder) out.push({ kind: 'em', text: emUnder.slice(1, -1) });
    else if (strike) out.push({ kind: 'strike', text: strike.slice(2, -2) });
    else if (mark) out.push({ kind: 'mark', text: mark.slice(2, -2) });
    else if (underline) out.push({ kind: 'underline', text: underline.slice(2, -2) });
    else if (math) out.push({ kind: 'math', text: math.slice(1, -1) });
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

function tokenizeInline(text) {
  const markers = findStdMarkersInLine(text, 0).sort(function (a, b) { return a.start - b.start; });
  const out = [];
  let pos = 0;
  markers.forEach(function (marker) {
    if (marker.start > pos) {
      tokenizePlain(text.slice(pos, marker.start)).forEach(function (t) { out.push(t); });
    }
    if (marker.func === 'calc') {
      const calc = evaluateStdCalc(marker.inner);
      out.push({ kind: 'stdcalc', expr: marker.inner, result: calc.result });
    } else {
      out.push({ kind: 'stdmarker', text: marker.inner });
    }
    pos = marker.end;
  });
  if (pos < text.length) {
    tokenizePlain(text.slice(pos)).forEach(function (t) { out.push(t); });
  }
  return out;
}

/* ---------------- block parser ---------------- */

const FENCE_RE = /^```\s*(\S*)\s*$/;
const CONTAINER_RE = /^:::(\w+)\s*(.*)$/;
const HEADING_RE = /^(#{1,6})(?:\s+(.*))?$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^>\s?(.*)$/;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TASK_RE = /^\[([ xX])\]\s?(.*)$/;
const TABLE_SEP_RE = /^\|?[\s:|-]+\|?$/;

function isHeadingLine(line) {
  const m = HEADING_RE.exec(line);
  return !!m && (m[2] !== undefined || /^#{1,6}$/.test(line.trim()));
}
function isContainerOpen(line) {
  return CONTAINER_RE.test(line) && line.trim() !== ':::';
}
function splitCells(line) {
  let cells = line.trim();
  if (cells.startsWith('|')) cells = cells.slice(1);
  if (cells.endsWith('|')) cells = cells.slice(0, -1);
  return cells.split('|').map(function (c) { return c.trim(); });
}

function parseQuiz(inner, baseLine) {
  const question = [];
  const options = [];
  inner.forEach(function (raw, i) {
    const line = baseLine + i;
    const item = raw.replace(/^(\s*)([-*+]|\d+[.)])\s+/, '');
    const task = TASK_RE.exec(item);
    if (task && LIST_RE.test(raw)) {
      options.push({ text: task[2], correct: task[1].toLowerCase() === 'x', line: line });
    } else if (options.length === 0 && raw.trim() !== '') {
      question.push(raw.trim());
    }
  });
  return { question: question.join('\n'), options: options };
}

function parseStmd(source) {
  const lines = source.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineNo = i;
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const lang = (fence[1] || '').toLowerCase();
      let j = i + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
      const body = lines.slice(i + 1, j);
      if (lang === 'calc') {
        blocks.push({ kind: 'calc', expressions: body.map(function (b) { return b.trim(); }).filter(function (b) { return b !== ''; }), line: lineNo });
      } else {
        blocks.push({ kind: 'code', lang: lang, code: body.join('\n'), line: lineNo });
      }
      i = j + 1;
      continue;
    }
    if (isContainerOpen(line)) {
      const container = CONTAINER_RE.exec(line);
      const name = (container[1] || '').toLowerCase();
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== ':::') j++;
      const content = lines.slice(i + 1, j);
      const baseLine = i + 1;
      if (name === 'flashcard') {
        const sep = content.findIndex(function (l) { return /^---\s*$/.test(l); });
        blocks.push({
          kind: 'flashcard',
          front: (sep < 0 ? content.join('\n') : content.slice(0, sep).join('\n')).trim(),
          back: sep < 0 ? '' : content.slice(sep + 1).join('\n').trim(),
          line: lineNo,
        });
      } else if (name === 'quiz') {
        const q = parseQuiz(content, baseLine);
        blocks.push({ kind: 'quiz', question: q.question, options: q.options, line: lineNo });
      } else {
        blocks.push({ kind: 'callout', tone: name, text: content.join('\n').trim(), line: lineNo });
      }
      i = j + 1;
      continue;
    }
    if (isHeadingLine(line)) {
      const heading = HEADING_RE.exec(line);
      blocks.push({ kind: 'heading', level: heading[1].length, text: (heading[2] || '').trim(), line: lineNo });
      i++;
      continue;
    }
    if (HR_RE.test(line)) { blocks.push({ kind: 'hr', line: lineNo }); i++; continue; }
    const quote = QUOTE_RE.exec(line);
    if (quote) {
      const quoted = [];
      while (i < lines.length) {
        const q = QUOTE_RE.exec(lines[i]);
        if (!q) break;
        quoted.push(q[1]);
        i++;
      }
      blocks.push({ kind: 'quote', text: quoted.join('\n'), line: lineNo });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const head = splitCells(line);
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') {
        rows.push(splitCells(lines[j]));
        j++;
      }
      blocks.push({ kind: 'table', head: head, rows: rows, line: lineNo });
      i = j;
      continue;
    }
    const list = LIST_RE.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[2].trim());
      const items = [];
      while (i < lines.length) {
        const lm = LIST_RE.exec(lines[i]);
        if (!lm) break;
        const task = TASK_RE.exec(lm[3]);
        if (task) items.push({ text: task[2], task: true, checked: task[1].toLowerCase() === 'x', line: i });
        else items.push({ text: lm[3], task: false, checked: false, line: i });
        i++;
      }
      blocks.push({ kind: 'list', ordered: ordered, items: items, line: lineNo });
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE_RE.test(lines[i]) &&
      !isContainerOpen(lines[i]) &&
      !isHeadingLine(lines[i]) &&
      !HR_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !LIST_RE.test(lines[i])
    ) {
      if (lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) break;
      para.push(lines[i]);
      i++;
    }
    if (para.length === 0) { i++; continue; }
    blocks.push({ kind: 'paragraph', text: para.join('\n'), line: lineNo });
  }
  return blocks;
}

/* ---------------- HTML renderer ---------------- */

function renderInlineHtml(tokens) {
  return tokens.map(function (t) {
    switch (t.kind) {
      case 'text': return esc(t.text);
      case 'code': return '<code class="nb-code">' + esc(t.text) + '</code>';
      case 'strong': return '<strong>' + esc(t.text) + '</strong>';
      case 'em': return '<em>' + esc(t.text) + '</em>';
      case 'strike': return '<s>' + esc(t.text) + '</s>';
      case 'mark': return '<mark>' + esc(t.text) + '</mark>';
      case 'underline': return '<u>' + esc(t.text) + '</u>';
      case 'math': return '<span class="nb-math">' + esc(t.text) + '</span>';
      case 'stdcalc':
        return '<span class="nb-stdcalc">' + esc(t.expr) + ' = ' +
          (t.result === null ? '<span class="muted">?</span>' : '<strong>' + esc(t.result) + '</strong>') + '</span>';
      case 'stdmarker': return '<mark>' + esc(t.text) + '</mark>';
      case 'link':
        if (/^https?:|^mailto:/.test(t.href)) {
          return '<a href="' + esc(t.href) + '" target="_blank" rel="noreferrer">' + esc(t.text) + '</a>';
        }
        return esc(t.text);
      case 'image':
        return '<img src="' + esc(t.src) + '" alt="' + esc(t.alt) + '" loading="lazy" />';
      default: return '';
    }
  }).join('');
}

function renderRichText(text) {
  return text.split('\n').map(function (line) {
    return renderInlineHtml(tokenizeInline(line));
  }).join('<br />');
}

function renderBlock(block, idx) {
  switch (block.kind) {
    case 'heading': {
      const tag = 'h' + Math.min(block.level, 6);
      return '<' + tag + ' class="nb-h' + Math.min(block.level, 3) + '">' +
        renderInlineHtml(tokenizeInline(block.text)) + '</' + tag + '>';
    }
    case 'paragraph':
      return '<p class="nb-p">' + renderRichText(block.text) + '</p>';
    case 'code':
      return '<pre class="nb-pre">' + esc(block.code) + '</pre>';
    case 'calc': {
      const rows = block.expressions.map(function (expr) {
        let result;
        try {
          result = Calc.formatResult(Calc.evaluate(expr));
        } catch (e) {
          result = null;
        }
        return '<div class="nb-calc-row"><span>' + esc(expr) + '</span><strong>' +
          (result === null ? '<span class="muted">?</span>' : esc(result)) + '</strong></div>';
      }).join('');
      return '<div class="nb-calc">' + rows + '</div>';
    }
    case 'list':
      if (block.ordered) {
        return '<ol class="nb-ol">' + block.items.map(function (it) {
          return '<li>' + renderInlineHtml(tokenizeInline(it.text)) + '</li>';
        }).join('') + '</ol>';
      }
      return '<ul class="nb-ul">' + block.items.map(function (it) {
        if (it.task) {
          return '<li><label class="nb-task"><input type="checkbox" data-task-line="' + it.line + '"' +
            (it.checked ? ' checked' : '') + ' /><span' + (it.checked ? ' class="nb-done"' : '') + '>' +
            renderInlineHtml(tokenizeInline(it.text)) + '</span></label></li>';
        }
        return '<li class="nb-bullet"><span class="muted">•</span><span>' +
          renderInlineHtml(tokenizeInline(it.text)) + '</span></li>';
      }).join('') + '</ul>';
    case 'quote':
      return '<blockquote class="nb-quote">' + renderRichText(block.text) + '</blockquote>';
    case 'hr':
      return '<hr class="nb-hr" />';
    case 'table': {
      const head = block.head.map(function (c) {
        return '<th>' + renderInlineHtml(tokenizeInline(c)) + '</th>';
      }).join('');
      const rows = block.rows.map(function (row) {
        return '<tr>' + row.map(function (c) {
          return '<td>' + renderInlineHtml(tokenizeInline(c)) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<div class="nb-table-wrap"><table class="nb-table"><thead><tr>' + head +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    case 'flashcard':
      if (!block.back) {
        return '<div class="nb-flash">' + renderRichText(block.front) + '</div>';
      }
      return '<button type="button" class="nb-flash nb-flip" data-flash="' + idx + '" data-side="front">' +
        '<span class="nb-flash-front">' + renderRichText(block.front) + '</span>' +
        '<span class="nb-flash-back" hidden>' + renderRichText(block.back) + '</span>' +
        '<span class="nb-hint">' + esc(StmdI18n.flip) + '</span></button>';
    case 'quiz': {
      if (!block.options.length) return '';
      const opts = block.options.map(function (o, i) {
        return '<label class="nb-opt" data-opt="' + i + '" data-correct="' + (o.correct ? '1' : '0') + '">' +
          '<input type="checkbox" />' +
          '<span>' + renderInlineHtml(tokenizeInline(o.text)) + '</span>' +
          '<span class="nb-verdict" hidden></span></label>';
      }).join('');
      return '<div class="nb-quiz" data-quiz="' + idx + '"><p class="nb-q">' +
        renderRichText(block.question) + '</p>' + opts +
        '<div class="nb-quiz-foot"><button type="button" class="btn btn-primary btn-sm" data-quiz-check>' +
        esc(StmdI18n.check) + '</button></div></div>';
    }
    case 'callout': {
      const tone = block.tone.toLowerCase();
      const cls = tone === 'aviso' ? 'nb-callout-err' : tone === 'dica' ? 'nb-callout-info' : 'nb-callout-note';
      return '<div class="nb-callout ' + cls + '">' + renderRichText(block.text) + '</div>';
    }
    default:
      return '';
  }
}

function renderNotebook(source) {
  const blocks = parseStmd(source);
  return '<article class="nb" data-notebook>' + blocks.map(function (b, i) {
    return renderBlock(b, i);
  }).join('') + '</article>';
}

window.Stmd = {
  isStmdFile: isStmdFile,
  ensureStudyExtension: ensureStudyExtension,
  drawingMarkdown: drawingMarkdown,
  normalizeCalcSymbols: normalizeCalcSymbols,
  evaluateStdCalc: evaluateStdCalc,
  findStdMarkers: findStdMarkers,
  findStdMarkersInLine: findStdMarkersInLine,
  tokenizeInline: tokenizeInline,
  parseStmd: parseStmd,
  renderNotebook: renderNotebook,
  renderInlineHtml: renderInlineHtml,
};
/* StmdI18n is defined by i18n.js (loaded before this file): flip/check labels. */
