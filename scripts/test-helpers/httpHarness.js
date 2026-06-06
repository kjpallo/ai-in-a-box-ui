const assert = require('node:assert/strict');

function createApp(handlers, methods = ['get', 'post', 'patch', 'delete']) {
  return methods.reduce((app, method) => {
    app[method] = (route, ...routeHandlers) => {
      handlers.set(`${method.toUpperCase()} ${route}`, composeHandlers(routeHandlers));
    };
    return app;
  }, {});
}

function composeHandlers(routeHandlers) {
  const handlers = routeHandlers.flat().filter(Boolean);

  return async (req, res) => {
    let index = -1;
    async function run(nextIndex) {
      if (nextIndex <= index) throw new Error('next() called multiple times.');
      index = nextIndex;
      const handler = handlers[nextIndex];
      if (!handler) return;

      if (handler.length >= 3) {
        let nextPromise = null;
        await handler(req, res, () => {
          nextPromise = run(nextIndex + 1);
          return nextPromise;
        });
        if (nextPromise) await nextPromise;
        return;
      }

      await handler(req, res);
    }

    await run(0);
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[String(name).toLowerCase()];
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
