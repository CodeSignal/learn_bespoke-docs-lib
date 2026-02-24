import { init } from './docs-lib.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init({}));
} else {
  init({});
}
