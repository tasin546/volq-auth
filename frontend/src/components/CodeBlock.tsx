'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'text', title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-obsidian-border bg-obsidian-void my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-obsidian-card/60 border-b border-obsidian-border text-xs">
        <span className="font-mono text-[11px] text-text-muted">{title || language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-brand transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-text-primary overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
