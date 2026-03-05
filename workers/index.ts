/**
 * Poker RTA API - Cloudflare Workers
 * APIs de detecção e análise de poker
 */

// ==================== TIPOS ====================

interface DetectRequest {
  imageData: string;
}

interface AnalyzeRequest {
  heroCards: string[];
  board: string[];
  potSize: number;
  betToCall: number;
  stackSize: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  position: string;
  numPlayers: number;
}

// ==================== CONSTANTES ====================

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const SUITS = ['h', 'd', 'c', 's'] as const;
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const SUIT_SYMBOLS: Record<string, string> = {
  'h': '♥', 'd': '♦', 'c': '♣', 's': '♠'
};

const SUIT_COLORS: Record<string, string> = {
  'h': '#ff4444', 'd': '#ff4444', 'c': '#333333', 's': '#333333'
};

const PREFLOP_STRENGTH: Record<string, number> = {
  'AA': 0.85, 'KK': 0.82, 'QQ': 0.80, 'JJ': 0.77, 'AKs': 0.67,
  'TT': 0.75, 'AKo': 0.65, '99': 0.72, 'AQs': 0.66, 'AJs': 0.65,
  '88': 0.70, 'AQo': 0.64, 'KQs': 0.63, 'ATs': 0.62, '77': 0.68,
  'AJo': 0.61, 'KQo': 0.60, '66': 0.66, 'ATo': 0.58, '55': 0.64,
  'JTs': 0.58, 'T9s': 0.55, '98s': 0.52, 'KJs': 0.60, 'QJs': 0.59,
  'KTs': 0.57, 'QTs': 0.56, 'JTo': 0.54, 'A9s': 0.56, 'A8s': 0.55,
  'A7s': 0.54, 'A6s': 0.52, 'A5s': 0.53, 'A4s': 0.51, 'A3s': 0.50,
  'A2s': 0.49, 'K9s': 0.52, 'Q9s': 0.50, '44': 0.62, '33': 0.60, '22': 0.58
};

// APIs gratuitas para OCR
const FREE_APIS = {
  ocrSpace: {
    url: 'https://api.ocr.space/parse/image',
    freeKey: 'K83936267888957'
  },
  huggingface: {
    models: [
      'Salesforce/blip-image-captioning-large',
      'nlpconnect/vit-gpt2-image-captioning'
    ]
  }
};

// ==================== FUNÇÕES DE POKER ====================

function parseCard(cardStr: string): { rank: string; suit: string } | null {
  if (!cardStr || cardStr.length < 2) return null;
  const rank = cardStr[0].toUpperCase();
  const suit = cardStr[1].toLowerCase();
  if (!RANKS.includes(rank as any)) return null;
  if (!SUITS.includes(suit as any)) return null;
  return { rank, suit };
}

function getHandName(cards: { rank: string; suit: string }[]): string {
  if (cards.length !== 2) return 'Unknown';
  const r1 = RANK_VALUES[cards[0].rank];
  const r2 = RANK_VALUES[cards[1].rank];
  const suited = cards[0].suit === cards[1].suit;
  const high = r1 >= r2 ? cards[0].rank : cards[1].rank;
  const low = r1 >= r2 ? cards[1].rank : cards[0].rank;
  if (high === low) return high + low;
  return high + low + (suited ? 's' : 'o');
}

function calculatePotOdds(pot: number, betToCall: number): number {
  if (betToCall === 0) return 0;
  return betToCall / (pot + betToCall);
}

function getPreflopStrength(cards: { rank: string; suit: string }[]): number {
  const handName = getHandName(cards);
  return PREFLOP_STRENGTH[handName] || 0.35;
}

