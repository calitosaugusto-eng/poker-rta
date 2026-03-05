/**
 * POKER RTA ENGINE
 * Motor matemático completo para análise de poker
 */

// ==================== TIPOS ====================

export interface Card {
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
  suit: 'h' | 'd' | 'c' | 's';
}

export interface GameState {
  heroCards: Card[];
  board: Card[];
  potSize: number;
  betToCall: number;
  stackSize: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  position: string;
  numPlayers: number;
}

export interface Recommendation {
  action: 'fold' | 'check' | 'call' | 'raise' | 'allin';
  amount?: number;
  confidence: number;
  ev: number;
  reasoning: string;
  potOdds: number;
  equity: number;
  outs?: number;
}

export interface HandStrength {
  rank: string;
  name: string;
  strength: number;
}

// ==================== CONSTANTES ====================

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['h', 'd', 'c', 's'] as const;
export const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const SUIT_SYMBOLS: Record<string, string> = {
  'h': '♥', 'd': '♦', 'c': '♣', 's': '♠'
};

export const SUIT_COLORS: Record<string, string> = {
  'h': '#ff4444', 'd': '#ff4444', 'c': '#333333', 's': '#333333'
};

// Força de mãos pré-flop (simplified)
export const PREFLOP_STRENGTH: Record<string, number> = {
  'AA': 0.85, 'KK': 0.82, 'QQ': 0.80, 'JJ': 0.77, 'AKs': 0.67,
  'TT': 0.75, 'AKo': 0.65, '99': 0.72, 'AQs': 0.66, 'AJs': 0.65,
  '88': 0.70, 'AQo': 0.64, 'KQs': 0.63, 'ATs': 0.62, '77': 0.68,
  'AJo': 0.61, 'KQo': 0.60, '66': 0.66, 'ATo': 0.58, '55': 0.64,
  'JTs': 0.58, 'T9s': 0.55, '98s': 0.52, 'KJs': 0.60, 'QJs': 0.59,
  'KTs': 0.57, 'QTs': 0.56, 'JTo': 0.54, 'A9s': 0.56, 'A8s': 0.55,
  'A7s': 0.54, 'A6s': 0.52, 'A5s': 0.53, 'A4s': 0.51, 'A3s': 0.50,
  'A2s': 0.49, 'K9s': 0.52, 'Q9s': 0.50, '44': 0.62, '33': 0.60, '22': 0.58
};

// ==================== UTILITÁRIOS ====================

