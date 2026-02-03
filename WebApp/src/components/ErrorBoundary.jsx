import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-white p-8 font-mono overflow-auto">
                    <h1 className="text-2xl text-red-500 mb-4">Something went wrong.</h1>
                    <div className="bg-gray-900 p-4 rounded border border-gray-700">
                        <p className="font-bold text-yellow-500 mb-2">{this.state.error?.toString()}</p>
                        <details className="whitespace-pre-wrap text-xs text-gray-400">
                            {this.state.errorInfo?.componentStack}
                        </details>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
                    >
                        Reload App
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
