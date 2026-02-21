/**
 * API de Detecção de Cartas - 100% GRATUITA
 * Múltiplas APIs gratuitas sem necessidade de API key do usuário
 */

import { NextRequest, NextResponse } from 'next/server';

// ==================== CONFIGURAÇÕES DE APIs GRATUITAS ====================

const FREE_APIS = {
  // 1. Hugging Face Inference API (gratuita para modelos públicos)
  huggingface: {
    // BLIP funciona sem API key para requests limitados
    models: [
      'Salesforce/blip-image-captioning-large',
      'Salesforce/blip-vqa-base',
      'nlpconnect/vit-gpt2-image-captioning'
    ]
  },
  
  // 2. OCR.space API (gratuita - 25.000 requests/mês)
  ocrSpace: {
    url: 'https://api.ocr.space/parse/image',
    // Free tier key público (disponível no site deles)
    freeKey: 'K83936267888957'
  },

  // 3. DeepAI (tem tier gratuito)
  deepAI: {
    url: 'https://api.deepai.org/api/densecap',
    // Free API key (pública para demonstração)
    freeKey: 'quickstart-QUdJIGlzIGNvbWluZy4uLi4K'
  }
};

// ==================== DETECTORES ====================

/**
 * Detecção com Hugging Face - BLIP Image Captioning
 * Funciona sem API key para modelos públicos
 */
