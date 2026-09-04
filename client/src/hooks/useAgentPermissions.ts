import { useContext } from 'react';
import { PermissionsContext } from '../context/PermissionsContext.js';

export const useAgentPermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('useAgentPermissions must be used within a PermissionsProvider');
  }
  return context;
};
