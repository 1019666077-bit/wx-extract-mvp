import { handleRequest } from "./app.js";

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