export function parseCard(cardStr: string): Card | null {
  if (!cardStr || cardStr.length < 2) return null;
  
  const rank = cardStr[0].toUpperCase();
  const suit = cardStr[1].toLowerCase();
  
  if (!RANKS.includes(rank as any)) return null;
  if (!SUITS.includes(suit as any)) return null;
  
  return { rank: rank as Card['rank'], suit: suit as Card['suit'] };
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardToDisplay(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function getHandName(cards: Card[]): string {
  if (cards.length !== 2) return 'Unknown';
  
  const r1 = RANK_VALUES[cards[0].rank];
  const r2 = RANK_VALUES[cards[1].rank];
  const suited = cards[0].suit === cards[1].suit;
  
  const high = r1 >= r2 ? cards[0].rank : cards[1].rank;
  const low = r1 >= r2 ? cards[1].rank : cards[0].rank;
  
  if (high === low) {
    return high + low;
  }
  
  return high + low + (suited ? 's' : 'o');
}

// ==================== CÁLCULOS MATEMÁTICOS ====================

export function calculatePotOdds(pot: number, betToCall: number): number {
  if (betToCall === 0) return 0;
  return betToCall / (pot + betToCall);
}

export function calculateImpliedOdds(
  pot: number, 
  betToCall: number, 
  stackRemaining: number, 
  outs: number
): number {
  const directOdds = calculatePotOdds(pot, betToCall);
  const impliedAddition = stackRemaining * 0.3 * (outs / 47);
  return directOdds - impliedAddition / (pot + betToCall);
}

export function estimateOuts(heroCards: Card[], board: Card[]): number {
  if (board.length === 0) return 0;
  
  const allCards = [...heroCards, ...board];
  const ranks = allCards.map(c => c.rank);
  const suits = allCards.map(c => c.suit);
  
  // Count suits for flush draw
  const suitCounts: Record<string, number> = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  
  // Flush draw
  if (maxSuitCount === 4) return 9;
  
  // Check for straight draw potential
  const uniqueRanks = [...new Set(ranks)].map(r => RANK_VALUES[r]).sort((a, b) => a - b);
  
  // Check for open-ended straight draw
  for (let i = 0; i < uniqueRanks.length - 3; i++) {
    const window = uniqueRanks.slice(i, i + 4);
    if (window[3] - window[0] <= 4) {
      return 8; // OESD
    }
  }
  
  // Gutshot
  for (let i = 0; i < uniqueRanks.length - 2; i++) {
    if (uniqueRanks[i + 2] - uniqueRanks[i] <= 4) {
      return 4;
    }
  }
  
  // Pair - set improvement
  const rankCounts: Record<string, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
  const hasPair = Object.values(rankCounts).some(c => c === 2);
  
  if (hasPair) return 2; // Set improvement
  
  return 0;
}

export function getPreflopStrength(cards: Card[]): number {
  const handName = getHandName(cards);
  return PREFLOP_STRENGTH[handName] || 0.35;
}

export function evaluateHandStrength(heroCards: Card[], board: Card[]): HandStrength {
  const allCards = [...heroCards, ...board];
  
  if (allCards.length < 2) {
    return { rank: 'high', name: 'High Card', strength: 0.1 };
  }
  
  const ranks = allCards.map(c => RANK_VALUES[c.rank]);
  const suits = allCards.map(c => c.suit);
  
  // Count ranks and suits
  const rankCounts: Record<number, number> = {};
  ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
  
  const suitCounts: Record<string, number> = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  
  // Check for flush
  const hasFlush = maxSuitCount >= 5;
  
  // Check for straight
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
  let straightHigh = 0;
  
  // Check for ace-low straight (wheel)
  if (uniqueRanks.includes(14)) {
    uniqueRanks.unshift(1); // Ace as 1
  }
  
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    let consecutive = 1;
    for (let j = i + 1; j < uniqueRanks.length && consecutive < 5; j++) {
      if (uniqueRanks[j] === uniqueRanks[j-1] + 1) {
        consecutive++;
        if (consecutive >= 5) {
          straightHigh = uniqueRanks[j];
        }
      } else if (uniqueRanks[j] !== uniqueRanks[j-1]) {
        break;
      }
    }
  }
  
  const hasStraight = straightHigh > 0;
  
  // Determine hand rank
  if (hasStraight && hasFlush) {
    if (straightHigh === 14) {
      return { rank: 'royalflush', name: 'Royal Flush', strength: 0.99 };
    }
    return { rank: 'straightflush', name: 'Straight Flush', strength: 0.95 };
  }
  
  if (counts[0] === 4) {
    return { rank: 'quads', name: 'Four of a Kind', strength: 0.90 };
  }
  
  if (counts[0] === 3 && counts[1] >= 2) {
    return { rank: 'fullhouse', name: 'Full House', strength: 0.85 };
  }
  
  if (hasFlush) {
    return { rank: 'flush', name: 'Flush', strength: 0.80 };
  }
  
  if (hasStraight) {
    return { rank: 'straight', name: 'Straight', strength: 0.75 };
  }
  
  if (counts[0] === 3) {
    return { rank: 'trips', name: 'Three of a Kind', strength: 0.65 };
  }
  
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: 'twopair', name: 'Two Pair', strength: 0.55 };
  }
  
  if (counts[0] === 2) {
    return { rank: 'pair', name: 'One Pair', strength: 0.40 };
  }
  
  return { rank: 'high', name: 'High Card', strength: 0.15 };
}

export function calculateEquity(heroCards: Card[], board: Card[], numOpponents: number = 1): number {
  if (board.length === 0) {
    // Preflop equity
    const preflop = getPreflopStrength(heroCards);
    return preflop / Math.pow(1.1, numOpponents - 1);
  }
  
  // Postflop equity estimation
  const handStrength = evaluateHandStrength(heroCards, board);
  const outs = estimateOuts(heroCards, board);
  
  // Cards remaining to come
  const cardsRemaining = 52 - heroCards.length - board.length;
  const streetsLeft = 5 - board.length;
  
  // Calculate equity from hand strength + outs
  let equity = handStrength.strength;
  
  if (outs > 0 && streetsLeft > 0) {
    const outsEquity = 1 - Math.pow(1 - outs / cardsRemaining, streetsLeft);
    equity = Math.max(equity, outsEquity * 0.8);
  }
  
  // Adjust for number of opponents
  return equity / Math.pow(1.05, numOpponents - 1);
}

// ==================== ENGINE DE RECOMENDAÇÃO ====================

