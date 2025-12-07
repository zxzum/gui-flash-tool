export async function callApi(method, ...args) {
  if (!window.pywebview) {
    console.warn('pywebview bridge missing, returning stub');
    return {};
  }
  const api = window.pywebview.api;
  if (!api || typeof api[method] !== 'function') {
    console.warn('pywebview method not found', method);
    return {};
  }
  return api[method](...args);
}
