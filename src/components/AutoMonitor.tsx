'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useScreenCapture } from '@/lib/native-screen-capture';
import { API_BASE_URL } from '@/lib/api-config';

interface AutoMonitorProps {
  onDetect: (cards: {
    heroCards: string[];
    board: string[];
    potSize: number;
  }) => void;
}

export default function AutoMonitor({ onDetect }: AutoMonitorProps) {
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onDetectRef = useRef(onDetect);
  
  // Manter ref atualizado
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);
  
  const {
    isSupported,
    isNative,
    supportReason,
    isCapturing,
    error: captureError,
    startCapture,
    captureFrame,
    stopCapture
  } = useScreenCapture();
  
  // Análise de frame - sem depender de state
  const analyzeFrame = useCallback(async () => {
    try {
      const imageData = await captureFrame();
      if (!imageData) return;
      
      // Enviar para análise
      const response = await fetch(`${API_BASE_URL}/api/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const data = await response.json();
      
      if (data.success && data.gameState?.heroCards?.length >= 2) {
        const { heroCards, board, potSize } = data.gameState;
        onDetectRef.current({
          heroCards,
          board: board || [],
          potSize: potSize || 0
        });
        setLastDetection(`${heroCards.join(', ')}${board?.length ? ' | Board: ' + board.join(', ') : ''}`);
      } else if (data.needsManualInput) {
        setLastDetection('Cartas não detectadas - use modo manual');
      }
      
      setFramesAnalyzed(prev => prev + 1);
      
    } catch (err) {
      console.error('Frame analysis error:', err);
    }
  }, [captureFrame]);
  
  // Iniciar monitoramento
  const startMonitoring = useCallback(async () => {
    const success = await startCapture();
    if (!success) return;
    
    setFramesAnalyzed(0);
    setLastDetection(null);
    
    // Loop de análise a cada 1 segundo
    intervalRef.current = setInterval(analyzeFrame, 1000);
    
    // Primeira análise após 500ms
    setTimeout(analyzeFrame, 500);
    
  }, [startCapture, analyzeFrame]);
  
  // Parar monitoramento
  const stopMonitoring = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    await stopCapture();
    setFramesAnalyzed(0);
  }, [stopCapture]);
  
  // Parar quando isCapturing mudar para false
  useEffect(() => {
    if (!isCapturing && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isCapturing]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  
  return (
    <div className="space-y-4">
      {/* Info do ambiente */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isNative ? '📱' : '💻'}</span>
          <div>
            <p className="text-blue-300 font-medium">
              {isNative ? 'App Android Nativo' : 'Navegador Web'}
            </p>
            <p className="text-blue-200 text-sm">
              {isNative ? 'Usando plugin nativo de captura' : supportReason}
            </p>
          </div>
        </div>
      </div>
      
      {/* Aviso de não suportado */}
      {!isSupported && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-xl p-4">
          <p className="text-yellow-300">
            ⚠️ Screen Capture não disponível: {supportReason}
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            {isNative 
              ? 'Seu dispositivo pode não suportar screen capture.'
              : 'Use Chrome, Edge ou Firefox com HTTPS, ou baixe o App Android.'
            }
          </p>
        </div>
      )}
      
      {/* Erros */}
      {captureError && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {captureError}</p>
        </div>
      )}
      
      {/* Botões de controle */}
      <div className="flex gap-4">
        {!isCapturing ? (
          <Button 
            onClick={startMonitoring}
            disabled={!isSupported}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-xl py-8 px-10 font-bold rounded-xl shadow-xl"
          >
            ▶️ Iniciar Monitoramento Automático
          </Button>
        ) : (
          <Button 
            onClick={stopMonitoring}
            variant="destructive"
            className="text-xl py-8 px-10 font-bold rounded-xl"
          >
            ⏹️ Parar Monitoramento
          </Button>
        )}
      </div>
      
      {/* Status do monitoramento */}
      {isCapturing && (
        <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-300 font-medium">Monitorando...</span>
            <span className="text-gray-400">{framesAnalyzed} frames analisados</span>
          </div>
          {lastDetection && (
            <div className="mt-2 pt-2 border-t border-green-700">
              <span className="text-gray-400 text-sm">Última detecção: </span>
              <span className="text-green-200 text-sm">{lastDetection}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Instruções */}
      <div className="text-gray-400 text-sm space-y-1">
        <p>📌 <strong>Como funciona:</strong></p>
        {isNative ? (
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Toque em &quot;Iniciar&quot; e permita o acesso à tela</li>
            <li>Abra seu app de poker</li>
            <li>O app detectará as cartas automaticamente a cada 1 segundo</li>
            <li>Volte ao app para ver a recomendação</li>
          </ul>
        ) : (
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Clique em &quot;Iniciar&quot; e selecione a janela do poker</li>
            <li>As cartas serão detectadas automaticamente</li>
            <li>A análise aparece em tempo real</li>
          </ul>
        )}
      </div>
    </div>
  );
}
