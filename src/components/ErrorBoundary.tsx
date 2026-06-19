import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Attempt to clear local storage queues since a corrupted data element might be the root cause
    try {
      localStorage.removeItem('tiktok_radio_queue');
      localStorage.removeItem('tiktok_radio_index');
    } catch (e) {
      console.warn('Could not clear local storage during reset:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="youtube-radio-error-boundary" className="bg-[#0e0e13] border border-red-500/30 rounded-2xl p-6 text-center select-none flex flex-col items-center justify-center gap-4 min-h-[260px] relative overflow-hidden">
          <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-500">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              {this.props.fallbackTitle || 'Error en el Panel de Radio'}
            </h3>
            <p className="text-xs text-gray-400">
              Ocurrió un error inesperado al cargar la cola de reproducción o sincronizar el reproductor de YouTube.
            </p>
            {this.state.error && (
              <p className="text-[10px] text-red-400 font-mono max-h-16 overflow-y-auto bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap text-left break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            id="btn-error-boundary-reset"
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-[#ff0050] hover:bg-[#ff0050]/90 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer border-none"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reiniciar y Limpiar Cola
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
