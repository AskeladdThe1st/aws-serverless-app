import { useState, useEffect } from 'react';

const STORAGE_KEY = 'freemium-tracker';
const GUEST_LIMIT = 7;
const LOGGED_IN_BONUS = 2;
const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface FreemiumData {
  problemsSolved: number;
  lastReset: number;
}

export const useFreemium = (isAuthenticated: boolean) => {
  const [problemsSolved, setProblemsSolved] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);

  const limit = isAuthenticated ? GUEST_LIMIT + LOGGED_IN_BONUS : GUEST_LIMIT;

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: FreemiumData = JSON.parse(stored);
      const now = Date.now();
      
      // Reset if 24 hours have passed
      if (now - data.lastReset > RESET_INTERVAL) {
        const newData: FreemiumData = { problemsSolved: 0, lastReset: now };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        setProblemsSolved(0);
      } else {
        setProblemsSolved(data.problemsSolved);
      }
    } else {
      // Initialize
      const newData: FreemiumData = { problemsSolved: 0, lastReset: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    }
  }, []);

  useEffect(() => {
    setIsLimitReached(problemsSolved >= limit);
  }, [problemsSolved, limit]);

  const incrementProblems = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: FreemiumData = JSON.parse(stored);
      const newCount = data.problemsSolved + 1;
      const newData: FreemiumData = { 
        problemsSolved: newCount, 
        lastReset: data.lastReset 
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setProblemsSolved(newCount);
    }
  };

  const resetCount = () => {
    const newData: FreemiumData = { problemsSolved: 0, lastReset: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    setProblemsSolved(0);
  };

  return {
    problemsSolved,
    limit,
    remaining: Math.max(0, limit - problemsSolved),
    isLimitReached,
    incrementProblems,
    resetCount,
    progress: (problemsSolved / limit) * 100,
  };
};
