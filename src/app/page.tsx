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

interface StreetHistory {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  board: string[];
  result: AnalysisResult;
  timestamp: number;
}

// ==================== COMPONENTES VISUAIS MELHORADOS ====================

// Carta estilo baralho - grande e visível
function CardBadge({ card, onRemove }: { card: string; onRemove?: () => void }) {
  const rank = card[0];
  const suit = card[1].toLowerCase();
  const isRed = suit === 'h' || suit === 'd';
  
  return (
    <div 
      className={`
        relative inline-flex items-center justify-center
        min-w-[56px] h-[76px] 
        bg-white rounded-xl shadow-xl
        border-2 border-gray-300
        font-bold
        ${isRed ? 'text-red-600' : 'text-gray-900'}
        transition-transform hover:scale-105
      `}
    >
      <div className="flex flex-col items-center leading-none">
        <span className="text-2xl font-black">{rank}</span>
        <span className="text-2xl">{SUIT_SYMBOLS[suit]}</span>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full text-lg font-bold hover:bg-red-600 shadow-lg flex items-center justify-center border-2 border-white"
        >
          ×
        </button>
      )}
    </div>
  );
}

// Seletor de cartas melhorado
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
    <div className="space-y-4">
      <Label className="text-lg font-bold text-white">{label}</Label>
      
      {/* Cartas selecionadas */}
      {cards.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-gray-800/50 rounded-2xl border-2 border-gray-600">
          {cards.map((card, i) => (
            <CardBadge key={i} card={card} onRemove={() => removeCard(i)} />
          ))}
        </div>
      )}
      
      {/* Seletor */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={selectedRank}
          onChange={(e) => setSelectedRank(e.target.value)}
          className="bg-gray-700 border-2 border-gray-500 rounded-xl px-5 py-3 text-xl font-bold text-white focus:border-blue-400 focus:outline-none cursor-pointer"
        >
          {RANKS.map(r => (
            <option key={r} value={r} className="bg-gray-800 text-xl">{r}</option>
          ))}
        </select>
        
        <select
          value={selectedSuit}
          onChange={(e) => setSelectedSuit(e.target.value)}
          className="bg-gray-700 border-2 border-gray-500 rounded-xl px-5 py-3 text-xl font-bold text-white focus:border-blue-400 focus:outline-none cursor-pointer"
        >
          {SUITS.map(s => (
            <option key={s} value={s} className="bg-gray-800 text-xl">
              {SUIT_SYMBOLS[s]} {s.toUpperCase()}
            </option>
          ))}
        </select>
        
        <Button 
          size="lg" 
          onClick={addCard} 
          className="bg-blue-600 hover:bg-blue-500 text-xl px-6 py-6 font-bold rounded-xl shadow-lg"
        >
          + Adicionar
        </Button>
      </div>
    </div>
  );
}

