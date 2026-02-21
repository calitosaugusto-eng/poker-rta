/**
 * API de Detecção de Cartas via VLM
 * Analisa screenshots e extrai informações do jogo
 * 
 * Funciona com:
 * - z-ai-web-dev-sdk (se configurado)
 * - OpenAI API (se OPENAI_API_KEY configurada)
 */

import { NextRequest, NextResponse } from 'next/server';

async function analyzeWithVision(imageData: string): Promise<any> {
  const prompt = `Você é um especialista em poker. Analise esta imagem de uma mesa de poker e extraia as seguintes informações em formato JSON:

{
  "heroCards": ["As", "Kh"],
  "board": ["Tc", "Jd", "Qs"],
  "potSize": 150,
  "betToCall": 50,
  "myStack": 1000,
  "street": "flop",
  "position": "BTN",
  "numPlayers": 4,
  "myTurn": true
}

IMPORTANTE:
- Naipe: s=espadas(♠), h=copas(♥), d=ouros(♦), c=paus(♣)
- Rank: 2-9, T(10), J, Q, K, A
- Se não conseguir identificar algum valor, use null
- Identifique as cartas visíveis na mesa
- Identifique os números de fichas/pote visíveis

Responda APENAS com o JSON válido, sem explicações adicionais.`;

  // Tentar usar z-ai-web-dev-sdk primeiro
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    
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
    
    return response.choices[0]?.message?.content || '';
  } catch (zaiError) {
    console.log('ZAI SDK não disponível, tentando fallback...');
    
    // Fallback: usar OpenAI se configurado
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageData } }
              ]
            }
          ],
          max_tokens: 500
        })
      });
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }
    
    throw new Error('Nenhuma API de visão configurada. Configure OPENAI_API_KEY no Vercel.');
  }
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
    
    const content = await analyzeWithVision(imageData);
    
    // Parse JSON from response
    let gameState;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        gameState = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse vision response:', content);
      return NextResponse.json(
        { error: 'Falha ao processar imagem', raw: content },
        { status: 500 }
      );
    }
    
    // Validate and clean the data
    const validatedState = {
      heroCards: Array.isArray(gameState.heroCards) ? gameState.heroCards.filter((c: string) => c && c.length >= 2) : [],
      board: Array.isArray(gameState.board) ? gameState.board.filter((c: string) => c && c.length >= 2) : [],
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