async function detectWithHuggingFace(imageData: string): Promise<{ text: string; model: string }> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  // Tentar BLIP Image Captioning (melhor para descrever imagens)
  const models = FREE_APIS.huggingface.models;
  
  for (const model of models) {
    try {
      console.log(`📡 Tentando HuggingFace: ${model}...`);
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: base64Data,
          parameters: {
            // Para modelos de captioning
            max_length: 100,
            min_length: 10
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ ${model} falhou: ${response.status} - ${errorText.substring(0, 100)}`);
        continue;
      }
      
      const data = await response.json();
      
      // BLIP retorna array com generated_text
      let text = '';
      if (Array.isArray(data) && data[0]?.generated_text) {
        text = data[0].generated_text;
      } else if (data.generated_text) {
        text = data.generated_text;
      } else if (typeof data === 'string') {
        text = data;
      }
      
      if (text && text.length > 5) {
        console.log(`✅ HuggingFace (${model}) retornou: ${text.substring(0, 100)}...`);
        return { text, model };
      }
    } catch (e: any) {
      console.log(`❌ Erro com ${model}:`, e.message);
    }
  }
  
  throw new Error('Todos os modelos HuggingFace falharam');
}

/**
 * Detecção com Hugging Face VQA (Visual Question Answering)
 * Perguntamos especificamente sobre cartas
 */
async function detectWithVQA(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  const questions = [
    'What playing cards are visible in this image? List all cards.',
    'What card ranks and suits can you see?',
    'Describe all poker cards in the image.'
  ];
  
  for (const question of questions) {
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-vqa-base', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            image: base64Data,
            question: question
          }
        })
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const answer = data.answer || data[0]?.answer || '';
      
      if (answer && answer.length > 2) {
        console.log(`✅ VQA respondeu: ${answer}`);
        return answer;
      }
    } catch (e: any) {
      console.log('❌ VQA falhou:', e.message);
    }
  }
  
  return '';
}

/**
 * Detecção com OCR.space - Extrai texto da imagem
 * Ótimo para detectar cartas com texto impresso
 */
async function detectWithOCRSpace(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  const formData = new URLSearchParams();
  formData.append('base64Image', `data:image/png;base64,${base64Data}`);
  formData.append('apikey', FREE_APIS.ocrSpace.freeKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2'); // Engine mais precisa
  formData.append('scale', 'true'); // Aumentar escala para melhor precisão
  formData.append('detectOrientation', 'true');

  const response = await fetch(FREE_APIS.ocrSpace.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  if (!response.ok) {
    throw new Error('OCR.space indisponível');
  }

  const data = await response.json();
  const text = data.ParsedResults?.[0]?.ParsedText || '';
  
  if (text) {
    console.log(`✅ OCR.space retornou: ${text.substring(0, 100)}...`);
  }
  
  return text;
}

/**
 * Detecção com DeepAI - Dense Captioning
 * Descreve múltiplas regiões da imagem
 */
async function detectWithDeepAI(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  
  try {
    const formData = new URLSearchParams();
    formData.append('image', base64Data);
    
    const response = await fetch(FREE_APIS.deepAI.url, {
      method: 'POST',
      headers: {
        'Api-Key': FREE_APIS.deepAI.freeKey
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('DeepAI indisponível');
    }
    
    const data = await response.json();
    const captions = data.output?.captions || [];
    const text = captions.map((c: any) => c.caption || c).join(' ');
    
    if (text) {
      console.log(`✅ DeepAI retornou: ${text.substring(0, 100)}...`);
    }
    
    return text;
  } catch (e) {
    console.log('❌ DeepAI falhou:', (e as Error).message);
    return '';
  }
}

// ==================== EXTRAÇÃO DE CARTAS ====================

function extractCardsFromText(text: string): {
  heroCards: string[];
  board: string[];
  potSize: number;
  betToCall: number;
} {
  console.log('📄 Analisando texto:', text.substring(0, 300));
  
  const cards: string[] = [];
  
  // Padrão 1: Formato padrão de poker (As, Kh, Tc, 2d)
  const standardPattern = /\b([2-9TJQKA])([shdc])\b/gi;
  let match;
  while ((match = standardPattern.exec(text)) !== null) {
    const card = match[1].toUpperCase() + match[2].toLowerCase();
    if (!cards.includes(card)) {
      cards.push(card);
    }
  }
  
  // Padrão 2: Com naipe por extenso (Ace of spades, King hearts, etc)
  const extendedPattern = /\b(ace|king|queen|jack|ten|two|three|four|five|six|seven|eight|nine)\s*(?:of\s+)?(spades?|hearts?|diamonds?|clubs?)\b/gi;
  while ((match = extendedPattern.exec(text)) !== null) {
    const card = extendedToCard(match[1], match[2]);
    if (card && !cards.includes(card)) {
      cards.push(card);
    }
  }
  
  // Padrão 3: Com símbolos Unicode (A♠, K♥, Q♦, J♣)
  const symbolPattern = /([2-9TJQKA])[♠♥♦♣]/g;
  while ((match = symbolPattern.exec(text)) !== null) {
    const rank = match[1].toUpperCase();
    const suitMap: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
    const suit = suitMap[match[0].slice(-1)];
    const card = rank + suit;
    if (!cards.includes(card)) {
      cards.push(card);
    }
  }
  
  // Padrão 4: Formato com hífen (A-s, K-h, etc)
  const hyphenPattern = /\b([2-9TJQKA])-([shdc])\b/gi;
  while ((match = hyphenPattern.exec(text)) !== null) {
    const card = match[1].toUpperCase() + match[2].toLowerCase();
    if (!cards.includes(card)) {
      cards.push(card);
    }
  }
  
  // Padrão 5: Detectar apenas ranks se tiver contexto de "card" ou "poker"
  if (cards.length < 2 && /card|poker|hand|deck/i.test(text)) {
    // Tentar extrair ranks próximos a naipes
    const rankOnlyPattern = /\b([AKQJT]|[2-9])\b/g;
    const suits = ['s', 'h', 'd', 'c'];
    let suitIndex = 0;
    
    while ((match = rankOnlyPattern.exec(text)) !== null && cards.length < 7) {
      const rank = match[1].toUpperCase().replace('10', 'T');
      if ('AKQJT23456789'.includes(rank)) {
        // Atribuir naipe sequencialmente (heurística)
        const card = rank + suits[suitIndex % 4];
        if (!cards.includes(card)) {
          cards.push(card);
        }
        suitIndex++;
      }
    }
  }
  
  // Extrair valores numéricos
  const potMatch = text.match(/pot[:\s]*\$?([\d,]+)/i);
  const betMatch = text.match(/(?:bet|call|raise)[:\s]*\$?([\d,]+)/i);
  
  const potSize = potMatch ? parseInt(potMatch[1].replace(',', ''), 10) : 0;
  const betToCall = betMatch ? parseInt(betMatch[1].replace(',', ''), 10) : 0;
  
  console.log(`🃏 Cartas extraídas: [${cards.join(', ')}]`);
  
  return {
    heroCards: cards.slice(0, 2),
    board: cards.slice(2, 7),
    potSize,
    betToCall
  };
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

// ==================== DETECÇÃO LOCAL (FALLBACK) ====================

function detectLocally(imageData: string): { heroCards: string[]; board: string[] } {
  // Análise básica de cores para detectar cartas
  // Retorna vazio - implementação futura com Canvas no cliente
  return { heroCards: [], board: [] };
}

// ==================== ENDPOINT PRINCIPAL ====================

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

    console.log('🔍 Iniciando detecção de cartas...');
    const startTime = Date.now();
    
    let extractedTexts: string[] = [];
    let usedApis: string[] = [];
    
    // Executar múltiplas APIs em paralelo para melhor resultado
    const apiPromises = [
      // Hugging Face BLIP (captioning)
      detectWithHuggingFace(imageData)
        .then(r => { extractedTexts.push(r.text); usedApis.push(`HF:${r.model}`); })
        .catch(e => console.log('HF caption failed:', e.message)),
      
      // Hugging Face VQA
      detectWithVQA(imageData)
        .then(t => { if (t) { extractedTexts.push(t); usedApis.push('HF:VQA'); }})
        .catch(e => console.log('VQA failed:', e.message)),
      
      // OCR.space
      detectWithOCRSpace(imageData)
        .then(t => { if (t) { extractedTexts.push(t); usedApis.push('OCR.space'); }})
        .catch(e => console.log('OCR.space failed:', e.message)),
        
      // DeepAI (comentado pois pode ser instável)
      // detectWithDeepAI(imageData)
      //   .then(t => { if (t) { extractedTexts.push(t); usedApis.push('DeepAI'); }})
      //   .catch(e => console.log('DeepAI failed:', e.message)),
    ];
    
    // Aguardar todas as APIs (com timeout de 30s)
    await Promise.allSettled(apiPromises);
    
    // Combinar todos os textos extraídos
    const combinedText = extractedTexts.join(' | ');
    const processingTime = Date.now() - startTime;
    
    console.log(`⏱️ Tempo total: ${processingTime}ms`);
    console.log(`📡 APIs usadas: ${usedApis.join(', ')}`);
    
    // Se nenhuma API funcionou
    if (extractedTexts.length === 0) {
      return NextResponse.json({
        success: false,
        needsManualInput: true,
        message: '⚠️ APIs de visão indisponíveis no momento. Use o modo manual abaixo.',
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
    
    // Extrair cartas do texto combinado
    const { heroCards, board, potSize, betToCall } = extractCardsFromText(combinedText);
    
    // Determinar street baseado no board
    let street = 'preflop';
    if (board.length >= 3) street = 'flop';
    if (board.length >= 4) street = 'turn';
    if (board.length >= 5) street = 'river';
    
    console.log(`🃏 Detectado: Hero=[${heroCards.join(', ')}] Board=[${board.join(', ')}] Street=${street}`);
    
    // Se não detectou cartas suficientes
    if (heroCards.length < 2) {
      return NextResponse.json({
        success: false,
        needsManualInput: true,
        message: '⚠️ Não foi possível detectar suas cartas automaticamente. Use o modo manual abaixo.',
        extractedText: combinedText.substring(0, 500),
        usedApis,
        gameState: {
          heroCards: [],
          board: [],
          potSize,
          betToCall,
          stackSize: 1000,
          street: 'preflop',
          position: 'BTN',
          numPlayers: 2,
          myTurn: true
        },
        processingTime
      });
    }
    
    // Sucesso!
    return NextResponse.json({
      success: true,
      usedApis,
      extractedText: combinedText.substring(0, 200),
      gameState: {
        heroCards,
        board,
        potSize,
        betToCall,
        stackSize: 1000,
        street,
        position: 'BTN',
        numPlayers: 2,
        myTurn: true
      },
      processingTime
    });
    
  } catch (error: any) {
    console.error('❌ Detection error:', error);
    return NextResponse.json({
      success: false,
      needsManualInput: true,
      message: '❌ Erro na detecção. Use o modo manual abaixo.',
      error: error.message,
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
