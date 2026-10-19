/** Accept only this app's auth return URL; never exchange codes from unrelated links. */
export function getAuthCode(url: string, redirectUrl: string): string {
  const received = new URL(url);
  const expected = new URL(redirectUrl);
  if (received.protocol !== expected.protocol || received.host !== expected.host || received.pathname !== expected.pathname) {
    throw new Error('La dirección de regreso no corresponde a Día Uno.');
  }
  const params = received.searchParams;
  const hash = new URLSearchParams(received.hash.slice(1));
  if (params.has('error') || hash.has('error')) {
    throw new Error('Google no autorizó el inicio de sesión. Puedes volver a intentarlo.');
  }
  const code = params.get('code');
  if (!code) throw new Error('No recibimos el código de acceso. Vuelve a iniciar sesión.');
  return code;
}
