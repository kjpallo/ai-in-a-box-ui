const assert = require('node:assert/strict');

function createApp(handlers, methods = ['get', 'post', 'patch', 'delete']) {
  return methods.reduce((app, method) => {
    app[method] = (route, handler) => {
      handlers.set(`${method.toUpperCase()} ${route}`, handler);
    };
    return app;
  }, {});
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    redirect(url) {
      this.body = { redirect: url };
      return this;
    }
  };
}

async function request(handlers, method, route, body = {}, params = {}, query = {}, reqExtras = {}) {
  const handler = handlers.get(`${method} ${route}`);
  assert.ok(handler, `Missing handler: ${method} ${route}`);

  const req = {
    body,
    params,
    query,
    headers: {},
    ...reqExtras
  };
  const res = createResponse();
  await handler(req, res);
  return res;
}

async function requestMultipart(handlers, route, file) {
  const handler = handlers.get(`POST ${route}`);
  assert.ok(handler, `Missing handler: POST ${route}`);

  const boundary = `test-boundary-${Date.now()}`;
  const rawBody = makeMultipartBody(boundary, file);
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(rawBody.length)
    },
    rawBody
  };
  const res = createResponse();
  await handler(req, res);
  return res;
}

function makeMultipartBody(boundary, file) {
  const parts = [];

  if (file.fileName) {
    parts.push(
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${file.fieldName || 'sourceFile'}"; filename="${file.fileName}"\r\n`),
      Buffer.from(`Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content || '')),
      Buffer.from('\r\n')
    );
  }

  Object.entries(file.fields || {}).forEach(([name, value]) => {
    parts.push(
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`),
      Buffer.from(String(value)),
      Buffer.from('\r\n')
    );
  });

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

module.exports = {
  createApp,
  createResponse,
  makeMultipartBody,
  request,
  requestMultipart
};
