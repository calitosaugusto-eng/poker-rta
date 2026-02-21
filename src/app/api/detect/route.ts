/**
 * API de Detecção de Cartas - 100% GRATUITA
 * Usa múltiplas APIs gratuitas sem necessidade de API key
 */

import { NextRequest, NextResponse } from 'next/server';

// APIs Gratuitas disponíveis (sem API key necessário)
const FREE_APIS = {
  // 1. Hugging Face Inference API (gratuita para modelos públicos)
  huggingface: {
    url: 'https://api-inference.huggingface.co/models/',
    models: [
      'microsoft/kosmos-2-patch14-224',
      'Salesforce/blip-vqa-base',
      'llava-hf/llava-v1.6-mistral-7b-hf'
    ]
  },
  
  // 2. OCR.space API (gratuita - 25.000 requests/mês)
  ocrSpace: {
    url: 'https://api.ocr.space/parse/image',
    freeKey: 'K83936267888957' // Free tier key público
  }
};

// ==================== DETECTORES ====================

async function detectWithHuggingFace(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  // Tentar modelo LLaVA (melhor para descrever imagens)
  const response = await fetch(`${FREE_APIS.huggingface.url}llava-hf/llava-v1.6-mistral-7b-hf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        image: base64Data,
        prompt: "What playing cards do you see? List all cards with rank and suit. Format: Rank+Suit (As=Ace spades, Kh=King hearts, etc)"
      }
    })
  });

  if (!response.ok) {
    // Tentar modelo alternativo
    const response2 = await fetch(`${FREE_APIS.huggingface.url}Salesforce/blip-vqa-base`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          image: base64Data,
          question: "What poker cards are visible? List card ranks and suits."
        }
      })
    });
    
    if (!response2.ok) throw new Error('HuggingFace models unavailable');
    
    const data2 = await response2.json();
    return data2[0]?.answer || data2.answer || '';
  }

  const data = await response.json();
  return data.generated_text || data[0]?.generated_text || '';
}

async function detectWithOCRSpace(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  const formData = new URLSearchParams();
  formData.append('base64Image', `data:image/png;base64,${base64Data}`);
  formData.append('apikey', FREE_APIS.ocrSpace.freeKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2');

  const response = await fetch(FREE_APIS.ocrSpace.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  if (!response.ok) throw new Error('OCR.space unavailable');

  const data = await response.json();
  return data.ParsedResults?.[0]?.ParsedText || '';
}

async function detectWithEdenAI(imageData: string): Promise<string> {
  // Eden AI tem tier gratuito
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  try {
    const response = await fetch('https://api.edenai.run/v2/workflow/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: 'ocr',
        inputs: {
          image: base64Data
        }
      })
    });
    
    if (!response.ok) throw new Error('EdenAI unavailable');
    
    const data = await response.json();
    return data.result?.text || '';
  } catch {
    return '';
  }
}

// ==================== EXTRAÇÃO DE CARTAS ====================

function extractCardsFromText(text: string): {
  heroCards: string[];
  board: string[];
  potSize: number;
} {
  console.log('📄 Texto extraído:', text.substring(0, 200));
  
  // Padrões para detectar cartas
  const patterns = [
    // Padrão padrão: As, Kh, Tc, etc
    /([2-9TJQKA][shdc])/gi,
    // Com naipe por extenso: Ace of spades, King hearts
    /(ace|king|queen|jack|ten|[2-9])\s*(?:of\s*)?(spades?|hearts?|diamonds?|clubs?)/gi,
    // Com símbolos: A♠, K♥
    /([2-9TJQKA])[♠♥♦♣]/gi
  ];
  
  const cards: string[] = [];
  
  // Extrair cartas com padrão padrão
  const matches = text.match(patterns[0]) || [];
  
  for (const match of matches) {
    const card = normalizeCard(match);
    if (card && !cards.includes(card)) {
      cards.push(card);
    }
  }
  
  // Se não encontrou, tentar outros padrões
  if (cards.length === 0) {
    // Tentar extrair de texto com naipes por extenso
    const extendedPattern = /(ace|king|queen|jack|ten|two|three|four|five|six|seven|eight|nine)\s*(?:of\s*)?(spades?|hearts?|diamonds?|clubs?)/gi;
    const extendedMatches = text.matchAll(extendedPattern);
    
    for (const match of extendedMatches) {
      const card = extendedToCard(match[1], match[2]);
      if (card && !cards.includes(card)) {
        cards.push(card);
      }
    }
  }
  
  // Separar hero cards (primeiras 2) e board (próximas 5)
  return {
    heroCards: cards.slice(0, 2),
    board: cards.slice(2, 7),
    potSize: extractNumber(text, /pot[:\s]*\$?(\d+)/i) || 0
  };
}

function normalizeCard(str: string): string | null {
  const s = str.toUpperCase();
  const rank = s[0];
  const suitChar = s[1]?.toLowerCase();
  
  if (!'23456789TJQKA'.includes(rank)) return null;
  
  let suit = suitChar;
  if (suitChar === 's' || suitChar === '♠') suit = 's';
  else if (suitChar === 'h' || suitChar === '♥') suit = 'h';
  else if (suitChar === 'd' || suitChar === '♦') suit = 'd';
  else if (suitChar === 'c' || suitChar === '♣') suit = 'c';
  else return null;
  
  return rank + suit;
}

function extendedToCard(rankStr: string, suitStr: string): string | null {
  const ranks: Record<string, string> = {
    'ace': 'A', 'king': 'K', 'queen': 'Q', 'jack': 'J', 'ten': 'T',
    'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
  };
  
  const suits: Record<string, string> = {
    'spade': 's', 'spades': 's',
    'heart': 'h', 'hearts': 'h',
    'diamond': 'd', 'diamonds': 'd',
    'club': 'c', 'clubs': 'c'
  };
  
  const rank = ranks[rankStr.toLowerCase()];
  const suit = suits[suitStr.toLowerCase()];
  
  if (!rank || !suit) return null;
  return rank + suit;
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

// ==================== ENDPOINT ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageData } = body;
    
    if (!imageData) {
      return NextResponse.json(
        { error: 'ImageData é obrigatório' },
        { status: 400 }
      );
    }

    console.log('🔍 Iniciando detecção gratuita...');
    const startTime = Date.now();
    
    let extractedText = '';
    let usedApi = '';
    
    // Tentar APIs em sequência (todas gratuitas)
    const apis = [
      { name: 'HuggingFace', fn: () => detectWithHuggingFace(imageData) },
      { name: 'OCR.space', fn: () => detectWithOCRSpace(imageData) }
    ];
    
    for (const api of apis) {
      try {
        console.log(`📡 Tentando ${api.name}...`);
        extractedText = await api.fn();
        if (extractedText && extractedText.length > 5) {
          usedApi = api.name;
          console.log(`✅ ${api.name} retornou texto`);
          break;
        }
      } catch (e: any) {
        console.log(`❌ ${api.name} falhou:`, e.message);
      }
    }
    
    // Se nenhuma API funcionou
    if (!extractedText) {
      return NextResponse.json({
        success: false,
        needsManualInput: true,
        message: 'APIs de visão temporariamente indisponíveis. Use o modo manual.',
        gameState: {
          heroCards: [],
          board: [],
          potSize: 0,
          betToCall: 0,
          stackSize: 1000,
          street: 'preflop',
          position: 'BTN',
          numPlayers: 2,
          myTurn: true
        }
      });
    }
    
    // Extrair cartas do texto
    const { heroCards, board, potSize } = extractCardsFromText(extractedText);
    
    // Determinar street
    let street = 'preflop';
    if (board.length >= 3) street = 'flop';
    if (board.length >= 4) street = 'turn';
    if (board.length >= 5) street = 'river';
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Processamento: ${processingTime}ms`);
    console.log(`🃏 Detectadas: Hero=[${heroCards.join(', ')}] Board=[${board.join(', ')}]`);
    
    // Se não detectou cartas suficientes
    if (heroCards.length < 2) {
      return NextResponse.json({
        success: false,
        needsManualInput: true,
        message: 'Não foi possível detectar suas cartas. Use o modo manual.',
        extractedText: extractedText.substring(0, 500),
        usedApi,
        gameState: {
          heroCards: [],
          board: [],
          potSize,
          betToCall: 0,
          stackSize: 1000,
          street: 'preflop',
          position: 'BTN',
          numPlayers: 2,
          myTurn: true
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      usedApi,
      extractedText: extractedText.substring(0, 200),
      gameState: {
        heroCards,
        board,
        potSize,
        betToCall: 0,
        stackSize: 1000,
        street,
        position: 'BTN',
        numPlayers: 2,
        myTurn: true
      },
      processingTime
    });
    
  } catch (error: any) {
    console.error('Detection error:', error);
    return NextResponse.json({
      success: false,
      needsManualInput: true,
      message: 'Erro na detecção. Use o modo manual.',
      gameState: {
        heroCards: [],
        board: [],
        potSize: 0,
        betToCall: 0,
        stackSize: 1000,
        street: 'preflop',
        position: 'BTN',
        numPlayers: 2,
        myTurn: true
      }
    });
  }
}
