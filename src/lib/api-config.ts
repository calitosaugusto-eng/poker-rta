/**
 * Configuração de API para funcionar em Web e App Nativo
 */

// URL base da API - muda dependendo do ambiente
const getApiBaseUrl = (): string => {
  // Se estiver rodando como app nativo (Capacitor)
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    // Usar API hospedada na Vercel
    return 'https://poker-rta.vercel.app';
  }

  // Se estiver em desenvolvimento local
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '';
  }

  // Produção web (Vercel)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper para fazer requests à API
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
