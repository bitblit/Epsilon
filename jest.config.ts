import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'artifacts/coverage',
  roots: ['src'],
  maxConcurrency: 10,
  /*
    This is recommended to catch files you are not testing at all, but will
    need tweaks since I don't want to test index files, etc.  A job
    for a different day
    collectCoverageFrom: ['./src/**'],
     */
  coverageThreshold: {
    global: {
      lines: 10,
    },
  },
  verbose: true,
};

export default config;
