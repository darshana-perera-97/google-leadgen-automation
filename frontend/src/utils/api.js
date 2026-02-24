/**
 * Parse fetch response as JSON. If the server returns HTML (e.g. dev server 404),
 * throw a clear error instead of "Unexpected token '<'".
 */
export async function parseJsonResponse(res) {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('<') && (trimmed.startsWith('<!') || trimmed.startsWith('<?'))) {
    throw new Error(
      'Backend returned HTML instead of JSON. Is the API server running? ' +
      'Start it with: cd backend && npm start (default port 3434).'
    );
  }
  try {
    return trimmed ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error('Invalid JSON response from server');
  }
}
