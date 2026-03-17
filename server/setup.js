const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4';
const DIR = path.join(__dirname, 'public/movenet');

if (fs.existsSync(path.join(DIR, 'model.json'))) {
  console.log('모델 이미 존재함, 스킵.');
  process.exit(0);
}

fs.mkdirSync(DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => https.get(u, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) return get(res.headers.location);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${u}`));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
    get(url);
  });
}

(async () => {
  console.log('MoveNet Lightning 모델 다운로드 중...');
  const modelUrl = `${BASE}/model.json?tfjs-format=file`;
  await download(modelUrl, path.join(DIR, 'model.json'));

  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'model.json'), 'utf8'));
  const shards = manifest.weightsManifest.flatMap(w => w.paths);
  for (const shard of shards) {
    process.stdout.write(`  ${shard}...`);
    await download(`${BASE}/${shard}?tfjs-format=file`, path.join(DIR, shard));
    console.log(' 완료');
  }
  console.log('모델 준비 완료!');
})().catch(e => { console.error(e.message); process.exit(1); });
