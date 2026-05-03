export interface Result {
  url: string;
  title: string;
  snippet: string;
}

export interface MergedResult {
  url: string;
  title: string;
  snippet: string;
  frequency: number;
  bestPosition: number;
}

export interface EngineAdapter {
  name: string;
  search: (query: string, numResults: number) => Promise<Result[]>;
}
