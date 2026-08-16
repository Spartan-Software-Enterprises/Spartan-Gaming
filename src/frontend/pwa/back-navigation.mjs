export function handleAndroidBack(documentRef = globalThis.document) {
  const dialog = [...(documentRef?.querySelectorAll?.('dialog[open]') || [])].at(-1);
  if (dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute?.('open');
    return true;
  }
  return false;
}