// Display de recomendação melhorado
function RecommendationDisplay({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="text-center py-16 bg-gray-800/30 rounded-2xl border-2 border-gray-700">
        <div className="text-7xl mb-4">🃏</div>
        <p className="text-xl text-gray-400 font-medium">Selecione suas cartas para ver a recomendação</p>
      </div>
    );
  }
  
  const { state, analysis, recommendation, insights } = result;
  
  return (
    <div className="space-y-5">
      {/* Cartas atuais */}
      <div className="flex items-center justify-center gap-6 py-6 bg-gray-800/40 rounded-2xl border border-gray-700">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm text-gray-400 uppercase tracking-wider font-medium">Suas Cartas</span>
          <div className="flex gap-2">
            {state.heroCards.map((card, i) => (
              <CardBadge key={i} card={`${card.rank}${card.suit}`} />
            ))}
          </div>
        </div>
        
        {state.board.length > 0 && (
          <>
            <div className="w-px h-20 bg-gray-600" />
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-gray-400 uppercase tracking-wider font-medium">Board</span>
              <div className="flex gap-2">
                {state.board.map((card, i) => (
                  <CardBadge key={i} card={`${card.rank}${card.suit}`} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Ação Recomendada - GRANDE E DESTACADO */}
      <div 
        className="text-center py-10 rounded-2xl border-4 shadow-2xl"
        style={{ 
          backgroundColor: recommendation.actionColor + '20',
          borderColor: recommendation.actionColor
        }}
      >
        <div 
          className="text-7xl font-black mb-3 tracking-tight"
          style={{ color: recommendation.actionColor }}
        >
          {recommendation.quickAction}
        </div>
        {recommendation.amount > 0 && (
          <div className="text-4xl font-bold text-white">${recommendation.amount}</div>
        )}
        <div className="mt-4 inline-flex items-center gap-3 px-6 py-2 bg-black/40 rounded-full">
          <span className="text-gray-300 font-medium">Confiança:</span>
          <span className="font-bold text-white text-lg">{recommendation.confidence}</span>
        </div>
      </div>
      
      {/* Análise textual */}
      <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700">
        <div className="text-sm text-gray-400 uppercase tracking-wider mb-3 font-medium">Análise Detalhada</div>
        <p className="text-lg text-gray-200 leading-relaxed">{recommendation.reasoning}</p>
      </div>
      
      {/* Métricas - Cards grandes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border-2 border-gray-700 shadow-lg">
          <div className="text-base text-gray-400 mb-2">Pot Odds</div>
          <div className="text-3xl font-bold text-white">{analysis.potOdds}</div>
        </div>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border-2 border-gray-700 shadow-lg">
          <div className="text-base text-gray-400 mb-2">Equity</div>
          <div className="text-3xl font-bold text-white">{analysis.equity}</div>
        </div>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border-2 border-gray-700 shadow-lg">
          <div className="text-base text-gray-400 mb-2">Outs</div>
          <div className="text-3xl font-bold text-white">{analysis.outs}</div>
        </div>
        <div className={`rounded-2xl p-5 border-2 shadow-lg ${
          analysis.ev.startsWith('+') 
            ? 'bg-gradient-to-br from-green-900/60 to-green-800/40 border-green-500' 
            : 'bg-gradient-to-br from-red-900/60 to-red-800/40 border-red-500'
        }`}>
          <div className={`text-base mb-2 ${analysis.ev.startsWith('+') ? 'text-green-300' : 'text-red-300'}`}>
            Expected Value
          </div>
          <div className={`text-3xl font-bold ${analysis.ev.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
            {analysis.ev}
          </div>
        </div>
      </div>
      
      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <div className="text-base text-gray-400 uppercase tracking-wider font-medium">💡 Insights</div>
          {insights.map((insight, i) => (
            <div key={i} className="text-lg text-gray-300 bg-gray-800/40 rounded-2xl px-5 py-4 border border-gray-700">
              {insight}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Captura de tela
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
    <div className="space-y-4">
      <div className="flex gap-3">
        {!isStreaming ? (
          <Button onClick={startCapture} className="bg-blue-600 hover:bg-blue-500 text-lg py-6 px-8 font-bold rounded-xl">
            📷 Capturar Tela
          </Button>
        ) : (
          <>
            <Button onClick={captureFrame} className="bg-green-600 hover:bg-green-500 text-lg py-6 px-8 font-bold rounded-xl">
              🎯 Analisar Frame
            </Button>
            <Button onClick={stopCapture} variant="destructive" className="text-lg py-6 px-8 font-bold rounded-xl">
              Parar
            </Button>
          </>
        )}
      </div>
      
      {isStreaming && (
        <div className="relative rounded-xl overflow-hidden bg-black border-2 border-gray-600">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto max-h-48 object-contain"
          />
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// Modo compacto
function CompactMode({ result }: { result: AnalysisResult | null }) {
  if (!result) return null;
  
  const { recommendation } = result;
  
  return (
    <div 
      className="fixed bottom-6 right-6 p-6 rounded-2xl shadow-2xl z-50 min-w-[240px] border-2"
      style={{ 
        backgroundColor: 'rgba(0,0,0,0.95)',
        borderColor: recommendation.actionColor
      }}
    >
      <div 
        className="text-4xl font-black text-center"
        style={{ color: recommendation.actionColor }}
      >
        {recommendation.quickAction}
      </div>
      {recommendation.amount > 0 && (
        <div className="text-center text-2xl text-white font-bold mt-1">
          ${recommendation.amount}
        </div>
      )}
      <div className="text-sm text-gray-400 text-center mt-2">
        {recommendation.confidence} confiança
      </div>
    </div>
  );
}

// PWA Install
function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
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
      className="gap-2 text-base px-4 py-2"
    >
      📥 Instalar
    </Button>
  );
}

// Overlay de Monitoramento Automático
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
    <div className="fixed top-6 left-6 z-50">
      <Card className="bg-black/95 border-2 border-green-500 shadow-2xl min-w-[320px] rounded-2xl">
        <CardHeader className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-lg font-bold text-green-400">Monitorando</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onStop} className="h-8 px-3 text-sm font-medium">
              Parar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-4 px-5">
          {result ? (
            <div className="space-y-4">
              {/* Cards */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 font-medium">Cartas:</span>
                <div className="flex gap-1">
                  {result.state.heroCards.map((card, i) => (
                    <span key={i} style={{ color: card.color }} className="text-xl font-bold">
                      {card.display}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Board */}
              {result.state.board.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 font-medium">Board:</span>
                  <div className="flex gap-1">
                    {result.state.board.map((card, i) => (
                      <span key={i} style={{ color: card.color }} className="text-xl font-bold">
                        {card.display}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recomendação Principal */}
              <div 
                className="text-center py-4 rounded-xl border-2"
                style={{ 
                  backgroundColor: result.recommendation.actionColor + '20',
                  borderColor: result.recommendation.actionColor
                }}
              >
                <div 
                  className="text-4xl font-black"
                  style={{ color: result.recommendation.actionColor }}
                >
                  {result.recommendation.quickAction}
                </div>
                {result.recommendation.amount > 0 && (
                  <div className="text-xl font-bold text-white">${result.recommendation.amount}</div>
                )}
                <div className="text-sm text-gray-300 mt-2 font-medium">
                  {result.recommendation.confidence} | EV: {result.analysis.ev}
                </div>
              </div>
              
              {/* Reasoning */}
              <div className="text-sm text-gray-300 bg-gray-800/50 rounded-xl p-3 border border-gray-700">
                {result.recommendation.reasoning}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-base font-medium">
              Aguardando detecção de cartas...
              <div className="text-sm mt-3 text-gray-500">
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
  
  const [handHistory, setHandHistory] = useState<StreetHistory[]>([]);
  const [viewingHistoryStreet, setViewingHistoryStreet] = useState<string | null>(null);
  
  const [monitorState, setMonitorState] = useState({
    isMonitoring: false,
    framesAnalyzed: 0,
    lastCapture: null as Date | null
  });
  
  const autoMonitor = useAutoMonitor({
    intervalMs: 2500,
    onDetect: async (detected) => {
      console.log('🎯 Cartas detectadas:', detected.heroCards, detected.board);
      
      setHeroCards(detected.heroCards);
      setBoardCards(detected.board);
      setPotSize(detected.potSize);
      
      let newStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
      if (detected.board.length >= 3) newStreet = 'flop';
      if (detected.board.length >= 4) newStreet = 'turn';
      if (detected.board.length >= 5) newStreet = 'river';
      setStreet(newStreet);
      
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
  
  const analyze = useCallback(async () => {
    if (heroCards.length < 2) return;
    
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
  
  const handleCapture = useCallback(async (imageData: string) => {
    setIsAnalyzing(true);
    setDetectionMessage(null);
    
    try {
      const detectResponse = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const detectData = await detectResponse.json();
      
      if (detectData.success && detectData.gameState?.heroCards?.length >= 2) {
        const state = detectData.gameState;
        const usedApi = detectData.usedApi || 'local';
        
        setHeroCards(state.heroCards);
        setBoardCards(state.board || []);
        setPotSize(state.potSize || 0);
        setStreet(state.street || 'preflop');
        
        setDetectionMessage(`✅ Detectado via ${Array.isArray(usedApi) ? usedApi.join(', ') : usedApi}: ${state.heroCards.join(', ')}${state.board?.length ? ' | Board: ' + state.board.join(', ') : ''}`);
        
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
        setDetectionMessage(detectData.message || 'Não foi possível detectar as cartas automaticamente.');
      }
    } catch (error) {
      console.error('Capture analysis error:', error);
      setDetectionMessage('Erro na análise. Use o modo manual para selecionar suas cartas.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);
  
  useEffect(() => {
    if (heroCards.length >= 2 && activeTab === 'manual') {
      const timer = setTimeout(analyze, 300);
      return () => clearTimeout(timer);
    }
  }, [heroCards, boardCards, potSize, betToCall, street, stackSize, position, numPlayers]);
  
  const viewHistoryStreet = (streetName: 'preflop' | 'flop' | 'turn' | 'river') => {
    const historyEntry = handHistory.find(h => h.street === streetName);
    if (historyEntry) {
      setResult(historyEntry.result);
      setViewingHistoryStreet(streetName);
    }
  };
  
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
  
  const advanceStreet = () => {
    if (street === 'preflop') setStreet('flop');
    else if (street === 'flop') setStreet('turn');
    else if (street === 'turn') setStreet('river');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <AutoMonitorOverlay 
        result={result}
        monitorState={monitorState}
        onStop={autoMonitor.stopMonitoring}
      />
      
      {/* Header */}
      <header className="border-b-2 border-gray-700 bg-black/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🃏</span>
            <div>
              <h1 className="text-2xl font-black">Poker RTA</h1>
              <p className="text-sm text-gray-400">Real-Time Assistance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {handHistory.length > 0 && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-gray-400 font-medium">Histórico:</span>
                {['preflop', 'flop', 'turn', 'river'].map(s => {
                  const hasHistory = handHistory.some(h => h.street === s);
                  const isCurrent = street === s && !viewingHistoryStreet;
                  const isViewing = viewingHistoryStreet === s;
                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant={isCurrent ? "default" : isViewing ? "secondary" : "ghost"}
                      className={`text-sm px-3 py-1 h-8 font-bold ${!hasHistory ? 'opacity-30' : ''}`}
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
              className="gap-2 text-red-400 border-red-700 hover:bg-red-900/30 font-medium px-4"
            >
              🔄 Nova Mão
            </Button>
            
            <InstallButton />
            <Button
              variant={compactMode ? "default" : "outline"}
              size="sm"
              onClick={() => setCompactMode(!compactMode)}
              className="font-medium px-4"
            >
              {compactMode ? '🖥️ Completo' : '📱 Compacto'}
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8 h-14">
            <TabsTrigger value="auto" className="text-lg font-bold">🤖 Modo Auto</TabsTrigger>
            <TabsTrigger value="manual" className="text-lg font-bold">✏️ Manual</TabsTrigger>
            <TabsTrigger value="capture" className="text-lg font-bold">📷 Captura</TabsTrigger>
          </TabsList>
          
          {/* Auto Monitor Tab */}
          <TabsContent value="auto" className="space-y-6">
            <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  🤖 Monitoramento Automático
                  {monitorState.isMonitoring && (
                    <Badge className="bg-green-600 text-base px-3 py-1 animate-pulse">Ativo</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className={`rounded-2xl p-5 ${monitorState.isMonitoring ? 'bg-green-900/30 border-2 border-green-600' : 'bg-gray-700/30 border-2 border-gray-600'}`}>
                  {monitorState.isMonitoring ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xl text-green-400 font-bold">Monitorando sua tela...</span>
                      </div>
                      <div className="text-lg text-gray-300">
                        {monitorState.framesAnalyzed} frames analisados
                      </div>
                    </div>
                  ) : (
                    <p className="text-lg text-gray-200">
                      O modo automático monitora sua tela continuamente e detecta as cartas 
                      <strong className="text-white"> sem você precisar fazer nada</strong>. Quando as cartas mudam, 
                      a análise é atualizada automaticamente!
                    </p>
                  )}
                </div>
                
                {!monitorState.isMonitoring && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold text-gray-200">Como funciona:</h4>
                    <div className="grid gap-4">
                      <div className="flex items-start gap-4 bg-gray-700/20 rounded-xl p-4 border border-gray-600">
                        <span className="text-3xl">1️⃣</span>
                        <div>
                          <p className="text-lg text-gray-200">Clique em <strong className="text-white">"Iniciar Monitoramento"</strong></p>
                          <p className="text-gray-400">Selecione a janela do poker</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 bg-gray-700/20 rounded-xl p-4 border border-gray-600">
                        <span className="text-3xl">2️⃣</span>
                        <div>
                          <p className="text-lg text-gray-200">O app monitora automaticamente a cada 2.5 segundos</p>
                          <p className="text-gray-400">Detecta mudanças nas cartas</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 bg-gray-700/20 rounded-xl p-4 border border-gray-600">
                        <span className="text-3xl">3️⃣</span>
                        <div>
                          <p className="text-lg text-gray-200">Quando você recebe cartas, a análise aparece!</p>
                          <p className="text-gray-400">Flop, turn e river são detectados automaticamente</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4">
                  {!monitorState.isMonitoring ? (
                    <Button 
                      onClick={autoMonitor.startMonitoring}
                      className="bg-green-600 hover:bg-green-500 text-xl py-8 px-10 font-bold rounded-xl shadow-xl"
                    >
                      ▶️ Iniciar Monitoramento Automático
                    </Button>
                  ) : (
                    <Button 
                      onClick={autoMonitor.stopMonitoring}
                      variant="destructive"
                      className="text-xl py-8 px-10 font-bold rounded-xl"
                    >
                      ⏹️ Parar Monitoramento
                    </Button>
                  )}
                </div>
                
                {monitorState.isMonitoring && result && (
                  <div className="mt-6 border-t-2 border-gray-700 pt-6">
                    <h4 className="text-base text-gray-400 mb-4 font-medium">Última análise detectada:</h4>
                    <div className="flex items-center gap-6">
                      <div className="flex gap-2">
                        {result.state.heroCards.map((card, i) => (
                          <CardBadge key={i} card={`${card.rank}${card.suit}`} />
                        ))}
                      </div>
                      {result.state.board.length > 0 && (
                        <>
                          <span className="text-2xl text-gray-500">|</span>
                          <div className="flex gap-2">
                            {result.state.board.map((card, i) => (
                              <CardBadge key={i} card={`${card.rank}${card.suit}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-blue-900/20 border-2 border-blue-700 rounded-2xl">
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">💡</span>
                  <div className="text-lg text-blue-300">
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
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">🃏 Suas Cartas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardSelector 
                      label="Cartas do Herói" 
                      cards={heroCards} 
                      onChange={setHeroCards} 
                    />
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">🎴 Board</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardSelector 
                      label="Cartas Comunitárias" 
                      cards={boardCards} 
                      onChange={setBoardCards} 
                    />
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">💰 Informações do Pote</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-5">
                    <div>
                      <Label className="text-base text-gray-300 font-medium">Pote</Label>
                      <Input
                        type="number"
                        value={potSize}
                        onChange={(e) => setPotSize(Number(e.target.value))}
                        className="bg-gray-900 border-2 border-gray-600 text-lg py-3 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-base text-gray-300 font-medium">Para Pagar</Label>
                      <Input
                        type="number"
                        value={betToCall}
                        onChange={(e) => setBetToCall(Number(e.target.value))}
                        className="bg-gray-900 border-2 border-gray-600 text-lg py-3 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-base text-gray-300 font-medium">Seu Stack</Label>
                      <Input
                        type="number"
                        value={stackSize}
                        onChange={(e) => setStackSize(Number(e.target.value))}
                        className="bg-gray-900 border-2 border-gray-600 text-lg py-3 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-base text-gray-300 font-medium">Jogadores</Label>
                      <Input
                        type="number"
                        value={numPlayers}
                        onChange={(e) => setNumPlayers(Number(e.target.value))}
                        min={2}
                        max={10}
                        className="bg-gray-900 border-2 border-gray-600 text-lg py-3 rounded-xl"
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">📍 Posição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map(pos => (
                        <Button
                          key={pos}
                          size="lg"
                          variant={position === pos ? "default" : "outline"}
                          onClick={() => setPosition(pos)}
                          className="text-base font-bold px-5"
                        >
                          {pos}
                        </Button>
                      ))}
                    </div>
                    
                    <Separator className="my-5" />
                    
                    <div className="flex flex-wrap gap-2">
                      {['preflop', 'flop', 'turn', 'river'].map(s => {
                        const hasHistory = handHistory.some(h => h.street === s);
                        return (
                          <Button
                            key={s}
                            size="lg"
                            variant={street === s ? "default" : "outline"}
                            onClick={() => {
                              setStreet(s as any);
                              setViewingHistoryStreet(null);
                            }}
                            className="relative text-base font-bold px-5"
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                            {hasHistory && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    
                    {street !== 'river' && heroCards.length >= 2 && (
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={advanceStreet}
                        className="mt-4 w-full text-base font-bold py-6"
                      >
                        ➡️ Próxima Street ({street === 'preflop' ? 'Flop' : street === 'flop' ? 'Turn' : 'River'})
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <div>
                <Card className="bg-gray-800/50 border-2 border-gray-700 sticky top-6 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center justify-between">
                      <span>🎯 Recomendação</span>
                      {isAnalyzing && <span className="text-base text-blue-400 animate-pulse font-medium">Analisando...</span>}
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
            <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  📷 Detecção Automática
                  <Badge variant="secondary" className="bg-green-900/50 text-green-400 text-base px-3">Gratuito</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-2 border-blue-700/50 rounded-2xl p-5">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">🤖</span>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-2">APIs de Visão Gratuitas</h4>
                      <p className="text-base text-gray-300 mb-3">
                        Detectamos suas cartas automaticamente usando:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-sm px-3 py-1">Hugging Face BLIP</Badge>
                        <Badge variant="outline" className="text-sm px-3 py-1">OCR.space</Badge>
                        <Badge variant="outline" className="text-sm px-3 py-1">DeepAI</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-base text-gray-300">
                  <strong>Como usar:</strong> Clique em "Capturar Tela", selecione a janela do poker, 
                  e clique em "Analisar Frame". As cartas serão detectadas automaticamente!
                </p>
                
                <ScreenCapture onCapture={handleCapture} />
                
                {isAnalyzing && (
                  <div className="bg-blue-900/20 border-2 border-blue-700/50 rounded-2xl p-5 text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xl text-blue-400 font-bold">Analisando imagem...</span>
                    </div>
                    <div className="text-base text-gray-400">
                      Consultando APIs de visão gratuitas...
                    </div>
                  </div>
                )}
                
                {detectionMessage && (
                  <div className={`rounded-2xl p-5 ${detectionMessage.startsWith('✅') ? 'bg-green-900/30 border-2 border-green-700' : 'bg-yellow-900/30 border-2 border-yellow-700'}`}>
                    <p className={`text-base font-medium ${detectionMessage.startsWith('✅') ? 'text-green-300' : 'text-yellow-300'}`}>
                      {detectionMessage}
                    </p>
                    {!detectionMessage.startsWith('✅') && (
                      <div className="mt-4">
                        <Button 
                          size="lg" 
                          onClick={() => {
                            setDetectionMessage(null);
                            setActiveTab('manual');
                          }}
                          className="font-bold"
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
              <Card className="bg-gray-800/50 border-2 border-gray-700 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">🎯 Recomendação</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecommendationDisplay result={result} />
                </CardContent>
              </Card>
            )}
            
            <Card className="bg-gray-800/30 border-2 border-gray-700 rounded-2xl">
              <CardContent className="py-5">
                <div className="flex items-center gap-4 text-base text-gray-400">
                  <span className="text-2xl">💡</span>
                  <span>
                    <strong>Dica:</strong> Se a detecção automática não funcionar perfeitamente, 
                    você sempre pode usar o <Button 
                      variant="link" 
                      className="px-1 h-auto text-blue-400 text-base font-bold" 
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
      
      {compactMode && <CompactMode result={result} />}
      
      <footer className="border-t-2 border-gray-700 bg-black/30 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-5 text-center text-base text-gray-500 font-medium">
          Poker RTA - Assistência em Tempo Real | Baseado em matemática e teoria dos jogos
        </div>
      </footer>
    </div>
  );
}
