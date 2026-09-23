/* STDHub web — registers views on the shell. Loaded last. */
'use strict';

App.register('notebook', window.NotebookView);
App.register('calculator', window.CalcView);
App.register('research', window.SearchView);
App.register('tutor', window.ChatView);