export function generateRecommendation(state: GameState): Recommendation {
  const { heroCards, board, potSize, betToCall, stackSize, street, numPlayers } = state;
  
  // Calculate key metrics
  const potOdds = calculatePotOdds(potSize, betToCall);
  const equity = calculateEquity(heroCards, board, numPlayers);
  const outs = estimateOuts(heroCards, board);
  const handStrength = evaluateHandStrength(heroCards, board);
  
  // EV calculations
  const evFold = 0;
  const evCheck = equity * potSize;
  const evCall = (equity * (potSize + betToCall)) - ((1 - equity) * betToCall);
  
  // Recommended raise size
  const raiseSize = Math.min(potSize * 0.75, stackSize);
  const evRaise = (equity * (potSize + raiseSize * 2)) - ((1 - equity) * raiseSize);
  const evAllIn = (equity * (potSize + stackSize * 2)) - ((1 - equity) * stackSize);
  
  // MDF calculation
  const mdf = betToCall > 0 ? betToCall / (potSize + betToCall) : 0;
  
  // Decision logic
  let action: Recommendation['action'] = 'fold';
  let amount = 0;
  let confidence = 0;
  let reasoning = '';
  
  // Strong hand logic
  if (equity > 0.7) {
    if (stackSize < potSize * 2) {
      action = 'allin';
      amount = stackSize;
      confidence = 0.95;
      reasoning = `Mão forte (${(equity * 100).toFixed(0)}% equity). All-in é +EV.`;
    } else {
      action = 'raise';
      amount = raiseSize;
      confidence = 0.90;
      reasoning = `Value raise. Equity: ${(equity * 100).toFixed(0)}%`;
    }
  }
  // Medium strength
  else if (equity > 0.5) {
    if (betToCall === 0) {
      action = 'check';
      confidence = 0.75;
      reasoning = `Check para controle de pote. Equity: ${(equity * 100).toFixed(0)}%`;
    } else if (equity > potOdds + 0.05) {
      action = 'call';
      amount = betToCall;
      confidence = 0.80;
      reasoning = `Call +EV. Equity ${(equity * 100).toFixed(0)}% > Pot odds ${(potOdds * 100).toFixed(0)}%`;
    } else {
      action = 'raise';
      amount = raiseSize;
      confidence = 0.65;
      reasoning = `Semi-blefe com ${(equity * 100).toFixed(0)}% equity`;
    }
  }
  // Marginal / drawing hand
  else if (equity > 0.3 || outs >= 8) {
    if (betToCall === 0) {
      action = 'check';
      confidence = 0.70;
      reasoning = `Check behind. ${outs} outs`;
    } else if (equity > potOdds || (outs >= 8 && calculateImpliedOdds(potSize, betToCall, stackSize, outs) < equity)) {
      action = 'call';
      amount = betToCall;
      confidence = 0.60;
      reasoning = `Call com draw. ${outs} outs, implied odds favoráveis`;
    } else if (equity > mdf * 0.8 && betToCall < stackSize * 0.1) {
      action = 'call';
      amount = betToCall;
      confidence = 0.55;
      reasoning = `Defesa MDF. Equity marginal.`;
    } else {
      action = 'fold';
      confidence = 0.85;
      reasoning = `Fold. Pot odds ${(potOdds * 100).toFixed(0)}% muito altas para equity ${(equity * 100).toFixed(0)}%`;
    }
  }
  // Weak hand
  else {
    if (betToCall === 0) {
      // Opportunity to bluff?
      if (street === 'flop' || street === 'turn') {
        const bluffSuccess = potSize / (potSize + raiseSize);
        if (bluffSuccess > 0.4) {
          action = 'raise';
          amount = raiseSize;
          confidence = 0.45;
          reasoning = `Blefe oportunístico. Fold equity estimada: ${(bluffSuccess * 100).toFixed(0)}%`;
        } else {
          action = 'check';
          confidence = 0.80;
          reasoning = `Check. Mão fraca.`;
        }
      } else {
        action = 'check';
        confidence = 0.85;
        reasoning = `Check. Mão fraca.`;
      }
    } else {
      action = 'fold';
      confidence = 0.95;
      reasoning = `Fold. Equity ${(equity * 100).toFixed(0)}% muito baixa.`;
    }
  }
  
  const ev = action === 'fold' ? evFold : 
             action === 'check' ? evCheck :
             action === 'call' ? evCall :
             action === 'raise' ? evRaise : evAllIn;
  
  return {
    action,
    amount,
    confidence,
    ev: Math.round(ev * 100) / 100,
    reasoning,
    potOdds: Math.round(potOdds * 1000) / 1000,
    equity: Math.round(equity * 1000) / 1000,
    outs
  };
}

// ==================== POSIÇÕES E RANGES ====================

export const POSITIONS = {
  'UTG': { name: 'Under the Gun', shorthand: 'UTG', seats: 6 },
  'UTG+1': { name: 'UTG+1', shorthand: 'UTG+1', seats: 9 },
  'MP': { name: 'Middle Position', shorthand: 'MP', seats: 6 },
  'HJ': { name: 'Hijack', shorthand: 'HJ', seats: 6 },
  'CO': { name: 'Cutoff', shorthand: 'CO', seats: 6 },
  'BTN': { name: 'Button', shorthand: 'BTN', seats: 6 },
  'SB': { name: 'Small Blind', shorthand: 'SB', seats: 6 },
  'BB': { name: 'Big Blind', shorthand: 'BB', seats: 6 }
};

// Push/Fold ranges for short stack (simplified)
export function shouldPushFold(
  cards: Card[], 
  stackBB: number, 
  position: string, 
  numPlayers: number
): { push: boolean; range: string } {
  const handName = getHandName(cards);
  const strength = PREFLOP_STRENGTH[handName] || 0.35;
  
  // Simplified push/fold logic
  const pushThreshold = position === 'BTN' ? 0.35 : 
                       position === 'SB' ? 0.40 :
                       position === 'BB' ? 0.45 : 0.50;
  
  const shouldPush = strength > pushThreshold && stackBB <= 15;
  
  return {
    push: shouldPush,
    range: strength > 0.6 ? 'Strong' : strength > 0.45 ? 'Medium' : 'Weak'
  };
}
