import React from 'react';
import {
  FileCode,
  Terminal,
  Database,
  Globe,
  Bot,
  Lock,
  Zap,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { SkillDefinition } from '../types/permissions.js';

interface SkillBadgeProps {
  skill: SkillDefinition;
  isSessionGranted?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const SkillBadge: React.FC<SkillBadgeProps> = ({
  skill,
  isSessionGranted = false,
  onClick,
  showDetails = true,
  size = 'md'
}) => {
  const isAi = skill.category === 'ai_operation';

  // Render matching capability icon
  const renderIcon = () => {
    const iconProps = { size: size === 'sm' ? 12 : 14, className: 'skill-icon' };
    switch (skill.id) {
      case 'workspace_files':
        return <FileCode {...iconProps} />;
      case 'terminal_execution':
        return <Terminal {...iconProps} />;
      case 'ide_memory':
        return <Database {...iconProps} />;
      case 'network_access':
        return <Globe {...iconProps} />;
      case 'browser_agent':
        return <Bot {...iconProps} />;
      default:
        return <Zap {...iconProps} />;
    }
  };

  // Status indicator
  const renderStatusDot = () => {
    if (skill.status === 'executing') {
      return (
        <span className="skill-status-indicator executing" title="Currently actively executing">
          <span className="status-radar-ring" />
          <span className="status-dot" />
        </span>
      );
    }
    if (skill.status === 'blocked' || skill.level === 'deny') {
      return (
        <span className="skill-status-indicator blocked" title="Blocked by policy">
          <span className="status-dot" />
        </span>
      );
    }
    return (
      <span className="skill-status-indicator idle" title="Ready & idle">
        <span className="status-dot" />
      </span>
    );
  };

  // Level / grant label
  const renderLevelPill = () => {
    if (skill.level === 'deny') {
      return (
        <span className="skill-level-pill deny">
          <Lock size={10} />
          <span>Blocked</span>
        </span>
      );
    }
    if (isSessionGranted) {
      return (
        <span className="skill-level-pill session">
          <CheckCircle2 size={10} />
          <span>Session OK</span>
        </span>
      );
    }
    if (skill.level === 'ask') {
      return (
        <span className="skill-level-pill ask">
          <HelpCircle size={10} />
          <span>Ask JIT</span>
        </span>
      );
    }
    return (
      <span className="skill-level-pill allow">
        <CheckCircle2 size={10} />
        <span>Allowed</span>
      </span>
    );
  };

  return (
    <div
      className={`cortex-skill-badge ${isAi ? 'category-ai' : 'category-workspace'} size-${size} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={`${skill.name} - ${skill.description} (Status: ${skill.status.toUpperCase()})`}
    >
      <div className="badge-left">
        {renderStatusDot()}
        <span className="skill-icon-wrapper">{renderIcon()}</span>
        <span className="skill-name">{skill.name}</span>
      </div>

      {showDetails && (
        <div className="badge-right">
          {renderLevelPill()}
        </div>
      )}
    </div>
  );
};
