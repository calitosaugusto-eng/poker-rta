'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  parseCard,
  generateRecommendation,
  GameState,
  Recommendation,
  RANKS,
  SUITS,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  cardToDisplay
} from '@/lib/poker-engine';

// ==================== TIPOS ====================

interface DetectedState {
  heroCards: string[];
  board: string[];
  potSize: number;
  betToCall: number;
  myStack: number;
  street: string;
  position: string;
  numPlayers: number;
  myTurn: boolean;
}

interface AnalysisResult {
  success: boolean;
  state: {
    heroCards: Array<{ rank: string; suit: string; display: string; color: string }>;
    board: Array<{ rank: string; suit: string; display: string; color: string }>;
    potSize: number;
    betToCall: number;
    stackSize: number;
    street: string;
    position: string;
    numPlayers: number;
  };
  analysis: {
    handName: string;
    potOdds: string;
    equity: string;
    outs: number;
    ev: string;
  };
  recommendation: {
    action: string;
    amount: number;
    confidence: string;
    reasoning: string;
    actionColor: string;
    quickAction: string;
  };
  insights: string[];
}

// ==================== COMPONENTES ====================

function CardSelector({ 
  label, 
  cards, 
  onChange 
}: { 
  label: string; 
  cards: string[]; 
  onChange: (cards: string[]) => void;
}) {
  const [selectedRank, setSelectedRank] = useState('A');
  const [selectedSuit, setSelectedSuit] = useState('s');
  
  const addCard = () => {
    const cardStr = selectedRank + selectedSuit;
    if (!cards.includes(cardStr)) {
      onChange([...cards, cardStr]);
    }
  };
  
  const removeCard = (index: number) => {
    onChange(cards.filter((_, i) => i !== index));
  };
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-300">{label}</Label>
      
      <div className="flex flex-wrap gap-2 mb-2">
        {cards.map((card, i) => {
          const rank = card[0];
          const suit = card[1].toLowerCase();
          const color = SUIT_COLORS[suit];
          
          return (
            <div
              key={i}
              className="flex items-center bg-gray-800 rounded px-2 py-1 text-sm"
              style={{ color }}
            >
              <span className="font-bold">{rank}</span>
              <span>{SUIT_SYMBOLS[suit]}</span>
              <button
                onClick={() => removeCard(i)}
                className="ml-2 text-gray-500 hover:text-red-500"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-2">
        <select
          value={selectedRank}
          onChange={(e) => setSelectedRank(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
        >
          {RANKS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        
        <select
          value={selectedSuit}
          onChange={(e) => setSelectedSuit(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
        >
          {SUITS.map(s => (
            <option key={s} value={s} style={{ color: SUIT_COLORS[s] }}>
              {SUIT_SYMBOLS[s]} {s.toUpperCase()}
            </option>
          ))}
        </select>
        
        <Button size="sm" onClick={addCard} variant="secondary">
          +
        </Button>
      </div>
    </div>
  );
}

function RecommendationDisplay({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="text-center py-8 text-gray-500">
        Configure as cartas e clique em "Analisar" para ver a recomendação
      </div>
    );
  }
  
  const { state, analysis, recommendation, insights } = result;
  
  return (
    <div className="space-y-4">
      {/* Quick Action */}
      <div 
        className="text-center py-6 rounded-lg"
        style={{ backgroundColor: recommendation.actionColor + '20' }}
      >
        <div 
          className="text-4xl font-black mb-2"
          style={{ color: recommendation.actionColor }}
        >
          {recommendation.quickAction}
        </div>
        {recommendation.amount > 0 && (
          <div className="text-xl font-bold text-white">
            ${recommendation.amount}
          </div>
        )}
        <div className="text-sm text-gray-400 mt-2">
          Confiança: {recommendation.confidence}
        </div>
      </div>
      
      {/* Reasoning */}
      <div className="bg-gray-800/50 rounded p-3">
        <p className="text-sm text-gray-300">{recommendation.reasoning}</p>
      </div>
      
      {/* Analysis Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500">Pot Odds</div>
          <div className="text-lg font-bold text-white">{analysis.potOdds}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500">Equity</div>
          <div className="text-lg font-bold text-white">{analysis.equity}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500">Outs</div>
          <div className="text-lg font-bold text-white">{analysis.outs}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500">EV</div>
          <div className={`text-lg font-bold ${analysis.ev.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
            {analysis.ev}
          </div>
        </div>
      </div>
      
      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase">Insights</div>
          {insights.map((insight, i) => (
            <div key={i} className="text-sm text-gray-400 bg-gray-800/30 rounded px-3 py-2">
              {insight}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenCapture({ onCapture }: { onCapture: (imageData: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'window' } as any,
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setIsStreaming(true);
      
      mediaStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };
    } catch (error) {
      console.error('Error starting capture:', error);
    }
  };
  
  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsStreaming(false);
  };
  
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/png');
      onCapture(imageData);
    }
  };
  
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {!isStreaming ? (
          <Button onClick={startCapture} className="bg-blue-600 hover:bg-blue-700">
            📷 Capturar Tela
          </Button>
        ) : (
          <>
            <Button onClick={captureFrame} className="bg-green-600 hover:bg-green-700">
              🎯 Analisar Frame
            </Button>
            <Button onClick={stopCapture} variant="destructive">
              Parar
            </Button>
          </>
        )}
      </div>
      
      {isStreaming && (
        <div className="relative rounded overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto max-h-40 object-contain"
          />
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function CompactMode({ result }: { result: AnalysisResult | null }) {
  if (!result) return null;
  
  const { recommendation } = result;
  
  return (
    <div 
      className="fixed bottom-4 right-4 p-4 rounded-lg shadow-2xl z-50 min-w-[200px]"
      style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
    >
      <div 
        className="text-2xl font-black text-center"
        style={{ color: recommendation.actionColor }}
      >
        {recommendation.quickAction}
      </div>
      {recommendation.amount > 0 && (
        <div className="text-center text-white font-bold">
          ${recommendation.amount}
        </div>
      )}
      <div className="text-xs text-gray-500 text-center mt-1">
        {recommendation.confidence} confiança
      </div>
    </div>
  );
}

// PWA Install Button Component
function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    // Initialize based on whether already running as installed app
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches;
    }
    return false;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback: show instructions
      alert('Para instalar:\n\nNo Chrome/Edge: Menu → "Instalar app"\nNo Safari iOS: Compartilhar → "Adicionar à Tela de Início"');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInstall}
      className="gap-2"
    >
      📥 Instalar App
    </Button>
  );
}

// ==================== MAIN PAGE ====================

export default function PokerRTA() {
  // State
  const [heroCards, setHeroCards] = useState<string[]>([]);
  const [boardCards, setBoardCards] = useState<string[]>([]);
  const [potSize, setPotSize] = useState(0);
  const [betToCall, setBetToCall] = useState(0);
  const [stackSize, setStackSize] = useState(1000);
  const [street, setStreet] = useState<'preflop' | 'flop' | 'turn' | 'river'>('preflop');
  const [position, setPosition] = useState('BTN');
  const [numPlayers, setNumPlayers] = useState(6);
  
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [activeTab, setActiveTab] = useState('manual');
  
  // Manual analysis
  const analyze = useCallback(async () => {
    if (heroCards.length < 2) {
      alert('Selecione pelo menos 2 cartas');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroCards,
          board: boardCards,
          potSize,
          betToCall,
          stackSize,
          street,
          position,
          numPlayers
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [heroCards, boardCards, potSize, betToCall, stackSize, street, position, numPlayers]);
  
  // Screen capture analysis
  const handleCapture = useCallback(async (imageData: string) => {
    setIsAnalyzing(true);
    
    try {
      // First detect cards from image
      const detectResponse = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const detectData = await detectResponse.json();
      
      if (detectData.success && detectData.gameState) {
        const state = detectData.gameState as DetectedState;
        
        // Update local state
        setHeroCards(state.heroCards || []);
        setBoardCards(state.board || []);
        setPotSize(state.potSize || 0);
        setBetToCall(state.betToCall || 0);
        setStackSize(state.myStack || 1000);
        setStreet(state.street || 'preflop');
        setPosition(state.position || 'BTN');
        setNumPlayers(state.numPlayers || 6);
        
        // Then analyze
        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heroCards: state.heroCards,
            board: state.board,
            potSize: state.potSize,
            betToCall: state.betToCall,
            stackSize: state.myStack,
            street: state.street,
            position: state.position,
            numPlayers: state.numPlayers
          })
        });
        
        const analyzeData = await analyzeResponse.json();
        setResult(analyzeData);
      }
    } catch (error) {
      console.error('Capture analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);
  
  // Auto-analyze when cards change
  useEffect(() => {
    if (heroCards.length >= 2 && activeTab === 'manual') {
      const timer = setTimeout(analyze, 500);
      return () => clearTimeout(timer);
    }
  }, [heroCards, boardCards, potSize, betToCall, street]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-black/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🃏</span>
            <div>
              <h1 className="text-xl font-bold">Poker RTA</h1>
              <p className="text-xs text-gray-500">Real-Time Assistance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <InstallButton />
            <Button
              variant={compactMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCompactMode(!compactMode)}
            >
              {compactMode ? '🖥️ Modo Completo' : '📱 Modo Compacto'}
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="manual">✏️ Entrada Manual</TabsTrigger>
            <TabsTrigger value="capture">📷 Captura de Tela</TabsTrigger>
          </TabsList>
          
          {/* Manual Input Tab */}
          <TabsContent value="manual" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Input */}
              <div className="space-y-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">🃏 Suas Cartas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardSelector 
                      label="Cartas do Herói" 
                      cards={heroCards} 
                      onChange={setHeroCards} 
                    />
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">🎴 Board</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardSelector 
                      label="Cartas Comunitárias" 
                      cards={boardCards} 
                      onChange={setBoardCards} 
                    />
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">💰 Informações do Pote</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-400">Pote</Label>
                      <Input
                        type="number"
                        value={potSize}
                        onChange={(e) => setPotSize(Number(e.target.value))}
                        className="bg-gray-900 border-gray-700"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-400">Para Pagar</Label>
                      <Input
                        type="number"
                        value={betToCall}
                        onChange={(e) => setBetToCall(Number(e.target.value))}
                        className="bg-gray-900 border-gray-700"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-400">Seu Stack</Label>
                      <Input
                        type="number"
                        value={stackSize}
                        onChange={(e) => setStackSize(Number(e.target.value))}
                        className="bg-gray-900 border-gray-700"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-400">Jogadores</Label>
                      <Input
                        type="number"
                        value={numPlayers}
                        onChange={(e) => setNumPlayers(Number(e.target.value))}
                        min={2}
                        max={10}
                        className="bg-gray-900 border-gray-700"
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">📍 Posição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map(pos => (
                        <Button
                          key={pos}
                          size="sm"
                          variant={position === pos ? "default" : "outline"}
                          onClick={() => setPosition(pos)}
                        >
                          {pos}
                        </Button>
                      ))}
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex flex-wrap gap-2">
                      {['preflop', 'flop', 'turn', 'river'].map(s => (
                        <Button
                          key={s}
                          size="sm"
                          variant={street === s ? "default" : "outline"}
                          onClick={() => setStreet(s as any)}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Right: Recommendation */}
              <div>
                <Card className="bg-gray-800/50 border-gray-700 sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>🎯 Recomendação</span>
                      {isAnalyzing && <span className="text-sm text-blue-500 animate-pulse">Analisando...</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RecommendationDisplay result={result} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          {/* Screen Capture Tab */}
          <TabsContent value="capture" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg">📷 Captura de Tela</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-400">
                  Clique em "Capturar Tela" e selecione a janela do poker. 
                  Depois clique em "Analisar Frame" para obter a recomendação.
                </p>
                
                <ScreenCapture onCapture={handleCapture} />
                
                {isAnalyzing && (
                  <div className="text-center py-4">
                    <div className="animate-pulse text-blue-500">Analisando imagem...</div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {result && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg">🎯 Recomendação</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecommendationDisplay result={result} />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Compact Mode Overlay */}
      {compactMode && <CompactMode result={result} />}
      
      {/* Footer */}
      <footer className="border-t border-gray-700 bg-black/30 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
          Poker RTA - Assistência em Tempo Real | Baseado em matemática e teoria dos jogos
        </div>
      </footer>
    </div>
  );
}
