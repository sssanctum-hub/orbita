exports.handler = async (event, context) => (await import("./index.mjs")).handler(event, context);
