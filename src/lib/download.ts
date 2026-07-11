/**
 * Trigger a client-side download of in-memory text content. Used by the
 * Screensaver (standalone HTML) and ASCII Composer (.txt) exports — both are
 * pure browser tools with no backend, so everything is generated locally and
 * handed to the user as a Blob.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so the download has committed to the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Copy text to the clipboard, resolving to whether it succeeded. Falls back to
 * a hidden-textarea + execCommand for non-secure contexts (e.g. opening the
 * built site from a file:// path), so copy works even offline.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
