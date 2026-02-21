/**
 * API de Detecção de Cartas via VLM
 * Analisa screenshots e extrai informações do jogo
 */

import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

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
    
    const zai = await ZAI.create();
    
    // Prompt para extração de informações do poker
    const prompt = `Você é um especialista em poker. Analise esta imagem de uma mesa de poker e extraia as seguintes informações em formato JSON:

{
  "heroCards": ["As", "Kh"],  // Suas cartas (formato: Rank+naipe, ex: "As" = Ás de espadas, "Kh" = Rei de copas)
  "board": ["Tc", "Jd", "Qs"], // Cartas comunitárias no flop/turn/river
  "potSize": 150,              // Tamanho do pote em fichas/dinheiro
  "betToCall": 50,             // Valor para pagar
  "myStack": 1000,             // Seu stack restante
  "street": "flop",            // preflop, flop, turn, river
  "position": "BTN",           // Sua posição (UTG, MP, CO, BTN, SB, BB)
  "numPlayers": 4,             // Número de jogadores na mão
  "myTurn": true               // É sua vez de agir?
}

IMPORTANTE:
- Naipe: s=espadas(♠), h=copas(♥), d=ouros(♦), c=paus(♣)
- Rank: 2-9, T(10), J, Q, K, A
- Se não conseguir identificar algum valor, use null
- Seja preciso na identificação das cartas
- Identifique os números de fichas/pote visíveis

Responda APENAS com o JSON, sem explicações adicionais.`;

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageData } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    });
    
    const content = response.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    let gameState;
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        gameState = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse VLM response:', content);
      return NextResponse.json(
        { error: 'Falha ao processar imagem', raw: content },
        { status: 500 }
      );
    }
    
    // Validate and clean the data
    const validatedState = {
      heroCards: Array.isArray(gameState.heroCards) ? gameState.heroCards : [],
      board: Array.isArray(gameState.board) ? gameState.board : [],
      potSize: typeof gameState.potSize === 'number' ? gameState.potSize : 0,
      betToCall: typeof gameState.betToCall === 'number' ? gameState.betToCall : 0,
      stackSize: typeof gameState.myStack === 'number' ? gameState.myStack : 1000,
      street: ['preflop', 'flop', 'turn', 'river'].includes(gameState.street) ? gameState.street : 'preflop',
      position: gameState.position || 'BTN',
      numPlayers: typeof gameState.numPlayers === 'number' ? gameState.numPlayers : 2,
      myTurn: gameState.myTurn !== false
    };
    
    return NextResponse.json({
      success: true,
      gameState: validatedState,
      raw: content
    });
    
  } catch (error: any) {
    console.error('Detection error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro na detecção' },
      { status: 500 }
    );
  }
}
