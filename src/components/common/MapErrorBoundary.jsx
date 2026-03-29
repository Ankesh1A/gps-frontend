import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Map crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-2xl border border-red-500/30 gap-4">
          <div className="p-3 bg-red-500/20 rounded-full">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center px-6">
            <p className="text-white font-bold mb-1">Map crashed</p>
            <p className="text-slate-400 text-xs font-mono mb-4">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> Reload Map
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}