/**
 * API de Detecção de Cartas - GRATUITA
 * Usa Hugging Face API gratuita + OCR local
 */

import { NextRequest, NextResponse } from 'next/server';

// Hugging Face API gratuita (sem necessidade de key para modelos públicos)
const HF_API = 'https://api-inference.huggingface.co/models';

async function detectWithHuggingFace(imageData: string): Promise<string> {
  // Usar modelo de visão gratuito
  const response = await fetch(`${HF_API}/microsoft/kosmos-2-patch14-224`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: imageData.replace(/^data:image\/\w+;base64,/, ''),
      parameters: {
        task: 'image-to-text'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`HF API error: ${response.status}`);
  }

  const data = await response.json();
  return data[0]?.generated_text || '';
}

// Detecção baseada em padrões visuais (fallback)
function analyzePokerImage(imageData: string): {
  heroCards: string[];
  board: string[];
  confidence: number;
} {
  // Esta função seria chamada no frontend com Canvas
  // Por ora, retorna estrutura vazia para o frontend processar
  return {
    heroCards: [],
    board: [],
    confidence: 0
  };
}

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

    console.log('🔍 Analisando imagem (modo gratuito)...');
    const startTime = Date.now();

    // Tentar múltiplas abordagens gratuitas
    const approaches = [
      {
        name: 'HuggingFace Kosmos',
        fn: async () => {
          const text = await detectWithHuggingFace(imageData);
          return extractCardsFromText(text);
        }
      }
    ];

    let bestResult: any = null;

    for (const approach of approaches) {
      try {
        console.log(`Tentando: ${approach.name}`);
        const result = await approach.fn();
        
        if (result.heroCards.length > 0) {
          bestResult = result;
          console.log(`✅ ${approach.name} detectou ${result.heroCards.length} cartas`);
          break;
        }
      } catch (e: any) {
        console.log(`❌ ${approach.name} falhou:`, e.message);
      }
    }

    // Se nenhuma API funcionou, retornar para processamento no frontend
    if (!bestResult || bestResult.heroCards.length === 0) {
      return NextResponse.json({
        success: false,
        needsClientProcessing: true,
        message: 'APIs gratuitas não detectaram cartas. Use o modo manual ou configure uma API.',
        processingTime: Date.now() - startTime,
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

    return NextResponse.json({
      success: true,
      gameState: {
        heroCards: bestResult.heroCards,
        board: bestResult.board,
        potSize: bestResult.potSize || 0,
        betToCall: bestResult.betToCall || 0,
        stackSize: 1000,
        street: bestResult.street || 'preflop',
        position: 'BTN',
        numPlayers: 2,
        myTurn: true
      },
      processingTime: Date.now() - startTime
    });

  } catch (error: any) {
    console.error('Detection error:', error);
    return NextResponse.json({
      success: false,
      needsClientProcessing: true,
      message: 'Processamento no servidor falhou. Use modo manual.',
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

// Extrair cartas de texto OCR
function extractCardsFromText(text: string): {
  heroCards: string[];
  board: string[];
  potSize: number;
  betToCall: number;
  street: string;
} {
  const rankPattern = '[2-9TJQKAtjqa]';
  const suitPattern = '[shdcSHDC♥♦♣♠]';
  const cardRegex = new RegExp(`${rankPattern}${suitPattern}`, 'g');
  
  const cards = text.match(cardRegex) || [];
  
  // Normalizar cartas
  const normalizedCards = cards.map(c => {
    const rank = c[0].toUpperCase().replace('T', 'T');
    let suit = c[1].toLowerCase();
    
    // Converter símbolos para letras
    if (suit === '♥') suit = 'h';
    if (suit === '♦') suit = 'd';
    if (suit === '♣') suit = 'c';
    if (suit === '♠') suit = 's';
    
    return rank + suit;
  }).filter(c => /^[2-9TJQKA][shdc]$/.test(c));

  // Primeiras 2 cartas são do herói
  const heroCards = normalizedCards.slice(0, 2);
  // Próximas 5 são do board
  const board = normalizedCards.slice(2, 7);

  // Detectar street
  let street = 'preflop';
  if (board.length >= 3) street = 'flop';
  if (board.length >= 4) street = 'turn';
  if (board.length >= 5) street = 'river';

  return {
    heroCards,
    board,
    potSize: 0,
    betToCall: 0,
    street
  };
}
