// src/utils/performance.js
import { memo } from 'react';

// Function to memoize components with proper comparison
export function memoizeComponent(component, customCompare) {
  return memo(
    component,
    customCompare || ((prevProps, nextProps) => {
      // Default deep comparison of top-level props
      if (!prevProps || !nextProps) return false;
      
      const prevKeys = Object.keys(prevProps);
      const nextKeys = Object.keys(nextProps);
      
      if (prevKeys.length !== nextKeys.length) return false;
      
      return prevKeys.every(key => {
        // Special handling for functions
        if (typeof prevProps[key] === 'function' && typeof nextProps[key] === 'function') {
          return true; // Consider functions equal to avoid unnecessary rerenders
        }
        
        if (Array.isArray(prevProps[key]) && Array.isArray(nextProps[key])) {
          // For arrays, check length and then content if needed
          if (prevProps[key].length !== nextProps[key].length) return false;
          
          // For simple arrays of primitives
          if (typeof prevProps[key][0] !== 'object') {
            return prevProps[key].every((item, i) => item === nextProps[key][i]);
          }
          
          // For arrays of objects, a shallow check might be enough here
          return true;
        }
        
        return prevProps[key] === nextProps[key];
      });
    })
  );
}