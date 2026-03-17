export default {
  build: { outDir: 'dist' },
  server: {
    proxy: {
      '/api': 'http://localhost:2228',
      '/ws':  { target: 'ws://localhost:2228', ws: true },
    }
  }
};
