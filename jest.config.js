module.exports = {
    preset: 'ts-jest',
    collectCoverage: true,
    coverageDirectory: 'coverage',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest'
    }
  };