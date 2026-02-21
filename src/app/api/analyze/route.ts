/**
 * API de Análise e Recomendação de Poker
 * Recebe estado do jogo e retorna recomendação GTO
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  parseCard,
  generateRecommendation,
  GameState,
  Recommendation,
  cardToDisplay,
  SUIT_SYMBOLS,
  SUIT_COLORS
} from '@/lib/poker-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      heroCards: heroCardStrs, 
      board: boardStrs, 
      potSize, 
      betToCall, 
      stackSize,
      street,
      position,
      numPlayers 
    } = body;
    
    // Parse cards
    const heroCards = heroCardStrs?.map(parseCard).filter(Boolean) || [];
    const board = boardStrs?.map(parseCard).filter(Boolean) || [];
    
    // Validate minimum requirements
    if (heroCards.length < 2) {
      return NextResponse.json({
        error: 'Mínimo 2 cartas do herói necessárias',
        needsMoreInfo: true
      });
    }
    
    // Build game state
    const gameState: GameState = {
      heroCards: heroCards as any,
      board: board as any,
      potSize: typeof potSize === 'number' ? potSize : 0,
      betToCall: typeof betToCall === 'number' ? betToCall : 0,
      stackSize: typeof stackSize === 'number' ? stackSize : 1000,
      street: street || 'preflop',
      position: position || 'BTN',
      numPlayers: typeof numPlayers === 'number' ? numPlayers : 2
    };
    
    // Generate recommendation
    const recommendation = generateRecommendation(gameState);
    
    // Format cards for display
    const formatCards = (cards: any[]) => {
      return cards.map(c => ({
        rank: c.rank,
        suit: c.suit,
        symbol: SUIT_SYMBOLS[c.suit],
        color: SUIT_COLORS[c.suit],
        display: cardToDisplay(c)
      }));
    };
    
    // Build response
    const response = {
      success: true,
      timestamp: Date.now(),
      
      // Game state
      state: {
        heroCards: formatCards(heroCards),
        board: formatCards(board),
        potSize: gameState.potSize,
        betToCall: gameState.betToCall,
        stackSize: gameState.stackSize,
        street: gameState.street,
        position: gameState.position,
        numPlayers: gameState.numPlayers
      },
      
      // Analysis
      analysis: {
        handName: heroCards.length === 2 ? 
          `${heroCards[0].rank}${heroCards[1].rank}${heroCards[0].suit === heroCards[1].suit ? 's' : 'o'}` : 
          'Unknown',
        potOdds: `${(recommendation.potOdds * 100).toFixed(1)}%`,
        equity: `${(recommendation.equity * 100).toFixed(1)}%`,
        outs: recommendation.outs || 0,
        ev: recommendation.ev >= 0 ? `+$${recommendation.ev.toFixed(2)}` : `-$${Math.abs(recommendation.ev).toFixed(2)}`
      },
      
      // Recommendation
      recommendation: {
        action: recommendation.action.toUpperCase(),
        amount: recommendation.amount,
        confidence: `${(recommendation.confidence * 100).toFixed(0)}%`,
        reasoning: recommendation.reasoning,
        
        // Color coding for UI
        actionColor: 
          recommendation.action === 'fold' ? '#dc3545' :
          recommendation.action === 'call' || recommendation.action === 'check' ? '#ffc107' :
          '#28a745', // raise/allin
        
        // Quick action indicator
        quickAction: 
          recommendation.action === 'fold' ? '❌ FOLD' :
          recommendation.action === 'check' ? '✋ CHECK' :
          recommendation.action === 'call' ? '📞 CALL' :
          recommendation.action === 'raise' ? '📈 RAISE' :
          '🚀 ALL-IN'
      },
      
      // Additional insights
      insights: generateInsights(gameState, recommendation)
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro na análise' },
      { status: 500 }
    );
  }
}

function generateInsights(state: GameState, rec: Recommendation): string[] {
  const insights: string[] = [];
  
  // Pot odds insight
  if (rec.potOdds > 0.4) {
    insights.push(`⚠️ Pot odds altas (${(rec.potOdds * 100).toFixed(0)}%) - preciso de equity significativa`);
  } else if (rec.potOdds > 0 && rec.potOdds < 0.2) {
    insights.push(`✅ Pot odds favoráveis (${(rec.potOdds * 100).toFixed(0)}%) - call mais fácil`);
  }
  
  // Equity insight
  if (rec.equity > 0.6) {
    insights.push(`💪 Mão forte - buscar extrair valor`);
  } else if (rec.equity < 0.3 && rec.action !== 'fold') {
    insights.push(`🎲 Equity baixa - blefe ou semi-blefe`);
  }
  
  // Position insight
  if (state.position === 'BTN') {
    insights.push(`📍 Posição: Button - vantagem posicional`);
  } else if (state.position === 'SB' || state.position === 'BB') {
    insights.push(`📍 Posição: Blind - jogar mais tight OOP`);
  }
  
  // Stack insight
  const spr = state.stackSize / (state.potSize || 1);
  if (spr < 5) {
    insights.push(`💰 Stack curto (SPR ${spr.toFixed(1)}) - considerar push/fold`);
  }
  
  return insights;
}
