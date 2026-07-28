const { spawnSync } = require('child_process');
const electron = require('electron');

function run() {
  while (true) {
    const result = spawnSync(electron, ['.'], { stdio: 'inherit' });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

run();