function estimateOuts(heroCards: { rank: string; suit: string }[], board: { rank: string; suit: string }[]): number {
  if (board.length === 0) return 0;
  const allCards = [...heroCards, ...board];
  const suits = allCards.map(c => c.suit);
  const suitCounts: Record<string, number> = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  if (maxSuitCount === 4) return 9; // Flush draw

  const ranks = allCards.map(c => RANK_VALUES[c.rank]);
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);

  // OESD
  for (let i = 0; i < uniqueRanks.length - 3; i++) {
    const window = uniqueRanks.slice(i, i + 4);
    if (window[3] - window[0] <= 4) return 8;
  }

  // Gutshot
  for (let i = 0; i < uniqueRanks.length - 2; i++) {
    if (uniqueRanks[i + 2] - uniqueRanks[i] <= 4) return 4;
  }

  const rankCounts: Record<number, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
  const hasPair = Object.values(rankCounts).some(c => c === 2);
  if (hasPair) return 2;

  return 0;
}

function evaluateHandStrength(heroCards: { rank: string; suit: string }[], board: { rank: string; suit: string }[]): { rank: string; name: string; strength: number } {
  const allCards = [...heroCards, ...board];
  if (allCards.length < 2) return { rank: 'high', name: 'High Card', strength: 0.1 };

  const ranks = allCards.map(c => RANK_VALUES[c.rank]);
  const suits = allCards.map(c => c.suit);

  const rankCounts: Record<number, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);

  const suitCounts: Record<string, number> = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  const hasFlush = maxSuitCount >= 5;

  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
  let straightHigh = 0;

  if (uniqueRanks.includes(14)) uniqueRanks.unshift(1);

  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    let consecutive = 1;
    for (let j = i + 1; j < uniqueRanks.length && consecutive < 5; j++) {
      if (uniqueRanks[j] === uniqueRanks[j - 1] + 1) {
        consecutive++;
        if (consecutive >= 5) straightHigh = uniqueRanks[j];
      } else if (uniqueRanks[j] !== uniqueRanks[j - 1]) break;
    }
  }

  const hasStraight = straightHigh > 0;

  if (hasStraight && hasFlush) {
    if (straightHigh === 14) return { rank: 'royalflush', name: 'Royal Flush', strength: 0.99 };
    return { rank: 'straightflush', name: 'Straight Flush', strength: 0.95 };
  }
  if (counts[0] === 4) return { rank: 'quads', name: 'Four of a Kind', strength: 0.90 };
  if (counts[0] === 3 && counts[1] >= 2) return { rank: 'fullhouse', name: 'Full House', strength: 0.85 };
  if (hasFlush) return { rank: 'flush', name: 'Flush', strength: 0.80 };
  if (hasStraight) return { rank: 'straight', name: 'Straight', strength: 0.75 };
  if (counts[0] === 3) return { rank: 'trips', name: 'Three of a Kind', strength: 0.65 };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 'twopair', name: 'Two Pair', strength: 0.55 };
  if (counts[0] === 2) return { rank: 'pair', name: 'One Pair', strength: 0.40 };

  return { rank: 'high', name: 'High Card', strength: 0.15 };
}

function calculateEquity(heroCards: { rank: string; suit: string }[], board: { rank: string; suit: string }[], numOpponents: number = 1): number {
  if (board.length === 0) {
    const preflop = getPreflopStrength(heroCards);
    return preflop / Math.pow(1.1, numOpponents - 1);
  }

  const handStrength = evaluateHandStrength(heroCards, board);
  const outs = estimateOuts(heroCards, board);
  const cardsRemaining = 52 - heroCards.length - board.length;
  const streetsLeft = 5 - board.length;

  let equity = handStrength.strength;
  if (outs > 0 && streetsLeft > 0) {
    const outsEquity = 1 - Math.pow(1 - outs / cardsRemaining, streetsLeft);
    equity = Math.max(equity, outsEquity * 0.8);
  }

  return equity / Math.pow(1.05, numOpponents - 1);
}

// ==================== DETECÇÃO DE CARTAS ====================

