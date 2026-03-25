import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white p-6 overflow-auto">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <div className="bg-black/50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
            <p className="text-red-400 font-bold">{this.state.error?.toString()}</p>
            <p className="mt-4 text-gray-300">{this.state.errorInfo?.componentStack}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 bg-white text-red-900 px-4 py-2 rounded font-bold"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
