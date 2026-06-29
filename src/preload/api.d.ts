import type { OpenStudyAPI } from './index';

declare global {
  interface Window {
    api: OpenStudyAPI;
  }
}

export {};