async function detectWithOCRSpace(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

  const formData = new URLSearchParams();
  formData.append('base64Image', `data:image/png;base64,${base64Data}`);
  formData.append('apikey', FREE_APIS.ocrSpace.freeKey);
  formData.append('language', 'eng');
  formData.append('OCREngine', '2');
  formData.append('scale', 'true');

  const response = await fetch(FREE_APIS.ocrSpace.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  const data = await response.json() as any;
  return data.ParsedResults?.[0]?.ParsedText || '';
}

async function detectWithHuggingFace(imageData: string): Promise<string> {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

  for (const model of FREE_APIS.huggingface.models) {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: base64Data })
      });

      if (!response.ok) continue;

      const data = await response.json() as any;
      const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
      if (text) return text;
    } catch (e) {
      continue;
    }
  }

  return '';
}

function extractCardsFromText(text: string): { heroCards: string[]; board: string[] } {
  const cards: string[] = [];

  // Padrão: As, Kh, Tc, 2d
  const standardPattern = /\b([2-9TJQKA])([shdc])\b/gi;
  let match;
  while ((match = standardPattern.exec(text)) !== null) {
    const card = match[1].toUpperCase() + match[2].toLowerCase();
    if (!cards.includes(card)) cards.push(card);
  }

  // Padrão com símbolos: A♠, K♥
  const symbolPattern = /([2-9TJQKA])[♠♥♦♣]/g;
  while ((match = symbolPattern.exec(text)) !== null) {
    const rank = match[1].toUpperCase();
    const suitMap: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
    const suit = suitMap[match[0].slice(-1)];
    if (suit) {
      const card = rank + suit;
      if (!cards.includes(card)) cards.push(card);
    }
  }

  return {
    heroCards: cards.slice(0, 2),
    board: cards.slice(2, 7)
  };
}

// ==================== HANDLERS ====================

async function handleDetect(request: Request): Promise<Response> {
  try {
    const body = await request.json() as DetectRequest;
    const { imageData } = body;

    if (!imageData) {
      return Response.json({ success: false, message: 'ImageData é obrigatório' }, { status: 400 });
    }

    // Executar OCR em paralelo
    const [ocrText, hfText] = await Promise.all([
      detectWithOCRSpace(imageData).catch(() => ''),
      detectWithHuggingFace(imageData).catch(() => '')
    ]);

    const combinedText = ocrText + ' ' + hfText;
    const { heroCards, board } = extractCardsFromText(combinedText);

    if (heroCards.length < 2) {
      return Response.json({
        success: false,
        needsManualInput: true,
        message: 'Não foi possível detectar as cartas. Use o modo manual.',
        extractedText: combinedText.substring(0, 200)
      });
    }

    let street = 'preflop';
    if (board.length >= 3) street = 'flop';
    if (board.length >= 4) street = 'turn';
    if (board.length >= 5) street = 'river';

    return Response.json({
      success: true,
      gameState: { heroCards, board, potSize: 0, street },
      usedApis: ['OCR.space', 'HuggingFace']
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      message: 'Erro na detecção: ' + error.message
    }, { status: 500 });
  }
}

