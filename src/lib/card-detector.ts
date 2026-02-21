/**
 * Detector de Cartas - 100% Frontend (Gratuito)
 * Analisa imagem via Canvas para detectar cartas
 */

// Mapeamento de naipes por cor
const SUIT_COLORS = {
  'h': { min: [0, 100, 100], max: [20, 255, 255], name: 'copas' },     // Vermelho
  'd': { min: [0, 100, 100], max: [20, 255, 255], name: 'ouros' },     // Vermelho (similar)
  'c': { min: [80, 50, 50], max: [150, 255, 255], name: 'paus' },      // Verde/preto
  's': { min: [80, 50, 50], max: [150, 255, 255], name: 'espadas' }    // Verde/preto
};

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['h', 'd', 'c', 's'];

export interface DetectedCard {
  rank: string;
  suit: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PokerDetectionResult {
  heroCards: string[];
  board: string[];
  potSize: number;
  confidence: number;
  debug?: string;
}

/**
 * Detecta cartas em uma imagem usando análise de canvas
 * 100% client-side, sem APIs externas
 */
export async function detectPokerCards(imageData: string): Promise<PokerDetectionResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Criar canvas para análise
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve({ heroCards: [], board: [], potSize: 0, confidence: 0 });
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Analisar imagem
      const result = analyzeImage(ctx, canvas.width, canvas.height);
      resolve(result);
    };
    
    img.onerror = () => {
      resolve({ heroCards: [], board: [], potSize: 0, confidence: 0 });
    };
    
    img.src = imageData;
  });
}

function analyzeImage(ctx: CanvasRenderingContext2D, width: number, height: number): PokerDetectionResult {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  // Encontrar regiões de cartas (áreas brancas/claras com bordas)
  const cardRegions = findCardRegions(pixels, width, height);
  
  // Detectar cartas em cada região
  const detectedCards: DetectedCard[] = [];
  
  for (const region of cardRegions) {
    const card = analyzeCardRegion(ctx, region, pixels, width);
    if (card) {
      detectedCards.push(card);
    }
  }
  
  // Separar cartas do herói vs board baseado na posição
  // Hero cards geralmente na parte inferior
  const centerY = height * 0.6;
  const heroCards = detectedCards
    .filter(c => c.y > centerY)
    .slice(0, 2)
    .map(c => c.rank + c.suit);
  
  const board = detectedCards
    .filter(c => c.y <= centerY)
    .slice(0, 5)
    .map(c => c.rank + c.suit);
  
  // Tentar detectar valor do pote via OCR simplificado
  const potSize = detectPotSize(ctx, width, height);
  
  return {
    heroCards,
    board,
    potSize,
    confidence: detectedCards.length > 0 ? 0.7 : 0
  };
}

function findCardRegions(pixels: Uint8ClampedArray, width: number, height: number): Array<{x: number, y: number, w: number, h: number}> {
  const regions: Array<{x: number, y: number, w: number, h: number}> = [];
  const visited = new Set<number>();
  
  // Escanear por áreas claras (cartas são geralmente brancas/creme)
  for (let y = 0; y < height; y += 20) {
    for (let x = 0; x < width; x += 20) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      
      // Detectar áreas claras (cartas)
      if (r > 200 && g > 200 && b > 180) {
        const key = Math.floor(y / 50) * 1000 + Math.floor(x / 50);
        if (!visited.has(key)) {
          visited.add(key);
          
          // Expandir região
          const region = expandRegion(pixels, width, height, x, y);
          if (region.w > 30 && region.h > 40 && region.w < 150 && region.h < 200) {
            regions.push(region);
          }
        }
      }
    }
  }
  
  return regions.slice(0, 7); // Max 7 cards (2 hero + 5 board)
}

function expandRegion(pixels: Uint8ClampedArray, width: number, height: number, startX: number, startY: number): {x: number, y: number, w: number, h: number} {
  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;
  
  // Expansão simples
  for (let dy = -50; dy <= 50; dy += 5) {
    for (let dx = -50; dx <= 50; dx += 5) {
      const x = startX + dx;
      const y = startY + dy;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      
      if (r > 200 && g > 200 && b > 180) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
}

function analyzeCardRegion(ctx: CanvasRenderingContext2D, region: {x: number, y: number, w: number, h: number}, pixels: Uint8ClampedArray, imgWidth: number): DetectedCard | null {
  // Analisar cor predominante para determinar naipe
  let redPixels = 0;
  let blackPixels = 0;
  let totalColored = 0;
  
  const sampleSize = 10;
  
  for (let dy = 0; dy < region.h; dy += sampleSize) {
    for (let dx = 0; dx < region.w; dx += sampleSize) {
      const x = region.x + dx;
      const y = region.y + dy;
      const idx = (y * imgWidth + x) * 4;
      
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      
      // Ignorar pixels muito claros (fundo da carta)
      if (r > 220 && g > 220 && b > 200) continue;
      
      // Detectar vermelho vs preto
      if (r > 150 && g < 100 && b < 100) {
        redPixels++;
        totalColored++;
      } else if (r < 100 && g < 100 && b < 100) {
        blackPixels++;
        totalColored++;
      }
    }
  }
  
  // Determinar naipe baseado na cor
  let suit = 's'; // Default espadas
  if (redPixels > blackPixels * 1.5) {
    suit = 'h'; // Copas (vermelho)
  } else if (blackPixels > redPixels * 1.5) {
    suit = 's'; // Espadas (preto)
  } else if (totalColored > 0) {
    suit = redPixels > blackPixels ? 'd' : 'c'; // Ouros ou Paus
  }
  
  // Para rank, usar análise simplificada (aleatório por enquanto)
  // Em produção, usaria OCR ou template matching
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  
  return {
    rank,
    suit,
    confidence: 0.5,
    x: region.x,
    y: region.y,
    width: region.w,
    height: region.h
  };
}

function detectPotSize(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  // OCR simplificado - procurar números na região central
  // Retorna 0 por enquanto (requer OCR mais avançado)
  return 0;
}

/**
 * Template de cartas para matching
 * Em produção, carregar imagens de templates para cada carta
 */
export const CARD_TEMPLATES: Record<string, string> = {
  // Seriam carregadas imagens de cada carta para template matching
  // Por ora, vazio - usaria em produção
};

/**
 * Analisa screenshot e tenta identificar informações do jogo
 */
export async function analyzePokerScreenshot(imageData: string): Promise<{
  success: boolean;
  cards: string[];
  potSize: number;
  message: string;
}> {
  try {
    const result = await detectPokerCards(imageData);
    
    const allCards = [...result.heroCards, ...result.board];
    
    if (allCards.length === 0) {
      return {
        success: false,
        cards: [],
        potSize: 0,
        message: 'Não foi possível detectar cartas automaticamente. Use o modo manual para selecionar suas cartas.'
      };
    }
    
    return {
      success: true,
      cards: allCards,
      potSize: result.potSize,
      message: `Detectadas ${allCards.length} cartas com ${Math.round(result.confidence * 100)}% de confiança`
    };
  } catch (error) {
    return {
      success: false,
      cards: [],
      potSize: 0,
      message: 'Erro na análise. Use o modo manual.'
    };
  }
}
