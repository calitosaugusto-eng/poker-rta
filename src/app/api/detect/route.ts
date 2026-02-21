/**
 * API de Detecção de Cartas via Visão
 * Solução que funciona automaticamente no Vercel
 */

import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

// Configurar SDK via variáveis de ambiente se disponíveis
const ZAI_CONFIG = {
  baseUrl: process.env.ZAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY || ''
};

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
    
    console.log('🔍 Analisando imagem de poker...');
    const startTime = Date.now();
    
    const prompt = `Você é um especialista em poker. Analise esta imagem de uma mesa de poker e extraia as informações em JSON puro:

{
  "heroCards": [],
  "board": [],
  "potSize": 0,
  "betToCall": 0,
  "myStack": 1000,
  "street": "preflop",
  "position": "BTN",
  "numPlayers": 2,
  "myTurn": true
}

REGRAS CRÍTICAS:
1. heroCards: Suas 2 cartas privadas (mão do jogador)
   - Rank: 2-9, T(10), J, Q, K, A
   - Naipe: s=espadas♠, h=copas♥, d=ouros♦, c=paus♣
   - Exemplo: ["Ah", "Ks"] = Ás de copas, Rei de espadas

2. board: Cartas comunitárias visíveis
   - Flop: 3 cartas ["7c", "8d", "2h"]
   - Turn: 4 cartas
   - River: 5 cartas
   - Preflop: [] (vazio)

3. potSize: Valor numérico total do pote
4. betToCall: Valor para igualar a aposta atual
5. myStack: Suas fichas restantes
6. street: "preflop", "flop", "turn", ou "river"
7. position: UTG, MP, HJ, CO, BTN, SB, ou BB
8. numPlayers: Jogadores na mão (2-10)
9. myTurn: true se for sua vez de agir

Analise CUIDADOSAMENTE:
- Identifique TODAS as cartas visíveis
- Leve em conta o design da mesa de poker
- Cartas do herói geralmente estão na parte inferior
- Board está no centro da mesa

Responda APENAS com o JSON, sem markdown, sem explicação.`;

    let content = '';
    
    // Tentar usar z-ai-web-dev-sdk com configuração
    try {
      // Se temos API key configurada, usar diretamente
      if (ZAI_CONFIG.apiKey) {
        const response = await fetch(`${ZAI_CONFIG.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ZAI_CONFIG.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageData } }
              ]
            }],
            max_tokens: 500,
            temperature: 0.1
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          content = data.choices?.[0]?.message?.content || '';
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      } else {
        // Tentar usar SDK sem configuração (pode funcionar em alguns ambientes)
        const zai = await ZAI.create();
        
        const response = await zai.chat.completions.createVision({
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageData } }
            ]
          }],
          thinking: { type: 'disabled' }
        });
        
        content = response.choices[0]?.message?.content || '';
      }
    } catch (sdkError: any) {
      console.log('SDK/Primary API failed:', sdkError.message);
      
      // Se falhou, retornar erro informativo
      return NextResponse.json({
        error: 'API de visão não configurada',
        message: 'Para usar detecção automática, configure OPENAI_API_KEY no Vercel',
        setup: {
          step1: 'Vá em Settings → Environment Variables',
          step2: 'Adicione: OPENAI_API_KEY = sua_chave',
          step3: 'Faça redeploy do projeto'
        },
        alternative: 'Use o modo manual para selecionar as cartas'
      }, { status: 500 });
    }
    
    console.log(`✅ Resposta recebida em ${Date.now() - startTime}ms`);
    
    // Parse JSON
    let gameState;
    try {
      // Limpar resposta e extrair JSON
      let cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        gameState = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Parse error. Content:', content);
      return NextResponse.json({
        error: 'Falha ao processar resposta',
        raw: content.substring(0, 500)
      }, { status: 500 });
    }
    
    // Validar dados
    const validatedState = {
      heroCards: Array.isArray(gameState.heroCards) 
        ? gameState.heroCards.filter((c: string) => c && /^[2-9TJQKA][shdc]$/i.test(c)).slice(0, 2) 
        : [],
      board: Array.isArray(gameState.board) 
        ? gameState.board.filter((c: string) => c && /^[2-9TJQKA][shdc]$/i.test(c)).slice(0, 5) 
        : [],
      potSize: typeof gameState.potSize === 'number' ? Math.max(0, Math.floor(gameState.potSize)) : 0,
      betToCall: typeof gameState.betToCall === 'number' ? Math.max(0, Math.floor(gameState.betToCall)) : 0,
      stackSize: typeof gameState.myStack === 'number' ? Math.max(0, Math.floor(gameState.myStack)) : 1000,
      street: ['preflop', 'flop', 'turn', 'river'].includes(gameState.street) ? gameState.street : 'preflop',
      position: ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'].includes(gameState.position) ? gameState.position : 'BTN',
      numPlayers: typeof gameState.numPlayers === 'number' ? Math.max(2, Math.min(10, gameState.numPlayers)) : 2,
      myTurn: gameState.myTurn !== false
    };
    
    return NextResponse.json({
      success: true,
      gameState: validatedState,
      processingTime: Date.now() - startTime,
      detectedCards: {
        hero: validatedState.heroCards.length,
        board: validatedState.board.length
      }
    });
    
  } catch (error: any) {
    console.error('Detection error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro na detecção' },
      { status: 500 }
    );
  }
}
