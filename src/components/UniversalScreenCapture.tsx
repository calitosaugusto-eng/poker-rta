'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useScreenCapture } from '@/lib/native-screen-capture';
import { API_BASE_URL } from '@/lib/api-config';

interface UniversalScreenCaptureProps {
  onCapture: (imageData: string) => void;
}

export default function UniversalScreenCapture({ onCapture }: UniversalScreenCaptureProps) {
  const {
    isSupported,
    isNative,
    supportReason,
    isCapturing,
    error: captureError,
    startCapture,
    captureFrame,
    stopCapture,
  } = useScreenCapture();

  const [localError, setLocalError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const error = localError || captureError;

  const handleStartCapture = useCallback(async () => {
    setLocalError(null);
    setLastResult(null);
    
    console.log('[ScreenCapture] Iniciando captura...');
    const success = await startCapture();
    console.log('[ScreenCapture] Resultado:', success);
    
    if (!success) {
      setLocalError('Falha ao iniciar captura. Tente novamente.');
    }
  }, [startCapture]);

  const handleCaptureFrame = useCallback(async () => {
    setLocalError(null);
    setIsAnalyzing(true);
    setLastResult(null);

    try {
      console.log('[ScreenCapture] Capturando frame...');
      const imageData = await captureFrame();
      
      if (!imageData) {
        console.log('[ScreenCapture] Nenhum frame capturado');
        setLocalError('Nenhum frame capturado. Aguarde um momento e tente novamente.');
        return;
      }
      
      console.log('[ScreenCapture] Frame capturado, tamanho:', imageData.length);
      
      // Enviar para análise
      console.log('[ScreenCapture] Enviando para API:', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/api/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const data = await response.json();
      console.log('[ScreenCapture] Resposta da API:', data);

      if (data.success && data.gameState?.heroCards?.length >= 2) {
        const { heroCards, board } = data.gameState;
        setLastResult(`✅ Detectado: ${heroCards.join(', ')}${board?.length ? ' | Board: ' + board.join(', ') : ''}`);
        onCapture(imageData);
      } else {
        setLastResult('⚠️ ' + (data.message || 'Cartas não detectadas'));
      }
      
    } catch (e: any) {
      console.error('[ScreenCapture] Erro:', e);
      setLocalError(`Erro: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [captureFrame, onCapture]);

  const handleStopCapture = useCallback(async () => {
    console.log('[ScreenCapture] Parando captura...');
    await stopCapture();
    setLastResult(null);
  }, [stopCapture]);

  return (
    <div className="space-y-4">
      {/* Indicador de ambiente */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-3">
          <span className={`w-4 h-4 rounded-full ${isNative ? 'bg-green-500' : 'bg-blue-500'} ${isCapturing ? 'animate-pulse' : ''}`} />
          <div>
            <p className="text-white font-medium">
              {isNative ? '📱 App Android Nativo' : '💻 Navegador Web'}
            </p>
            <p className="text-gray-400 text-sm">{supportReason}</p>
          </div>
        </div>
      </div>

      {/* Aviso de suporte */}
      {!isSupported && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-xl p-4">
          <p className="text-yellow-300">
            ⚠️ Screen Capture não disponível: {supportReason}
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            {isNative
              ? 'O plugin nativo não foi carregado corretamente.'
              : 'Use Chrome/Edge Desktop ou instale o app Android.'}
          </p>
        </div>
      )}

      {/* Status de captura ativa */}
      {isCapturing && (
        <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-300 font-bold text-lg">✅ Captura Ativa!</span>
          </div>
          <p className="text-green-200 text-sm mt-2">
            {isNative 
              ? 'Agora clique em "Analisar Frame" para detectar as cartas'
              : 'Selecione a janela do poker e clique em "Analisar Frame"'}
          </p>
          {isNative && (
            <p className="text-green-200/70 text-xs mt-2">
              💡 Você pode abrir o app de poker e voltar aqui para analisar
            </p>
          )}
        </div>
      )}

      {/* Erros */}
      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}

      {/* Resultado da última análise */}
      {lastResult && (
        <div className={`rounded-xl p-4 border-2 ${
          lastResult.startsWith('✅') 
            ? 'bg-green-900/30 border-green-600' 
            : 'bg-yellow-900/30 border-yellow-600'
        }`}>
          <p className={lastResult.startsWith('✅') ? 'text-green-300' : 'text-yellow-300'}>
            {lastResult}
          </p>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 flex-wrap">
        {!isCapturing ? (
          <Button
            onClick={handleStartCapture}
            disabled={!isSupported}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg py-6 px-8 font-bold rounded-xl"
          >
            📷 Capturar Tela
          </Button>
        ) : (
          <>
            <Button
              onClick={handleCaptureFrame}
              disabled={isAnalyzing}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-lg py-6 px-8 font-bold rounded-xl"
            >
              {isAnalyzing ? '🔄 Analisando...' : '🎯 Analisar Frame'}
            </Button>
            <Button
              onClick={handleStopCapture}
              variant="destructive"
              className="text-lg py-6 px-8 font-bold rounded-xl"
            >
              ⏹️ Parar
            </Button>
          </>
        )}
      </div>

      {/* Analisando */}
      {isAnalyzing && (
        <div className="bg-blue-900/30 border-2 border-blue-600 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-blue-300">Analisando imagem e detectando cartas...</span>
          </div>
        </div>
      )}
      
      {/* Instruções */}
      {isNative && !isCapturing && (
        <div className="text-gray-400 text-sm space-y-2">
          <p className="font-medium text-white">📌 Como usar:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Toque em &quot;Capturar Tela&quot;</li>
            <li>Escolha o app de poker na lista</li>
            <li>Toque em &quot;Analisar Frame&quot; para detectar as cartas</li>
          </ol>
        </div>
      )}
    </div>
  );
}
