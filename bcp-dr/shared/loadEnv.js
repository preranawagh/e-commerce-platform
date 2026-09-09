const path = require('path');
const dotenv = require('dotenv');

function loadEnv(serviceRootDir) {
  dotenv.config({ path: path.join(serviceRootDir, '.env') });
  dotenv.config({ path: path.resolve(serviceRootDir, '../../.env') });
}

module.exports = { loadEnv };
