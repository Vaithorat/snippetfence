// @fence-begin "token-validation"
export function validateToken(token: string): boolean {
  if (!token || token.length < 10) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  return true;
}
// @fence-end

export function parseToken(token: string): { header: string; payload: string } {
  const parts = token.split('.');
  return {
    header: parts[0],
    payload: parts[1],
  };
}

// @fence-begin
export const API_KEY = 'secret-key-do-not-change';
// @fence-end
