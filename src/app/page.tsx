'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAutoMonitor } from '@/hooks/use-auto-monitor';
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

// Histórico de análises por street
interface StreetHistory {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  board: string[];
  result: AnalysisResult;
  timestamp: number;
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

// ==================== COMPONENTE DE MONITORAMENTO AUTOMÁTICO ====================

interface AutoMonitorOverlayProps {
  result: AnalysisResult | null;
  monitorState: {
    isMonitoring: boolean;
    framesAnalyzed: number;
    lastCapture: Date | null;
  };
  onStop: () => void;
}

function AutoMonitorOverlay({ result, monitorState, onStop }: AutoMonitorOverlayProps) {
  if (!monitorState.isMonitoring) return null;
  
  return (
    <div className="fixed top-4 left-4 z-50">
      <Card className="bg-black/95 border-gray-700 shadow-2xl min-w-[280px]">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-400">Monitorando</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onStop} className="h-6 px-2 text-xs">
              Parar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-3 px-4">
          {result ? (
            <div className="space-y-3">
              {/* Cards */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Cartas:</span>
                <div className="flex gap-1">
                  {result.state.heroCards.map((card, i) => (
                    <span key={i} style={{ color: card.color }} className="font-bold">
                      {card.display}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Board */}
              {result.state.board.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Board:</span>
                  <div className="flex gap-1">
                    {result.state.board.map((card, i) => (
                      <span key={i} style={{ color: card.color }} className="font-bold">
                        {card.display}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recomendação Principal */}
              <div 
                className="text-center py-3 rounded-lg"
                style={{ backgroundColor: result.recommendation.actionColor + '20' }}
              >
                <div 
                  className="text-3xl font-black"
                  style={{ color: result.recommendation.actionColor }}
                >
                  {result.recommendation.quickAction}
                </div>
                {result.recommendation.amount > 0 && (
                  <div className="text-lg font-bold text-white">${result.recommendation.amount}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {result.recommendation.confidence} | EV: {result.analysis.ev}
                </div>
              </div>
              
              {/* Reasoning */}
              <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                {result.recommendation.reasoning}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              Aguardando detecção de cartas...
              <div className="text-xs mt-2">
                {monitorState.framesAnalyzed} frames analisados
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
  const [activeTab, setActiveTab] = useState('auto');
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);
  
  // Histórico de análises por street
  const [handHistory, setHandHistory] = useState<StreetHistory[]>([]);
  const [viewingHistoryStreet, setViewingHistoryStreet] = useState<string | null>(null);
  
  // Estado do monitoramento automático
  const [monitorState, setMonitorState] = useState({
    isMonitoring: false,
    framesAnalyzed: 0,
    lastCapture: null as Date | null
  });
  
  // Hook de monitoramento automático
  const autoMonitor = useAutoMonitor({
    intervalMs: 2500, // Analisa a cada 2.5 segundos
    onDetect: async (detected) => {
      console.log('🎯 Cartas detectadas automaticamente:', detected.heroCards, detected.board);
      
      // Atualizar cartas
      setHeroCards(detected.heroCards);
      setBoardCards(detected.board);
      setPotSize(detected.potSize);
      
      // Determinar street
      let newStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
      if (detected.board.length >= 3) newStreet = 'flop';
      if (detected.board.length >= 4) newStreet = 'turn';
      if (detected.board.length >= 5) newStreet = 'river';
      setStreet(newStreet);
      
      // Analisar automaticamente
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heroCards: detected.heroCards,
            board: detected.board,
            potSize: detected.potSize,
            betToCall: 0,
            stackSize: 1000,
            street: newStreet,
            position: 'BTN',
            numPlayers: 2
          })
        });
        
        const data = await response.json();
        setResult(data);
        
        // Salvar no histórico
        setHandHistory(prev => {
          const newHistory = prev.filter(h => h.street !== newStreet);
          newHistory.push({
            street: newStreet,
            board: [...detected.board],
            result: data,
            timestamp: Date.now()
          });
          return newHistory.sort((a, b) => {
            const order = { preflop: 0, flop: 1, turn: 2, river: 3 };
            return order[a.street] - order[b.street];
          });
        });
      } catch (error) {
        console.error('Auto-analysis error:', error);
      }
    },
    onChange: (state) => {
      setMonitorState({
        isMonitoring: state.isMonitoring,
        framesAnalyzed: state.framesAnalyzed,
        lastCapture: state.lastCapture
      });
    }
  });
  
  // Manual analysis
  const analyze = useCallback(async () => {
    if (heroCards.length < 2) {
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
      
      // Salvar no histórico por street
      setHandHistory(prev => {
        const newHistory = prev.filter(h => h.street !== street);
        newHistory.push({
          street,
          board: [...boardCards],
          result: data,
          timestamp: Date.now()
        });
        return newHistory.sort((a, b) => {
          const order = { preflop: 0, flop: 1, turn: 2, river: 3 };
          return order[a.street] - order[b.street];
        });
      });
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [heroCards, boardCards, potSize, betToCall, stackSize, street, position, numPlayers]);
  
  // Screen capture analysis - 100% GRATUITO
  const handleCapture = useCallback(async (imageData: string) => {
    setIsAnalyzing(true);
    setDetectionMessage(null);
    
    try {
      // Chamar API de detecção GRATUITA (sem API key necessário)
      const detectResponse = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const detectData = await detectResponse.json();
      
      if (detectData.success && detectData.gameState?.heroCards?.length >= 2) {
        // Detecção funcionou!
        const state = detectData.gameState;
        const usedApi = detectData.usedApi || 'local';
        
        setHeroCards(state.heroCards);
        setBoardCards(state.board || []);
        setPotSize(state.potSize || 0);
        setStreet(state.street || 'preflop');
        
        setDetectionMessage(`✅ Detectado via ${usedApi}: ${state.heroCards.join(', ')}${state.board?.length ? ' | Board: ' + state.board.join(', ') : ''}`);
        
        // Analisar com cartas detectadas
        const analyzeResponse = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heroCards: state.heroCards,
            board: state.board,
            potSize: state.potSize,
            betToCall: 0,
            stackSize: 1000,
            street: state.street,
            position: 'BTN',
            numPlayers: 2
          })
        });
        
        const analyzeData = await analyzeResponse.json();
        setResult(analyzeData);
      } else {
        // Detecção falhou
        setDetectionMessage(detectData.message || 'Não foi possível detectar as cartas automaticamente.');
      }
    } catch (error) {
      console.error('Capture analysis error:', error);
      setDetectionMessage('Erro na análise. Use o modo manual para selecionar suas cartas.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);
  
  // Auto-analyze when cards or game state change
  useEffect(() => {
    if (heroCards.length >= 2 && activeTab === 'manual') {
      const timer = setTimeout(analyze, 300);
      return () => clearTimeout(timer);
    }
  }, [heroCards, boardCards, potSize, betToCall, street, stackSize, position, numPlayers]);
  
  // Visualizar histórico de uma street específica
  const viewHistoryStreet = (streetName: 'preflop' | 'flop' | 'turn' | 'river') => {
    const historyEntry = handHistory.find(h => h.street === streetName);
    if (historyEntry) {
      setResult(historyEntry.result);
      setViewingHistoryStreet(streetName);
    }
  };
  
  // Limpar histórico e começar nova mão
  const newHand = () => {
    setHandHistory([]);
    setHeroCards([]);
    setBoardCards([]);
    setPotSize(0);
    setBetToCall(0);
    setResult(null);
    setViewingHistoryStreet(null);
    setStreet('preflop');
  };
  
  // Avançar para próxima street (preservando dados)
  const advanceStreet = () => {
    if (street === 'preflop') setStreet('flop');
    else if (street === 'flop') setStreet('turn');
    else if (street === 'turn') setStreet('river');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Overlay de Monitoramento Automático */}
      <AutoMonitorOverlay 
        result={result}
        monitorState={monitorState}
        onStop={autoMonitor.stopMonitoring}
      />
      
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
            {/* Histórico de Streets */}
            {handHistory.length > 0 && (
              <div className="flex items-center gap-1 mr-4">
                <span className="text-xs text-gray-500 mr-2">Histórico:</span>
                {['preflop', 'flop', 'turn', 'river'].map(s => {
                  const hasHistory = handHistory.some(h => h.street === s);
                  const isCurrent = street === s && !viewingHistoryStreet;
                  const isViewing = viewingHistoryStreet === s;
                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant={isCurrent ? "default" : isViewing ? "secondary" : "ghost"}
                      className={`text-xs px-2 py-1 h-6 ${!hasHistory ? 'opacity-30' : ''}`}
                      disabled={!hasHistory}
                      onClick={() => viewHistoryStreet(s as any)}
                    >
                      {s === 'preflop' ? 'PF' : s.charAt(0).toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={newHand}
              className="gap-1 text-red-400 border-red-800 hover:bg-red-900/30"
            >
              🔄 Nova Mão
            </Button>
            
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
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="auto">🤖 Modo Auto</TabsTrigger>
            <TabsTrigger value="manual">✏️ Manual</TabsTrigger>
            <TabsTrigger value="capture">📷 Captura</TabsTrigger>
          </TabsList>
          
          {/* Auto Monitor Tab */}
          <TabsContent value="auto" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🤖 Monitoramento Automático
                  {monitorState.isMonitoring && (
                    <Badge className="bg-green-600 animate-pulse">Ativo</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Banner */}
                <div className={`rounded-lg p-4 ${monitorState.isMonitoring ? 'bg-green-900/30 border border-green-700' : 'bg-gray-700/30 border border-gray-600'}`}>
                  {monitorState.isMonitoring ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-green-400 font-medium">Monitorando sua tela...</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {monitorState.framesAnalyzed} frames analisados
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-300">
                      O modo automático monitora sua tela continuamente e detecta as cartas 
                      <strong> sem você precisar fazer nada</strong>. Quando as cartas mudam, 
                      a análise é atualizada automaticamente!
                    </p>
                  )}
                </div>
                
                {/* Como funciona */}
                {!monitorState.isMonitoring && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-200">Como funciona:</h4>
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-start gap-3 bg-gray-700/20 rounded p-3">
                        <span className="text-xl">1️⃣</span>
                        <div>
                          <p className="text-gray-300">Clique em <strong>"Iniciar Monitoramento"</strong></p>
                          <p className="text-gray-500 text-xs">Selecione a janela do poker</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-gray-700/20 rounded p-3">
                        <span className="text-xl">2️⃣</span>
                        <div>
                          <p className="text-gray-300">O app monitora automaticamente a cada 2.5 segundos</p>
                          <p className="text-gray-500 text-xs">Detecta mudanças nas cartas</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-gray-700/20 rounded p-3">
                        <span className="text-xl">3️⃣</span>
                        <div>
                          <p className="text-gray-300">Quando você recebe cartas, a análise aparece!</p>
                          <p className="text-gray-500 text-xs">Flop, turn e river são detectados automaticamente</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Botões de controle */}
                <div className="flex gap-3">
                  {!monitorState.isMonitoring ? (
                    <Button 
                      onClick={autoMonitor.startMonitoring}
                      className="bg-green-600 hover:bg-green-700 text-lg py-6 px-8"
                    >
                      ▶️ Iniciar Monitoramento Automático
                    </Button>
                  ) : (
                    <Button 
                      onClick={autoMonitor.stopMonitoring}
                      variant="destructive"
                      className="text-lg py-6 px-8"
                    >
                      ⏹️ Parar Monitoramento
                    </Button>
                  )}
                </div>
                
                {/* Preview da análise atual */}
                {monitorState.isMonitoring && result && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <h4 className="text-sm text-gray-500 mb-3">Última análise detectada:</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1">
                        {result.state.heroCards.map((card, i) => (
                          <span key={i} style={{ color: card.color }} className="text-xl font-bold">
                            {card.display}
                          </span>
                        ))}
                      </div>
                      {result.state.board.length > 0 && (
                        <>
                          <span className="text-gray-500">|</span>
                          <div className="flex gap-1">
                            {result.state.board.map((card, i) => (
                              <span key={i} style={{ color: card.color }} className="text-xl font-bold">
                                {card.display}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Dica */}
            <Card className="bg-blue-900/20 border-blue-700/50">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div className="text-sm text-blue-300">
                    <strong>Dica:</strong> Deixe a janela do poker visível na tela. O monitoramento 
                    funciona em segundo plano e você verá um painel no canto superior esquerdo com 
                    a recomendação em tempo real!
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
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
                      {['preflop', 'flop', 'turn', 'river'].map(s => {
                        const hasHistory = handHistory.some(h => h.street === s);
                        return (
                          <Button
                            key={s}
                            size="sm"
                            variant={street === s ? "default" : "outline"}
                            onClick={() => {
                              setStreet(s as any);
                              setViewingHistoryStreet(null);
                            }}
                            className="relative"
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                            {hasHistory && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    
                    {/* Botão para avançar street */}
                    {street !== 'river' && heroCards.length >= 2 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={advanceStreet}
                        className="mt-2 w-full"
                      >
                        ➡️ Próxima Street ({street === 'preflop' ? 'Flop' : street === 'flop' ? 'Turn' : 'River'})
                      </Button>
                    )}
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
                <CardTitle className="text-lg flex items-center gap-2">
                  📷 Detecção Automática
                  <Badge variant="secondary" className="bg-green-900/50 text-green-400">100% Gratuito</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info sobre APIs */}
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h4 className="font-semibold text-white mb-1">APIs de Visão Gratuitas</h4>
                      <p className="text-sm text-gray-300 mb-2">
                        Detectamos suas cartas automaticamente usando:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">Hugging Face BLIP</Badge>
                        <Badge variant="outline" className="text-xs">OCR.space</Badge>
                        <Badge variant="outline" className="text-xs">DeepAI</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-400">
                  <strong>Como usar:</strong> Clique em "Capturar Tela", selecione a janela do poker, 
                  e clique em "Analisar Frame". As cartas serão detectadas automaticamente!
                </p>
                
                <ScreenCapture onCapture={handleCapture} />
                
                {isAnalyzing && (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-blue-400 font-medium">Analisando imagem...</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Consultando APIs de visão gratuitas...
                    </div>
                  </div>
                )}
                
                {detectionMessage && (
                  <div className={`rounded-lg p-4 ${detectionMessage.startsWith('✅') ? 'bg-green-900/30 border border-green-700' : 'bg-yellow-900/30 border border-yellow-700'}`}>
                    <p className={`text-sm ${detectionMessage.startsWith('✅') ? 'text-green-300' : 'text-yellow-300'}`}>
                      {detectionMessage}
                    </p>
                    {!detectionMessage.startsWith('✅') && (
                      <div className="mt-3 flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setDetectionMessage(null);
                            setActiveTab('manual');
                          }}
                        >
                          ✏️ Usar Modo Manual
                        </Button>
                      </div>
                    )}
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
            
            {/* Dica para modo manual */}
            <Card className="bg-gray-800/30 border-gray-700/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>💡</span>
                  <span>
                    <strong>Dica:</strong> Se a detecção automática não funcionar perfeitamente, 
                    você sempre pode usar o <Button 
                      variant="link" 
                      className="px-1 h-auto text-blue-400" 
                      onClick={() => setActiveTab('manual')}
                    >
                      Modo Manual
                    </Button> para selecionar suas cartas rapidamente.
                  </span>
                </div>
              </CardContent>
            </Card>
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
