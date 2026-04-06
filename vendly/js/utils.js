// VARIÁVEIS GLOBAIS E DE ESTADO
const STORE_NAME = CONFIG.storeName;
const API_BASE_URL = CONFIG.apiBaseUrl;
const WHATSAPP_NUMBER = CONFIG.whatsappNumber;
const CARRINHO_KEY = 'catalogo_cart_v1';
const PRODUTOS_CACHE_KEY = 'catalogo_produtos_cache_v2';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de validade do cache
const CLICKS_KEY = 'catalogo_clicks_v1';
const ONBOARDING_KEY = 'catalogo_onboarding_v1';

let produtos = [];
let carrinho = [];
let comparacao = [];

// Variáveis de estado do modal de produtos
let modalVariacoes = [];
let selColor = '';
let selStorage = '';
let selCondition = '';
let currentTargetId = '';

let produtoClicks = carregarClicksLocalStorage(); // Para destacar populares

// === Funções Utilitárias e de Storage ===

function carregarClicksLocalStorage() {
  try {
    const json = localStorage.getItem(CLICKS_KEY);
    return json ? JSON.parse(json) : {};
  } catch (e) { return {}; }
}

function salvarClicksLocalStorage() {
  localStorage.setItem(CLICKS_KEY, JSON.stringify(produtoClicks));
}

// === Cache de produtos no localStorage ===
function salvarCacheProdutos(data) {
  try {
    localStorage.setItem(PRODUTOS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: data
    }));
  } catch (e) { /* quota excedida */ }
}

function carregarCacheProdutos() {
  try {
    const json = localStorage.getItem(PRODUTOS_CACHE_KEY);
    if (!json) return null;
    const cache = JSON.parse(json);
    return cache.data || null;
  } catch (e) { return null; }
}

function cacheValido() {
  try {
    const json = localStorage.getItem(PRODUTOS_CACHE_KEY);
    if (!json) return false;
    const cache = JSON.parse(json);
    return (Date.now() - cache.timestamp) < CACHE_TTL;
  } catch (e) { return false; }
}

function formatarMoedaBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function extrairNumero(str) {
  if (!str) return 0;
  const match = String(str).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function getUniqueValues(arr, key) {
  return [...new Set(arr.map(item => item[key]).filter(Boolean))];
}

// ===== Sistema de Onboarding =====
function isFirstVisit() {
  return !localStorage.getItem(ONBOARDING_KEY);
}

function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
    completedAt: Date.now(),
    version: 1
  }));
}