async function handleAnalyze(request: Request): Promise<Response> {
  try {
    const body = await request.json() as AnalyzeRequest;
    const { heroCards, board, potSize, betToCall, stackSize, street, position, numPlayers } = body;

    if (!heroCards || heroCards.length < 2) {
      return Response.json({ success: false, message: 'Cartas do herói são obrigatórias' }, { status: 400 });
    }

    // Parse cards
    const parsedHero = heroCards.map(parseCard).filter(Boolean) as { rank: string; suit: string }[];
    const parsedBoard = board.map(parseCard).filter(Boolean) as { rank: string; suit: string }[];

    if (parsedHero.length < 2) {
      return Response.json({ success: false, message: 'Formato de cartas inválido' }, { status: 400 });
    }

    // Calculate metrics
    const potOdds = calculatePotOdds(potSize, betToCall);
    const equity = calculateEquity(parsedHero, parsedBoard, numPlayers);
    const outs = estimateOuts(parsedHero, parsedBoard);
    const handStrength = evaluateHandStrength(parsedHero, parsedBoard);

    // EV calculations
    const evCall = (equity * (potSize + betToCall)) - ((1 - equity) * betToCall);
    const raiseSize = Math.min(potSize * 0.75, stackSize);
    const evRaise = (equity * (potSize + raiseSize * 2)) - ((1 - equity) * raiseSize);

    // Determine action
    let action = 'fold';
    let amount = 0;
    let confidence = 0;
    let reasoning = '';
    let actionColor = '#ef4444';
    let quickAction = 'FOLD';

    if (equity > 0.7) {
      action = 'raise';
      amount = raiseSize;
      confidence = 0.9;
      reasoning = `Mão forte! Equity ${(equity * 100).toFixed(0)}% - Value bet`;
      actionColor = '#22c55e';
      quickAction = 'RAISE';
    } else if (equity > 0.5) {
      if (betToCall === 0) {
        action = 'check';
        confidence = 0.8;
        reasoning = `Check com equity ${(equity * 100).toFixed(0)}%`;
        actionColor = '#3b82f6';
        quickAction = 'CHECK';
      } else {
        action = 'call';
        amount = betToCall;
        confidence = 0.75;
        reasoning = `Call +EV. Equity > Pot odds`;
        actionColor = '#f59e0b';
        quickAction = 'CALL';
      }
    } else if (equity > 0.3 || outs >= 8) {
      if (betToCall === 0 || equity > potOdds) {
        action = 'call';
        amount = betToCall;
        confidence = 0.6;
        reasoning = `Call com ${outs} outs. Implied odds favoráveis`;
        actionColor = '#f59e0b';
        quickAction = 'CALL';
      } else {
        action = 'fold';
        confidence = 0.85;
        reasoning = `Fold. Pot odds altas para equity baixa`;
        actionColor = '#ef4444';
        quickAction = 'FOLD';
      }
    } else {
      action = 'fold';
      confidence = 0.9;
      reasoning = `Fold. Equity muito baixa (${(equity * 100).toFixed(0)}%)`;
      actionColor = '#ef4444';
      quickAction = 'FOLD';
    }

    const ev = action === 'call' ? evCall : action === 'raise' ? evRaise : 0;

    return Response.json({
      success: true,
      state: {
        heroCards: parsedHero.map(c => ({
          rank: c.rank,
          suit: c.suit,
          display: c.rank + SUIT_SYMBOLS[c.suit],
          color: SUIT_COLORS[c.suit]
        })),
        board: parsedBoard.map(c => ({
          rank: c.rank,
          suit: c.suit,
          display: c.rank + SUIT_SYMBOLS[c.suit],
          color: SUIT_COLORS[c.suit]
        })),
        potSize,
        betToCall,
        stackSize,
        street,
        position,
        numPlayers
      },
      analysis: {
        handName: handStrength.name,
        potOdds: `${(potOdds * 100).toFixed(1)}%`,
        equity: `${(equity * 100).toFixed(1)}%`,
        outs,
        ev: ev >= 0 ? `+$${ev.toFixed(2)}` : `-$${Math.abs(ev).toFixed(2)}`
      },
      recommendation: {
        action,
        amount,
        confidence: `${(confidence * 100).toFixed(0)}%`,
        reasoning,
        actionColor,
        quickAction
      },
      insights: outs > 0 ? [`${outs} outs para melhorar sua mão`] : []
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      message: 'Erro na análise: ' + error.message
    }, { status: 500 });
  }
}

// ==================== ROUTER ====================

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route
    if (url.pathname === '/api/detect' && request.method === 'POST') {
      const response = await handleDetect(request);
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      const response = await handleAnalyze(request);
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders });
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  }
};
