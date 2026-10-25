const { AsyncLocalStorage } = require('async_hooks');

// Carries per-request data (currently the request id) through async calls so
// logs and outgoing service calls can pick it up without passing it around.
const storage = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return storage.run(context, callback);
}

function getRequestId() {
  return storage.getStore()?.requestId;
}

module.exports = { runWithRequestContext, getRequestId };
