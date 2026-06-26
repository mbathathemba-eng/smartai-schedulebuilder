import { useState, useEffect } from 'react';
import { X, Key, Save, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  onSaveGeminiKey: (key: string) => void;
}

export default function SettingsDrawer({ isOpen, onClose, geminiApiKey, onSaveGeminiKey }: SettingsDrawerProps) {
  const [keyInput, setKeyInput] = useState(geminiApiKey);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setKeyInput(geminiApiKey);
  }, [geminiApiKey]);

  const handleSave = () => {
    try {
      onSaveGeminiKey(keyInput.trim());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleClear = () => {
    setKeyInput('');
    onSaveGeminiKey('');
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Gemini API Key Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">Google Gemini API</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Connect Jerald AI to Gemini 2.5 Flash
                </p>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-3">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIza..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />

              {/* Status indicator */}
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">API key saved</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Failed to save</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!keyInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Key
                </button>
                {geminiApiKey && (
                  <button
                    onClick={handleClear}
                    className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Help link */}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Get a Gemini API key from Google AI Studio
            </a>
          </section>

          {/* Current Status */}
          <section className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">AI Provider Status</h4>
            <div className="flex items-center gap-2">
              {geminiApiKey ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">Gemini 2.5 Flash connected</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">Local simulation mode (no API key)</span>
                </>
              )}
            </div>
          </section>

          {/* Privacy Notice */}
          <section className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Privacy & Data</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your API key is stored locally in your browser. Messages are sent directly to Google's API and are not stored on our servers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
