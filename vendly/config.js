/**
 * CONFIGURAÇÃO WHITE LABEL - Altere aqui para customizar para cada cliente
 * Basta duplicar este arquivo e ajustar os valores para replicar a aplicação
 */

const CONFIG = {
  // Identidade da Loja
  storeName: 'Black Phones',
  storeLogo: 'banners/unidospacks-png.png', // Logo da loja (usada no onboarding)
  storeTagline: 'Encontre o celular ideal para você',

  // Cores da Marca
  colors: {
    primary: '#222222',        // Azul - cor principal (botões, headers)
    primaryLight: '#00ff37',   // Azul claro - para degradês
    secondary: '#374151',      // Cinza - cor secundária
    accent: '#f59e0b',         // Amarelo - destaque
    success: '#22c55e',        // Verde - sucesso
    error: '#ef4444',          // Vermelho - erro
    warning: '#eab308',        // Amarelo - aviso
  },

  // WhatsApp
  whatsappNumber: '5579996063423', // sem +

  // Google Apps Script API
  apiBaseUrl: 'https://script.google.com/macros/s/AKfycbyFC7T58EFRRWtsER_4_0ULtX41XPHTJVOV4YFAZDMxpApe4AS2eXe0TcQTPy1KawLD/exec',

  // Banners do Carrossel
  // Para Desktop: tamanho recomendado 1200x400px (proporção 3:1)
  // Para Mobile (Opcional): tamanho recomendado 600x600px (Formato Quadrado 1:1)
  // Se "imageMobile" não for enviada, a de desktop é usada em todas as telas
  banners: [
    { image: 'banners/banner1.png', imageMobile: 'banners/banner1-teste.png', alt: 'Ofertas Especiais' },
    { image: 'banners/banner2.png', imageMobile: 'banners/banner2-mobile.png', alt: 'Novidades' },
    { image: 'banners/banner3.png', imageMobile: 'banners/banner3-mobile.png', alt: 'Frete Grátis' },
  ],

  // Intervalo de rotação dos banners em ms (padrão: 5 segundos)
  bannerInterval: 5000,
};

// Injetar variáveis CSS customizadas
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', CONFIG.colors.primary);
  root.style.setProperty('--color-primary-light', CONFIG.colors.primaryLight);
  root.style.setProperty('--color-secondary', CONFIG.colors.secondary);
  root.style.setProperty('--color-accent', CONFIG.colors.accent);
  root.style.setProperty('--color-success', CONFIG.colors.success);
  root.style.setProperty('--color-error', CONFIG.colors.error);
  root.style.setProperty('--color-warning', CONFIG.colors.warning);
}

// Aplicar tema ao carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyTheme);
} else {
  applyTheme();
}
