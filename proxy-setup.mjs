// Dev-only: Node's global fetch (undici) ignores HTTPS_PROXY by default.
// This preload wires undici's ProxyAgent so Supabase/Next server calls go through the local proxy.
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
  setGlobalDispatcher(new ProxyAgent(proxy));
  // eslint-disable-next-line no-console
  console.log(`[proxy-setup] undici dispatcher routed through ${proxy}`);
}
