module.exports = {
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [
    "/node_modules/(?!@exodus|html-encoding-sniffer|jsdom|whatwg-url|whatwg-encoding|iconv-lite|@asamuzakjp)"
  ],
  transform: {
    '^.+\\.[t|j]sx?$': 'babel-jest'
  }
};
