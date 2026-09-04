import { CredentialMatch } from '../types/index.js';

interface PatternRule {
  type: string;
  regex: RegExp;
  severity: 'high' | 'medium' | 'info';
  mask: (text: string) => string;
}

const PATTERNS: PatternRule[] = [
  {
    type: 'OpenAI API Key',
    regex: /\b(sk-[a-zA-Z0-9_\-]{20,48})\b/g,
    severity: 'high',
    mask: (t) => t.slice(0, 5) + '...' + t.slice(-4)
  },
  {
    type: 'Anthropic API Key',
    regex: /\b(sk-ant-[a-zA-Z0-9_\-]{30,80})\b/g,
    severity: 'high',
    mask: (t) => t.slice(0, 8) + '...' + t.slice(-4)
  },
  {
    type: 'Google API Key',
    regex: /\b(AIza[0-9A-Za-z_\-]{35})\b/g,
    severity: 'high',
    mask: (t) => t.slice(0, 6) + '...' + t.slice(-4)
  },
  {
    type: 'GitHub Token',
    regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,40}|github_pat_[A-Za-z0-9_]{40,82})\b/g,
    severity: 'high',
    mask: (t) => t.slice(0, 6) + '...' + t.slice(-4)
  },
  {
    type: 'AWS Access Key',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    severity: 'high',
    mask: (t) => t.slice(0, 4) + '...' + t.slice(-4)
  },
  {
    type: 'JSON Web Token (JWT)',
    regex: /\b(eyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+)\b/g,
    severity: 'high',
    mask: (t) => t.slice(0, 10) + '...' + t.slice(-6)
  },
  {
    type: 'Bearer Token',
    regex: /(Bearer\s+)([a-zA-Z0-9_\-\.]{20,})/gi,
    severity: 'high',
    mask: (t) => t.replace(/(Bearer\s+)(.{4}).+(.{4})$/i, '$1$2...$3')
  },
  {
    type: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    severity: 'high',
    mask: () => '-----BEGIN PRIVATE KEY-----\n[... REDACTED ...]\n-----END PRIVATE KEY-----'
  },
  {
    type: 'Password in Variable/Assignment',
    regex: /(?:password|passwd|secret|api_key|token|auth_token)\s*[:=]\s*["']([^"'\s]{6,})["']/gi,
    severity: 'medium',
    mask: (t) => t.replace(/(:\s*["'])([^"']+)(["'])/, '$1***REDACTED***$3')
  }
];

export function scanForCredentials(content: string): CredentialMatch[] {
  if (!content || typeof content !== 'string') return [];
  const matches: CredentialMatch[] = [];

  for (const rule of PATTERNS) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(content)) !== null) {
      const matchedText = match[0];
      matches.push({
        type: rule.type,
        matchedText,
        maskedText: rule.mask(matchedText),
        startIndex: match.index,
        endIndex: match.index + matchedText.length,
        severity: rule.severity
      });
    }
  }

  return matches.sort((a, b) => a.startIndex - b.startIndex);
}
