/* STDHub web — AI client (OpenAI-compatible; Pollinations keyless default).
   Works when there is network + key (or keyless preset); honest offline. */
'use strict';

const AI = {
  async chat(messages, opts) {
    const s = Store.data;
    const base = (opts && opts.baseUrl) || s.aiBaseUrl;
    const model = (opts && opts.model) || s.aiModel;
    const key = (opts && opts.key !== undefined) ? opts.key : s.aiKey;
    const url = base.replace(/\/$/, '') + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ model: model, messages: messages }),
      });
    } catch (e) {
      throw new Error('offline');
    }
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try {
        const data = await res.json();
        msg = (data.error && data.error.message) || msg;
      } catch (e) { /* keep status */ }
      throw new Error(msg);
    }
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    if (!text) throw new Error('empty');
    return text;
  },

  tutorSystem: function () {
    return 'You are STDHub Tutor, a study assistant. Explain clearly and briefly, ' +
      'in the same language as the student. Use examples and end with one quick check question.';
  },
};

window.AI = AI;
